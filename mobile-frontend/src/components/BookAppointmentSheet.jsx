import { useState, useEffect } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import { Search, X, Check, Loader2 } from 'lucide-react'

const APPT_TYPES = [
  { v: 'new_patient', l: 'New Patient' },
  { v: 'follow_up', l: 'Follow-up' },
  { v: 'walk_in', l: 'Walk-in' },
  { v: 'emergency', l: 'Emergency' },
]
const bkInput = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-gray-400 bg-white'

function Sheet({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// `doctor` (optional) pre-selects + locks the doctor field (used from Doctor Profile).
export default function BookAppointmentSheet({ brandColor = '#2E4168', doctor = null, onClose, onCreated }) {
  const lockedDoctor = !!doctor
  const [doctors, setDoctors] = useState([])
  const [pq, setPq] = useState('')
  const [results, setResults] = useState([])
  const [patient, setPatient] = useState(null)
  const [doctorId, setDoctorId] = useState(doctor?.id || '')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [time, setTime] = useState('10:00')
  const [type, setType] = useState('new_patient')
  const [duration, setDuration] = useState('30')
  const [priority, setPriority] = useState('normal')
  const [fee, setFee] = useState('')
  const [complaint, setComplaint] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (lockedDoctor) return
    client.get('/settings', { params: { resource: 'users' } })
      .then(r => setDoctors((r?.data || []).filter(u => u.role === 'doctor')))
      .catch(() => {})
  }, [lockedDoctor])

  useEffect(() => {
    if (!pq || patient) { setResults([]); return }
    const t = setTimeout(() => {
      client.get('/patients', { params: { search: pq, limit: 6 } }).then(r => setResults(r?.data || [])).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [pq, patient])

  const submit = async () => {
    if (!patient) { toast.error('Select a patient'); return }
    if (!doctorId) { toast.error('Select a doctor'); return }
    if (!time) { toast.error('Pick a time'); return }
    setSaving(true)
    try {
      const res = await client.post('/appointments', {
        patientId: patient.id, doctorId,
        appointmentDate: new Date(date).toISOString(), appointmentTime: time,
        durationMinutes: parseInt(duration) || 30, appointmentType: type, priority,
        consultationFee: parseFloat(fee) || undefined,
        chiefComplaint: complaint || undefined,
        notes: notes || undefined,
      })
      if (res.success) { toast.success('Appointment booked'); onCreated?.() }
      else toast.error(res.error || 'Failed to book')
    } catch (e) { toast.error(e.message || 'Failed to book') } finally { setSaving(false) }
  }

  return (
    <Sheet onClose={onClose} title="Book appointment">
      <div className="space-y-3.5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">Patient <span className="text-rose-500">*</span></label>
          {patient ? (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5">
              <span className="text-sm font-medium text-gray-800 truncate">{[patient.firstName, patient.lastName].filter(Boolean).join(' ')} · {patient.mrn}</span>
              <button onClick={() => { setPatient(null); setPq('') }} className="text-xs text-rose-500 font-semibold shrink-0">Change</button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5">
                <Search className="h-4 w-4 text-gray-400" />
                <input value={pq} onChange={e => setPq(e.target.value)} placeholder="Search patient by name / UHID…" className="flex-1 bg-transparent text-sm outline-none" />
              </div>
              {results.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-white elev-1 overflow-hidden divide-y divide-gray-100">
                  {results.map(p => (
                    <button key={p.id} onClick={() => { setPatient(p); setResults([]) }} className="w-full text-left px-3.5 py-2.5 active:bg-gray-50">
                      <p className="text-sm font-medium text-gray-800 truncate">{[p.firstName, p.lastName].filter(Boolean).join(' ')}</p>
                      <p className="text-[11px] text-gray-400">UHID {p.mrn}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">Doctor <span className="text-rose-500">*</span></label>
          {lockedDoctor ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5">
              <span className="text-sm font-medium text-gray-800 truncate">Dr. {doctor.fullName?.replace(/^Dr\.?\s*/i, '')}{doctor.specialization ? ` · ${doctor.specialization}` : ''}</span>
            </div>
          ) : (
            <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className={bkInput}>
              <option value="">Select doctor</option>
              {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.fullName?.replace(/^Dr\.?\s*/i, '')}{d.specialization ? ` · ${d.specialization}` : ''}</option>)}
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={bkInput} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Time</label><input type="time" value={time} onChange={e => setTime(e.target.value)} className={bkInput} /></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Type</label><select value={type} onChange={e => setType(e.target.value)} className={bkInput}>{APPT_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Duration</label><select value={duration} onChange={e => setDuration(e.target.value)} className={bkInput}>{['15', '30', '45', '60'].map(d => <option key={d} value={d}>{d} min</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Priority</label><select value={priority} onChange={e => setPriority(e.target.value)} className={bkInput}><option value="normal">Normal</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option></select></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Consultation fee (₹)</label><input type="number" value={fee} onChange={e => setFee(e.target.value)} className={bkInput} /></div>
        </div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Chief complaint</label><input value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="Reason for visit" className={bkInput} /></div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Notes (optional)</label><input value={notes} onChange={e => setNotes(e.target.value)} className={bkInput} /></div>

        <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Book appointment
        </button>
      </div>
    </Sheet>
  )
}
