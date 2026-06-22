# 📡 Sharing a Live Demo with a Client

Two ways to let a remote client see the app: a **quick tunnel** (one-off, share your
local machine) or a **deploy** (permanent public link). Pick based on the need.

---

## A. Quick Tunnel — share your LOCAL app (one-off demo)

Exposes `localhost:5173` to the internet via a Cloudflare quick-tunnel. The URL is
random and changes every run; it stays live only while your laptop + the 3 processes
are running.

### One-time setup (ALREADY DONE — no need to repeat)
- `backend/.env` → `AUTH_ENFORCED=false` (open demo, no login)
- `frontend/.env.local` → `VITE_AUTH_ENFORCED=false` (legacy no-login app)
- `frontend/.env.development` → `VITE_API_URL` commented (frontend uses `/api` → Vite proxy)
- `frontend/vite.config.js` → `allowedHosts: ['.trycloudflare.com']`
- `backend/server.js` → CORS allows any `*.trycloudflare.com` (dev only)
- `cloudflared` installed at `C:\Program Files (x86)\cloudflared\cloudflared.exe`

> Because CORS + allowedHosts match ANY `*.trycloudflare.com` (regex, not a fixed URL),
> every future tunnel works with **zero code changes**.

### Every time the client asks (the recipe)
```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev

# Terminal 3 — tunnel (restart terminal once so cloudflared is on PATH)
cloudflared tunnel --url http://localhost:5173
```
cloudflared prints a box with `https://<random>.trycloudflare.com` → **send that URL to the client.**

### Keep in mind
- URL changes every run; laptop/tunnel off = link dead.
- All 3 terminals must stay running during the demo.
- Client sees YOUR local data (whatever is seeded).

### Switch back to normal dev (after the demo)
- `backend/.env` → `AUTH_ENFORCED=true`
- `frontend/.env.local` → `VITE_AUTH_ENFORCED=true`
- `frontend/.env.development` → uncomment `VITE_API_URL`
- Restart backend + frontend.

---

## B. Deploy — permanent public link (best for repeat access)

Already wired up: **Render** (backend) + **Vercel** (frontend).
```bash
git add -A
git commit -m "demo: <what changed>"
git push origin main
```
Render + Vercel auto-deploy → share the fixed Vercel URL (e.g. `gudmed-hms-new.vercel.app`).

- Always on, professional, client clicks anytime.
- Auth stays **ON** in prod (separate dashboard env vars — local `.env` changes don't affect it).
- Note: free DB plans can expire ~30 days — see memory `prod-deployment-stack`.

---

## Which to use?
| Situation | Use |
|-----------|-----|
| Quick one-off "show me" demo | **Quick tunnel** (A) |
| Client will look repeatedly / share with their team | **Deploy** (B) |
