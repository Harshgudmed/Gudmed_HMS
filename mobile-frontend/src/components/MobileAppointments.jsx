import { useState, useEffect, useCallback } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import { Clock, CalendarX2, CalendarCheck, Plus, Search, X, Check, Loader2 } from 'lucide-react'

const LIMIT = 20

const STATUS = {
  scheduled:   { label: 'Scheduled',   bg: 'bg-blue-50',    text: 'text-blue-600',    rail: 'bg-blue-400' },
  checked_in:  { label: 'Checked In',  bg: 'bg-indigo-50',  text: 'text-indigo-600',  rail: 'bg-indigo-400' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-50',   text: 'text-amber-600',   rail: 'bg-amber-400' },
  completed:   { label: 'Completed',   bg: 'bg-emerald-50', text: 'text-emerald-600', rail: 'bg-emerald-400' },
  cancelled:   { label: 'Cancelled',   bg: 'bg-rose-50',    text: 'text-rose-600',    rail: 'bg-rose-300' },
  no_show:     { label: 'No Show',     bg: 'bg-gray-100',   text: 'text-gray-500',    rail: 'bg-gray-300' },
}
const CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

const initials = (p) => `${p?.firstName?.[0] || ''}${p?.lastName?.[0] || ''}`.toUpperCase() || 'P'
const avatarGradient = (g) => g === 'female' ? 'from-rose-400 to-pink-500' : g === 'male' ? 'from-blue-400 to-indigo-500' : 'from-violet-400 to-purple-500'
const pName = (p) => p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : 'Unknown patient'
const dName = (d) => d ? `Dr. ${d.fullName?.replace(/^Dr\.?\s*/i, '')}` : 'Unassigned'
function fmtTime(t) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ap = h < 12 ? 'AM' : 'PM'; const hh = ((h + 11) % 12) + 1
  return `${hh}:${String(m ?? 0).padStart(2, '0')} ${ap}`
}
function dateLabel(iso) {
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((d - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })
}
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA')

// Group a flat (chronologically-ordered) list into [{ key, label, items }]
function groupByDay(items) {
  const groups = []
  const index = new Map()
  for (const a of items) {
    const k = dayKey(a.appointmentDate)
    if (!index.has(k)) { index.set(k, groups.length); groups.push({ key: k, label: dateLabel(a.appointmentDate), items: [] }) }
    groups[index.get(k)].items.push(a)
  }
  return groups
}

export default function MobileAppointments({ brandColor = '#2E4168' }) {
  const [status, setStatus] = useState('all')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [showBook, setShowBook] = useState(false)

  const load = useCallback(async (nextOffset, append) => {
    append ? setLoadingMore(true) : setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(LIMIT)); params.set('offset', String(nextOffset))
      if (status !== 'all') params.set('status', status)
      const res = await client.get(`/appointments?${params}`)
      const data = res.data ?? []
      setItems(prev => append ? [...prev, ...data] : data)
      setTotal(res.meta?.total ?? data.length)
      setOffset(nextOffset)
    } catch (err) {
      setError(err.message || 'Failed to load appointments')
    } finally { setLoading(false); setLoadingMore(false) }
  }, [status])

  useEffect(() => { load(0, false) }, [load])

  const updateStatus = async (apt, status) => {
    setBusyId(apt.id)
    try {
      const body = { status }
      if (status === 'cancelled') body.cancellationReason = 'Cancelled from mobile'
      const res = await client.patch(`/appointments/${apt.id}`, body)
      if (res.success) {
        setItems(prev => prev.map(x => x.id === apt.id ? { ...x, status } : x))
        toast.success(`Marked ${status.replace(/_/g, ' ')}`)
      } else toast.error(res.error || 'Failed')
    } catch { toast.error('Failed to update appointment') } finally { setBusyId(null) }
  }

  const groups = groupByDay(items)
  const hasMore = items.length < total

  return (
    <div className="pb-2">
      {/* Sticky status chips */}
      <div className="sticky top-14 z-20 -mx-3 px-3 pt-1 pb-3 bg-gray-50/95 backdrop-blur">
        <div className="-mx-1 flex gap-2 overflow-x-auto no-scrollbar px-1">
          {CHIPS.map(c => {
            const on = status === c.key
            return (
              <button
                key={c.key}
                onClick={() => setStatus(c.key)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition active:scale-95 ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                style={on ? { backgroundColor: brandColor } : undefined}
              >
                {c.label}
              </button>
            )
          })}
        </div>
        <p className="mt-2 px-0.5 text-xs text-gray-400">{loading ? 'Loading…' : `${total.toLocaleString('en-IN')} appointments`}</p>
      </div>

      {/* Book appointment FAB + sheet */}
      <button onClick={() => setShowBook(true)} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="Book appointment">
        <Plus className="h-7 w-7" />
      </button>
      {showBook && <BookAppointmentSheet brandColor={brandColor} onClose={() => setShowBook(false)} onCreated={() => { setShowBook(false); load(0, false) }} />}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(0, false)} brandColor={brandColor} />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {groups.map(group => (
            <div key={group.key} className="mb-4">
              <div className="flex items-center gap-2 px-0.5 mb-2">
                <CalendarCheck className="h-4 w-4 text-gray-400" />
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{group.label}</h3>
                <span className="text-[11px] text-gray-300">· {group.items.length}</span>
              </div>
              <div className="space-y-2.5 stagger">
                {group.items.map(a => <AppointmentCard key={a.id} a={a} brandColor={brandColor} onUpdate={updateStatus} busy={busyId === a.id} />)}
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => load(offset + LIMIT, true)}
              disabled={loadingMore}
              className="mx-auto mt-1 mb-1 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold elev-2 active:scale-95 transition disabled:opacity-60"
              style={{ color: brandColor }}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

const NEXT_ACTIONS = {
  scheduled:   [{ label: 'Check in', to: 'checked_in', kind: 'primary' }, { label: 'Cancel', to: 'cancelled', kind: 'danger' }],
  confirmed:   [{ label: 'Check in', to: 'checked_in', kind: 'primary' }, { label: 'Cancel', to: 'cancelled', kind: 'danger' }],
  checked_in:  [{ label: 'Start', to: 'in_progress', kind: 'primary' }, { label: 'Cancel', to: 'cancelled', kind: 'danger' }],
  in_progress: [{ label: 'Complete', to: 'completed', kind: 'primary' }],
}

function AppointmentCard({ a, brandColor, onUpdate, busy }) {
  const s = STATUS[a.status] || STATUS.scheduled
  const type = (a.appointmentType || '').replace(/_/g, ' ')
  const acts = NEXT_ACTIONS[a.status] || []
  return (
    <div className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
      <div className="flex items-stretch gap-3">
        <div className="flex flex-col items-center justify-center pr-3 border-r border-gray-100">
          <span className="text-[13px] font-extrabold leading-none" style={{ color: brandColor }}>{fmtTime(a.appointmentTime).split(' ')[0]}</span>
          <span className="text-[10px] font-semibold text-gray-400 mt-0.5">{fmtTime(a.appointmentTime).split(' ')[1]}</span>
        </div>
        <div className={`h-11 w-11 shrink-0 self-center rounded-2xl bg-gradient-to-br ${avatarGradient(a.patient?.gender)} flex items-center justify-center text-white font-bold text-xs`}>
          {initials(a.patient)}
        </div>
        <div className="min-w-0 flex-1 self-center">
          <p className="font-semibold text-[14px] text-gray-900 truncate">{pName(a.patient)}</p>
          <p className="text-xs text-blue-600 truncate mt-0.5">{dName(a.doctor)}{a.doctor?.specialization ? ` · ${a.doctor.specialization}` : ''}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>{s.label}</span>
            {type && <span className="text-[10px] text-gray-400 capitalize truncate">{type}</span>}
          </div>
        </div>
      </div>
      {acts.length > 0 && (
        <div className="mt-3 flex gap-2 border-t border-gray-50 pt-3">
          {acts.map(act => (
            <button key={act.to} disabled={busy} onClick={() => onUpdate(a, act.to)}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold active:scale-95 transition disabled:opacity-60 ${act.kind === 'danger' ? 'bg-rose-50 text-rose-600' : 'text-white'}`}
              style={act.kind === 'primary' ? { backgroundColor: brandColor } : undefined}>
              {busy ? '…' : act.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-1">
      <div className="h-11 w-11 rounded-2xl bg-gray-100 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-2/5 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-1/4 rounded bg-gray-100 animate-pulse" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade">
      <div className="h-20 w-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-4">
        <CalendarX2 className="h-9 w-9 text-gray-400" />
      </div>
      <p className="font-semibold text-gray-700">No appointments</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[220px]">Nothing here for this filter.</p>
    </div>
  )
}

function ErrorState({ message, onRetry, brandColor }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade">
      <div className="h-20 w-20 rounded-3xl bg-rose-50 flex items-center justify-center mb-4">
        <Clock className="h-9 w-9 text-rose-400" />
      </div>
      <p className="font-semibold text-gray-700">Couldn’t load appointments</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[240px]">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-full px-5 py-2 text-sm font-semibold text-white active:scale-95 transition" style={{ backgroundColor: brandColor }}>Try again</button>
    </div>
  )
}

/* ── Book appointment ────────────────────────────────────────────────────── */
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

function BookAppointmentSheet({ brandColor, onClose, onCreated }) {
  const [doctors, setDoctors] = useState([])
  const [pq, setPq] = useState('')
  const [results, setResults] = useState([])
  const [patient, setPatient] = useState(null)
  const [doctorId, setDoctorId] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [time, setTime] = useState('10:00')
  const [type, setType] = useState('new_patient')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    client.get('/settings', { params: { resource: 'users' } })
      .then(r => setDoctors((r?.data || []).filter(u => u.role === 'doctor')))
      .catch(() => {})
  }, [])

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
        durationMinutes: 30, appointmentType: type, priority: 'normal',
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
          <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className={bkInput}>
            <option value="">Select doctor</option>
            {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.fullName?.replace(/^Dr\.?\s*/i, '')}{d.specialization ? ` · ${d.specialization}` : ''}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={bkInput} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Time</label><input type="time" value={time} onChange={e => setTime(e.target.value)} className={bkInput} /></div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className={bkInput}>{APPT_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
        </div>

        <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Notes (optional)</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Chief complaint…" className={bkInput} /></div>

        <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Book appointment
        </button>
      </div>
    </Sheet>
  )
}
