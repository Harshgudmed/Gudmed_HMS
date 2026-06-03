import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { router } from './src/routes/index.js'
import { errorHandler } from './src/middleware/errorHandler.js'

const app  = express()
const PORT = process.env.PORT || 5000

// ── CORS — works locally AND in production ───────────────────────────────────
// To add a new frontend URL: just add it to ALLOWED_ORIGINS or set FRONTEND_URL in .env
const ALLOWED_ORIGINS = [
  'http://localhost:5173',          // local dev
  'http://localhost:4173',          // local preview (npm run preview)
  'https://gudmed.vercel.app',      // production (old URL)
  'https://frontend-sigma-gray-63.vercel.app',  // new production frontend
  'https://frontend-49efa18nl-harsh-rajs-projects-4074e1e0.vercel.app',  // new Vercel deployment
  process.env.FRONTEND_URL,         // set this in Render dashboard → Environment
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}))

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  status:  'ok',
  env:     process.env.NODE_ENV,
  version: '1.0.0',
  time:    new Date(),
}))
app.use('/api', router)

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[${process.env.NODE_ENV}] Backend running on http://localhost:${PORT}`)
})
