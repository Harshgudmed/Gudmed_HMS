import axios from 'axios'

const GUDMED_API_URL   = process.env.GUDMED_API_URL
const GUDMED_MOBILE    = process.env.GUDMED_DOCTOR_MOBILE
const GUDMED_PASSWORD  = process.env.GUDMED_DOCTOR_PASSWORD
const GUDMED_DOCTOR_CODE = process.env.GUDMED_DOCTOR_CODE

// In-memory token cache — refreshed automatically when expired
let _token = null
let _tokenExpiresAt = 0

function isConfigured() {
  return GUDMED_API_URL && GUDMED_MOBILE && GUDMED_PASSWORD && GUDMED_DOCTOR_CODE
}

// Converts any time string to GudMed's expected "h:mm AM/PM" format
function toGudmedTime(timeStr) {
  if (!timeStr) return ''

  // Already in 12-hour format like "9:30 AM" — return as-is
  if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(timeStr)) return timeStr

  // Convert 24-hour "HH:MM" → "h:mm AM/PM"
  const [hourStr, minStr] = timeStr.split(':')
  let hour = parseInt(hourStr, 10)
  const min = minStr || '00'
  const period = hour >= 12 ? 'PM' : 'AM'
  if (hour === 0) hour = 12
  else if (hour > 12) hour -= 12
  return `${hour}:${min} ${period}`
}

async function getAuthToken() {
  if (_token && Date.now() < _tokenExpiresAt) return _token

  const res = await axios.post(
    `${GUDMED_API_URL}/v1/docMgmt/loginjwt`,
    { mobileNbr: GUDMED_MOBILE, paswd: GUDMED_PASSWORD },
    { headers: { 'Content-Type': 'application/json' } },
  )

  _token = res.data?.body?.token
  if (!_token) throw new Error('GudMed login returned no token')

  // Cache for 23 hours — GudMed tokens are typically 24-hour lived
  _tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000
  return _token
}

/**
 * Syncs a newly created HMS appointment to GudMed's DocPortal.
 * Non-fatal — caller should wrap in try/catch and only warn on failure.
 *
 * @param {object} params
 * @param {string} params.patientName     Full name of the patient
 * @param {string} params.patientMobile   10-digit mobile number
 * @param {string} params.appointmentDate ISO date string or "YYYY-MM-DD"
 * @param {string} params.appointmentTime Time string in any format
 */
export async function syncAppointmentToGudmed({ patientName, patientMobile, appointmentDate, appointmentTime }) {
  if (!isConfigured()) {
    return { skipped: true, reason: 'GudMed env vars not set' }
  }

  const authToken = await getAuthToken()

  // Format date as YYYY-MM-DD
  const formattedDate = appointmentDate.includes('T')
    ? appointmentDate.split('T')[0]
    : appointmentDate

  const payload = {
    patientName,
    patientMobileNo: patientMobile,
    appointmentDate: formattedDate,
    appointmentTime: toGudmedTime(appointmentTime),
    doctorId: GUDMED_DOCTOR_CODE,
  }

  // Step 1 — get appointment-scoped JWT from GudMed
  const jwtRes = await axios.post(
    `${GUDMED_API_URL}/v1/docMgmt/saveNewAppointmentsjwt`,
    payload,
    { headers: { 'x-auth-token': authToken, 'Content-Type': 'application/json' } },
  )

  const appointmentJwt = jwtRes.data?.body?.token
  if (!appointmentJwt) throw new Error('GudMed did not return appointment JWT')

  // Step 2 — create the appointment
  const saveRes = await axios.post(
    `${GUDMED_API_URL}/v1/docMgmt/saveNewAppointments`,
    { ...payload, jwtToken: appointmentJwt },
    { headers: { 'x-auth-token': authToken, 'Content-Type': 'application/json' } },
  )

  return saveRes.data
}
