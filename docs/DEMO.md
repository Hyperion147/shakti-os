# Demo and two-client acceptance walkthrough

Goal: show **one citizen observation → one persisted incident → an operator decision → the citizen's updated status**, with evidence and a timeline. Optional machine signals demonstrate deterministic fusion; optional n8n demonstrates a handoff, not dispatch.

## Preflight

1. Follow the [README](../README.md) to configure/start FastAPI and the dashboard. Point the sibling citizen app at the same API/Supabase project. For a device, use a reachable host rather than the device's `localhost`.
2. Apply migrations and, if needed, review/apply the labelled [demo seed](REAL_DATA.md). Do not reset a shared database or seed into an unknown project.
3. Sign in as a specifically authorized operator. `/me` must return `is_operator: true`; a normal citizen must not gain operator access.
4. Sign in on mobile as a citizen. Select a backend-registered venue/zone. The example below uses **Hackspire26 — Ranchi Seed Scenario**, zone **Registration & Entry**.
5. Rehearse camera/microphone/GPS permissions on the target device. Manual venue ID joining and a manual report remain useful fallbacks. Do not rely on automatic external deep-link joining without a separate test.
6. If showing n8n, configure a controlled test destination using its [runbook](../n8n/README.md). The imported workflow only validates/acknowledges. Never connect a presentation to real emergency channels.

Keep tokens, environment files, personal account details and unrelated reports off the presentation screen. Mark submitted descriptions as demo observations.

## Optional: stage fresh machine signals

Old seed incidents and the crowd simulator's generic `gate_4` do **not** automatically merge with a registered zone report. Correlation needs the exact same zone ID and eligible timestamps (default window: five minutes).

The following POSIX-shell example posts three explicitly synthetic signals to the **local development API**. Run only when those stored demo writes are intended and the Ranchi venue/zone is registered:

```bash
for signal in \
  '{"type":"crowd_density","source":"demo_crowd_sensor","location":"hackspire26_ranchi_registration","confidence":0.9,"payload":{"density":0.8,"is_demo":true}}' \
  '{"type":"social_concern","source":"demo_social_signal","location":"hackspire26_ranchi_registration","confidence":0.9,"payload":{"velocity":0.6,"is_demo":true}}' \
  '{"type":"abnormal_movement","source":"demo_movement_sensor","location":"hackspire26_ranchi_registration","confidence":0.9,"payload":{"score":0.5,"is_demo":true}}'
do
  curl --fail-with-body --silent --show-error \
    http://localhost:8000/events \
    -H 'Content-Type: application/json' --data "$signal"
  printf '\n'
done
```

No token is used because non-citizen machine ingestion is still open for the local MVP. This is not a production integration pattern. Each response should be `201`; note its actual `incident_id`. If another recent incident is eligible, the signals may join it rather than create a new one. For a clean rehearsal, use another registered zone rather than deleting shared records.

## Walkthrough

1. **Establish the data boundary.** Show `/` as labelled static sample content, then open the authenticated `/dashboard` for stored operational records.
2. **Submit the citizen observation.** In the app, choose the venue/zone, category and urgency; enter a clearly labelled demo description. GPS is optional. Review, submit and note the stored report ID. If using voice, consent, process, edit the preview and separately confirm the final report.
3. **Verify ownership and persistence.** Open My Reports and report detail. They must read the stored record, not just display the draft. History refreshes on focus; it is not an operator WebSocket subscription.
4. **Locate the actual incident.** Follow the returned report's `incident_id` in the dashboard. Review its linked evidence, zone coordinates, factors and timeline—not merely another incident at a similarly named location.
5. **Explain the score.** In a fresh incident with the three inputs above and exactly one citizen report, the score is `0.62 / MEDIUM`. If the evidence differs, explain the actual factors rather than asserting that number. High urgency alone does not make an incident critical.
6. **Record a human decision.** Move `DETECTED → ASSESSING` with a note, then choose `RESPONDING` or `RESOLVED`. Do not present a seeded state as a live operator action.
7. **Check the citizen result.** Reopen My Reports/detail. The same incident now produces “Under review”, “Operator Responding” or “Resolved”. Responding means workflow state, not confirmed dispatch.
8. **Optional approved handoff.** For `RESPONDING`, use **Review & approve → Approve action**. Inspect n8n execution history and the accepted `action.requested` timeline entry. On failure, explain the actual diagnostic and inspect executions before retrying; a timeout does not prove nothing ran.
9. **Finish with the audit trail.** Show correlated evidence, the operator's note/state transition and any accepted handoff. Resolve only when appropriate for the staged scenario.

## Acceptance checks beyond the presentation

- A second citizen cannot list the first citizen's reports; fetching the first report ID returns `404`.
- A citizen cannot access operator routes or operator WebSockets. Missing/invalid tokens are rejected.
- Native restart restores the intended session/venue; web memory-only storage is not expected to survive a full reload.
- Interrupt/reconnect the API and verify truthful error/retry states and refreshed dashboard snapshots. `LIVE` requires WebSocket authentication acknowledgement.
- Check camera, GPS and microphone permissions on real hardware. Exports and browser mocks do not establish device behavior.
- Treat uncertain submission/handoff outcomes carefully: there is no general report/action idempotency guarantee.
- Do not use the legacy anonymous `scripts/e2e_check.py` as proof of this authenticated flow; see [legacy utility caveats](REAL_DATA.md#legacy-utilities-do-not-use-as-the-current-runbook).

## Presentation timing and fallback

For six minutes: **problem (0:35) → architecture/data boundary (0:30) → citizen submission (1:10) → evidence/risk (1:10) → operator/status loop (1:00) → optional handoff and limits (0:50) → timeline/close (0:45)**.

For four minutes, pre-sign in, select the venue in advance and omit QR/GPS/live n8n. If a connection fails, use a clearly labelled seeded incident or recording, identify the failed step and do not claim the mobile round trip or delivery succeeded.

Use [PRESENTATION_SUMMARY.md](../PRESENTATION_SUMMARY.md) for the narrative; [CONTRIBUTING.md](CONTRIBUTING.md) owns automated check commands. This is a repeatable checklist, not a claim that the current device/project has already passed it.
