# Boundaryless Resource Utilization Tracker

Internal resource utilization, allocation, timesheet, and governance tracker for employees, Project Managers, Country Directors, HR, and Admin users.

The application can run in two modes:

- Local demo mode: Vite frontend with browser-local demo data for fast demos and UI testing.
- Production/API mode: Node/Express backend with PostgreSQL/Supabase persistence, username/password login, backend validation, scoped API reads, and production static serving.

## Prerequisites

- Node.js 22
- npm
- PostgreSQL or Supabase PostgreSQL for backend/API mode

## Local Demo

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Seeded demo credentials use password `demo123`. Example users include:

- `admin-1`
- `hr-1`
- `pm-1`
- `emp-1`

## Backend Mode

Create a local `.env` from `.env.example`, then set:

```text
DATABASE_URL=postgres://...
PGSSLMODE=require
API_SESSION_SECRET=<long-random-secret>
```

Run:

```bash
npm install
npm run api:migrate
npm run api:seed:demo
npm run build
npm start
```

Open `http://localhost:10000` unless a different `PORT` is configured.

Health check:

```text
/api/health
```

Expected backend-ready state:

```json
{ "status": "ok", "database": "connected" }
```

## Render + Supabase Deployment

Use `DEPLOYMENT_SUPABASE_RENDER.md` for the full deployment guide.

Important seed rule:

- Use `AUTO_SEED_DEMO=true` only for the first disposable demo deployment.
- Set `AUTO_SEED_DEMO=false` before editing demo records into real company records.
- Use `RESET_DEMO_DATA=true` or `npm run api:seed:demo -- --reset` only for disposable demo databases.

## Validation

Run before handover or deployment:

```bash
npm run lint
npm run build
npm run test:backend
npm run test:access
npm run test:requirements
npm run test:backend-api
```

`test:backend-api` skips unless `BACKEND_SMOKE_BASE_URL` is provided. Set `BACKEND_SMOKE_MUTATIONS=true` only when it is acceptable for the test to write a settings record.

## Handover Documents

- `Resource_Utilization_Tracker_Requirements.md`
- `Resource_Utilization_Tracker_Technical_Status.md`
- `Resource_Utilization_Tracker_User_Flow_Guide.md`
- `DEPLOYMENT_SUPABASE_RENDER.md`

Company handover should normally require changing environment variables, running migrations, and loading real data. It should not require a code rewrite for the database provider.
