import jwt from 'jsonwebtoken'
import { db } from '../config/db.js'

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

    res.json({
      success: true,
      token,
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
