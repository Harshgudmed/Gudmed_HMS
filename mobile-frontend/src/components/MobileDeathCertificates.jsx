import { useState, useEffect, useCallback } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import { FileText, Search, Inbox, Trash2, Plus, X, Check, Loader2, Printer, Pencil } from 'lucide-react'

const pName = (p) => p ? [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') : 'Unknown'
const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const inp = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-gray-400 bg-white'
const PLACES = ['inpatient', 'emergency', 'doa', 'home', 'other']
const MANNERS = ['natural', 'accident', 'suicide', 'homicide', 'undetermined', 'pending']
const SEXES = ['Male', 'Female', 'Other']
const MARITAL = ['Single', 'Married', 'Widowed', 'Divorced', 'Separated', 'Unknown']
const ageFromDob = (d) => { if (!d) return ''; const x = new Date(d); if (isNaN(x)) return ''; return String(Math.floor((Date.now() - x) / (365.25 * 864e5))) }
const PREGNANCY = [['', '—'], ['pregnant', 'Pregnant at death'], ['within_42_days', 'Within 42 days'], ['within_1_year', 'Within 1 year'], ['not_related', 'Not related']]
const longDate = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) }
const hexA = (hex, a) => { try { const h = (hex || '#2E4168').replace('#', ''); const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h; const n = parseInt(f, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})` } catch { return `rgba(46,65,104,${a})` } }
const Field = ({ label, req, children }) => <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">{label}{req && <span className="text-rose-500"> *</span>}</label>{children}</div>
function printDoc(html) { const w = window.open('', '_blank', 'width=900,height=750'); if (!w) { toast.error('Allow pop-ups to print'); return } w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500) }
const orgName = () => { try { return localStorage.getItem('hospitalName') || 'Hospital' } catch { return 'Hospital' } }
function printCertificate(cert) {
  const dod = longDate(cert.dateOfDeath)
  const certDate = cert.certificationDate ? longDate(cert.certificationDate) : longDate(new Date())
  const name = pName(cert.patient)
  const age = [cert.ageAtDeathYears && `${cert.ageAtDeathYears} years`, cert.ageAtDeathMonths && `${cert.ageAtDeathMonths} months`, cert.ageAtDeathDays && `${cert.ageAtDeathDays} days`].filter(Boolean).join(', ') || '—'
  const certifier = cert.certifiedBy?.fullName || cert.certifierName || '—'
  printDoc(`<!DOCTYPE html><html><head><title>Death Certificate ${cert.certificateNumber || ''}</title>
<style>body{font-family:'Times New Roman',serif;margin:30px;color:#000}.border-box{border:3px double #000;padding:20px}.header{text-align:center;margin-bottom:20px}h1{font-size:22px;margin:0}h2{font-size:16px;margin:4px 0}.sub{font-size:13px;color:#444}.cert-num{font-size:13px;text-align:right;margin-bottom:10px}.section{margin:12px 0}.section-title{font-weight:bold;font-size:13px;border-bottom:1px solid #000;margin-bottom:6px;padding-bottom:2px;text-transform:uppercase}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.field{margin-bottom:6px}.label{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px}.value{font-size:13px;border-bottom:1px dotted #999;padding-bottom:2px}.cause{font-size:13px;margin:4px 0}.sig-box{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:30px}.sig-line{border-top:1px solid #000;padding-top:4px;font-size:11px}.footer{text-align:center;font-size:10px;color:#888;margin-top:20px}@media print{body{margin:10px}}</style>
</head><body><div class="border-box">
<div class="cert-num">Certificate No: <strong>${cert.certificateNumber || '—'}</strong></div>
<div class="header"><h1>CERTIFICATE OF DEATH</h1><h2>${orgName()}</h2><div class="sub">Official Medical Death Certificate</div></div>
<div class="section"><div class="section-title">Deceased Information</div><div class="grid">
<div class="field"><div class="label">Full Name</div><div class="value">${name}</div></div>
<div class="field"><div class="label">Sex</div><div class="value">${cert.sex || '—'}</div></div>
<div class="field"><div class="label">Age at Death</div><div class="value">${age}</div></div>
<div class="field"><div class="label">Marital Status</div><div class="value">${cert.maritalStatus || '—'}</div></div>
<div class="field"><div class="label">Occupation</div><div class="value">${cert.occupation || '—'}</div></div>
<div class="field"><div class="label">Address</div><div class="value">${cert.address || '—'}</div></div>
</div></div>
<div class="section"><div class="section-title">Death Information</div><div class="grid">
<div class="field"><div class="label">Date of Death</div><div class="value">${dod}</div></div>
<div class="field"><div class="label">Time of Death</div><div class="value">${cert.timeOfDeath || '—'}</div></div>
<div class="field"><div class="label">Place of Death</div><div class="value">${cert.placeOfDeath || '—'}</div></div>
<div class="field"><div class="label">Manner of Death</div><div class="value">${cert.mannerOfDeath || '—'}</div></div>
</div></div>
<div class="section"><div class="section-title">Cause of Death</div>
<div class="cause"><strong>I(a) Immediate Cause:</strong> ${cert.immediateCause || '—'}</div>
${cert.antecedentCauseB ? `<div class="cause"><strong>I(b):</strong> ${cert.antecedentCauseB}</div>` : ''}
${cert.antecedentCauseC ? `<div class="cause"><strong>I(c):</strong> ${cert.antecedentCauseC}</div>` : ''}
${cert.otherConditions ? `<div class="cause"><strong>II. Other conditions:</strong> ${cert.otherConditions}</div>` : ''}
</div>
<div class="sig-box"><div><div style="height:40px"></div><div class="sig-line">Certifying Physician<br/>${certifier}<br/>${cert.certifierQualification || ''}</div></div><div><div style="height:40px"></div><div class="sig-line">Date of Certification<br/>${certDate}</div></div></div>
</div><div class="footer">This is an official medical death certificate issued by ${orgName()}</div></body></html>`)
}

export default function MobileDeathCertificates({ brandColor = '#2E4168' }) {
  const [certs, setCerts] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [issue, setIssue] = useState(false)
  const [editCert, setEditCert] = useState(null)
  const [delId, setDelId] = useState(null)

  const fetchCerts = useCallback(() => {
    setError(null)
    client.get('/death-certificates', { params: { limit: 200 } })
      .then(res => setCerts(res?.data || []))
      .catch(e => setError(e.message || 'Failed to load certificates'))
  }, [])
  useEffect(() => { fetchCerts() }, [fetchCerts])

  const del = async (id) => {
    setDelId(null)
    try { const res = await client.delete(`/death-certificates?id=${id}`); if (res?.success !== false) { toast.success('Certificate deleted'); fetchCerts() } else toast.error(res.error || 'Failed') }
    catch (e) { toast.error(e.message || 'Failed to delete') }
  }

  const shown = (certs || []).filter(c => !q || pName(c.patient).toLowerCase().includes(q.toLowerCase()) || c.certificateNumber?.toLowerCase().includes(q.toLowerCase()))

  if (error) return <Centered icon={FileText} title="Couldn’t load" sub={error} />

  return (
    <div className="pb-2 pt-1">
      <div className="rounded-3xl p-4 mb-3 elev-3 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${brandColor}, ${hexA(brandColor, 0.82)})` }}>
        <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full" style={{ background: 'rgba(255,255,255,.10)' }} />
        <div className="absolute -right-2 top-10 h-16 w-16 rounded-full" style={{ background: 'rgba(255,255,255,.08)' }} />
        <p className="text-white/80 text-xs font-medium">Death Certificates</p>
        <p className="text-white text-3xl font-extrabold leading-tight mt-0.5">{certs?.length || 0}<span className="text-base font-semibold text-white/70"> issued</span></p>
        <p className="text-white/70 text-[11px] mt-1">{(certs || []).filter(c => { const d = new Date(c.dateOfDeath); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() }).length} this month</p>
      </div>
      <div className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 elev-2">
        <Search className="h-5 w-5 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or certificate no…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400" />
      </div>

      {!certs ? <div className="mt-3 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white elev-1 animate-pulse" />)}</div>
        : shown.length === 0 ? <Centered icon={Inbox} title="No certificates" sub={q ? `Nothing matches “${q}”.` : 'Issue the first certificate with ＋.'} inline />
          : (
            <div className="mt-3 space-y-3 stagger">
              {shown.map(c => (
                <div key={c.id} className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white shadow-sm"><FileText className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[15px] text-gray-900 truncate">{pName(c.patient)}</p>
                      <p className="text-[11px] text-gray-400 truncate">{c.certificateNumber} · {fmtDate(c.dateOfDeath)}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {c.placeOfDeath && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize" style={{ background: hexA(brandColor, 0.1), color: brandColor }}>{c.placeOfDeath}</span>}
                        {c.mannerOfDeath && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 capitalize">{c.mannerOfDeath}</span>}
                        {c.ageAtDeathYears != null && <span className="text-[11px] text-gray-400">{c.ageAtDeathYears}y{c.sex ? ` · ${c.sex}` : ''}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex gap-2 border-t border-gray-50 pt-2.5">
                    <button onClick={() => setEditCert(c)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-600 active:scale-95 transition"><Pencil className="h-3.5 w-3.5" />Edit</button>
                    <button onClick={() => printCertificate(c)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-600 active:scale-95 transition"><Printer className="h-3.5 w-3.5" />Print</button>
                    <button onClick={() => setDelId(c.id)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-rose-50 text-rose-600 active:scale-95 transition"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

      <button onClick={() => setIssue(true)} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="Issue certificate"><Plus className="h-7 w-7" /></button>

      {(issue || editCert) && <IssueSheet cert={editCert} brandColor={brandColor} onClose={() => { setIssue(false); setEditCert(null) }} onDone={() => { setIssue(false); setEditCert(null); fetchCerts() }} />}

      {delId && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-6" onClick={() => setDelId(null)}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-gray-800">Delete this certificate?</p>
            <p className="text-sm text-gray-400 mt-1">This cannot be undone.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setDelId(null)} className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-600">Cancel</button>
              <button onClick={() => del(delId)} className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function IssueSheet({ cert, brandColor, onClose, onDone }) {
  const editing = !!cert
  const [pq, setPq] = useState(''); const [results, setResults] = useState([]); const [patient, setPatient] = useState(cert?.patient || null)
  const [staff, setStaff] = useState([])
  const [f, setF] = useState({
    dateOfDeath: cert?.dateOfDeath ? new Date(cert.dateOfDeath).toLocaleDateString('en-CA') : new Date().toLocaleDateString('en-CA'),
    timeOfDeath: cert?.timeOfDeath || '', placeOfDeath: cert?.placeOfDeath || 'inpatient', locationDetails: cert?.locationDetails || '',
    sex: cert?.sex || 'Male', maritalStatus: cert?.maritalStatus || 'Married', occupation: cert?.occupation || '', address: cert?.address || '',
    ageAtDeathYears: cert?.ageAtDeathYears ?? '', ageAtDeathMonths: cert?.ageAtDeathMonths ?? '', ageAtDeathDays: cert?.ageAtDeathDays ?? '',
    immediateCause: cert?.immediateCause || '', antecedentCauseB: cert?.antecedentCauseB || '', antecedentCauseC: cert?.antecedentCauseC || '', antecedentCauseD: cert?.antecedentCauseD || '', otherConditions: cert?.otherConditions || '',
    mannerOfDeath: cert?.mannerOfDeath || 'natural', autopsyPerformed: !!cert?.autopsyPerformed, autopsyFindings: cert?.autopsyFindings || '',
    isMaternalDeath: !!cert?.isMaternalDeath, pregnancyRelated: cert?.pregnancyRelated || '',
    certifiedById: cert?.certifiedById || '', certifierQualification: cert?.certifierQualification || '', licenseNumber: cert?.licenseNumber || '',
    issuedTo: cert?.issuedTo || '', issuedToRelationship: cert?.issuedToRelationship || '', issuedToNationalId: cert?.issuedToNationalId || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  useEffect(() => { client.get('/settings', { params: { resource: 'users' } }).then(r => setStaff(r?.data || [])).catch(() => {}) }, [])
  useEffect(() => {
    if (!pq || patient) { setResults([]); return }
    const t = setTimeout(() => client.get('/patients', { params: { search: pq, limit: 6 } }).then(r => setResults(r?.data || [])).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [pq, patient])

  const pickPatient = (p) => { setPatient(p); setResults([]); setF(s => ({ ...s, sex: p.gender ? p.gender[0].toUpperCase() + p.gender.slice(1) : s.sex, ageAtDeathYears: ageFromDob(p.dateOfBirth) || s.ageAtDeathYears, address: p.region || s.address })) }

  const submit = async () => {
    if (!patient) { toast.error('Select the deceased patient'); return }
    if (!f.dateOfDeath || !f.placeOfDeath) { toast.error('Date and place of death are required'); return }
    if (!f.immediateCause) { toast.error('Immediate cause of death is required'); return }
    if (!f.certifiedById) { toast.error('Select the certifying physician'); return }
    setSaving(true)
    try {
      const payload = {
        patientId: patient.id, dateOfDeath: f.dateOfDeath, timeOfDeath: f.timeOfDeath || undefined,
        placeOfDeath: f.placeOfDeath, locationDetails: f.locationDetails || undefined,
        sex: f.sex, maritalStatus: f.maritalStatus || undefined, occupation: f.occupation || undefined, address: f.address || undefined,
        ageAtDeathYears: parseInt(f.ageAtDeathYears) || undefined, ageAtDeathMonths: parseInt(f.ageAtDeathMonths) || undefined, ageAtDeathDays: parseInt(f.ageAtDeathDays) || undefined,
        immediateCause: f.immediateCause, antecedentCauseB: f.antecedentCauseB || undefined, antecedentCauseC: f.antecedentCauseC || undefined, antecedentCauseD: f.antecedentCauseD || undefined, otherConditions: f.otherConditions || undefined,
        mannerOfDeath: f.mannerOfDeath, autopsyPerformed: f.autopsyPerformed, autopsyFindings: f.autopsyPerformed ? (f.autopsyFindings || undefined) : undefined,
        isMaternalDeath: f.isMaternalDeath, pregnancyRelated: f.isMaternalDeath ? (f.pregnancyRelated || undefined) : undefined,
        certifiedById: f.certifiedById, certifierQualification: f.certifierQualification || undefined, licenseNumber: f.licenseNumber || undefined,
        issuedTo: f.issuedTo || undefined, issuedToRelationship: f.issuedToRelationship || undefined, issuedToNationalId: f.issuedToNationalId || undefined,
      }
      const res = editing ? await client.patch('/death-certificates', { id: cert.id, ...payload }) : await client.post('/death-certificates', payload)
      if (res?.success !== false) { toast.success(editing ? 'Certificate updated' : 'Death certificate issued'); onDone() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to save certificate') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[94vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit death certificate' : 'Issue death certificate'}</h3><button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3.5">
          <Field label="Deceased patient" req>
            {patient ? (
              <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5"><span className="text-sm font-medium text-gray-800 truncate">{pName(patient)} · {patient.mrn}</span>{!editing && <button onClick={() => { setPatient(null); setPq('') }} className="text-xs text-rose-500 font-semibold">Change</button>}</div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5"><Search className="h-4 w-4 text-gray-400" /><input value={pq} onChange={e => setPq(e.target.value)} placeholder="Search patient…" className="flex-1 bg-transparent text-sm outline-none" /></div>
                {results.length > 0 && <div className="rounded-xl border border-gray-100 bg-white elev-1 overflow-hidden divide-y divide-gray-100">{results.map(p => <button key={p.id} onClick={() => pickPatient(p)} className="w-full text-left px-3.5 py-2.5 active:bg-gray-50"><p className="text-sm font-medium text-gray-800 truncate">{pName(p)}</p><p className="text-[11px] text-gray-400">UHID {p.mrn}</p></button>)}</div>}
              </>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of death" req><input type="date" className={inp} value={f.dateOfDeath} onChange={e => set('dateOfDeath', e.target.value)} /></Field>
            <Field label="Time of death"><input type="time" className={inp} value={f.timeOfDeath} onChange={e => set('timeOfDeath', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Place of death" req><select className={inp} value={f.placeOfDeath} onChange={e => set('placeOfDeath', e.target.value)}>{PLACES.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}</select></Field>
            <Field label="Location details"><input className={inp} value={f.locationDetails} onChange={e => set('locationDetails', e.target.value)} placeholder="e.g. ICU Ward A" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Age (yrs)"><input type="number" className={inp} value={f.ageAtDeathYears} onChange={e => set('ageAtDeathYears', e.target.value)} /></Field>
            <Field label="Months"><input type="number" className={inp} value={f.ageAtDeathMonths} onChange={e => set('ageAtDeathMonths', e.target.value)} /></Field>
            <Field label="Days"><input type="number" className={inp} value={f.ageAtDeathDays} onChange={e => set('ageAtDeathDays', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sex"><select className={inp} value={f.sex} onChange={e => set('sex', e.target.value)}>{SEXES.map(s => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Marital status"><select className={inp} value={f.maritalStatus} onChange={e => set('maritalStatus', e.target.value)}>{MARITAL.map(m => <option key={m}>{m}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Occupation"><input className={inp} value={f.occupation} onChange={e => set('occupation', e.target.value)} /></Field>
            <Field label="Address"><input className={inp} value={f.address} onChange={e => set('address', e.target.value)} /></Field>
          </div>
          <Field label="Immediate cause of death" req><input className={inp} value={f.immediateCause} onChange={e => set('immediateCause', e.target.value)} placeholder="Cause of death" /></Field>
          <Field label="Antecedent cause (b)"><input className={inp} value={f.antecedentCauseB} onChange={e => set('antecedentCauseB', e.target.value)} placeholder="Due to / as a consequence of" /></Field>
          <Field label="Antecedent cause (c)"><input className={inp} value={f.antecedentCauseC} onChange={e => set('antecedentCauseC', e.target.value)} placeholder="Optional" /></Field>
          <Field label="Antecedent cause (d)"><input className={inp} value={f.antecedentCauseD} onChange={e => set('antecedentCauseD', e.target.value)} placeholder="Optional" /></Field>
          <Field label="Other significant conditions"><input className={inp} value={f.otherConditions} onChange={e => set('otherConditions', e.target.value)} placeholder="Optional" /></Field>
          <Field label="Manner of death"><select className={inp} value={f.mannerOfDeath} onChange={e => set('mannerOfDeath', e.target.value)}>{MANNERS.map(m => <option key={m} value={m} className="capitalize">{m}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700"><input type="checkbox" checked={f.autopsyPerformed} onChange={e => set('autopsyPerformed', e.target.checked)} className="h-4 w-4" style={{ accentColor: brandColor }} />Autopsy done</label>
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700"><input type="checkbox" checked={f.isMaternalDeath} onChange={e => set('isMaternalDeath', e.target.checked)} className="h-4 w-4" style={{ accentColor: brandColor }} />Maternal death</label>
          </div>
          {f.autopsyPerformed && <Field label="Autopsy findings"><input className={inp} value={f.autopsyFindings} onChange={e => set('autopsyFindings', e.target.value)} /></Field>}
          {f.isMaternalDeath && <Field label="Relationship to pregnancy"><select className={inp} value={f.pregnancyRelated} onChange={e => set('pregnancyRelated', e.target.value)}>{PREGNANCY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>}
          <Field label="Certified by" req><select className={inp} value={f.certifiedById} onChange={e => set('certifiedById', e.target.value)}><option value="">Select physician</option>{staff.map(u => <option key={u.id} value={u.id}>{u.fullName}{u.role ? ` · ${u.role}` : ''}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Qualification"><input className={inp} value={f.certifierQualification} onChange={e => set('certifierQualification', e.target.value)} placeholder="MBBS, MD…" /></Field>
            <Field label="Licence number"><input className={inp} value={f.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} placeholder="Reg. no." /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issued to"><input className={inp} value={f.issuedTo} onChange={e => set('issuedTo', e.target.value)} placeholder="Next of kin" /></Field>
            <Field label="Relationship"><input className={inp} value={f.issuedToRelationship} onChange={e => set('issuedToRelationship', e.target.value)} placeholder="e.g. Son" /></Field>
          </div>
          <Field label="Issued-to national ID"><input className={inp} value={f.issuedToNationalId} onChange={e => set('issuedToNationalId', e.target.value)} placeholder="Aadhaar / ID no." /></Field>
          <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{editing ? 'Save changes' : 'Issue certificate'}</button>
        </div>
      </div>
    </div>
  )
}

function Centered({ icon: Icon, title, sub, inline }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center animate-fade ${inline ? 'py-16' : 'py-24'}`}>
      <div className="h-20 w-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-4"><Icon className="h-9 w-9 text-gray-400" /></div>
      <p className="font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[230px]">{sub}</p>
    </div>
  )
}
