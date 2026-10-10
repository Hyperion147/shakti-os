"""Gemma assist: real auth/HTTP boundaries, mocked HTTPX Gemini API only, no paid calls."""

import base64
import json

import httpx
import pytest

from test_auth import client  # Existing isolated SQLite fixture, never the runtime DB.
from shaktios_api import auth, gemma_assist, gemma_provider
from shaktios_api.auth import AuthUser
from shaktios_api.database import SessionLocal
from shaktios_api.event_store import EventRecord
from shaktios_api.incident_store import IncidentRecord
from shaktios_api.timeline_store import TimelineEntryRecord

HEADERS = {"Authorization": "Bearer citizen-token"}
SECRET = "test-only-gemini-secret"
MODEL = "gemma-4-26b-a4b-it"
TRIAGE = {
    "suggested_urgency": "high", "priority": True,
    "reasons": ["Crowd blocking exit"], "visual_findings": ["Dense crowd at gate"],
}
BRIEF = {
    "brief": "Crowd building at Registration with medium risk.",
    "bullets": ["Density 0.8", "One citizen report"],
    "suggested_actions": ["Verify zone footage"],
}
_REAL_ASYNC_CLIENT = httpx.AsyncClient

# 1x1 PNG bytes for a valid tiny image.
TINY_PNG = base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000d49444154789c6360000000020001e221bc330000000049454e44ae426082"
    )
).decode()


def envelope(payload):
    return httpx.Response(200, json={"candidates": [{
        "finishReason": "STOP",
        "content": {"parts": [{"text": json.dumps(payload, ensure_ascii=False)}]},
    }]})


@pytest.fixture(autouse=True)
def safe_environment(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", SECRET)
    monkeypatch.delenv("GEMMA_MODEL", raising=False)
    monkeypatch.setattr(gemma_assist, "limiter", gemma_assist.VoiceLimiter())
    monkeypatch.setattr(auth, "verify_token", lambda _: AuthUser(id="citizen-gemma"))


@pytest.fixture
def provider(monkeypatch):
    requests = []
    responses = [envelope(TRIAGE)]

    async def handle(request):
        assert "generativelanguage.googleapis.com" in str(request.url), "Unexpected network/action"
        assert f"/models/{MODEL}" in str(request.url)
        assert request.headers.get("x-goog-api-key") == SECRET
        await request.aread()
        requests.append(request)
        if not responses:
            pytest.fail("Unexpected provider request or automatic retry")
        response = responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    def client_factory(**kwargs):
        assert kwargs["follow_redirects"] is False
        assert kwargs["trust_env"] is False
        return _REAL_ASYNC_CLIENT(transport=httpx.MockTransport(handle), **kwargs)

    monkeypatch.setattr(gemma_provider.httpx, "AsyncClient", client_factory)
    return requests, responses


def counts():
    with SessionLocal() as db:
        return tuple(db.query(model).count() for model in (EventRecord, IncidentRecord, TimelineEntryRecord))


def test_config_reports_gemma_model(client):
    response = client.get("/assist/config", headers=HEADERS)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body == {"configured": True, "provider": "gemini-api", "model": MODEL, "multimodal": True}


def test_photo_triage_text_only(client, provider):
    before = counts()
    response = client.post("/assist/photo-triage", json={
        "category": "crowd", "description": "Queue blocking entrance.",
    }, headers=HEADERS)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["suggested_urgency"] == "high"
    assert body["model"] == MODEL
    assert counts() == before, "Gemma assist must not write records"


def test_photo_triage_with_image(client, provider):
    before = counts()
    response = client.post("/assist/photo-triage", json={
        "category": "crowd", "description": "Crowd at gate.",
        "image_base64": TINY_PNG, "mime_type": "image/png",
    }, headers=HEADERS)
    assert response.status_code == 200, response.text
    assert response.json()["visual_findings"] == ["Dense crowd at gate"]
    assert counts() == before


def test_photo_triage_rejects_bad_image_without_provider_call(client, provider):
    requests, _ = provider
    response = client.post("/assist/photo-triage", json={
        "category": "crowd", "description": "Crowd.", "image_base64": "!!!not-base64!!!",
    }, headers=HEADERS)
    assert response.status_code == 422
    assert requests == []


def test_incident_brief(client, provider):
    _, responses = provider
    responses.clear()
    responses.append(envelope(BRIEF))
    before = counts()
    response = client.post("/assist/incident-brief", json={
        "location": "hackspire26_ranchi_registration", "status": "DETECTED",
        "severity": "MEDIUM", "risk": 0.62, "evidence": ["density 0.8", "one report"],
    }, headers=HEADERS)
    assert response.status_code == 200, response.text
    assert response.json()["brief"].startswith("Crowd building")
    assert counts() == before


def test_assist_requires_authentication(client, provider):
    assert client.post("/assist/photo-triage", json={"category": "crowd", "description": "x"}).status_code in (401, 403)
    assert client.get("/assist/config").status_code in (401, 403)


def test_assist_without_key_is_actionable(client, monkeypatch, provider):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    response = client.post("/assist/photo-triage", json={"category": "crowd", "description": "Crowd."}, headers=HEADERS)
    assert response.status_code == 503
    assert "manually" in response.json()["detail"]


def test_assist_invalid_provider_response_stays_manual(client, provider):
    _, responses = provider
    responses.clear()
    responses.append(envelope({"suggested_urgency": "critical", "priority": "yes"}))
    response = client.post("/assist/photo-triage", json={"category": "crowd", "description": "Crowd."}, headers=HEADERS)
    assert response.status_code == 502
    assert "manually" in response.json()["detail"]
