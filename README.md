# ShaktiOS

ShaktiOS connects citizen observations and machine signals to **explainable incidents, operator decisions, and an auditable response handoff**. It is a decision-support MVP, not an autonomous dispatcher or a certified emergency service.

```text
Sources → Events → location/time correlation → Incidents + Risk
                                               ↓
                                  Human review → Action request → Timeline
```

## Two repositories, one platform

| Repository / area | Responsibility |
| --- | --- |
| `shakti-os/apps/dashboard` | Next.js 16 / React 19 operator dashboard, Supabase login, incident evidence, Leaflet maps, decisions and timelines |
| `shakti-os/services/api` | FastAPI, identity/access checks, venue registry, report ownership, correlation, risk, WebSockets and optional integrations |
| `shakti-os/intelligence/` | Civic-Shield and citizen-report normalization packages |
| `shakti-os/simulator/crowd` | Deterministic crowd signal generator |
| `shakti-os/packages/` | Shared event types, ESLint/TypeScript configuration and configuration placeholder |
| `shakti-os/supabase/migrations` | Authoritative PostgreSQL schema and RLS policies |
| `shakti-os/scripts`, `shakti-os/n8n` | Seed utilities and an acknowledgement-only action workflow |
| [`shaktios-app`](../shaktios-app/README.md) (separate sibling repo) | Expo 56 / React Native citizen app: sign-in, venue/QR joining, manual or voice-assisted reports, optional GPS and owned report status |

Both clients use Supabase **Auth** and call FastAPI for operational data. The mobile app is **not** a pnpm workspace package in this repo; install and run it separately.

**Current boundaries:** the public landing page is labelled static sample content; the authenticated dashboard reads stored data. Seed scenarios are synthetic. Voice produces an editable draft, not a submitted report. n8n acknowledges an approved request; the supplied workflow does not notify or dispatch responders. See the [project overview](docs/PROJECT_OVERVIEW.md) for capabilities and limitations.

## Local setup

Commands below run from `shakti-os` unless a `cd` is shown. They use a POSIX shell; Windows PowerShell equivalents are noted where needed.

### 1. Prerequisites and configuration

- Node.js **24+** and **pnpm 11.25.0** (the version pinned in `package.json`).
- Python **3.11+** with virtual-environment support.
- A Supabase project with PostgreSQL and Auth, plus the Supabase CLI for migrations.
- Docker is not required for the hosted Supabase path; `docker-compose.yml` is not the current setup path.

Install dependencies, then copy the template **only if a root `.env` does not already exist**:

```bash
pnpm install --frozen-lockfile
# New checkout only; keep an existing configured .env:
cp .env.example .env
```

In PowerShell, use `Copy-Item .env.example .env` for that new-checkout step.

Configure the root `.env` with your `DATABASE_URL` (Supabase connection string with `sslmode=require`), `SUPABASE_URL`, and the intended operator allowlist. Follow [Supabase setup](docs/SUPABASE.md) for Auth, pooler and migration details. Optional n8n and Sarvam credentials stay server-side.

**Configure Next.js separately:** create an ignored `apps/dashboard/.env.local` containing only these public values:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Next.js loads environment files from `apps/dashboard`, not the monorepo root. The root template lists these values for reference but does not wire them into the dashboard. Never copy `DATABASE_URL`, webhook secrets, service-role credentials or provider keys into a client environment. Restart the dashboard after changing its environment; public values are embedded at build time.

### 2. Install the API and apply migrations

```bash
cd services/api
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[test]"
cd ../..

supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

In PowerShell, create the environment with `python -m venv .venv` and activate with `.\.venv\Scripts\Activate.ps1` from `services/api`.

Apply migrations **before** starting against a shared database. SQLAlchemy startup table creation is not a replacement for migrations or RLS. For an isolated offline API smoke test, explicitly set `DATABASE_URL=sqlite+pysqlite:///./shaktios-local.db` in the API process; that does not provide Supabase Auth or a complete offline two-client demo.

### 3. Run the API and dashboard

With the API virtual environment active:

```bash
cd services/api
python -m uvicorn shaktios_api.main:app --app-dir src --env-file ../../.env --reload --port 8000
```

Use `--host 0.0.0.0` only when a local emulator/device needs to reach this development server. Do not expose the unhardened API publicly.

In a second terminal, from `shakti-os`:

```bash
pnpm --filter @shaktios/dashboard dev
```

- Dashboard: `http://localhost:3000` (sample landing), `/login`, then `/dashboard`.
- API: `http://localhost:8000/health`; interactive HTTP schema: `http://localhost:8000/docs`.
- `pnpm dev` starts workspace development tasks, **not** the Python API or sibling Expo app.

### 4. Authorize an operator and connect the citizen app

Use an existing Supabase email/password account. Configure **one trusted account** through root `OPERATOR_USER_IDS` or `OPERATOR_EMAILS`, then restart FastAPI. Trusted `app_metadata.role=operator|admin` also grants access. `GET /me` must return `is_operator: true`. There is no demo-login bypass; citizen sign-up must not grant operator capability.

Follow the [citizen app README](../shaktios-app/README.md) in the sibling repo. Its `EXPO_PUBLIC_API_URL` must reach this API: `http://10.0.2.2:8000` for the Android emulator, the development machine's LAN address for a physical device, or `http://localhost:8000` for a browser on the same machine. Use the same Supabase project. Add the Expo **web** origin to backend `CORS_ORIGINS` when testing in a browser; native apps are not governed by browser CORS.

### 5. Add optional demo data

The database seed is explicit and defaults to a no-connection dry-run:

```bash
services/api/.venv/bin/python scripts/seed_supabase.py --dry-run
# Only after confirming the intended database:
services/api/.venv/bin/python scripts/seed_supabase.py --apply
```

On Windows use `services/api/.venv/Scripts/python.exe`. Read the [seed runbook](docs/REAL_DATA.md) before applying; it documents fixture counts, the scoped Ranchi scenario, rerun behavior and legacy script caveats. See [DEMO.md](docs/DEMO.md) for the actual citizen → operator → citizen-status walkthrough.

## Checks

From the monorepo root:

```bash
pnpm lint
pnpm check-types
pnpm test
pnpm build
```

Run `python -m pytest` from `services/api` with its test dependencies installed. JavaScript workspace tests do not run Python or sibling mobile tests. [CONTRIBUTING.md](docs/CONTRIBUTING.md) lists package checks, current CI coverage and documentation-only validation.

## Documentation map

| Need | Read |
| --- | --- |
| Product scope and both user experiences | [Project overview](docs/PROJECT_OVERVIEW.md) |
| Components, data flow and code navigation | [Architecture](docs/ARCHITECTURE.md) |
| Domain, correlation, risk and lifecycle rules | [Domain](docs/DOMAIN.md) |
| HTTP routes, access, response shapes and WebSockets | [API](docs/API.md) |
| Signal types, adapters and ingestion caveats | [Events](docs/EVENTS.md) |
| Environment, Auth, schema, RLS and storage boundary | [Supabase](docs/SUPABASE.md) |
| Synthetic fixtures and seed commands | [Seed runbook](docs/REAL_DATA.md) |
| Rehearsal and acceptance walkthrough | [Demo](docs/DEMO.md) |
| Optional integrations | [Voice drafts](docs/VOICE_REPORTING.md), [n8n handoff](n8n/README.md) |
| Presentation narrative | [Presentation summary](PRESENTATION_SUMMARY.md) |
| Engineering rationale and remaining work | [Decisions](docs/DECISIONS.md), [Tasks](docs/TASKS.md) |
| API contract ownership and regeneration | [Contracts](docs/CONTRACTS.md) |
| Contribution expectations | [Contributing](docs/CONTRIBUTING.md), [Definition of done](docs/DEFINITION_OF_DONE.md) |

Keep detailed contracts in their owning guide and link to them rather than maintaining another copy. Links to `shaktios-app` assume both repos are checked out as siblings; they do not make the app part of this workspace.
