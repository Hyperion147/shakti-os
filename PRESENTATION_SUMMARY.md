# ShaktiOS — presentation summary

**Two experiences, one accountable safety workflow:** `shakti-os` provides the operator dashboard and backend; the separate `shaktios-app` provides citizen reporting.

This is the canonical presentation narrative. Technical contracts live in the linked guides; rehearsal steps live in [DEMO.md](docs/DEMO.md).

## The pitch

**ShaktiOS turns fragmented observations into explainable incidents that humans assess, act on and audit.**

At a crowded venue, a density reading, a social concern and an attendee's observation each show only part of the situation. Operators need a shared answer to:

> What is happening, why does it matter, and who approved the next step?

- **Citizens / attendees** contribute location-specific observations and see the status of the linked incident.
- **Safety operators / control rooms** review evidence, prioritize incidents and explicitly approve a downstream workflow.
- **Organizers** gain a common incident picture and a traceable decision history instead of disconnected feeds.

Faster coordinated response is a goal, not a measured outcome established by this repository. Position ShaktiOS as a decision-support MVP, not a certified emergency service, predictive risk model or autonomous dispatcher.

## The system in one slide

```text
Crowd / social signals          Citizen app: manual or reviewed voice report
            └───────────────────────┬──────────────────────┘
                              FastAPI + Supabase
                     Events → correlation → Incident + Risk
                                    │
                          Operator dashboard + Timeline
                                    │
                       Human review and explicit approval
                                    │
                         Optional n8n workflow handoff
```

Both clients use Supabase Auth; FastAPI enforces access and owns operational data. Voice uses server-side Sarvam processing only after consent and produces an editable draft. It cannot submit a report or trigger action on its own.

An **Event** is evidence; an **Incident** groups relevant evidence; **Risk** exposes contributing factors; the **Timeline** records observations and operator decisions. See [Architecture](docs/ARCHITECTURE.md) and [Domain](docs/DOMAIN.md).

## What to demonstrate

1. **Separate samples from operations.** The public landing is always static, labelled sample content. The signed-in dashboard reads persisted records.
2. **Show the citizen's contribution.** Choose a registered venue/zone, describe a demo observation, review and submit. Show the returned stored report, not just a local draft.
3. **Show explainable fusion.** Open the report's actual linked incident and evidence. Exact zone/time matching joins the signals; fixed weighted factors explain the score.
4. **Show human control.** An authorized operator records an assessment and note. The citizen's status follows that stored incident.
5. **Show the action boundary honestly.** Approval can request an n8n workflow; the supplied workflow validates and acknowledges, with no notification-provider or responder-dispatch node.
6. **Close on the timeline.** Evidence, decisions and accepted requests form a traceable account of the scenario.

The [demo walkthrough](docs/DEMO.md) contains preflight, fresh multi-source inputs, timing, ownership checks and fallback steps. The [seed runbook](docs/REAL_DATA.md) explains the labelled Hackspire26/Ranchi fixtures; those are illustrative, not live conditions or an official campus plan.

## Claims to make carefully

| Say | Do not imply |
| --- | --- |
| “Supabase identity, operator authorization and owned citizen reports are implemented.” | Every signup is an operator or the hosted deployment is fully hardened |
| “Venues and canonical zones come from the database.” | Seed coordinates/helplines are verified operational registrations or a venue-admin editor exists |
| “Risk is a transparent weighted score.” | Learned prediction, calibrated probability or a high urgency label automatically triggering dispatch |
| “The citizen sees the linked incident's status.” | Push notifications, a mobile live incident feed, responder arrival or delivery confirmation |
| “Voice assists entry after consent and human review.” | Guaranteed transcription accuracy, automatic submission or verified native/provider performance |
| “The dashboard uses authenticated WebSockets and HTTP refresh.” | Durable replay, horizontally scalable fanout or unbounded history/analytics |
| “n8n accepted the approved handoff.” | A message was delivered or responders were dispatched |
| “The app can scan venue QR codes, capture optional GPS and attach up to 3 photo evidence images.” | SOS dispatch, chat/inbox or working automatic external deep-link joining |

Phone/Google sign-in and push notifications are not implemented. Machine ingestion remains open for local integrations; broader production access/abuse controls are still needed.

## Verification and maturity

Source implementation, configuration, automated checks and live verification are separate claims:

- Unit tests cover backend access/ownership, correlation, seeds, webhook errors and mocked voice boundaries; frontend/mobile checks cover their own client behavior.
- A mocked test or Expo export is **not** proof of real Supabase login on a phone, native session/venue restoration, camera/GPS/microphone behavior, a signed installable artifact or real Sarvam quality/latency.
- A configured n8n URL/secret is not proof of workflow health or provider delivery. Inspect execution history before retrying a failed request.
- Record the actual revision, command and environment when presenting test results. Do not reuse old test counts as current proof.

Check commands: [CONTRIBUTING.md](docs/CONTRIBUTING.md). Native acceptance: [mobile build readiness](../shaktios-app/BUILD_READINESS.md). Remaining work: [TASKS.md](docs/TASKS.md).

## Slide outline

1. Problem: fragmented evidence at a crowded venue.
2. Two users: citizen contributor and accountable operator.
3. Architecture: common Event → Incident → Risk → decision → timeline flow.
4. Demonstration: one fresh report, its actual incident and an operator decision.
5. Explainability and trust: factors, ownership, human approval and truthful handoff status.
6. Current maturity: implemented MVP versus device/integration validation and production hardening.

Prefer a factor breakdown, split citizen/operator view and vertical decision timeline over an unexplained “AI score”. Keep the human-approval checkpoint visible before n8n.

**Closing line:** “Citizens contribute observations. Operators see why an incident matters. Humans approve the next step, and the timeline records what happened.”

## Reference map

- [Product scope and screen inventory](docs/PROJECT_OVERVIEW.md)
- [Architecture](docs/ARCHITECTURE.md), [Domain](docs/DOMAIN.md), [API](docs/API.md)
- [Setup](README.md), [Demo](docs/DEMO.md), [Seed provenance](docs/REAL_DATA.md)
- [Voice drafts](docs/VOICE_REPORTING.md), [n8n workflow](n8n/README.md)
- [Citizen app README](../shaktios-app/README.md)
