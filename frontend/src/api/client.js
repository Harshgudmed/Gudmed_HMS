import axios from 'axios'

// ─────────────────────────────────────────────────────────────────────────────
// ONE LINE TO CHANGE FOR PROD:
//   In .env.production → VITE_API_URL=https://gudmed-api.onrender.com/api
//   In .env.development → VITE_API_URL=http://localhost:5000/api  (or use proxy)
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Attach JWT token on every request (for multi-tenancy)
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
