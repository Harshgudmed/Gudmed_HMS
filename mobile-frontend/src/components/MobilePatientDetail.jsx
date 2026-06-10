import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import client from '@/api/client'
import PatientFormSheet from '@/components/MobilePatientForm'
import { toast } from 'sonner'
import {
  ChevronLeft, Phone, MessageCircle, Mail, CalendarDays, Droplet, VenusAndMars,
  FlaskConical, Scan, BedDouble, ArrowLeft, ClipboardList, Pencil,
  BadgeIndianRupee, XCircle, Clock3, Loader2,
} from 'lucide-react'

function shade(hex, percent) {
  const h = (hex || '#2E4168').replace('#', '')
  if (h.length !== 6) return hex
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const t = percent < 0 ? 0 : 255, p = Math.abs(percent) / 100
  r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
}
const fullName = (p) => [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || 'Unknown'
const initials = (p) => `${p.firstName?.[0] || ''}${p.lastName?.[0] || ''}`.toUpperCase() || 'P'
function age(dob) {
  if (!dob) return null
  const d = new Date(dob); if (isNaN(d)) return null
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000))
}
const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const waDigits = (phone) => { const d = (phone || '').replace(/\D/g, ''); return d.length === 10 ? `91${d}` : d }

export default function MobilePatientDetail({ brandColor = '#2E4168' }) {
  const { id } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(state?.patient)
  const [showForm, setShowForm] = useState(false)
  const [records, setRecords] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  const fetchRecords = () => {
    if (!id) return Promise.resolve()
    return client.get(`/patients/${id}/records`).then(res => setRecords(res?.data || {})).catch(() => setRecords({}))
  }
  useEffect(() => { fetchRecords() /* eslint-disable-next-line */ }, [id])

  const cancelAppointment = async (appt) => {
    if (!window.confirm('Cancel this appointment?')) return
    setCancellingId(appt.id)
    try {
      const res = await client.patch(`/appointments/${appt.id}`, { status: 'cancelled' })
      if (res?.success !== false) { toast.success('Appointment cancelled'); await fetchRecords() }
      else toast.error(res.error || 'Failed to cancel')
    } catch (e) { toast.error(e.message || 'Failed to cancel') }
    finally { setCancellingId(null) }
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade">
        <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <ClipboardList className="h-7 w-7 text-gray-400" />
        </div>
        <p className="font-semibold text-gray-700">Open a patient from the list</p>
        <button onClick={() => navigate('/patients')} className="mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}>
          <ArrowLeft className="h-4 w-4" /> Go to Patients
        </button>
      </div>
    )
  }

  const a = age(patient.dateOfBirth)
  const g = patient.gender ? patient.gender[0].toUpperCase() + patient.gender.slice(1) : '—'
  const labs = records?.labOrders || []
  const rads = records?.radiologyOrders || []
  const adms = records?.admissions || []
  const appts = records?.appointments || []
  const billing = records?.billing || null
  const rupee = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const isUpcoming = (ap) => new Date(ap.appointmentDate) >= todayStart && !['cancelled', 'completed', 'no_show'].includes(ap.status)
  const upcoming = appts.filter(isUpcoming)
  const history = appts.filter(ap => !isUpcoming(ap))
  const statusTint = {
    scheduled: 'bg-blue-50 text-blue-600', confirmed: 'bg-indigo-50 text-indigo-600',
    checked_in: 'bg-cyan-50 text-cyan-600', in_progress: 'bg-amber-50 text-amber-600',
    completed: 'bg-emerald-50 text-emerald-600', cancelled: 'bg-rose-50 text-rose-600',
    no_show: 'bg-gray-100 text-gray-500', rescheduled: 'bg-violet-50 text-violet-600',
  }

  return (
    <div className="pb-3">
      {/* Immersive header */}
      <div
        className="relative overflow-hidden px-4 pt-12 pb-16 text-white rounded-b-[32px]"
        style={{ background: `linear-gradient(150deg, ${shade(brandColor, 14)}, ${shade(brandColor, -30)})` }}
      >
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full glass ring-1 ring-white/20 flex items-center justify-center active:scale-95 transition" aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => setShowForm(true)} className="h-10 w-10 rounded-full glass ring-1 ring-white/20 flex items-center justify-center active:scale-95 transition" aria-label="Edit patient">
            <Pencil className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="relative mt-4 flex items-center gap-4 animate-fade">
          <div className="h-16 w-16 shrink-0 rounded-3xl bg-white/15 ring-2 ring-white/30 flex items-center justify-center text-xl font-bold">
            {initials(patient)}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight truncate">{fullName(patient)}</h1>
            <p className="text-sm text-white/80 mt-0.5">{[a != null ? `${a} yrs` : null, g].filter(Boolean).join(' · ')}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide">UHID {patient.mrn}</span>
              {patient.bloodGroup && <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-bold">{patient.bloodGroup}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Contact actions */}
      <div className="px-4 -mt-9">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 elev-3 animate-scale">
          <ContactBtn disabled={!patient.phonePrimary} href={`tel:${patient.phonePrimary}`} Icon={Phone} label="Call" tint="text-blue-600" bg="bg-blue-50" />
          <ContactBtn disabled={!patient.phonePrimary} href={`https://wa.me/${waDigits(patient.phonePrimary)}`} Icon={MessageCircle} label="WhatsApp" tint="text-emerald-600" bg="bg-emerald-50" />
          <ContactBtn disabled={!patient.email} href={`mailto:${patient.email}`} Icon={Mail} label="Email" tint="text-violet-600" bg="bg-violet-50" />
        </div>
      </div>

      {/* Information */}
      <div className="px-4 mt-6">
        <h2 className="text-[15px] font-bold text-gray-900 mb-3">Information</h2>
        <div className="grid grid-cols-2 gap-3 stagger">
          <InfoCard Icon={CalendarDays} label="Date of birth" value={patient.dateOfBirth ? fmtDate(patient.dateOfBirth) : '—'} brandColor={brandColor} />
          <InfoCard Icon={VenusAndMars} label="Gender" value={g} brandColor={brandColor} />
          <InfoCard Icon={Droplet} label="Blood group" value={patient.bloodGroup || '—'} brandColor={brandColor} />
          <InfoCard Icon={Phone} label="Phone" value={patient.phonePrimary || '—'} brandColor={brandColor} />
        </div>
      </div>

      {/* Appointments & Billing */}
      <div className="px-4 mt-6">
        <h2 className="text-[15px] font-bold text-gray-900 mb-3">Appointments &amp; Billing</h2>

        {/* Billing summary */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl bg-white p-3 elev-1 border border-gray-100/70 text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400"><BadgeIndianRupee className="h-3.5 w-3.5" /><span className="text-[10px] font-medium">Billed</span></div>
            <p className="mt-1 text-sm font-extrabold text-gray-800">{rupee(billing?.totalBilled)}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-3 border border-emerald-100 text-center">
            <p className="text-[10px] font-medium text-emerald-600">Paid</p>
            <p className="mt-1 text-sm font-extrabold text-emerald-700">{rupee(billing?.totalPaid)}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-3 border border-amber-100 text-center">
            <p className="text-[10px] font-medium text-amber-600">Balance</p>
            <p className="mt-1 text-sm font-extrabold text-amber-700">{rupee(billing?.balanceDue)}</p>
          </div>
        </div>

        {records !== null && (
          <>
            {/* Upcoming */}
            <div className="mt-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-emerald-600" />Upcoming ({upcoming.length})</h3>
              {upcoming.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No upcoming appointments</p>
              ) : (
                <div className="space-y-2">
                  {upcoming.map(ap => (
                    <div key={ap.id} className="rounded-xl bg-white p-3 elev-1 border border-gray-100/70">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800">{fmtDate(ap.appointmentDate)}{ap.appointmentTime ? ` · ${ap.appointmentTime}` : ''}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusTint[ap.status] || 'bg-gray-100 text-gray-500'}`}>{ap.status?.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{ap.doctor?.fullName || 'Doctor —'}{ap.department?.name ? ` · ${ap.department.name}` : ''}{ap.consultationFee != null ? ` · ${rupee(ap.consultationFee)}` : ''}</p>
                      <button onClick={() => cancelAppointment(ap)} disabled={cancellingId === ap.id} className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 py-1.5 text-xs font-semibold text-rose-600 active:scale-95 transition disabled:opacity-60">
                        {cancellingId === ap.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">History ({history.length})</h3>
                <div className="space-y-2">
                  {history.slice(0, 8).map(ap => (
                    <div key={ap.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 elev-1 border border-gray-100/70">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{fmtDate(ap.appointmentDate)} · {ap.doctor?.fullName || '—'}</p>
                        <p className="text-[11px] text-gray-400 capitalize">{ap.appointmentType?.replace(/_/g, ' ')}{ap.consultationFee != null ? ` · ${rupee(ap.consultationFee)}` : ''}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusTint[ap.status] || 'bg-gray-100 text-gray-500'}`}>{ap.status?.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Medical records */}
      <div className="px-4 mt-6">
        <h2 className="text-[15px] font-bold text-gray-900 mb-3">Medical Records</h2>
        {records === null ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white elev-1 animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <RecordStat Icon={FlaskConical} label="Lab Orders" count={labs.length} tint="text-cyan-600" bg="bg-cyan-50" />
              <RecordStat Icon={Scan} label="Radiology" count={rads.length} tint="text-indigo-600" bg="bg-indigo-50" />
              <RecordStat Icon={BedDouble} label="Admissions" count={adms.length} tint="text-orange-600" bg="bg-orange-50" />
            </div>

            <RecentList title="Recent lab orders" items={labs} Icon={FlaskConical} tint="text-cyan-600" bg="bg-cyan-50"
              name={(x) => x.test?.name || x.testName || x.test?.testName || 'Lab test'} />
            <RecentList title="Recent radiology" items={rads} Icon={Scan} tint="text-indigo-600" bg="bg-indigo-50"
              name={(x) => x.exam?.name || x.examName || x.exam?.examName || 'Radiology exam'} />

            {labs.length === 0 && rads.length === 0 && adms.length === 0 && (
              <div className="mt-4 rounded-2xl bg-white p-6 text-center elev-1">
                <p className="text-sm text-gray-400">No medical records yet for this patient.</p>
              </div>
            )}
          </>
        )}
      </div>

      {showForm && <PatientFormSheet brandColor={brandColor} patient={patient} onClose={() => setShowForm(false)} onSaved={(u) => { setPatient(p => ({ ...p, ...u })); setShowForm(false) }} />}
    </div>
  )
}

function ContactBtn({ href, Icon, label, tint, bg, disabled }) {
  const cls = `flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 ${bg} ${tint} active:scale-95 transition ${disabled ? 'opacity-40 pointer-events-none' : ''}`
  return (
    <a href={disabled ? undefined : href} className={cls} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
      <Icon className="h-5 w-5" />
      <span className="text-[11px] font-semibold">{label}</span>
    </a>
  )
}

function InfoCard({ Icon, label, value, brandColor }) {
  return (
    <div className="rounded-2xl bg-white p-3.5 elev-1 border border-gray-100/70">
      <div className="flex items-center gap-1.5 text-gray-400">
        <Icon className="h-3.5 w-3.5" style={{ color: brandColor }} />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-gray-800 truncate">{value}</p>
    </div>
  )
}

function RecordStat({ Icon, label, count, tint, bg }) {
  return (
    <div className="rounded-2xl bg-white p-3 elev-2 border border-gray-100/70 flex flex-col items-center">
      <div className={`h-9 w-9 rounded-xl ${bg} ${tint} flex items-center justify-center mb-1.5`}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <p className="text-lg font-extrabold text-gray-900 leading-none">{count}</p>
      <p className="text-[10px] text-gray-500 mt-1 text-center leading-tight">{label}</p>
    </div>
  )
}

function RecentList({ title, items, Icon, tint, bg, name }) {
  if (!items?.length) return null
  return (
    <div className="mt-5">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-2">
        {items.slice(0, 3).map((x, i) => (
          <div key={x.id || i} className="flex items-center gap-3 rounded-xl bg-white p-3 elev-1">
            <div className={`h-9 w-9 shrink-0 rounded-lg ${bg} ${tint} flex items-center justify-center`}>
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{name(x)}</p>
              {(x.createdAt || x.orderedAt || x.date) && (
                <p className="text-[11px] text-gray-400">{fmtDate(x.createdAt || x.orderedAt || x.date)}</p>
              )}
            </div>
            {x.status && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 capitalize">{x.status}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
