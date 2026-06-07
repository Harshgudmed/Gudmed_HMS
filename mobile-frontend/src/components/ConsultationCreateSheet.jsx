import { useState, useEffect, useMemo } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import { X, Check, Loader2, Search, Plus, Trash2, Activity, Stethoscope, Pill, FlaskConical, Scan } from 'lucide-react'

const inp = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-gray-400 bg-white'
const sm = 'rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none bg-white'
const FREQ = ['OD', 'BD', 'TID', 'QID', 'HS', 'SOS', 'STAT']
const Field = ({ label, req, children }) => <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">{label}{req && <span className="text-rose-500"> *</span>}</label>{children}</div>
const Section = ({ Icon, title, children }) => <div className="rounded-2xl bg-white p-3.5 elev-1 border border-gray-100/70 space-y-3"><p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Icon className="h-4 w-4" style={{ color: 'currentColor' }} />{title}</p>{children}</div>

export default function ConsultationCreateSheet({ brandColor = '#2E4168', onClose, onDone }) {
  const [doctors, setDoctors] = useState([]); const [drugs, setDrugs] = useState([]); const [tests, setTests] = useState([]); const [exams, setExams] = useState([])
  const [pq, setPq] = useState(''); const [pres, setPres] = useState([]); const [patient, setPatient] = useState(null)
  const [doctorId, setDoctorId] = useState('')
  const [v, setV] = useState({ temperature: '', sys: '', dia: '', pulse: '', rr: '', spo2: '', weight: '', height: '' })
  const [c, setC] = useState({ chiefComplaint: '', diagnosis: '', treatmentPlan: '', historyOfPresentIllness: '', physicalExamination: '', icd10Code: '', referredTo: '', referralReason: '', followUpDate: '', followUpInstructions: '', notes: '' })
  const [rx, setRx] = useState([]); const [labs, setLabs] = useState([]); const [rads, setRads] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    client.get('/settings', { params: { resource: 'users' } }).then(r => setDoctors((r?.data || []).filter(u => u.role === 'doctor'))).catch(() => {})
    client.get('/pharmacy/drugs', { params: { limit: 1000 } }).then(r => setDrugs(r?.data || [])).catch(() => {})
    client.get('/laboratory', { params: { resource: 'tests', limit: 300 } }).then(r => setTests(r?.data || [])).catch(() => {})
    client.get('/radiology', { params: { resource: 'exams', limit: 300 } }).then(r => setExams(r?.data || [])).catch(() => {})
  }, [])
  useEffect(() => {
    if (!pq || patient) { setPres([]); return }
    const t = setTimeout(() => client.get('/patients', { params: { search: pq, limit: 6 } }).then(r => setPres(r?.data || [])).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [pq, patient])

  const setVit = (k, val) => setV(s => ({ ...s, [k]: val }))
  const setCl = (k, val) => setC(s => ({ ...s, [k]: val }))

  const submit = async () => {
    if (!patient) { toast.error('Select a patient'); return }
    if (!doctorId) { toast.error('Select a doctor'); return }
    if (!c.chiefComplaint || !c.diagnosis || c.diagnosis.length < 3) { toast.error('Chief complaint and diagnosis are required'); return }
    setSaving(true)
    try {
      const num = (x) => x === '' ? undefined : Number(x)
      const payload = {
        patientId: patient.id, doctorId, visitType: 'outpatient',
        temperature: num(v.temperature), bloodPressureSystolic: num(v.sys), bloodPressureDiastolic: num(v.dia),
        pulseRate: num(v.pulse), respiratoryRate: num(v.rr), oxygenSaturation: num(v.spo2), weight: num(v.weight), height: num(v.height),
        chiefComplaint: c.chiefComplaint, historyOfPresentIllness: c.historyOfPresentIllness || undefined,
        physicalExamination: c.physicalExamination || undefined,
        diagnosis: c.diagnosis, icd10Codes: c.icd10Code ? [c.icd10Code] : [], treatmentPlan: c.treatmentPlan || undefined,
        referredTo: c.referredTo || undefined, referralReason: c.referralReason || undefined,
        followUpInstructions: c.followUpInstructions || undefined, followUpDate: c.followUpDate || undefined, notes: c.notes || undefined,
        prescriptionItems: rx.length ? rx : undefined,
        labOrderItems: labs.length ? labs : undefined,
        radiologyOrderItems: rads.length ? rads : undefined,
        ordersClinicalIndication: c.diagnosis,
      }
      const res = await client.post('/consultations', payload)
      if (res?.success !== false) { toast.success('Consultation saved'); onDone() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to save consultation') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[94vh] overflow-y-auto rounded-t-3xl bg-gray-50 p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">New consultation</h3><button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>

        <div className="space-y-3">
          {/* Patient + doctor */}
          <Section Icon={Stethoscope} title="Patient & doctor">
            <Field label="Patient" req>
              {patient ? (
                <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5"><span className="text-sm font-medium text-gray-800 truncate">{[patient.firstName, patient.lastName].filter(Boolean).join(' ')} · {patient.mrn}</span><button onClick={() => { setPatient(null); setPq('') }} className="text-xs text-rose-500 font-semibold">Change</button></div>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5"><Search className="h-4 w-4 text-gray-400" /><input value={pq} onChange={e => setPq(e.target.value)} placeholder="Search patient…" className="flex-1 bg-transparent text-sm outline-none" /></div>
                  {pres.length > 0 && <div className="rounded-xl border border-gray-100 bg-white elev-1 overflow-hidden divide-y divide-gray-100">{pres.map(p => <button key={p.id} onClick={() => { setPatient(p); setPres([]) }} className="w-full text-left px-3.5 py-2.5 active:bg-gray-50"><p className="text-sm font-medium text-gray-800 truncate">{[p.firstName, p.lastName].filter(Boolean).join(' ')}</p><p className="text-[11px] text-gray-400">UHID {p.mrn}</p></button>)}</div>}
                </>
              )}
            </Field>
            <Field label="Doctor" req><select className={inp} value={doctorId} onChange={e => setDoctorId(e.target.value)}><option value="">Select doctor</option>{doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.fullName?.replace(/^Dr\.?\s*/i, '')}</option>)}</select></Field>
          </Section>

          {/* Vitals */}
          <Section Icon={Activity} title="Vitals">
            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Temp °F"><input type="number" className={inp} value={v.temperature} onChange={e => setVit('temperature', e.target.value)} /></Field>
              <Field label="BP sys"><input type="number" className={inp} value={v.sys} onChange={e => setVit('sys', e.target.value)} /></Field>
              <Field label="BP dia"><input type="number" className={inp} value={v.dia} onChange={e => setVit('dia', e.target.value)} /></Field>
              <Field label="Pulse"><input type="number" className={inp} value={v.pulse} onChange={e => setVit('pulse', e.target.value)} /></Field>
              <Field label="Resp"><input type="number" className={inp} value={v.rr} onChange={e => setVit('rr', e.target.value)} /></Field>
              <Field label="SpO₂"><input type="number" className={inp} value={v.spo2} onChange={e => setVit('spo2', e.target.value)} /></Field>
              <Field label="Weight kg"><input type="number" className={inp} value={v.weight} onChange={e => setVit('weight', e.target.value)} /></Field>
              <Field label="Height cm"><input type="number" className={inp} value={v.height} onChange={e => setVit('height', e.target.value)} /></Field>
            </div>
          </Section>

          {/* Clinical */}
          <Section Icon={Stethoscope} title="Clinical">
            <Field label="Chief complaint" req><input className={inp} value={c.chiefComplaint} onChange={e => setCl('chiefComplaint', e.target.value)} /></Field>
            <Field label="History of present illness"><textarea rows={2} className={inp} value={c.historyOfPresentIllness} onChange={e => setCl('historyOfPresentIllness', e.target.value)} /></Field>
            <Field label="Physical examination"><textarea rows={2} className={inp} value={c.physicalExamination} onChange={e => setCl('physicalExamination', e.target.value)} /></Field>
            <Field label="Diagnosis" req><input className={inp} value={c.diagnosis} onChange={e => setCl('diagnosis', e.target.value)} /></Field>
            <Field label="ICD-10 code"><input className={inp} value={c.icd10Code} onChange={e => setCl('icd10Code', e.target.value)} placeholder="e.g. J06.9" /></Field>
            <Field label="Treatment plan"><textarea rows={2} className={inp} value={c.treatmentPlan} onChange={e => setCl('treatmentPlan', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Referred to"><input className={inp} value={c.referredTo} onChange={e => setCl('referredTo', e.target.value)} /></Field>
              <Field label="Referral reason"><input className={inp} value={c.referralReason} onChange={e => setCl('referralReason', e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Follow-up date"><input type="date" className={inp} value={c.followUpDate} onChange={e => setCl('followUpDate', e.target.value)} /></Field>
              <Field label="Follow-up note"><input className={inp} value={c.followUpInstructions} onChange={e => setCl('followUpInstructions', e.target.value)} /></Field>
            </div>
            <Field label="Notes"><textarea rows={2} className={inp} value={c.notes} onChange={e => setCl('notes', e.target.value)} /></Field>
          </Section>

          {/* Prescriptions */}
          <Section Icon={Pill} title={`Prescriptions (${rx.length})`}>
            <Picker placeholder="Search medicine to add…" items={drugs} match={(d, s) => d.drugName?.toLowerCase().includes(s) || d.genericName?.toLowerCase().includes(s)} label={d => `${d.drugName} ${d.strength || ''}`}
              onPick={d => { if (rx.find(i => i.drugId === d.id)) return; setRx(p => [...p, { drugId: d.id, drugName: d.drugName, genericName: d.genericName, dosage: '', frequency: 'TID', duration: '7 days', quantity: 21, instructions: '' }]) }} />
            {rx.map((item, i) => (
              <div key={item.drugId} className="rounded-xl bg-gray-50 p-2.5">
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-800 truncate capitalize">{item.drugName}</span><button onClick={() => setRx(p => p.filter((_, x) => x !== i))} className="text-rose-400"><Trash2 className="h-4 w-4" /></button></div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  <input className={sm} placeholder="Dose" value={item.dosage} onChange={e => setRx(p => p.map((x, j) => j === i ? { ...x, dosage: e.target.value } : x))} />
                  <select className={sm} value={item.frequency} onChange={e => setRx(p => p.map((x, j) => j === i ? { ...x, frequency: e.target.value } : x))}>{FREQ.map(f => <option key={f}>{f}</option>)}</select>
                  <input className={sm} placeholder="Days" value={item.duration} onChange={e => setRx(p => p.map((x, j) => j === i ? { ...x, duration: e.target.value } : x))} />
                  <input type="number" className={sm} placeholder="Qty" value={item.quantity} onChange={e => setRx(p => p.map((x, j) => j === i ? { ...x, quantity: parseInt(e.target.value) || 0 } : x))} />
                </div>
              </div>
            ))}
          </Section>

          {/* Lab orders */}
          <Section Icon={FlaskConical} title={`Lab orders (${labs.length})`}>
            <Picker placeholder="Search lab test…" items={tests} match={(t, s) => t.testName?.toLowerCase().includes(s) || t.testCode?.toLowerCase().includes(s)} label={t => t.testName}
              onPick={t => { if (labs.find(i => i.testId === t.id)) return; setLabs(p => [...p, { testId: t.id, testName: t.testName, testCode: t.testCode || '', urgency: 'routine', specimenType: t.specimenType || '' }]) }} />
            <Chips items={labs} label={i => i.testName} onRemove={idx => setLabs(p => p.filter((_, x) => x !== idx))} tint="bg-cyan-50 text-cyan-700" />
          </Section>

          {/* Radiology orders */}
          <Section Icon={Scan} title={`Radiology orders (${rads.length})`}>
            <Picker placeholder="Search radiology exam…" items={exams} match={(e, s) => e.examName?.toLowerCase().includes(s) || e.examCode?.toLowerCase().includes(s)} label={e => e.examName}
              onPick={e => { if (rads.find(i => i.examId === e.id)) return; setRads(p => [...p, { examId: e.id, examName: e.examName, examCode: e.examCode || '', examCategory: e.examCategory || '', urgency: 'routine', bodyPart: e.bodyPart || '' }]) }} />
            <Chips items={rads} label={i => i.examName} onRemove={idx => setRads(p => p.filter((_, x) => x !== idx))} tint="bg-indigo-50 text-indigo-700" />
          </Section>

          <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-3 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Save consultation</button>
        </div>
      </div>
    </div>
  )
}

function Picker({ placeholder, items, match, label, onPick }) {
  const [q, setQ] = useState('')
  const results = useMemo(() => { if (!q) return []; const s = q.toLowerCase(); return items.filter(it => match(it, s)).slice(0, 6) }, [q, items, match])
  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2"><Search className="h-4 w-4 text-gray-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent text-sm outline-none" /></div>
      {results.length > 0 && (
        <div className="mt-1.5 rounded-xl border border-gray-100 bg-white elev-1 overflow-hidden divide-y divide-gray-100">
          {results.map(it => <button key={it.id} onClick={() => { onPick(it); setQ('') }} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left active:bg-gray-50"><span className="text-sm text-gray-800 truncate capitalize">{label(it)}</span><Plus className="h-4 w-4 text-gray-400 shrink-0" /></button>)}
        </div>
      )}
    </div>
  )
}
function Chips({ items, label, onRemove, tint }) {
  if (!items.length) return null
  return <div className="flex flex-wrap gap-1.5">{items.map((it, i) => <span key={i} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${tint}`}>{label(it)}<button onClick={() => onRemove(i)}><X className="h-3 w-3" /></button></span>)}</div>
}
