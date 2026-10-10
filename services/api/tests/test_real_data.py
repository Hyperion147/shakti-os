"""Real-data contracts: privacy, ownership, mapping, and repeatable seed."""
import importlib.util
from pathlib import Path
from datetime import datetime, timedelta, timezone

import pytest
from starlette.websockets import WebSocketDisconnect

from test_auth import client, _citizen_payload  # reuse isolated DB fixture
from shaktios_api import auth, main
from shaktios_api.auth import AuthError, AuthUser
from shaktios_api.database import SessionLocal
from shaktios_api.event_store import EventRecord
from shaktios_api.incident_store import IncidentRecord
from shaktios_api.timeline_store import TimelineEntryRecord

HEADERS = {"Authorization": "Bearer citizen-token"}


def authenticate(monkeypatch, user_id="citizen-abc", role="authenticated"):
    monkeypatch.setattr(auth, "verify_token", lambda _: AuthUser(id=user_id, role=role))


def test_venue_wire_contract(client):
    venue = client.get("/venues").json()[0]
    assert venue["locationLabel"] == "Gate 4"
    assert "startTime" in venue and "endTime" in venue
    assert venue["helpline"] is None
    assert venue["zones"][0]["id"] == "gate_4"
    assert client.get("/venues/missing").status_code == 404


def test_my_reports_return_database_status_and_coordinates(client, monkeypatch):
    authenticate(monkeypatch)
    response = client.post("/events", json=_citizen_payload(), headers=HEADERS)
    assert response.status_code == 201
    report_id = response.json()["id"]
    incident_id = response.json()["incident_id"]
    assert incident_id
    report = client.get(f"/me/reports/{report_id}", headers=HEADERS).json()
    assert report["report_status"] == "received"
    assert report["incident_status"] == "DETECTED"
    assert report["venue_name"] == "Test Venue"
    with SessionLocal() as db:
        incident = db.get(IncidentRecord, incident_id)
        assert incident.latitude == 23.3441
        incident.status = "RESOLVED"
        db.commit()
    assert client.get("/me/reports", headers=HEADERS).json()[0]["report_status"] == "resolved"


def test_reports_filter_ownership_before_limit_and_detail(client, monkeypatch):
    authenticate(monkeypatch, "owner")
    own = client.post("/events", json=_citizen_payload(), headers=HEADERS).json()
    authenticate(monkeypatch, "other")
    for _ in range(3):
        assert client.post("/events", json=_citizen_payload(), headers=HEADERS).status_code == 201
    assert client.get(f"/me/reports/{own['id']}", headers=HEADERS).status_code == 404
    authenticate(monkeypatch, "owner")
    result = client.get("/me/reports?limit=1", headers=HEADERS).json()
    assert [item["id"] for item in result] == [own["id"]]
    assert client.get("/me/reports?offset=1", headers=HEADERS).json() == []
    assert client.get("/me/reports").status_code == 401


def test_citizen_cannot_read_operator_data_or_change_status(client, monkeypatch):
    authenticate(monkeypatch)
    for path in ["/events", "/incidents", "/incidents/id", "/incidents/id/events", "/incidents/id/timeline", "/integrations"]:
        assert client.get(path).status_code == 401
        assert client.get(path, headers=HEADERS).status_code == 403
    for path, body in [("/incidents/id/status", {"status": "ASSESSING"}), ("/incidents/id/actions", {"type": "notify_operator"})]:
        assert client.post(path, json=body, headers=HEADERS).status_code == 403


def test_operator_allowlist_requires_verified_identity(monkeypatch):
    monkeypatch.setenv("OPERATOR_EMAILS", "operator@example.com")
    monkeypatch.setenv("OPERATOR_USER_IDS", "trusted-id")
    assert auth.is_operator(AuthUser(id="trusted-id"))
    assert auth.is_operator(AuthUser(id="x", email="OPERATOR@example.com"))
    assert not auth.is_operator(AuthUser(id="citizen", role="authenticated"))


def test_public_overview_redacts_private_payloads_and_identity(client, monkeypatch):
    authenticate(monkeypatch)
    client.post("/events", json=_citizen_payload(), headers=HEADERS)
    overview = client.get("/public/overview").json()
    assert overview["event_count"] == 1
    assert set(overview["recent_events"][0]) == {"id", "type", "source", "location", "timestamp"}
    assert "factors" not in overview["incidents"][0]
    assert "reporter_id" not in str(overview)
    assert "Crowd blocking entrance" not in str(overview)


def test_unknown_zone_and_forged_incident_id_are_not_trusted(client, monkeypatch):
    authenticate(monkeypatch)
    bad = _citizen_payload(location="unknown-zone")
    assert client.post("/events", json=bad, headers=HEADERS).status_code == 422
    good = _citizen_payload(incident_id="forged")
    response = client.post("/events", json=good, headers=HEADERS)
    assert response.status_code == 201
    assert response.json()["incident_id"] != "forged"


def test_websocket_rejects_bad_and_non_operator_tokens(client, monkeypatch):
    for role in ["invalid", "authenticated"]:
        def verify(_):
            if role == "invalid":
                raise AuthError()
            return AuthUser(id="citizen", role=role)
        monkeypatch.setattr(main, "verify_token", verify)
        with client.websocket_connect("/ws/events") as ws:
            ws.send_json({"type": "authenticate", "token": "untrusted"})
            with pytest.raises(WebSocketDisconnect) as error:
                ws.receive_json()
            assert error.value.code == 1008


def test_seed_is_atomic_repeatable_and_never_invents_a_citizen(client):
    path = Path(__file__).resolve().parents[3] / "scripts" / "seed_supabase.py"
    spec = importlib.util.spec_from_file_location("seed_supabase", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with SessionLocal.begin() as db:
        result = module.seed(db, datetime.now(timezone.utc))
        assert result["incidents"] == 11
        assert result["events"] == 77
        assert result["timeline"] == 87
    with SessionLocal.begin() as db:
        before = (db.query(EventRecord).count(), db.query(IncidentRecord).count(), db.query(TimelineEntryRecord).count())
        rerun = module.seed(db, datetime.now(timezone.utc) + timedelta(days=1))
        assert all(value == 0 for value in rerun.values())
        assert before == (db.query(EventRecord).count(), db.query(IncidentRecord).count(), db.query(TimelineEntryRecord).count())
        assert not db.query(EventRecord).filter(EventRecord.reporter_id.is_not(None)).count()
        assert db.query(IncidentRecord).filter(IncidentRecord.severity == "CRITICAL").count() > 0
        assert db.query(IncidentRecord).filter(IncidentRecord.status == "RESOLVED").count() > 0


def test_supabase_pooler_disables_named_prepared_statements(monkeypatch):
    from shaktios_api import database
    monkeypatch.setenv("DATABASE_URL", "postgresql://unused@localhost/unused")
    options = {}
    def capture_engine(url, **kwargs):
        options.update(kwargs)
        return None
    monkeypatch.setattr(database, "create_engine", capture_engine)
    database.build_engine()
    assert options["connect_args"] == {"prepare_threshold": None}


def test_dashboard_observation_requires_operator_even_for_citizen_type(client, monkeypatch):
    authenticate(monkeypatch)
    payload = _citizen_payload(source="dashboard_observation")
    assert client.post("/events", json=payload, headers=HEADERS).status_code == 403
    authenticate(monkeypatch, "operator-id", "operator")
    assert client.post("/events", json=payload, headers=HEADERS).status_code == 201
