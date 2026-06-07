import axios from 'axios'

// ─────────────────────────────────────────────────────────────────────────────
// ONE LINE TO CHANGE FOR PROD:
//   In .env.production → VITE_API_URL=https://gudmed-api.onrender.com/api
//   In .env.development → VITE_API_URL=http://localhost:5000/api  (or use proxy)
// ─────────────────────────────────────────────────────────────────────────────
// Dev → Vite proxy at "/api". Production (Vercel / Capacitor) → the live backend.
// The hard-coded prod fallback guarantees the app works even if VITE_API_URL is
// not configured in the Vercel dashboard.
const PROD_API = 'https://gudmed-api.onrender.com/api'
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? PROD_API : '/api')

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // Send/receive the httpOnly auth cookie on every request (cross-site in prod).
  withCredentials: true,
  // 60s to tolerate Render free-tier cold starts (backend spins down after
  // ~15 min idle and takes 30-60s to wake on the first request).
  timeout: 60000,
})

// The httpOnly cookie is the primary auth transport and is sent automatically.
// We still attach a Bearer header when a token is present (e.g. older sessions
// or non-cookie environments) as a fallback for multi-tenancy.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const data    = error.response?.data
    const message = data?.error || error.message || 'Request failed'
    const err     = new Error(message)
    err.status    = error.response?.status
    err.code      = data?.code
    return Promise.reject(err)
  }
)

export default client
