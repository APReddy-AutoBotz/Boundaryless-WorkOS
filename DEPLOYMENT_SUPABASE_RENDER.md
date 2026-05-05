# Supabase + Render Deployment Guide

**Application:** Boundaryless Resource Utilization Tracker  
**Recommended temporary deployment:** Render Web Service + Supabase PostgreSQL  
**Repository:** https://github.com/APReddy-AutoBotz/Boundaryless-RUT

This guide explains how to deploy the current application using a personal Supabase project now, while keeping handover to the company technical team simple later.

## 1. Important Security Note

Do not commit Supabase passwords, database URLs, API secrets, service role keys, or `.env` files to GitHub.

The database connection string should be stored only in:

- Local `.env` file for local testing
- Render Environment Variables for hosted deployment
- Company secret manager later during handover

If a database password was shared in chat, email, screenshots, or documentation, rotate it before final deployment.

## 2. Current Recommended Architecture

| Layer | Temporary Setup | Company Handover Setup |
|---|---|---|
| Frontend | Built by Vite and served by Express | Same, or migrated to company frontend hosting |
| Backend | Node/Express on Render | Same, or moved to company server/cloud |
| Database | Personal Supabase PostgreSQL | Company Supabase/PostgreSQL |
| Secrets | Render environment variables | Company secret manager / hosting env vars |

The handover should require changing environment variables, running migrations, and loading real data. The code should not need database-specific rewrites.

## 3. Supabase Details Needed

From Supabase, collect these values:

| Value | Required? | Where to Find |
|---|---:|---|
| Transaction pooler connection string | Yes | Supabase project > Connect > Transaction pooler |
| Database password | Yes | The password you set for the project database |
| Project ref | Useful | Supabase project URL or Project Settings |
| Region | Useful | Supabase project settings or connection host |
| SSL requirement | Yes | Use `PGSSLMODE=require` for Supabase |

For Render/serverless-style hosting, the transaction pooler string is usually safest because it supports many short-lived connections.

## 4. Render Environment Variables

In Render, add these variables to the Web Service:

| Key | Value |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler connection string |
| `PGSSLMODE` | `require` |
| `API_SESSION_SECRET` | Long random secret value |
| `NODE_ENV` | `production` |
| `LOGIN_RATE_LIMIT` | `8` |
| `AUTO_MIGRATE` | `true` for first Render deployment |
| `AUTO_SEED_DEMO` | `true` for first Render deployment/demo |
| `DEMO_SEED_PASSWORD` | `demo123` or your chosen demo password |
| `APP_URL` | Render app URL, for example `https://boundaryless-rut.onrender.com` |

Render provides `PORT` automatically. Do not manually set `PORT` unless Render asks you to.

For the first deployment on Render Free, keep `AUTO_MIGRATE=true` and `AUTO_SEED_DEMO=true`. This lets the app create the Supabase schema and seed demo users during startup because Render Free does not provide a convenient interactive shell.

After the demo database is seeded and you start making real changes, set `AUTO_SEED_DEMO=false` so startup does not refresh demo records on every deploy. Keeping `AUTO_MIGRATE=true` is safe because migrations are idempotent.

If your Supabase password contains special characters, URL-encode it in `DATABASE_URL`. For example, `@` inside the password must become `%40`.

## 5. How to Create `API_SESSION_SECRET`

Use any strong random value with at least 32 characters.

Examples:

- Generate with a password manager
- Use a random secret generator
- Use a command locally such as `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Do not reuse your Supabase password as the API session secret.

## 6. Render Web Service Settings

Create a new Render Web Service:

| Setting | Value |
|---|---|
| Repository | `APReddy-AutoBotz/Boundaryless-RUT` |
| Runtime | Node |
| Node Version | 22 |
| Branch | `main` or your active deployment branch |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

The repo also includes `render.yaml`, which Render can use as an infrastructure blueprint.

## 7. Database Migration and Demo Seed

After adding `DATABASE_URL` and `PGSSLMODE=require`, run these once against Supabase:

```bash
npm run api:migrate
npm run api:seed:demo
```

If you need to reset demo data:

```bash
npm run api:seed:demo -- --reset
```

Use reset carefully because it can overwrite seeded demo data.

## 8. Deployment Verification

After Render deploys, open:

```text
https://your-render-service.onrender.com/api/health
```

Expected result:

```json
{
  "status": "ok",
  "database": "connected"
}
```

If it says `database: not_configured`, then `DATABASE_URL` is missing or not available to the running service.

If it errors, check:

- Database password is correct
- Supabase connection string includes the project ref
- `PGSSLMODE=require`
- Render redeployed after environment variables were saved
- Supabase project is active and not paused

## 9. Company Handover

When handing over to the company technical team, provide:

- GitHub repository access
- This deployment guide
- Requirements document
- Technical status document
- User flow guide
- List of environment variables, without your secret values
- Migration command
- Seed/import command
- Known pending production items

The company team should replace:

| Temporary Personal Value | Company Replacement |
|---|---|
| Personal Supabase `DATABASE_URL` | Company database URL |
| Personal Supabase password | Company database password |
| Personal Render account/service | Company hosting account/service |
| Personal `API_SESSION_SECRET` | Company-generated secret |
| Demo seed data | Real employee/client/project/allocation data |

## 10. Minimum Production Checklist

Before calling this production-ready:

- `/api/health` returns `database: connected`
- Migrations run successfully
- Demo seed or real data load succeeds
- Login works from deployed URL
- Employees/projects/allocations persist across browsers
- Role-scoped views are manually tested
- `APP_URL` matches the deployed app URL
- Personal Supabase credentials are rotated or replaced before company ownership
- Company team owns hosting, database, secrets, backup, and restore process
