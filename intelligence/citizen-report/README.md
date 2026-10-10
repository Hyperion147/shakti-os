# Citizen report normalization adapter

`CitizenReportAdapter.to_event()` converts a report mapping into a `citizen_report` Event with source `citizen_report`. It requires location and description/text, normalizes confidence and retains category/urgency plus selected metadata. It does not persist data, assign reporter identity or calculate risk.

```python
from citizen_report import CitizenReportAdapter

event = CitizenReportAdapter().to_event({
    "location": "hackspire26_ranchi_registration",
    "venue_event_id": "venue-hackspire26-ranchi",
    "description": "Demo observation: queue is blocking the entrance.",
    "category": "crowd",
    "urgency": "high",
    "confidence": 0.9,
})
```

Normalization requires `venue_event_id` and preserves it in the payload. To submit, call `await adapter.send_event(report, api_url, access_token=verified_supabase_access_token)`. The keyword token is mandatory and sent only as `Authorization: Bearer ...`; never use the machine-ingestion key for a citizen. HTTPS is required except for loopback development; redirects and environment proxies are disabled. FastAPI validates the registered active/upcoming venue/zone, normalizes citizen source to `citizen_app` and stamps the JWT identity. Input identity fields are never forwarded.

The sibling mobile app constructs its own authenticated request; it does not call this Python adapter. For a valid submission use the [API contract](../../docs/API.md#event-submission): a verified session, selected venue ID and one of that venue's zone IDs. FastAPI stamps ownership and computes the incident association.

For local package checks, install `.[test]` in this package's virtual environment and run `python -m pytest`. See [Events](../../docs/EVENTS.md) for the source-boundary overview.
