"""Hackspire26's five Ranchi nodes are additive, labelled and repeatable."""
import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import pytest

from test_auth import client  # isolated SQLite database + registered test venue
from shaktios_api.database import SessionLocal
from shaktios_api.event_store import EventRecord
from shaktios_api.incident_store import IncidentRecord
from shaktios_api.timeline_store import TimelineEntryRecord
from shaktios_api.venue_store import VenueRecord

VENUE_ID = "venue-hackspire26-ranchi"
NOW = datetime(2026, 10, 2, 12, tzinfo=timezone.utc)


@pytest.fixture
def seed_module():
    path = Path(__file__).resolve().parents[3] / "scripts" / "seed_supabase.py"
    spec = importlib.util.spec_from_file_location("hackspire_seed", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_five_ranchi_nodes_have_active_incidents_and_labelled_evidence(client, seed_module):
    with SessionLocal.begin() as db:
        result = seed_module.seed(db, NOW, venue_id=VENUE_ID)
        assert result == {"venues": 1, "zones": 5, "incidents": 5, "events": 35, "timeline": 39}
    response = client.get(f"/venues/{VENUE_ID}")
    assert response.status_code == 200
    venue = response.json()
    assert "Hackspire26" in venue["name"] and "Seed Scenario" in venue["name"]
    assert venue["helpline"] is None
    assert venue["startTime"] is None and venue["endTime"] is None
    assert len(venue["zones"]) == 5
    zone_ids = {zone["id"] for zone in venue["zones"]}
    with SessionLocal() as db:
        incidents = db.query(IncidentRecord).filter(IncidentRecord.location.in_(zone_ids)).all()
        assert len(incidents) == 5
        assert {item.status for item in incidents} == {"DETECTED", "ASSESSING", "RESPONDING"}
        assert {item.severity for item in incidents} == {"LOW", "MEDIUM", "HIGH"}
        for zone in venue["zones"]:
            assert 23.30 < zone["latitude"] < 23.50
            assert 85.25 < zone["longitude"] < 85.50
            incident = db.get(IncidentRecord, seed_module.stable_id(zone["id"]))
            assert (incident.latitude, incident.longitude) == (zone["latitude"], zone["longitude"])
            evidence = db.query(EventRecord).filter(EventRecord.incident_id == incident.id).all()
            assert len(evidence) == 7
            for event in evidence:
                assert event.reporter_id is None
                assert event.source.startswith("seed_")
                assert event.payload["is_seeded"] is True
                assert event.payload["venue_event_id"] == VENUE_ID
                assert event.payload["seed_batch"] == seed_module.BATCH
                assert "Hackspire26 seed observation" in event.payload["description"]


def test_new_nodes_preserve_existing_records_and_skip_operator_edited_seed_rows(client, seed_module):
    with SessionLocal.begin() as db:
        for fixture in seed_module.VENUES:
            if fixture["id"] != VENUE_ID:
                seed_module.seed(db, NOW, venue_id=fixture["id"])
        # A pre-existing citizen record must never be replaced or attributed to a fixture.
        db.add(EventRecord(
            id="existing-citizen-event", type="citizen_report", source="citizen_app",
            timestamp=NOW, location="gate_4", confidence=0.7,
            payload={"description": "Existing observation", "venue_event_id": "venue-test"},
            reporter_id="existing-citizen", incident_id=None,
        ))
    with SessionLocal.begin() as db:
        before = {row.id: (row.status, row.risk, row.updated_at) for row in db.query(IncidentRecord).all()}
        legacy_id = str(uuid5(NAMESPACE_URL, "shaktios-seed-v2/techfest_gate_3"))
        assert legacy_id in before
        assert len(before) == 6
        assert seed_module.seed(db, NOW, venue_id=VENUE_ID)["incidents"] == 5
        assert {key: (db.get(IncidentRecord, key).status, db.get(IncidentRecord, key).risk, db.get(IncidentRecord, key).updated_at) for key in before} == before
        citizen = db.get(EventRecord, "existing-citizen-event")
        assert citizen.reporter_id == "existing-citizen"
        assert citizen.payload == {"description": "Existing observation", "venue_event_id": "venue-test"}
        example_id = seed_module.stable_id("hackspire26_ranchi_registration")
        db.get(IncidentRecord, example_id).status = "RESOLVED"
        db.get(VenueRecord, VENUE_ID).description = "Operator-reviewed venue description"
    with SessionLocal.begin() as db:
        counts = (db.query(EventRecord).count(), db.query(IncidentRecord).count(), db.query(TimelineEntryRecord).count())
        rerun = seed_module.seed(db, NOW + timedelta(days=1), venue_id=VENUE_ID)
        assert all(value == 0 for value in rerun.values())
        assert (db.query(EventRecord).count(), db.query(IncidentRecord).count(), db.query(TimelineEntryRecord).count()) == counts
        assert db.get(IncidentRecord, example_id).status == "RESOLVED"
        assert db.get(VenueRecord, VENUE_ID).description == "Operator-reviewed venue description"


def test_selected_dry_run_and_unknown_venue_do_not_write(seed_module, monkeypatch, capsys):
    monkeypatch.setattr("sys.argv", ["seed_supabase.py", "--venue", VENUE_ID, "--dry-run"])
    seed_module.main()
    output = capsys.readouterr().out
    assert "5 zones" in output and "35 events" in output and "39 timeline" in output
    assert seed_module.seed_plan()["zones"] == 11
    with pytest.raises(ValueError, match="Unknown seed venue"):
        seed_module.seed_plan("unknown-venue")
