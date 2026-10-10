# Domain and processing rules

## Terms

| Term | Meaning in this MVP |
| --- | --- |
| Signal | Raw source observation before normalization |
| Event | Normalized observation with type, source, timestamp, location, confidence and payload |
| Venue / zone | Registered gathering and its canonical location IDs; a venue “event” is not a signal Event |
| Report | Human observation stored as a `citizen_report` Event; ownership comes from the verified JWT |
| Incident | A `crowd_risk` situation associated with one or more relevant Events |
| Risk | Bounded weighted score and contributing factors on an incident, not a calibrated probability |
| Action | Operator-approved downstream workflow request; execution/delivery is not proven by approval |
| Timeline | Stored history of correlated evidence, status changes and accepted action requests |
| Operator / citizen | Authorized decision-maker / authenticated report contributor; citizen sign-up does not grant operator access |

An Event has at most one `incident_id`; an incident can have many Events and timeline entries. Reports are not a separate table. The API owns `reporter_id` and `incident_id`; clients cannot assign either.

## Correlation

Only `crowd_density`, `social_concern`, `abnormal_movement` and `citizen_report` contribute to the current incident model. Other valid event types are stored/broadcast without creating an incident.

For an incoming event, choose the most recently updated eligible incident where:

- type is `crowd_risk`;
- `location` matches **exactly**;
- status is not `RESOLVED`;
- `updated_at` is between `event.timestamp - window` and `event.timestamp`, inclusive.

The window defaults to **300 seconds**, configurable with `INCIDENT_CORRELATION_WINDOW_SECONDS` (minimum one second). If none qualifies, create a new incident. A backdated event does not attach to a newer incident. This is deterministic location/time correlation, not semantic similarity or GPS-radius matching.

Citizen reports must select a registered venue and one of its zone IDs. Machine inputs should use that same canonical ID when they are intended to correlate. A free-text `gate_4` does not match `hackspire26_ranchi_registration`. Incident coordinates come from the zone registry, not the citizen's optional GPS evidence.

## Explainable risk

```text
risk = 0.40 × crowd_density
     + 0.30 × social_velocity
     + 0.20 × abnormal_movement
     + 0.10 × citizen_reports
```

| Factor | Input / update rule |
| --- | --- |
| `crowd_density` | `crowd_density` event's `payload.density` |
| `social_velocity` | `social_concern` event's `payload.velocity`, falling back to event confidence when absent |
| `abnormal_movement` | `abnormal_movement` event's `payload.score`, falling back to event confidence when absent |
| `citizen_reports` | `min(citizen_report_count / 5, 1)`; every contributing citizen-report Event increments the count |

Factors are bounded to 0–1. The non-report factors retain the strongest observed value; there is **no automatic decay**. Risk is rounded to four decimal places. Incident confidence is the strongest contributing event confidence, not calibrated credibility.

| Score | Severity |
| --- | --- |
| `< 0.40` | `LOW` |
| `0.40` to `< 0.70` | `MEDIUM` |
| `0.70` to `< 0.85` | `HIGH` |
| `>= 0.85` | `CRITICAL` |

Example: density `0.8`, social velocity `0.6`, movement `0.5` and one report produce `0.62` / `MEDIUM`. A citizen report alone contributes `0.02` to a new incident. The mobile convention uses confidence `0.7` for low/medium urgency and `0.9` for high; urgency itself does not raise the score to critical or trigger action.

Source: `services/api/src/shaktios_api/{incident_store,risk}.py`.

## Human-controlled lifecycle

```text
DETECTED → ASSESSING → RESPONDING → RESOLVED
                 └──────────────→ RESOLVED
```

Only authorized operators make these transitions. `RESOLVED` has no outgoing transition; invalid changes return `409`. Accepted changes record `status.changed`, optional notes and verified operator attribution.

An action request requires `RESPONDING` **and** a separate explicit approval. A successful webhook handoff records `action.requested` without resolving the incident. The supplied workflow only validates and acknowledges; notification delivery and emergency dispatch are not implemented. See [API](API.md) and [n8n](../n8n/README.md).

## Citizen-facing status

| Linked incident | API `report_status` | Mobile label |
| --- | --- | --- |
| None | `submitted` | Submitted |
| `DETECTED` | `received` | Received |
| `ASSESSING` | `under_review` | Under review |
| `RESPONDING` | `action_initiated` | Operator Responding |
| `RESOLVED` | `resolved` | Resolved |

These are derived from the persisted incident, not fabricated progress or notification receipts. “Operator Responding” does not confirm dispatch, delivery or arrival. See [API.md](API.md) for owned-report retrieval and [Events](EVENTS.md) for source normalization.
