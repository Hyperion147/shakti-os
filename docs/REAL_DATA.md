# Database-backed demo data and seed runbook

**Database-backed does not mean a live observation.** The dashboard and citizen app share FastAPI/Supabase data, but `scripts/seed_supabase.py` creates explicitly synthetic scenarios. The public landing page has separate static sample content and never polls the API.

Install/configure the system using the [README](../README.md), apply [Supabase migrations](SUPABASE.md), then use this guide if you need demo fixtures. For actual reporting and acceptance checks, see [DEMO.md](DEMO.md).

## Review before applying

From `shakti-os`, using the installed API virtual environment:

```bash
services/api/.venv/bin/python scripts/seed_supabase.py --dry-run
# Run only after confirming the intended demo database:
services/api/.venv/bin/python scripts/seed_supabase.py --apply
```

On Windows replace `services/api/.venv/bin/python` with `services/api/.venv/Scripts/python.exe`.

- No option means **dry-run**. It prints the fixture plan without opening a database connection.
- `--apply` uses the API database configuration (including root `.env`) and requires PostgreSQL, not SQLite.
- Writes occur in one transaction. Existing deterministic IDs are skipped; existing records are not overwritten or truncated.
- It creates no Auth users, contacts, fake citizen identities, attachment URLs or webhook calls.
- A seed rerun is **not** a timestamp refresh, a reset of operator decisions or a general repair of partially missing fixture rows.

## Fixture inventory

A fresh complete v2 seed plans:

| Record | Count |
| --- | ---: |
| Venues | 3 |
| Canonical zones | 11 |
| Incidents | 11 |
| Events | 77 |
| Timeline entries | 87 |

IDs are deterministic UUID5 values. Events use `seed_*` sources and payload markers `seed_batch=shaktios-seed-v2`, `is_seeded=true`. Seeded timeline decisions explicitly state that no real operator action or dispatch occurred. Counts are **fixture counts**, not the totals of an existing database.

Coordinates are illustrative, and venue helplines are not invented. Use reviewed venue/zone registration before real operations. There is no venue-admin editor in the MVP.

## Scoped Hackspire26 / Ranchi scenario

The Ranchi college-circuit nodes are illustrative demo locations across Ranchi campus areas (Morabadi, BIT Mesra side, St. Xavier's area and the station shuttle point), **not an official campus plan or live conditions**.

```bash
services/api/.venv/bin/python scripts/seed_supabase.py --venue venue-hackspire26-ranchi --dry-run
services/api/.venv/bin/python scripts/seed_supabase.py --venue venue-hackspire26-ranchi --apply
```

A fresh scoped application plans **1 venue, 5 zones, 5 active incidents, 35 events and 39 timeline entries**. The same skip-existing rules apply.

| Node | Latitude | Longitude | Initial state | Initial risk / severity |
| --- | --- | --- | --- | --- |
| Registration & Entry | 23.3852 | 85.3180 | ASSESSING | 81.8% / HIGH |
| Hacking Arena | 23.3860 | 85.3195 | DETECTED | 61.1% / MEDIUM |
| Judging & Demo Stage | 23.4120 | 85.4250 | RESPONDING | 76.4% / HIGH |
| Food & Rest Zone | 23.3710 | 85.3265 | ASSESSING | 35.9% / LOW |
| Campus Shuttle | 23.3475 | 85.3353 | DETECTED | 67.4% / MEDIUM |

Mobile venue name: **Hackspire26 — Ranchi Seed Scenario**. Manual join ID: `venue-hackspire26-ranchi`. The registration zone used in the demo is `hackspire26_ranchi_registration`.

After SQL seeding, refresh `/dashboard` or `/map`: direct SQL writes do not emit in-process WebSocket updates. The initial regional map is centered at `23.381, 85.345`, zoom `11`, framing the Ranchi college circuit. Zoom near `23.386, 85.319` to distinguish the nearby Morabadi nodes. Incoming updates do not reset a manually chosen view.

Seed incident timestamps are deliberately in the past. A new citizen report normally starts a fresh incident rather than joining an old seed incident. To demonstrate fusion, use the fresh matching-zone inputs in [DEMO.md](DEMO.md), not a rerun of the seed.

## Verification checklist

1. Review dry-run counts and selected venue before any write.
2. Apply only to the intended demo project with pending migrations already deployed.
3. Read `/venues` and the authenticated dashboard; confirm seed-labelled names, registered zones and expected coordinates.
4. Compare database/public-overview counts only with their own pre-application baseline; unrelated reports may already exist.
5. A second application to an unchanged complete fixture set should insert zero records. It must not change existing operator state or create webhook executions.
6. Keep synthetic data labelled in screenshots and presentations. A later user-submitted demo report is a real owned database record, not evidence of an actual emergency.

Automated seed behavior is covered by `services/api/tests/test_real_data.py` and `test_hackspire_seed.py`. Tests do not verify the state of your hosted project; run the [two-client walkthrough](DEMO.md) for that.

## Legacy utilities: do not use as the current runbook

| Utility | Current caveat |
| --- | --- |
| `scripts/seed.py` | Posts mixed events without a token or registered citizen venue context; citizen submissions no longer satisfy the API contract |
| `scripts/e2e_check.py` | Assumes anonymous operator reads/citizen writes; it is not a valid authenticated end-to-end acceptance check |
| `scripts/reset_demo.py` | Destructively clears operational records; not part of safe additive setup |
| `scripts/seed_kolkata_durga_puja.py` | Older scenario utility, not the supported venue/zone-registry seed path |
| `python -m shaktios_api.migrate` | Legacy table creation, not the authoritative Supabase schema upgrade workflow |

These files remain unchanged. Use `seed_supabase.py` for fixtures, the API contract for authenticated submissions, and reviewed migrations rather than resets.
