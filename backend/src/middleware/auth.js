import jwt from 'jsonwebtoken'

export function authenticate(req, res, next) {
  try {
    // Prefer the httpOnly cookie; fall back to the Authorization header for
    // non-browser clients (and backward compatibility).
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1]
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret')
      req.user = decoded
      req.organizationId = decoded.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    } else {
      req.organizationId = process.env.ORGANIZATION_ID || 'org-demo'
    }
    next()
  } catch {
    // Token invalid - still allow but use default org (don't break existing flow)
    req.organizationId = process.env.ORGANIZATION_ID || 'org-demo'
    next()
  }
}
