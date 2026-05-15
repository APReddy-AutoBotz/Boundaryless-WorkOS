# Security and Operations Checklist

Use this checklist before production go-live. Items marked company-owned require customer/company decisions or infrastructure.

## 1. Secrets

| Item | Status |
|---|---|
| Company `DATABASE_URL` is stored only in the hosting secret manager. | Company-owned |
| `API_SESSION_SECRET` is company-generated and at least 32 characters. | Company-owned |
| `APP_MODE=production` and `DISABLE_DEMO_FALLBACK=true` are set for company production. | Required |
| Enterprise feature flags are enabled only for phases that passed role UAT. | Required |
| `EMAIL_PROVIDER`, `TEAMS_PROVIDER`, and `IDENTITY_PROVIDER` are set to approved provider modes. | Company-owned |
| Demo or personal Supabase credentials are removed before handover. | Company-owned |
| `.env` files and secret screenshots are not committed. | Must pass |
| Any password shared in chat/email/screenshots is rotated. | Company-owned |

## 2. Authentication and Sessions

| Item | Status |
|---|---|
| Password minimum length is configured through `PASSWORD_MIN_LENGTH`. | Company-owned |
| Password reset delivery channel is approved. | Company-owned |
| Temporary passwords force password change on next login. | Implemented |
| Login rate limiting is enabled. | Implemented |
| Session lifetime is configured through `API_SESSION_TTL_HOURS`. | Implemented, company value required |
| Disabled/exited users cannot login. | Implemented, UAT required |
| Session expiry and refresh policy is signed off. | Company-owned |

## 3. Authorization

| Item | Status |
|---|---|
| Frontend route access is role-gated. | Implemented |
| Backend role middleware protects API routes using active role, not inactive assigned roles. | Implemented |
| Employee, PM, CD, and Admin/HR scoped reads are covered by smoke tests. | Implemented |
| Team Lead final data scope is confirmed. | Company-owned |
| Project Manager approval authority is confirmed. | Company-owned |

## 4. Audit

| Item | Status |
|---|---|
| Critical backend mutations write audit records with source, active role, and request metadata where available. | Implemented for core writes |
| Audit retention period is defined. | Company-owned |
| Audit export permissions are approved. | Company-owned |
| Tamper-resistant audit storage is designed for go-live. | Company-owned |

## 5. Backup and Restore

| Item | Status |
|---|---|
| Backup frequency is defined. | Company-owned |
| Backup retention is defined. | Company-owned |
| Restore owner is assigned. | Company-owned |
| Restore test is performed before go-live. | Company-owned |
| Recovery time and recovery point expectations are documented. | Company-owned |

## 6. Monitoring and Support

| Item | Status |
|---|---|
| Application logs are centralized. | Company-owned |
| Error logs are monitored. | Company-owned |
| Database health alert is configured. | Company-owned |
| Render/platform deploy failure alerts are configured. | Company-owned |
| Support owner and escalation channel are assigned. | Company-owned |

## 7. Release Sign-Off

| Item | Status |
|---|---|
| `npm run test:prod-readiness` passes. | Required |
| Hosted read-only API smoke passes. | Required |
| Role UAT checklist is completed. | Required |
| Real data reconciliation is completed. | Required |
| Security, backup, monitoring, and support owners sign off. | Company-owned |
