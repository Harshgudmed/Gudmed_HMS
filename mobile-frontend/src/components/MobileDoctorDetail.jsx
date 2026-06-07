import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BookAppointmentSheet from '@/components/BookAppointmentSheet'
import {
  ChevronLeft, Phone, MessageCircle, Mail, CalendarPlus, BadgeCheck,
  Stethoscope, Building2, ShieldCheck, ArrowLeft, AtSign,
} from 'lucide-react'

function shade(hex, percent) {
  const h = (hex || '#2E4168').replace('#', '')
  if (h.length !== 6) return hex
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const t = percent < 0 ? 0 : 255, p = Math.abs(percent) / 100
  r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
}
const initials = (name = '') => name.replace(/^Dr\.?\s*/i, '').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'Dr'
const waDigits = (phone) => { const d = (phone || '').replace(/\D/g, ''); return d.length === 10 ? `91${d}` : d }

export default function MobileDoctorDetail({ brandColor = '#2E4168' }) {
  const { state } = useLocation()
  const navigate = useNavigate()
  useParams()
  const d = state?.doctor
  const [showBook, setShowBook] = useState(false)

  if (!d) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade">
        <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Stethoscope className="h-7 w-7 text-gray-400" />
        </div>
        <p className="font-semibold text-gray-700">Open a doctor from the list</p>
        <button onClick={() => navigate('/doctors')} className="mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}>
          <ArrowLeft className="h-4 w-4" /> Go to Doctors
        </button>
      </div>
    )
  }

  const name = d.fullName?.replace(/^Dr\.?\s*/i, '')

  return (
    <div className="pb-3">
      {/* Immersive header */}
      <div
        className="relative overflow-hidden px-4 pt-12 pb-20 text-white rounded-b-[32px]"
        style={{ background: `linear-gradient(150deg, ${shade(brandColor, 14)}, ${shade(brandColor, -30)})` }}
      >
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <button onClick={() => navigate(-1)} className="relative h-10 w-10 rounded-full glass ring-1 ring-white/20 flex items-center justify-center active:scale-95 transition" aria-label="Back">
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="relative mt-3 flex flex-col items-center text-center animate-fade">
          <div className="relative">
            <div className="h-20 w-20 rounded-[26px] bg-white/15 ring-2 ring-white/30 flex items-center justify-center text-2xl font-bold">
              {initials(d.fullName)}
            </div>
            <BadgeCheck className="absolute -bottom-1 -right-1 h-7 w-7 text-white fill-blue-500" />
          </div>
          <h1 className="mt-3 text-xl font-extrabold leading-tight">Dr. {name}</h1>
          <p className="mt-1 text-sm text-white/85 font-medium">{d.specialization || 'General Physician'}</p>
          {d.department?.name && <p className="text-xs text-white/70 mt-0.5">{d.department.name}</p>}
        </div>
      </div>

      {/* Contact actions */}
      <div className="px-4 -mt-9">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 elev-3 animate-scale">
          <ContactBtn disabled={!d.phone} href={`tel:${d.phone}`} Icon={Phone} label="Call" tint="text-blue-600" bg="bg-blue-50" />
          <ContactBtn disabled={!d.phone} href={`https://wa.me/${waDigits(d.phone)}`} Icon={MessageCircle} label="WhatsApp" tint="text-emerald-600" bg="bg-emerald-50" />
          <ContactBtn disabled={!d.email} href={`mailto:${d.email}`} Icon={Mail} label="Email" tint="text-violet-600" bg="bg-violet-50" />
        </div>
      </div>

      {/* Book appointment CTA */}
      <div className="px-4 mt-4">
        <button
          onClick={() => setShowBook(true)}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-3 active:scale-[.99] transition"
          style={{ background: `linear-gradient(135deg, ${shade(brandColor, 16)}, ${shade(brandColor, -20)})` }}
        >
          <CalendarPlus className="h-5 w-5" /> Book Appointment
        </button>
      </div>

      {/* Details */}
      <div className="px-4 mt-6">
        <h2 className="text-[15px] font-bold text-gray-900 mb-3">Details</h2>
        <div className="space-y-2.5">
          <DetailRow Icon={Stethoscope} label="Speciality" value={d.specialization || 'General Physician'} brandColor={brandColor} />
          <DetailRow Icon={Building2} label="Department" value={d.department?.name || '—'} brandColor={brandColor} />
          <DetailRow Icon={AtSign} label="Email" value={d.email || '—'} brandColor={brandColor} />
          <DetailRow Icon={Phone} label="Phone" value={d.phone || '—'} brandColor={brandColor} />
          <DetailRow Icon={ShieldCheck} label="Status" value={d.isActive === false ? 'Inactive' : 'Active'} brandColor={brandColor} valueClass={d.isActive === false ? 'text-gray-500' : 'text-emerald-600'} />
        </div>
      </div>

      {showBook && <BookAppointmentSheet brandColor={brandColor} doctor={d} onClose={() => setShowBook(false)} onCreated={() => setShowBook(false)} />}
    </div>
  )
}

function ContactBtn({ href, Icon, label, tint, bg, disabled }) {
  return (
    <a
      href={disabled ? undefined : href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 ${bg} ${tint} active:scale-95 transition ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[11px] font-semibold">{label}</span>
    </a>
  )
}

function DetailRow({ Icon, label, value, brandColor, valueClass = 'text-gray-800' }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-1 border border-gray-100/70">
      <div className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}14`, color: brandColor }}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-gray-400 font-medium">{label}</p>
        <p className={`text-sm font-semibold truncate ${valueClass}`}>{value}</p>
      </div>
    </div>
  )
}
