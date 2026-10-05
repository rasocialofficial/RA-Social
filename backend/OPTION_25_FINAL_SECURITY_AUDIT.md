# Option 25 — Final Security & Production Audit

## Applied fixes
- Added dependency-free rate limiting to registration, login, admin login, password-reset request/OTP verification/reset endpoints.
- Added 2 MB JSON/urlencoded body limits.
- Enabled `trust proxy` so deployed client IPs are handled correctly behind a reverse proxy.
- Admin login now creates a tracked Session and signs the JWT with a session `jti`.
- Admin middleware now enforces session revocation/expiry for tracked admin tokens.
- Socket.IO now rejects revoked/expired tracked sessions.
- Admin forgot-password now uses the same production email/SMS provider flow and generic account-existence response.

## Verification
- All backend JavaScript files pass `node --check`.
- Frontend relative-import audit: no missing local imports found.
- ZIP integrity verified after packaging.
- Prisma/Vite full builds were not claimed because the required CLIs/dependencies were unavailable in the execution environment.

## Deployment
Run the existing backend start command so Prisma generates/pushes the schema before startup. Configure real provider/database secrets in the hosting environment; do not commit `.env`.
