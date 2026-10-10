# API contract

Local base URL: `http://localhost:8000`. FastAPI publishes its HTTP schema at `/docs` and `/openapi.json`; WebSocket authentication is documented below. Source: `services/api/src/shaktios_api/main.py` and the `*_models.py` modules; voice routes live in `voice.py`.

## Access rules

Send `Authorization: Bearer <Supabase access token>` on authenticated HTTP requests.

| Access | Meaning |
| --- | --- |
| Public | No session required; responses deliberately expose only public fields |
| User | Any verified Supabase user; report reads are restricted to that user's ownership |
| Operator | Verified user with operator capability; citizen sign-up does not grant it |

Missing/invalid credentials on protected routes return `401`; a verified non-operator gets `403` from operator routes. Operator capability is configured server-side through `OPERATOR_USER_IDS`, `OPERATOR_EMAILS` or trusted roles, not editable client profile metadata. See [SUPABASE.md](SUPABASE.md).

`POST /events` has source/type-specific rules: citizen reports require a user, dashboard-prefixed sources require an operator, and other machine signals currently allow anonymous ingestion. A dashboard-prefixed source without operator access returns `403`. A supplied invalid bearer token is rejected rather than treated as anonymous. **Protect machine ingestion before public deployment.**

## Route reference

### Public and identity routes

| Method / path | Access | Response |
| --- | --- | --- |
| `GET /health` | Public | `{ "status": "ok", "service": "shaktios-api" }`; not an Auth/provider/database readiness test |
| `GET /venues` | Public | Array of registered venues with canonical zones |
| `GET /venues/{venue_id}` | Public | Venue, or `404` |
| `GET /public/overview` | Public | Database-wide counts and projected recent summaries; no report payloads or reporter identities |
| `GET /me` | User | `{id, email, role, is_operator}` from verified identity/access rules |
| `GET /integrations` | Operator | `{ "n8n": { "configured": boolean, "authenticated": boolean } }` |

Venue fields are `id`, `name`, `description`, `venue`, `locationLabel`, `status`, nullable `startTime`, `endTime`, `helpline`, and `zones`. Each zone has `id`, `label`, `latitude`, `longitude`. These are registry records, including labelled seed scenarios when seeded.

Public overview includes `incident_count`, `active_count`, `elevated_count`, `event_count`, `source_count`, `last_event_at`, `seeded_event_count`, up to 100 projected `incidents` and up to 12 `recent_events`. Counts cover the database; arrays are bounded. The landing page does **not** use this endpoint—it always shows static samples.

Integration flags reflect the presence of a webhook URL and a server-side secret, **not** a live n8n authentication or delivery test. The server cannot establish that the remote secret matches merely from these flags.

### Events, incidents and owned reports

| Method / path | Access | Parameters / behavior |
| --- | --- | --- |
| `POST /events` | Type/source-dependent | Validates, stores, correlates when relevant and broadcasts; returns Event with `201` |
| `GET /events` | Operator | `limit=50`, range 1–200; newest observations first |
| `GET /incidents` | Operator | `limit=50`, range 1–200; most recently updated first |
| `GET /incidents/{incident_id}` | Operator | Incident or `404` |
| `GET /incidents/{incident_id}/events` | Operator | `limit=100`, range 1–200; oldest first, filtered by actual incident association; unknown incident → `404` |
| `GET /incidents/{incident_id}/timeline` | Operator | `limit=100`, minimum 1; oldest first; unknown incident → `404`; no explicit upper limit in this route |
| `GET /me/reports` | User | `limit=50`, range 1–100; `offset=0`, minimum 0; newest first; ownership filter applied **before** pagination |
| `GET /me/reports/{report_id}` | User | Owned report; missing or unowned ID → `404` |

### Local camera detections

| Method / path | Access | Behavior |
| --- | --- | --- |
| `POST /camera/detections` | Operator | Accepts a normalized frame-change result from a browser-connected local camera and stores it as an `abnormal_movement` event with `source=camera_analytics` |

The browser connects directly to a configured HTTP/MJPEG or other browser-compatible LAN feed. The API does not discover, proxy or store camera URLs or credentials. The request requires a registered venue zone and contains `camera_id`, `camera_name`, `location`, `change_score`, `threshold` and `confidence`. The server supplies the event timestamp and runs the normal correlation, risk, timeline and WebSocket flow. RTSP requires a separate local gateway that exposes a browser-compatible stream.

List endpoints return arrays, not pagination envelopes. Only `/me/reports` currently exposes an offset. Do not present a bounded list as the complete database history.

### Voice drafts

| Method / path | Access | Behavior |
| --- | --- | --- |
| `GET /voice/config` | User | Provider-key presence, languages and recording/upload limits; not provider health |
| `POST /voice/draft` | User | Multipart audio, selected venue, language and explicit consent → transcript and nullable suggested fields |

Voice does not require operator access and does not store a report, infer GPS, broadcast operational events or call n8n. The full multipart contract, error codes, server-only configuration and process-local rate limits live in [VOICE_REPORTING.md](VOICE_REPORTING.md).

### Priority assist

| Method / path | Access | Behavior |
| --- | --- | --- |
| `POST /priority/assess` | User | Sarvam triage of `{category, description, has_photo}` → validated `{suggested_urgency, priority, reasons}` |

Priority assist never stores a report or infers GPS; invalid provider output and missing keys resolve to actionable manual-urgency messages. Source: `services/api/src/shaktios_api/priority.py`, tests in `services/api/tests/test_priority.py`.

## Event submission

Machine signal example:

```json
{
  "type": "crowd_density",
  "source": "crowd_simulator",
  "location": "gate_4",
  "confidence": 0.95,
  "payload": { "density": 0.42 }
}
```

Event fields:

| Field | Contract |
| --- | --- |
| `id` | String, UUID generated when omitted; duplicate stored ID → `409` |
| `type`, `source`, `location` | Nonempty strings; source/type determine ingestion access rules |
| `timestamp` | Datetime, generated in UTC when omitted; use timezone-aware timestamps |
| `confidence` | Number from 0 to 1 |
| `payload` | Object containing source-specific details |
| `incident_id` | Nullable server-owned link assigned by correlation |
| `reporter_id` | Nullable server-owned verified citizen identity; cleared for machine events |

Citizen example, requiring a bearer token and the corresponding registered venue/zone (shown here from the optional Ranchi seed):

```json
{
  "type": "citizen_report",
  "source": "citizen_app",
  "location": "hackspire26_ranchi_registration",
  "confidence": 0.9,
  "payload": {
    "venue_event_id": "venue-hackspire26-ranchi",
    "location_label": "Registration & Entry",
    "category": "crowd",
    "description": "Demo observation: queue is blocking the entrance.",
    "urgency": "high",
    "photo_urls": ["https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/report-evidence/<user_id>/<uuid>.jpg"],
    "latitude": null,
    "longitude": null,
    "accuracy": null
  }
}
```

For `citizen_report`, the server requires a valid session, `payload.venue_event_id` and a `location` zone belonging to that venue. Invalid venue/zone input returns `422`. It strips payload identity keys (`reporter_id`, `user_id`, `reporter`, `userId`), replaces top-level `reporter_id` with the verified JWT subject and ignores client-assigned incident links. The base Event model leaves the rest of the payload open; the mobile form's category/description/urgency validation is not a stricter server-side report schema. Optional `payload.photo_urls` carries up to 3 public `report-evidence` bucket URLs, stored as-is and rendered as thumbnails on the operator dashboard.

An owned report response extends Event with nullable `incident_status`, `venue_name` and `report_status`. [DOMAIN.md](DOMAIN.md) owns the status mapping, correlation algorithm and risk formula. Report status is workflow state, not delivery confirmation.

## Incident response

An Incident contains `id`, `type`, `location`, nullable `latitude`/`longitude`, `status`, `severity`, `confidence`, `risk`, `factors`, `created_at` and `updated_at`. Current type is `crowd_risk`. Coordinates come from registered zones; missing coordinates remain null.

`factors` contains the risk contributors and `citizen_report_count`. See [Domain](DOMAIN.md) rather than duplicating scoring thresholds here.

## Operator writes

### `POST /incidents/{incident_id}/status`

Requires operator access. Request:

```json
{
  "status": "ASSESSING",
  "note": "Operator is reviewing the demo evidence."
}
```

Returns the updated Incident with `200`. Note is optional, at most 500 characters. Allowed transitions are defined in [Domain](DOMAIN.md): `DETECTED → ASSESSING`, `ASSESSING → RESPONDING` or `RESOLVED`, `RESPONDING → RESOLVED`. Unknown incident → `404`; invalid transition → `409`.

An accepted transition records `status.changed` with verified operator attribution and broadcasts the updated incident.

### `POST /incidents/{incident_id}/actions`

Requires operator access, an incident in `RESPONDING` and explicit human approval. Request:

```json
{
  "type": "notify_operator",
  "note": "Approved test handoff only; do not dispatch."
}
```

Action `type` is a string of 1–100 characters; optional note is at most 500. Successful response is `200` with `{action_id, status: "accepted", incident}`. FastAPI sends action ID/type, note and incident to `N8N_WEBHOOK_URL`, optionally including `X-ShaktiOS-Webhook-Secret`.

| Status | Meaning |
| --- | --- |
| `404` | Incident does not exist |
| `409` | Incident is not `RESPONDING` |
| `503` | Webhook URL is not configured |
| `502` | Upstream rejection, HTTP/network failure or timeout; diagnostic text is sanitized |

A successful handoff records `action.requested` without resolving the incident. The dashboard requires both URL/secret flags before enabling approval; the API itself only requires a URL and includes the secret when configured. The supplied n8n workflow uses Header Auth, so configure both sides.

**Acceptance is not notification delivery.** A timeout/failure may occur after n8n has started; there is no automatic retry or idempotency guarantee. Inspect execution history before retrying. Import, setup and detailed troubleshooting belong in the [n8n runbook](../n8n/README.md).

## Timeline response

Each entry has `id`, `incident_id`, `type`, `timestamp`, and a `details` object. Current types:

- `event.correlated`: event ID/type/source and resulting risk/severity.
- `status.changed`: previous/new state, optional note and verified operator attribution.
- `action.requested`: action ID/type, accepted delivery marker, optional note and operator attribution.

Synthetic seed entries include seed provenance instead of pretending a real operator approved them.

## WebSocket protocol

Both `WS /ws/events` and `WS /ws/incidents` are **operator-only**. After opening the socket, send this first message within five seconds:

```json
{"type":"authenticate","token":"<Supabase access token>"}
```

Never put credentials in the URL. After verifying identity and operator capability, the server replies:

```json
{"type":"authenticated"}
```

Invalid, missing, timed-out or non-operator authentication closes with code `1008`. Only mark a subscription live after acknowledgement. Subsequent frames are:

- `/ws/events`: `{ "type": "event.created", "event": <Event> }`
- `/ws/incidents`: `{ "type": "incident.updated", "incident": <Incident> }`

Subscriptions are held in the current API process. There is no cross-process fanout or replay. Reconnect with a current token and reload HTTP snapshots; do not assume missed events will be resent.

## Schema and setup

The SQL migrations, not this API guide, own database column definitions: see [SUPABASE.md](SUPABASE.md) and [`supabase/migrations`](../supabase/migrations). Local startup and client environment setup are in the [README](../README.md).
