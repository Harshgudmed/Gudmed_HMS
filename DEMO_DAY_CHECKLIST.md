# 🎬 Demo Day Checklist — Keep the App Working

Follow this so the app **never fails** when your sir demos it.

---

## ⚡ 2 Minutes Before ANY Demo (most important)

**Open these two links in your browser to "wake up" the app:**

1. Backend (wakes the server):
   👉 https://gudmed-api.onrender.com/api/
   - You should see: `{"message":"Hospital Management API","version":"1.0.0"}`
   - If it takes 30-60s the first time, that's normal — it's waking up.

2. Frontend (the actual app):
   👉 https://frontend-sigma-gray-63.vercel.app
   - Log in once to confirm it loads.

✅ Once both load, the app is "warm" and will be **fast** for the next ~15 minutes.

> Do this right before your sir starts. It's the single best guarantee.

---

## 🛡️ Three Layers of Protection (already set up)

1. **Auto keep-alive** — A GitHub Action pings the backend every 10 minutes,
   24/7, so it rarely sleeps at all. (Runs automatically.)

2. **60-second timeout** — Even if the backend is cold, the app waits up to
   60s for it to wake instead of showing an error.

3. **Manual warm-up** — The 2-minute step above is your guaranteed backup.

---

## 🚨 If Something Looks Broken During a Demo

### Problem: Page is blank or shows an error
- **Refresh** with `Ctrl + Shift + R` (hard refresh)
- Wait 30-60 seconds — the backend may be waking up
- Try the backend link: https://gudmed-api.onrender.com/api/

### Problem: Login fails or data won't load
- The backend is probably still waking. Wait 1 minute, refresh.
- Confirm the backend link shows the API message.

### Problem: "timeout" or "network error"
- Backend is cold. Open https://gudmed-api.onrender.com/api/ in a new tab,
  wait until it responds, then refresh the app.

---

## 📋 Login Credentials (keep handy)

- **Admin:** admin@gudmed.in / Admin@123
- **Doctor:** priya@gudmed.in / Doctor@123

---

## 🔗 Important Links

| What | URL |
|------|-----|
| **App (frontend)** | https://frontend-sigma-gray-63.vercel.app |
| **Backend API** | https://gudmed-api.onrender.com/api/ |
| Vercel dashboard | https://vercel.com/harsh-rajs-projects-4074e1e0/frontend |
| Render dashboard | https://dashboard.render.com |
| GitHub repo | https://github.com/Harshgudmed/Gudmed_HMS |

---

## 💪 For 100% Reliability (recommended)

The free tier *can* still occasionally be slow. For a stress-free month:

### Best option — External uptime pinger (free, 5 minutes to set up)
1. Go to **https://uptimerobot.com** and sign up (free)
2. Add New Monitor → **HTTP(s)**
3. URL: `https://gudmed-api.onrender.com/api/`
4. Monitoring interval: **5 minutes**
5. Save.

This pings every 5 minutes from a reliable external service — your backend
will **never sleep**. More dependable than GitHub Actions.

### Bulletproof option — Upgrade Render ($7/month)
Render dashboard → gudmed-api → upgrade to Starter plan → spin-down disabled
entirely. Worth it if the demo is critical to your job.

---

## ✅ Quick Pre-Demo Routine (memorize this)

1. Open https://gudmed-api.onrender.com/api/ → wait for the message
2. Open https://frontend-sigma-gray-63.vercel.app → log in
3. Click around once (Patients, Consultations) to warm everything
4. Hand it to your sir — it's fast and ready 🚀

You've got this.
