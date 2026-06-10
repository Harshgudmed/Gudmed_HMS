// Per-doctor data isolation helpers.
//
// When access control is enforced and the caller is a doctor, their view of
// doctor-owned records (appointments, consultations, ...) must be limited to
// their own. Returns the doctor's userId to force into a `where.doctorId`, or
// null for every other role (and while AUTH_ENFORCED is off).

const AUTH_ENFORCED = process.env.AUTH_ENFORCED === 'true'

export function scopedDoctorId(req) {
  if (AUTH_ENFORCED && req.user?.role === 'doctor') return req.user.userId
  return null
}
