# Project overview

ShaktiOS is a decision-support platform for evolving safety incidents at crowded venues. It combines source observations into a shared incident picture, explains its risk score, and keeps the operator's decisions visible in a timeline.

**Citizens contribute observations; operators retain control.** An incident, a high score or a citizen's urgency selection never automatically dispatches responders.

## Product and repository boundaries

| Experience | Repository | User outcome |
| --- | --- | --- |
| Operator dashboard and core API | `shakti-os` | Review multi-source evidence, prioritize incidents, record assessment and request an approved workflow |
| Citizen app | [`shaktios-app`](../../shaktios-app/README.md), a separate sibling repo | Join a registered venue, submit an observation and follow its linked incident status |

Both clients authenticate with Supabase and read/write operational data through the same FastAPI service and PostgreSQL database. A **venue event** (festival or gathering) is a registry record, not a signal **Event**. See [DOMAIN.md](DOMAIN.md) for terminology and rules.

## Operator experience

| Route | Purpose |
| --- | --- |
| `/` | Public, static, explicitly labelled sample dashboard; no operational API polling |
| `/login` | Supabase email/password sign-in |
| `/dashboard` | Stored incidents, recent signals, active/elevated counts, map and stream state |
| `/incidents`, `/incidents/{incidentId}` | Queue, actual linked evidence, risk factors, timeline, status changes, notes and reviewed action requests |
| `/map` | Leaflet/OpenStreetMap view using incident or registered-zone coordinates |
| `/signals`, `/reports`, `/sources` | Recent observations, report evidence and source activity |
| `/analytics`, `/timeline`, `/actions` | Summaries and audit/action history over the loaded records |
| `/settings` | Profile display name, API/auth/stream and integration configuration status |

All operational routes verify `/me` and operator capability before mounting their data-fetching views. “New observation” creates an operator-authored report, not simulated sensor measurements.

The shared snapshot holds up to **200 incidents and 200 events**. Global timeline/action views use the latest **15 incidents**; evidence and timeline requests are also bounded. Counts and exports derived from these views are not a full database census. The public overview API has database-wide counts, but the landing page does not consume it.

The map initially frames the Ranchi college circuit. It preserves API/zone coordinates and does not invent markers for missing locations or reset the camera on every update. Real map tiles do not turn illustrative seed coordinates into verified venue data.

## Citizen experience

```text
Email/password sign-in or sign-up → choose registered venue / QR / manual ID
  → manual report OR consented voice draft → select zone and urgency
  → optional GPS → review → explicit submission → stored report → My Reports
```

- Venue choices come from `/venues`; there is no bundled fallback registry or automatic default venue.
- Manual reporting captures category, description, canonical zone and low/medium/high urgency. GPS is optional supporting evidence, not the correlation key.
- Voice is an optional, server-mediated transcription/extraction flow. Users consent to processing by Sarvam, edit nullable suggestions and separately confirm submission. No voice request creates an incident or invokes n8n. See [VOICE_REPORTING.md](VOICE_REPORTING.md).
- Submission uses `POST /events` with `type=citizen_report`, `source=citizen_app`, the zone ID as `location`, and the selected `venue_event_id` in the payload.
- Confirmation and detail fetch the stored report. History uses ownership-filtered `/me/reports`, currently the latest 50; it is not client filtering of the operator event feed.
- Status follows the stored incident. “Operator Responding” reflects workflow state, **not** confirmed responder arrival or dispatch.
- Native session and selected-venue ID persistence use SecureStore. Web storage falls back to memory; do not promise restoration after a full browser reload.
- Citizens do not receive operator controls, operator WebSocket feeds, push alerts, SOS dispatch or a messaging inbox. Camera use covers QR scanning and optional photo evidence (up to 3 compressed photos per report, uploaded to the `report-evidence` bucket and rendered on the operator dashboard). Camera/manual parsing of venue QR text is implemented; automatic external deep-link joining remains incomplete and needs a separate fix/test.

Mobile installation, routes and device acceptance checks belong in the [app README](../../shaktios-app/README.md) and [build-readiness checklist](../../shaktios-app/BUILD_READINESS.md), not in a second mobile setup guide here.

## Implemented versus deployment-ready

| Area | Implemented | Boundary / remaining verification |
| --- | --- | --- |
| Core processing | Event persistence, deterministic location/time correlation, weighted risk, evidence links and timeline | No learned prediction, semantic fusion or automatic risk decay |
| Access control | Supabase JWT verification, operator gate, owned-report list/detail, authenticated operator WebSockets | Machine-signal ingestion remains open for the local MVP; production access/abuse controls remain work |
| Venues and maps | Database venue/zone registry and stored coordinates | Seed coordinates are illustrative; no venue-admin editor |
| Citizen reporting | Auth, joining, reporting, optional GPS, report history/status and voice draft UI | Native auth, persistence, permissions and real provider behavior need device/integration verification |
| Realtime | HTTP snapshots plus reconnecting in-process WebSockets | No multi-process fanout or replay |
| Action handoff | Operator approval, webhook request and accepted-action timeline entry | Supplied n8n workflow validates/acknowledges only; no provider delivery, dispatch or exactly-once guarantee |
| Source integration | Crowd simulator, Civic-Shield normalization/demo bridge, citizen normalization package | Not deployed CCTV analysis or production social-source collection; legacy citizen adapter delivery needs auth/venue integration |
| Media / extra sign-in / alerts | Photo evidence upload via the `report-evidence` bucket; no phone login, Google login or push notifications | Photo URLs ride in the report payload and render on the dashboard; no retention/deletion flow yet |

“Implemented” describes source behavior, not proof that a particular hosted project, signed app or provider integration is working. Test commands and coverage boundaries are in [CONTRIBUTING.md](CONTRIBUTING.md); remaining work is tracked in [TASKS.md](TASKS.md).

## Where to go next

- [README](../README.md): install, configure and run both sides.
- [Architecture](ARCHITECTURE.md): component map and trust boundaries.
- [API](API.md): canonical client contract; [Domain](DOMAIN.md): risk and lifecycle semantics.
- [Seed runbook](REAL_DATA.md) and [Demo](DEMO.md): labelled fixtures and a reproducible walkthrough.
- [Presentation summary](../PRESENTATION_SUMMARY.md): concise audience-facing narrative.
