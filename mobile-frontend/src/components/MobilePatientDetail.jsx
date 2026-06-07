import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import client from '@/api/client'
import PatientFormSheet from '@/components/MobilePatientForm'
import {
  ChevronLeft, Phone, MessageCircle, Mail, CalendarDays, Droplet, VenusAndMars,
  FlaskConical, Scan, BedDouble, ArrowLeft, ClipboardList, Pencil,
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

  useEffect(() => {
    if (!id) return
    client.get(`/patients/${id}/records`).then(res => setRecords(res?.data || {})).catch(() => setRecords({}))
  }, [id])

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
