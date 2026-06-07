import { useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ArrowLeft, Stethoscope, Thermometer, Activity, Heart, Droplet,
  Wind, Scale, Ruler, Pill, FlaskConical, Scan,
} from 'lucide-react'

function shade(hex, percent) {
  const h = (hex || '#2E4168').replace('#', '')
  if (h.length !== 6) return hex
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const t = percent < 0 ? 0 : 255, p = Math.abs(percent) / 100
  r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
}
const initials = (p) => `${p?.firstName?.[0] || ''}${p?.lastName?.[0] || ''}`.toUpperCase() || 'P'
const pName = (p) => p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : 'Unknown patient'
const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }

export default function MobileConsultationDetail({ brandColor = '#2E4168' }) {
  const { state } = useLocation()
  const navigate = useNavigate()
  const c = state?.consultation

  if (!c) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade">
        <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4"><Stethoscope className="h-7 w-7 text-gray-400" /></div>
        <p className="font-semibold text-gray-700">Open a consultation from the list</p>
        <button onClick={() => navigate('/consultations')} className="mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}><ArrowLeft className="h-4 w-4" /> Consultations</button>
      </div>
    )
  }

  const vitals = [
    c.temperature != null && { Icon: Thermometer, label: 'Temp', value: `${c.temperature}°F`, tint: 'text-orange-500', bg: 'bg-orange-50' },
    (c.bloodPressureSystolic != null && c.bloodPressureDiastolic != null) && { Icon: Activity, label: 'BP (mmHg)', value: `${c.bloodPressureSystolic}/${c.bloodPressureDiastolic}`, tint: 'text-rose-500', bg: 'bg-rose-50' },
    c.pulseRate != null && { Icon: Heart, label: 'Pulse', value: `${c.pulseRate} bpm`, tint: 'text-red-500', bg: 'bg-red-50' },
    c.oxygenSaturation != null && { Icon: Droplet, label: 'SpO₂', value: `${c.oxygenSaturation}%`, tint: 'text-sky-500', bg: 'bg-sky-50' },
    c.respiratoryRate != null && { Icon: Wind, label: 'Resp. rate', value: `${c.respiratoryRate}/min`, tint: 'text-cyan-500', bg: 'bg-cyan-50' },
    c.weight != null && { Icon: Scale, label: 'Weight', value: `${c.weight} kg`, tint: 'text-emerald-500', bg: 'bg-emerald-50' },
    c.height != null && { Icon: Ruler, label: 'Height', value: `${c.height} cm`, tint: 'text-violet-500', bg: 'bg-violet-50' },
  ].filter(Boolean)

  const sections = [
    ['Chief complaint', c.chiefComplaint],
    ['History of present illness', c.historyOfPresentIllness],
    ['Physical examination', c.physicalExamination],
    ['Diagnosis', c.diagnosis],
    ['Treatment plan', c.treatmentPlan],
    ['Notes', c.notes],
  ].filter(([, v]) => v)

  const rxItems = []
  ;(c.prescriptions || []).forEach(rx => { if (Array.isArray(rx.items)) rx.items.forEach(i => rxItems.push(i)); else rxItems.push(rx) })
  const labs = c.labOrders || []
  const rads = c.radiologyOrders || []

  return (
    <div className="pb-3">
      {/* Header */}
      <div className="relative overflow-hidden px-4 pt-12 pb-16 text-white rounded-b-[32px]" style={{ background: `linear-gradient(150deg, ${shade(brandColor, 14)}, ${shade(brandColor, -30)})` }}>
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <button onClick={() => navigate(-1)} className="relative h-10 w-10 rounded-full glass ring-1 ring-white/20 flex items-center justify-center active:scale-95 transition" aria-label="Back"><ChevronLeft className="h-5 w-5" /></button>
        <div className="relative mt-4 flex items-center gap-4 animate-fade">
          <div className="h-16 w-16 shrink-0 rounded-3xl bg-white/15 ring-2 ring-white/30 flex items-center justify-center text-xl font-bold">{initials(c.patient)}</div>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight truncate">{pName(c.patient)}</h1>
            <p className="text-sm text-white/80 mt-0.5">{c.doctor?.fullName ? `Dr. ${c.doctor.fullName.replace(/^Dr\.?\s*/i, '')}` : '—'} · {fmtDate(c.visitDate)}</p>
            {c.visitType && <span className="mt-1.5 inline-block rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold capitalize">{c.visitType.replace(/_/g, ' ')}</span>}
          </div>
        </div>
      </div>

      {/* Vitals */}
      {vitals.length > 0 && (
        <div className="px-4 -mt-8">
          <div className="rounded-2xl bg-white p-3.5 elev-3">
            <div className="grid grid-cols-3 gap-3">
              {vitals.map(v => (
                <div key={v.label} className="flex flex-col items-center text-center">
                  <div className={`h-9 w-9 rounded-xl ${v.bg} ${v.tint} flex items-center justify-center mb-1`}><v.Icon className="h-[18px] w-[18px]" /></div>
                  <p className="text-sm font-extrabold text-gray-900 leading-none">{v.value}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{v.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Clinical sections */}
      {sections.length > 0 && (
        <div className="px-4 mt-6 space-y-3">
          {sections.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white p-3.5 elev-1 border border-gray-100/70">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
              <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Prescriptions */}
      {rxItems.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="text-[15px] font-bold text-gray-900 mb-2.5 flex items-center gap-1.5"><Pill className="h-4 w-4 text-teal-500" /> Prescriptions</h2>
          <div className="space-y-2">
            {rxItems.map((i, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-xl bg-white p-3 elev-1">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center"><Pill className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate capitalize">{i.drugName || i.drug?.drugName || i.name || 'Medicine'}</p>
                  <p className="text-[11px] text-gray-400 truncate">{[i.dosage, i.frequency, i.duration].filter(Boolean).join(' · ') || (i.quantity ? `Qty ${i.quantity}` : '')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders */}
      {(labs.length > 0 || rads.length > 0) && (
        <div className="px-4 mt-6 space-y-4">
          {labs.length > 0 && <OrderList title="Lab orders" Icon={FlaskConical} tint="text-cyan-600" bg="bg-cyan-50" items={labs} name={(x) => x.test?.name || x.testName || x.labTest?.testName || 'Lab test'} />}
          {rads.length > 0 && <OrderList title="Radiology orders" Icon={Scan} tint="text-indigo-600" bg="bg-indigo-50" items={rads} name={(x) => x.exam?.name || x.examName || x.radiologyExam?.examName || 'Radiology exam'} />}
        </div>
      )}

      {/* Follow-up */}
      {(c.followUpDate || c.followUpInstructions) && (
        <div className="px-4 mt-6">
          <div className="rounded-2xl p-4 border" style={{ backgroundColor: `${brandColor}0D`, borderColor: `${brandColor}22` }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: brandColor }}>Follow-up</p>
            {c.followUpDate && <p className="mt-1 text-sm font-semibold text-gray-800">{fmtDate(c.followUpDate)}</p>}
            {c.followUpInstructions && <p className="mt-0.5 text-sm text-gray-600">{c.followUpInstructions}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function OrderList({ title, Icon, tint, bg, items, name }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-2">
        {items.map((x, i) => (
          <div key={x.id || i} className="flex items-center gap-3 rounded-xl bg-white p-3 elev-1">
            <div className={`h-8 w-8 shrink-0 rounded-lg ${bg} ${tint} flex items-center justify-center`}><Icon className="h-4 w-4" /></div>
            <p className="min-w-0 flex-1 text-sm font-medium text-gray-800 truncate">{name(x)}</p>
            {x.status && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 capitalize">{x.status}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
