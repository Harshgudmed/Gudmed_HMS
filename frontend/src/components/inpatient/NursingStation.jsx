import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Activity, HeartPulse, ClipboardList, Pill, Loader2, Plus, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import client from '@/api/client'
import { useAuth } from '@/lib/auth'

const NOTE_TYPES = ['PROGRESS', 'NURSING', 'DOCTOR', 'CONSULTANT', 'PROCEDURE', 'OBSERVATION']
const MAR_STATUSES = ['GIVEN', 'MISSED', 'HELD', 'REFUSED']
const CONSCIOUSNESS = ['ALERT', 'CONFUSION', 'VOICE', 'PAIN', 'UNRESPONSIVE']

// Client-side NEWS2 for instant feedback (server recomputes authoritatively).
function news2(v) {
  const n = (x) => (x === '' || x == null ? null : Number(x))
  const rr = n(v.respiratoryRate), sp = n(v.spo2), sbp = n(v.systolicBp), hr = n(v.heartRate), t = n(v.tempC)
  const pts = []
  pts.push(rr == null ? 0 : rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3)
  pts.push(sp == null ? 0 : sp >= 96 ? 0 : sp >= 94 ? 1 : sp >= 92 ? 2 : 3)
  pts.push(sbp == null ? 0 : sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3)
  pts.push(hr == null ? 0 : hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3)
  pts.push(t == null ? 0 : t <= 35 ? 3 : t <= 36 ? 1 : t <= 38 ? 0 : t <= 39 ? 1 : 2)
  pts.push(!v.consciousness || v.consciousness === 'ALERT' ? 0 : 3)
  const score = pts.reduce((a, b) => a + b, 0)
  const any3 = pts.some((p) => p === 3)
  const risk = score >= 7 ? 'HIGH' : score >= 5 || any3 ? 'MEDIUM' : 'LOW'
  return { score, risk }
}

const riskStyle = { LOW: 'bg-green-100 text-green-800', MEDIUM: 'bg-amber-100 text-amber-800', HIGH: 'bg-red-100 text-red-800' }

const emptyVitals = { systolicBp: '', diastolicBp: '', heartRate: '', respiratoryRate: '', spo2: '', tempC: '', painScore: '', consciousness: 'ALERT', bloodSugar: '', notes: '' }

export default function NursingStation({ admitted = [] }) {
  const { user } = useAuth()
  // Vitals are nurse-only to record/correct (doctors view). In demo mode (no
  // logged-in user) the form stays available so the demo keeps working.
  const canRecordVitals = !user || ['nurse', 'admin', 'super_admin'].includes(user.role)
  const [selectedId, setSelectedId] = useState('')
  const [tab, setTab] = useState('vitals')
  const [vitals, setVitals] = useState([])
  const [notes, setNotes] = useState([])
  const [mar, setMar] = useState([])
  const [loading, setLoading] = useState(false)

  const [vForm, setVForm] = useState(emptyVitals)
  const [nForm, setNForm] = useState({ noteType: 'NURSING', body: '' })
  const [mForm, setMForm] = useState({ drugName: '', dosage: '', route: 'Oral', status: 'GIVEN', reason: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!selectedId && admitted.length) setSelectedId(admitted[0].id)
  }, [admitted, selectedId])

  const load = useCallback(async (id) => {
    if (!id) return
    setLoading(true)
    try {
      const [v, n, m] = await Promise.all([
        client.get(`/inpatient?resource=vitals&admissionId=${id}`),
        client.get(`/inpatient?resource=clinical-notes-v2&admissionId=${id}`),
        client.get(`/inpatient?resource=medication-administration&admissionId=${id}`),
      ])
      setVitals(v.data || [])
      setNotes(n.data || [])
      setMar(m.data || [])
    } catch (e) { toast.error('Failed to load nursing data') }
    setLoading(false)
  }, [])

  useEffect(() => { if (selectedId) load(selectedId) }, [selectedId, load])

  const livePreview = news2(vForm)

  const saveVitals = async () => {
    setSaving(true)
    try {
      const res = await client.post('/inpatient', { resource: 'vitals', admissionId: selectedId, ...vForm })
      if (res.success) {
        toast.success(`Vitals recorded · NEWS ${res.data.newsScore} (${res.data.newsRisk})`)
        if (res.data.newsRisk === 'HIGH') toast.error('⚠ HIGH early-warning score — escalate to doctor')
        setVForm(emptyVitals); load(selectedId)
      } else toast.error(res.error || 'Failed')
    } catch { toast.error('Failed to record vitals') }
    setSaving(false)
  }

  const saveNote = async () => {
    if (!nForm.body.trim()) { toast.error('Note text required'); return }
    setSaving(true)
    try {
      const res = await client.post('/inpatient', { resource: 'note-v2', admissionId: selectedId, ...nForm })
      if (res.success) { toast.success('Note added'); setNForm({ noteType: 'NURSING', body: '' }); load(selectedId) }
      else toast.error(res.error || 'Failed')
    } catch { toast.error('Failed to add note') }
    setSaving(false)
  }

  const saveMar = async () => {
    if (!mForm.drugName.trim()) { toast.error('Drug name required'); return }
    setSaving(true)
    try {
      const res = await client.post('/inpatient', { resource: 'medication-administration', admissionId: selectedId, ...mForm })
      if (res.success) { toast.success(`Medication ${mForm.status.toLowerCase()}`); setMForm({ drugName: '', dosage: '', route: 'Oral', status: 'GIVEN', reason: '' }); load(selectedId) }
      else toast.error(res.error || 'Failed')
    } catch { toast.error('Failed to record administration') }
    setSaving(false)
  }

  const patient = admitted.find((a) => a.id === selectedId)?.patient

  if (!admitted.length) {
    return (
      <Card><CardContent className="py-14 text-center text-gray-400">
        <HeartPulse className="h-10 w-10 mx-auto mb-3 text-gray-200" />
        No admitted patients. Admit a patient to use the Nursing Station.
      </CardContent></Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Patient picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <Label className="text-sm font-medium">Patient:</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-80"><SelectValue placeholder="Select admitted patient" /></SelectTrigger>
          <SelectContent>
            {admitted.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.patient?.firstName} {a.patient?.lastName} · {a.patient?.mrn} · {a.bed?.ward?.name || 'Ward'}/{a.bed?.bedNumber || '—'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {patient && <Badge variant="outline" className="text-xs">{patient.gender}</Badge>}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b">
        {[{ id: 'vitals', label: 'Vitals & NEWS', Icon: Activity }, { id: 'notes', label: 'Clinical Notes', Icon: ClipboardList }, { id: 'mar', label: 'Medications (eMAR)', Icon: Pill }].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* VITALS */}
      {tab === 'vitals' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {canRecordVitals ? (
          <Card><CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-blue-600" />Record Vitals</p>
              <Badge className={riskStyle[livePreview.risk]}>Live NEWS {livePreview.score} · {livePreview.risk}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[['systolicBp', 'Systolic BP'], ['diastolicBp', 'Diastolic BP'], ['heartRate', 'Heart Rate'], ['respiratoryRate', 'Resp Rate'], ['spo2', 'SpO₂ %'], ['tempC', 'Temp °C'], ['painScore', 'Pain 0-10'], ['bloodSugar', 'Blood Sugar']].map(([k, label]) => (
                <div key={k}>
                  <Label className="text-[11px] text-gray-500">{label}</Label>
                  <Input className="mt-0.5 h-9" type="number" value={vForm[k]} onChange={(e) => setVForm((p) => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="col-span-1">
                <Label className="text-[11px] text-gray-500">Consciousness</Label>
                <Select value={vForm.consciousness} onValueChange={(v) => setVForm((p) => ({ ...p, consciousness: v }))}>
                  <SelectTrigger className="mt-0.5 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{CONSCIOUSNESS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {livePreview.risk === 'HIGH' && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />High score — escalate to doctor on submit.</p>}
            <Button onClick={saveVitals} disabled={saving} className="w-full">{saving ? 'Saving…' : 'Record Vitals'}</Button>
          </CardContent></Card>
          ) : (
          <Card><CardContent className="pt-4">
            <p className="font-semibold text-sm flex items-center gap-2 mb-2"><Activity className="h-4 w-4 text-gray-400" />Vitals</p>
            <p className="text-sm text-gray-500">Vitals are recorded by nursing staff. You have <span className="font-medium">view-only</span> access — review the recorded readings and NEWS trend on the right.</p>
          </CardContent></Card>
          )}

          <Card><CardContent className="pt-4">
            <p className="font-semibold text-sm mb-2">Recent Vitals</p>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {vitals.length === 0 ? <p className="text-sm text-gray-400 py-4 text-center">No vitals recorded</p> : vitals.map((v) => (
                <div key={v.id} className="border rounded-lg p-2.5 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <Badge className={riskStyle[v.newsRisk] + ' text-[10px]'}>NEWS {v.newsScore} · {v.newsRisk}</Badge>
                    <span className="text-gray-400">{v.recordedAt ? format(new Date(v.recordedAt), 'dd MMM HH:mm') : ''}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-gray-600">
                    {v.systolicBp != null && <span>BP {v.systolicBp}/{v.diastolicBp ?? '—'}</span>}
                    {v.heartRate != null && <span>HR {v.heartRate}</span>}
                    {v.respiratoryRate != null && <span>RR {v.respiratoryRate}</span>}
                    {v.spo2 != null && <span>SpO₂ {v.spo2}%</span>}
                    {v.tempC != null && <span>{v.tempC}°C</span>}
                    {v.bloodSugar != null && <span>Sugar {v.bloodSugar}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </div>
      )}

      {/* NOTES */}
      {tab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card><CardContent className="pt-4 space-y-3">
            <p className="font-semibold text-sm">Add Clinical Note</p>
            <Select value={nForm.noteType} onValueChange={(v) => setNForm((p) => ({ ...p, noteType: v }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{NOTE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea rows={4} placeholder="Enter note…" value={nForm.body} onChange={(e) => setNForm((p) => ({ ...p, body: e.target.value }))} />
            <Button onClick={saveNote} disabled={saving} className="w-full"><Plus className="h-4 w-4 mr-1" />Add Note</Button>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="font-semibold text-sm mb-2">Notes Timeline</p>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {notes.length === 0 ? <p className="text-sm text-gray-400 py-4 text-center">No notes</p> : notes.map((n) => (
                <div key={n.id} className="border rounded-lg p-2.5 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-[10px]">{n.noteType}</Badge>
                    <span className="text-xs text-gray-400">{n.authoredAt ? format(new Date(n.authoredAt), 'dd MMM HH:mm') : ''}{n.authorName ? ` · ${n.authorName}` : ''}</span>
                  </div>
                  <p className="text-gray-700">{n.body}</p>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </div>
      )}

      {/* eMAR */}
      {tab === 'mar' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card><CardContent className="pt-4 space-y-3">
            <p className="font-semibold text-sm flex items-center gap-2"><Pill className="h-4 w-4 text-blue-600" />Record Administration</p>
            <div><Label className="text-[11px] text-gray-500">Drug</Label><Input className="mt-0.5 h-9" placeholder="e.g. Paracetamol 650mg" value={mForm.drugName} onChange={(e) => setMForm((p) => ({ ...p, drugName: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[11px] text-gray-500">Dosage</Label><Input className="mt-0.5 h-9" value={mForm.dosage} onChange={(e) => setMForm((p) => ({ ...p, dosage: e.target.value }))} /></div>
              <div><Label className="text-[11px] text-gray-500">Route</Label><Input className="mt-0.5 h-9" value={mForm.route} onChange={(e) => setMForm((p) => ({ ...p, route: e.target.value }))} /></div>
            </div>
            <div><Label className="text-[11px] text-gray-500">Status</Label>
              <Select value={mForm.status} onValueChange={(v) => setMForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="mt-0.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{MAR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {mForm.status !== 'GIVEN' && <div><Label className="text-[11px] text-gray-500">Reason</Label><Input className="mt-0.5 h-9" placeholder="Reason not given" value={mForm.reason} onChange={(e) => setMForm((p) => ({ ...p, reason: e.target.value }))} /></div>}
            <Button onClick={saveMar} disabled={saving} className="w-full">Record</Button>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="font-semibold text-sm mb-2">Administration Record</p>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {mar.length === 0 ? <p className="text-sm text-gray-400 py-4 text-center">No records</p> : mar.map((m) => (
                <div key={m.id} className="border rounded-lg p-2.5 text-sm flex items-center justify-between">
                  <div>
                    <p className="font-medium">{m.drugName} {m.dosage && <span className="text-gray-400 text-xs">· {m.dosage}</span>}</p>
                    <p className="text-xs text-gray-400">{m.route}{m.reason ? ` · ${m.reason}` : ''} · {(m.administeredAt || m.createdAt) ? format(new Date(m.administeredAt || m.createdAt), 'dd MMM HH:mm') : ''}</p>
                  </div>
                  <Badge className={m.status === 'GIVEN' ? 'bg-green-100 text-green-800' : m.status === 'REFUSED' || m.status === 'MISSED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>{m.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </div>
      )}
    </div>
  )
}
