import jwt from 'jsonwebtoken'
import { db } from '../config/db.js'
import { TOKEN_COOKIE, authCookieOptions, clearCookieOptions } from '../config/cookie.js'

/**
 * POST /api/auth/login
 * Body: { email, password, organizationId? }
 * Returns a JWT containing userId, organizationId, role, email.
 *
 * NOTE: This is a skeleton — add password hashing (bcrypt) before production use.
 */
export async function login(req, res, next) {
  try {
    const { email, password, organizationId: bodyOrgId } = req.body

    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' })
    }

    const user = await db.user.findUnique({ where: { email } })

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }

    // TODO: replace with bcrypt.compare(password, user.passwordHash) once passwords are hashed
    // For now accept any non-empty password as placeholder
    if (!password) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }

    const orgId = user.organizationId || bodyOrgId || process.env.ORGANIZATION_ID || 'org-demo'

    const token = jwt.sign(
      {
        userId: user.id,
        organizationId: orgId,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '8h' }
    )

    // Primary auth transport: httpOnly Secure cookie (sent over HTTPS only in prod).
    res.cookie(TOKEN_COOKIE, token, authCookieOptions)

    res.json({
      success: true,
      token, // also returned for backward-compatibility / non-browser clients
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        organizationId: orgId,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/logout
 * Clears the auth cookie.
 */
export async function logout(_req, res) {
  res.clearCookie(TOKEN_COOKIE, clearCookieOptions)
  res.json({ success: true, message: 'Logged out' })
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user (decoded from the cookie/header).
 */
export async function me(req, res) {
  if (!req.user?.userId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' })
  }
  const user = await db.user.findUnique({ where: { id: req.user.userId } })
  if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' })
  res.json({
    success: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      organizationId: req.user.organizationId,
    },
  })
}
