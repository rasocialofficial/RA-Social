# RA Social — Complete Project (merged, single backend)

⚠️ IMPORTANT: There is only ONE backend. Both the RA Social app and the
Admin panel talk to this SAME backend — do not deploy two separate backends.

## Folders

- `backend/`   → Deploy to Render (your existing "Reels AI" service).
                 This single backend now includes:
                   - Normal user auth (register/login/profile)
                   - Forgot password → OTP reset flow (requires the configured reset/OTP delivery setup) → Reset password
                   - Change password (logged-in users)
                   - Admin login + admin dashboard APIs (stats/users/posts)
                   - Auto-creates a default admin account on startup
                     (an administrator account configured through DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD) — no Shell needed.
                   - Auto-runs database migrations on every deploy.

- `frontend/`  → Deploy to Vercel / GitHub Pages (your existing RA Social
                 frontend repo, e.g. reels-ai-pearl.vercel.app).
                 This is the app your users use. Includes PWA support
                 (installable on mobile/desktop, works offline for the
                 app shell).

- `admin/`     → Deploy to Vercel (your existing Reels-AI-Admin repo,
                 e.g. reels-ai-admin.vercel.app). This is for YOU only,
                 not for regular users.

## Both frontend/ and admin/ must point to the SAME backend URL

- `frontend/.env` → `VITE_API_URL=https://your-backend.onrender.com/api`
- `admin/.env.local` → `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`

## After deploying the backend

No manual steps needed — on first boot it will:
1. Run `npx prisma migrate deploy` automatically (via package.json start script)
2. Create the default admin account automatically if it doesn't exist

Check Render → Logs after deploying; you should see:
`✅ Default admin account created: admin@rasocial.com`

## AI Phase 11
See `PHASE_11_CREATIVE_VIDEO_VOICE_MEMORY_AI.md` for the Creative, Video, Voice transcription, and Personal AI Memory additions.
