import { useState, useEffect, useCallback } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import { BedDouble, Users, X, Check, Loader2, Search, LogOut, ArrowLeftRight, Plus, AlertTriangle, FileText, Printer, Receipt, Trash2, Building2 } from 'lucide-react'

const initials = (p) => `${p?.firstName?.[0] || ''}${p?.lastName?.[0] || ''}`.toUpperCase() || 'P'
const avatarGradient = (g) => g === 'female' ? 'from-rose-400 to-pink-500' : g === 'male' ? 'from-blue-400 to-indigo-500' : 'from-violet-400 to-purple-500'
const pName = (p) => p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : 'Unknown patient'
const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
const inp = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-gray-400 bg-white'
const ADM_TYPES = ['Emergency', 'Elective', 'Transfer', 'Maternity', 'Day Care']
const COND = ['Stable', 'Improved', 'Recovered', 'Referred', 'LAMA', 'Deceased']

function Sheet({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">{title}</h3><button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  )
}
const Field = ({ label, req, children }) => <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">{label}{req && <span className="text-rose-500"> *</span>}</label>{children}</div>
const SubmitBtn = ({ onClick, saving, label, brandColor }) => (
  <button onClick={onClick} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>
    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{label}
  </button>
)

/* ── print helpers (desktop format) ──────────────────────────────────────── */
function printDoc(html) { const w = window.open('', '_blank', 'width=900,height=780'); if (!w) { toast.error('Allow pop-ups to print'); return } w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500) }
const orgName = () => { try { return localStorage.getItem('hospitalName') || 'Hospital' } catch { return 'Hospital' } }
const slipDT = (d, t) => { const x = new Date(d); if (isNaN(x)) return '—'; return x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + (t ? ', ' + x.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '') }
const daysBetween = (a, b) => { const x = new Date(a), y = new Date(b); return isNaN(x) || isNaN(y) ? 0 : Math.max(0, Math.floor((y - x) / 864e5)) }
const ageY = (dob) => { if (!dob) return '—'; const d = new Date(dob); return isNaN(d) ? '—' : Math.floor((Date.now() - d) / (365.25 * 864e5)) + ' yrs' }
const admLabel = (a) => a.admissionNumber || `ADM-${(a.id || '').slice(-6).toUpperCase()}`

function printAdmissionSlip(adm, wardNm) {
  printDoc(`<!DOCTYPE html><html><head><title>Admission Slip</title><style>body{font-family:Arial,sans-serif;font-size:13px;padding:24px;color:#222}h2{text-align:center;margin-bottom:4px;font-size:18px}.sub{text-align:center;color:#666;font-size:11px;margin-bottom:16px}table{width:100%;border-collapse:collapse;margin-bottom:12px}td{padding:5px 8px;border:1px solid #ddd}td:first-child{background:#f5f5f5;font-weight:600;width:38%}.diag{background:#fffbe6;border:1px solid #ffe58f;padding:8px 10px;border-radius:4px;margin:8px 0}.footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px}@media print{body{padding:10px}}</style></head><body>
<h2>Admission Slip</h2><div class="sub">${orgName()} &nbsp;·&nbsp; Generated ${slipDT(new Date(), true)}</div>
<table>
<tr><td>Patient Name</td><td>${pName(adm.patient)}</td></tr>
<tr><td>UHID</td><td>${adm.patient?.mrn || '—'}</td></tr>
<tr><td>Admission #</td><td>${admLabel(adm)}</td></tr>
<tr><td>Admission Date</td><td>${slipDT(adm.admissionDate, true)}</td></tr>
<tr><td>Ward</td><td>${wardNm || '—'}</td></tr>
<tr><td>Bed Number</td><td>${adm.bed?.bedNumber || '—'}</td></tr>
<tr><td>Admission Type</td><td>${adm.admissionType || '—'}</td></tr>
<tr><td>Expected Stay</td><td>${adm.expectedLengthOfStay || '—'} day(s)</td></tr>
<tr><td>Deposit Paid</td><td>₹${(adm.depositAmount || 0).toLocaleString()}</td></tr>
${adm.isCritical ? `<tr><td>Status</td><td style="color:orange;font-weight:bold">CRITICAL (${adm.criticalLevel ? adm.criticalLevel.toUpperCase() : 'CODE'})</td></tr>` : ''}
</table>
<div class="diag"><strong>Admission Diagnosis:</strong><br/>${adm.admissionDiagnosis || '—'}</div>
${adm.chiefComplaint ? `<div class="diag"><strong>Chief Complaint:</strong><br/>${adm.chiefComplaint}</div>` : ''}
${adm.admissionNotes ? `<div class="diag"><strong>Notes:</strong><br/>${adm.admissionNotes}</div>` : ''}
<div class="footer">This is a computer-generated admission slip.</div></body></html>`)
}

function printDischargeSummary(adm, wardNm) {
  const admDate = adm.admissionDate ? slipDT(adm.admissionDate) : 'N/A'
  const disDate = adm.dischargeDate ? slipDT(adm.dischargeDate) : 'N/A'
  const days = adm.admissionDate ? daysBetween(adm.admissionDate, adm.dischargeDate || new Date()) : 0
  const printDate = slipDT(new Date(), true)
  printDoc(`<!DOCTYPE html><html><head><title>Discharge Summary — ${pName(adm.patient)}</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#222;background:#f0f0f0;padding:20px}.page{max-width:860px;margin:0 auto;background:#fff;padding:30px;box-shadow:0 2px 12px rgba(0,0,0,0.15)}.header{border-bottom:3px solid #1e3a8a;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start}.hosp-name{font-size:22px;font-weight:bold;color:#1e3a8a}.hosp-sub{font-size:11px;color:#666;margin-top:3px}.meta{font-size:11px;color:#666;text-align:right;line-height:1.7}.title-bar{text-align:center;margin:0 0 20px}.title-bar h1{font-size:18px;font-weight:700;letter-spacing:3px;color:#1e3a8a;border:2px solid #1e3a8a;display:inline-block;padding:6px 30px}.section-title{font-size:11px;font-weight:700;color:#1e3a8a;text-transform:uppercase;letter-spacing:1px;border-bottom:1.5px solid #1e3a8a;padding-bottom:3px;margin:16px 0 8px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}.field{margin-bottom:6px}.field-label{font-size:10px;color:#888;text-transform:uppercase;font-weight:600;letter-spacing:0.5px}.field-value{font-size:13px;color:#111;font-weight:500;margin-top:1px}.field-value.placeholder{color:#bbb;font-style:italic}.text-block{border:1px solid #e5e7eb;border-radius:4px;padding:10px 12px;min-height:50px;font-size:12px;line-height:1.6;white-space:pre-wrap;color:#333;background:#fafafa}.text-block.empty{color:#ccc;font-style:italic}.sig-row{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px;padding-top:16px;border-top:2px solid #333}.sig-line{border-bottom:1px solid #555;height:40px;margin-bottom:6px}.sig-label{font-size:10px;color:#666;text-align:center}.footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb}@media print{body{background:#fff;padding:0}.page{box-shadow:none;padding:15px}}
</style></head><body><div class="page">
<div class="header"><div><div class="hosp-name">${orgName()}</div><div class="hosp-sub">Inpatient Department</div></div><div class="meta">Printed: ${printDate}<br/>Admission #: <strong>${admLabel(adm)}</strong></div></div>
<div class="title-bar"><h1>DISCHARGE SUMMARY</h1></div>
<div class="section-title">Patient Information</div>
<div class="grid2"><div class="field"><div class="field-label">Patient Name</div><div class="field-value">${pName(adm.patient)}</div></div><div class="field"><div class="field-label">UHID</div><div class="field-value">${adm.patient?.mrn || '—'}</div></div><div class="field"><div class="field-label">Age / Gender</div><div class="field-value">${ageY(adm.patient?.dateOfBirth)} / ${adm.patient?.gender || '—'}</div></div><div class="field"><div class="field-label">Phone</div><div class="field-value">${adm.patient?.phonePrimary || '—'}</div></div></div>
<div class="section-title">Admission Details</div>
<div class="grid2"><div class="field"><div class="field-label">Admission Date</div><div class="field-value">${admDate}</div></div><div class="field"><div class="field-label">Discharge Date</div><div class="field-value">${disDate}</div></div><div class="field"><div class="field-label">Ward / Bed</div><div class="field-value">${wardNm || '—'} — Bed ${adm.bed?.bedNumber || '—'}</div></div><div class="field"><div class="field-label">Length of Stay</div><div class="field-value">${days} days</div></div></div>
<div class="section-title">Diagnosis</div>
<div class="field" style="margin-bottom:8px"><div class="field-label">Admission Diagnosis</div><div class="field-value">${adm.admissionDiagnosis || '—'}</div></div>
<div class="field"><div class="field-label">Discharge Diagnosis</div><div class="field-value ${!adm.dischargeDiagnosis ? 'placeholder' : ''}">${adm.dischargeDiagnosis || 'Not recorded'}</div></div>
<div class="section-title">Clinical Summary / Treatment Provided</div>
<div class="text-block ${!adm.treatmentSummary ? 'empty' : ''}">${adm.treatmentSummary || 'Not recorded'}</div>
<div class="section-title">Discharge Instructions / Follow-Up</div>
<div class="text-block ${!adm.followUpInstructions ? 'empty' : ''}">${adm.followUpInstructions || 'Not recorded'}</div>
${adm.dischargeNotes ? `<div class="section-title">Additional Notes</div><div class="text-block">${adm.dischargeNotes}</div>` : ''}
<div class="sig-row"><div><div class="sig-line"></div><div class="sig-label">Attending Physician Signature</div></div><div><div class="sig-line"></div><div class="sig-label">Authorized Hospital Signatory &amp; Stamp</div></div></div>
<div class="footer">This is a computer-generated document. &nbsp;|&nbsp; ${orgName()} &nbsp;|&nbsp; Generated: ${printDate}</div>
</div></body></html>`)
}

function printFinalBill(adm, wardNm, billing) {
  const admDate = adm.admissionDate ? slipDT(adm.admissionDate) : '—'
  const disDate = adm.dischargeDate ? slipDT(adm.dischargeDate) : slipDT(new Date())
  const days = adm.admissionDate ? daysBetween(adm.admissionDate, adm.dischargeDate || new Date()) : 0
  const roomCharge = (billing.dailyRate || 0) * days
  const extra = (billing.charges || []).reduce((s, c) => s + ((c.amount || 0) * (c.quantity || 1)), 0)
  const total = roomCharge + extra
  const chargesRows = (billing.charges || []).map(c => `<tr><td>${c.name}</td><td>${c.type || ''}</td><td>${c.quantity || 1}</td><td>₹${(c.amount || 0).toLocaleString()}</td><td>₹${((c.amount || 0) * (c.quantity || 1)).toLocaleString()}</td></tr>`).join('')
  printDoc(`<!DOCTYPE html><html><head><title>IPD Final Bill</title><style>body{font-family:Arial,sans-serif;font-size:13px;padding:24px;color:#222}h2{text-align:center;margin-bottom:4px;font-size:18px}.sub{text-align:center;color:#666;font-size:11px;margin-bottom:16px}h3{font-size:13px;margin:14px 0 4px;border-bottom:1px solid #ddd;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{padding:6px 8px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5;font-weight:600}.total{font-weight:bold;background:#e8f5e9}.footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px}@media print{body{padding:10px}}</style></head><body>
<h2>IPD Final Bill</h2><div class="sub">${orgName()} &nbsp;·&nbsp; Generated ${slipDT(new Date(), true)}</div>
<h3>Patient Details</h3><table>
<tr><td width="38%" style="background:#f5f5f5;font-weight:600">Patient Name</td><td>${pName(adm.patient)}</td></tr>
<tr><td style="background:#f5f5f5;font-weight:600">UHID</td><td>${adm.patient?.mrn || '—'}</td></tr>
<tr><td style="background:#f5f5f5;font-weight:600">Admission #</td><td>${admLabel(adm)}</td></tr>
<tr><td style="background:#f5f5f5;font-weight:600">Ward / Bed</td><td>${wardNm || '—'} · Bed ${adm.bed?.bedNumber || '—'}</td></tr>
<tr><td style="background:#f5f5f5;font-weight:600">Period</td><td>${admDate} → ${disDate} (${days} days)</td></tr>
<tr><td style="background:#f5f5f5;font-weight:600">Deposit Paid</td><td>₹${(adm.depositAmount || 0).toLocaleString()}</td></tr>
</table>
<h3>Billing Details</h3><table>
<tr><th>Item</th><th>Type</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
<tr><td>Room Charges (${days} days × ₹${(billing.dailyRate || 0).toLocaleString()}/day)</td><td>Room</td><td>${days}</td><td>₹${(billing.dailyRate || 0).toLocaleString()}</td><td>₹${roomCharge.toLocaleString()}</td></tr>
${chargesRows}
<tr class="total"><td colspan="4" style="text-align:right">Total</td><td>₹${total.toLocaleString()}</td></tr>
<tr><td colspan="4" style="text-align:right">Deposit Paid</td><td>₹${(adm.depositAmount || 0).toLocaleString()}</td></tr>
<tr class="total"><td colspan="4" style="text-align:right">Net Payable</td><td>₹${Math.max(0, total - (adm.depositAmount || 0)).toLocaleString()}</td></tr>
</table>
<div class="footer">This is a computer-generated bill.</div></body></html>`)
}

export default function MobileInpatient({ brandColor = '#2E4168' }) {
  const [tab, setTab] = useState('admitted')
  const [admissions, setAdmissions] = useState(null)
  const [wards, setWards] = useState([])
  const [error, setError] = useState(null)
  const [sheet, setSheet] = useState(null)

  const fetchAll = useCallback(() => {
    setAdmissions(null); setError(null)
    Promise.all([
      client.get('/inpatient', { params: { resource: 'admissions', limit: 200 } }),
      client.get('/inpatient', { params: { resource: 'wards' } }),
    ]).then(([a, w]) => { setAdmissions(a?.data || []); setWards(w?.data || []) })
      .catch(e => setError(e.message || 'Failed to load inpatient data'))
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const wardName = (id) => wards.find(w => w.id === id)?.name || ''
  const active = (admissions || []).filter(a => a.status === 'admitted')
  const done = () => { setSheet(null); fetchAll() }
  const delWard = async (w) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete ward "${w.name}"? Beds must be empty.`)) return
    try { const res = await client.delete('/inpatient', { params: { resource: 'ward', id: w.id } }); if (res.success !== false) { toast.success('Ward deleted'); fetchAll() } else toast.error(res.error || 'Failed') } catch (e) { toast.error(e.message || 'Failed') }
  }
  const bedStatus = async (b, status) => {
    try { const res = await client.patch('/inpatient', { resource: 'bed', id: b.id, status }); if (res.success !== false) { toast.success(`Bed set ${status}`); fetchAll() } else toast.error(res.error || 'Failed') } catch (e) { toast.error(e.message || 'Failed') }
  }

  return (
    <div className="pb-2">
      <div className="sticky top-14 z-20 -mx-3 px-3 pt-1 pb-2.5 bg-gray-50/95 backdrop-blur">
        <div className="flex gap-2">
          {[['admitted', 'Admitted', Users], ['wards', 'Wards & Beds', BedDouble]].map(([k, l, Icon]) => {
            const on = tab === k
            return <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`} style={on ? { backgroundColor: brandColor } : undefined}><Icon className="h-4 w-4" />{l}</button>
          })}
        </div>
      </div>

      {error ? <Centered icon={BedDouble} title="Couldn’t load" sub={error} />
        : admissions === null ? <ListSkeleton />
        : tab === 'admitted'
          ? <AdmittedList active={active} wardName={wardName} brandColor={brandColor} onDischarge={a => setSheet({ type: 'discharge', a })} onTransfer={a => setSheet({ type: 'transfer', a })} onNote={a => setSheet({ type: 'note', a })} onSlip={a => printAdmissionSlip(a, wardName(a.bed?.wardId))} onSummary={a => printDischargeSummary(a, wardName(a.bed?.wardId))} onBill={a => setSheet({ type: 'bill', a })} />
          : <WardsMap wards={wards} brandColor={brandColor} onAdmit={(ward, bed) => setSheet({ type: 'admit', ward, bed })} onAddBed={w => setSheet({ type: 'addbed', ward: w })} onDeleteWard={delWard} onBedStatus={bedStatus} />}

      {/* FABs */}
      {admissions !== null && tab === 'admitted' && (
        <button onClick={() => setSheet({ type: 'admit' })} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="Admit patient"><Plus className="h-7 w-7" /></button>
      )}
      {admissions !== null && tab === 'wards' && (
        <button onClick={() => setSheet({ type: 'addward' })} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="Add ward"><Building2 className="h-6 w-6" /></button>
      )}

      {sheet?.type === 'admit' && <AdmitSheet wards={wards} ward={sheet.ward} bed={sheet.bed} brandColor={brandColor} onClose={() => setSheet(null)} onDone={done} />}
      {sheet?.type === 'discharge' && <DischargeSheet admission={sheet.a} brandColor={brandColor} onClose={() => setSheet(null)} onDone={done} />}
      {sheet?.type === 'transfer' && <TransferSheet admission={sheet.a} wards={wards} brandColor={brandColor} onClose={() => setSheet(null)} onDone={done} />}
      {sheet?.type === 'note' && <NoteSheet admission={sheet.a} brandColor={brandColor} onClose={() => setSheet(null)} onDone={() => setSheet(null)} />}
      {sheet?.type === 'bill' && <BillSheet admission={sheet.a} wardNm={wardName(sheet.a.bed?.wardId)} brandColor={brandColor} onClose={() => setSheet(null)} />}
      {sheet?.type === 'addward' && <AddWardSheet brandColor={brandColor} onClose={() => setSheet(null)} onDone={done} />}
      {sheet?.type === 'addbed' && <AddBedSheet ward={sheet.ward} brandColor={brandColor} onClose={() => setSheet(null)} onDone={done} />}
    </div>
  )
}

function AdmittedList({ active, wardName, brandColor, onDischarge, onTransfer, onNote, onSlip, onSummary, onBill }) {
  if (active.length === 0) return <Centered icon={Users} title="No admitted patients" sub="Admit a patient from Wards & Beds, or the ＋ button." inline />
  return (
    <div className="space-y-3 stagger">
      {active.map(a => (
        <div key={a.id} className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br ${avatarGradient(a.patient?.gender)} flex items-center justify-center text-white font-bold text-xs`}>{initials(a.patient)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><p className="font-semibold text-[14px] text-gray-900 truncate">{pName(a.patient)}</p><span className="text-[11px] text-gray-400 shrink-0">{fmtDate(a.admissionDate)}</span></div>
              <p className="text-xs text-gray-500 truncate">{[wardName(a.bed?.wardId), a.bed?.bedNumber ? `Bed ${a.bed.bedNumber}` : null].filter(Boolean).join(' · ') || a.admissionType}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                {a.isCritical && <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600"><AlertTriangle className="h-3 w-3" />Critical</span>}
                {a.admissionDiagnosis && <span className="text-[11px] text-gray-400 truncate">{a.admissionDiagnosis}</span>}
              </div>
            </div>
          </div>
          <div className="mt-2.5 flex gap-2 border-t border-gray-50 pt-2.5">
            <button onClick={() => onNote(a)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-600 active:scale-95 transition"><FileText className="h-3.5 w-3.5" />Note</button>
            <button onClick={() => onTransfer(a)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-600 active:scale-95 transition"><ArrowLeftRight className="h-3.5 w-3.5" />Transfer</button>
            <button onClick={() => onDischarge(a)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white active:scale-95 transition" style={{ backgroundColor: brandColor }}><LogOut className="h-3.5 w-3.5" />Discharge</button>
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => onSlip(a)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-600 active:scale-95 transition"><Printer className="h-3.5 w-3.5" />Slip</button>
            <button onClick={() => onSummary(a)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-600 active:scale-95 transition"><FileText className="h-3.5 w-3.5" />Summary</button>
            <button onClick={() => onBill(a)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-600 active:scale-95 transition"><Receipt className="h-3.5 w-3.5" />Bill</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function WardsMap({ wards, brandColor, onAdmit, onAddBed, onDeleteWard, onBedStatus }) {
  if (wards.length === 0) return <Centered icon={BedDouble} title="No wards" sub="Add a ward with the ＋ button." inline />
  return (
    <div className="space-y-4">
      {wards.map(w => (
        <div key={w.id} className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
          <div className="flex items-center justify-between mb-2.5 gap-2">
            <div className="min-w-0"><p className="font-bold text-gray-900 truncate">{w.name}</p><p className="text-[11px] text-gray-400">{w.type} · {w.occupiedBeds ?? 0}/{w.capacity ?? (w.beds?.length || 0)} occupied</p></div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold" style={{ color: brandColor }}>{w.occupancyRate ?? 0}%</span>
              <button onClick={() => onAddBed(w)} className="h-8 w-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center active:scale-90" aria-label="Add bed"><Plus className="h-4 w-4" /></button>
              <button onClick={() => onDeleteWard(w)} className="h-8 w-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center active:scale-90" aria-label="Delete ward"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(w.beds || []).map(b => {
              const avail = b.status === 'available'
              return (
                <button key={b.id} disabled={b.status === 'occupied'} onClick={() => { if (avail) onAdmit(w, b); else if (b.status !== 'occupied') onBedStatus(b, 'available') }}
                  className={`h-11 w-12 rounded-xl border-2 flex flex-col items-center justify-center text-[10px] font-bold transition ${avail ? 'border-emerald-300 bg-emerald-50 text-emerald-600 active:scale-95' : b.status === 'occupied' ? 'border-rose-200 bg-rose-50 text-rose-400' : 'border-amber-200 bg-amber-50 text-amber-500 active:scale-95'}`}>
                  <BedDouble className="h-4 w-4" />{b.bedNumber}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[10px] text-gray-400">Green = available (tap to admit) · Red = occupied · Amber = maintenance (tap to free)</p>
        </div>
      ))}
    </div>
  )
}

function AdmitSheet({ wards, ward, bed, brandColor, onClose, onDone }) {
  const [pq, setPq] = useState(''); const [results, setResults] = useState([]); const [patient, setPatient] = useState(null)
  const [wardId, setWardId] = useState(ward?.id || '')
  const [bedId, setBedId] = useState(bed?.id || '')
  const [type, setType] = useState('Emergency')
  const [diagnosis, setDiagnosis] = useState('')
  const [complaint, setComplaint] = useState('')
  const [los, setLos] = useState('3'); const [deposit, setDeposit] = useState('0'); const [critical, setCritical] = useState(false); const [critLevel, setCritLevel] = useState('high'); const [admNotes, setAdmNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!pq || patient) { setResults([]); return }
    const t = setTimeout(() => client.get('/patients', { params: { search: pq, limit: 6 } }).then(r => setResults(r?.data || [])).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [pq, patient])

  const beds = (wards.find(w => w.id === wardId)?.beds || []).filter(b => b.status === 'available' || b.id === bedId)

  const submit = async () => {
    if (!patient) { toast.error('Select a patient'); return }
    if (!wardId || !bedId) { toast.error('Select ward and bed'); return }
    if (!diagnosis) { toast.error('Enter admission diagnosis'); return }
    setSaving(true)
    try {
      const res = await client.post('/inpatient', {
        resource: 'admission', patientId: patient.id, wardId, bedId, admissionType: type,
        admissionDiagnosis: diagnosis, chiefComplaint: complaint || undefined,
        expectedLengthOfStay: parseInt(los) || 3, depositAmount: parseFloat(deposit) || 0,
        admissionNotes: admNotes || undefined,
        isCritical: critical, criticalLevel: critical ? critLevel : 'none',
      })
      if (res.success !== false) { toast.success('Patient admitted'); onDone() } else toast.error(res.error || 'Failed to admit')
    } catch (e) { toast.error(e.message || 'Failed to admit') } finally { setSaving(false) }
  }

  return (
    <Sheet onClose={onClose} title="Admit patient">
      <div className="space-y-3.5">
        <Field label="Patient" req>
          {patient ? (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5"><span className="text-sm font-medium text-gray-800 truncate">{pName(patient)} · {patient.mrn}</span><button onClick={() => { setPatient(null); setPq('') }} className="text-xs text-rose-500 font-semibold">Change</button></div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5"><Search className="h-4 w-4 text-gray-400" /><input value={pq} onChange={e => setPq(e.target.value)} placeholder="Search patient…" className="flex-1 bg-transparent text-sm outline-none" /></div>
              {results.length > 0 && <div className="rounded-xl border border-gray-100 bg-white elev-1 overflow-hidden divide-y divide-gray-100">{results.map(p => <button key={p.id} onClick={() => { setPatient(p); setResults([]) }} className="w-full text-left px-3.5 py-2.5 active:bg-gray-50"><p className="text-sm font-medium text-gray-800 truncate">{pName(p)}</p><p className="text-[11px] text-gray-400">UHID {p.mrn}</p></button>)}</div>}
            </>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ward" req><select className={inp} value={wardId} onChange={e => { setWardId(e.target.value); setBedId('') }}><option value="">Select</option>{wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
          <Field label="Bed" req><select className={inp} value={bedId} onChange={e => setBedId(e.target.value)} disabled={!wardId}><option value="">Select</option>{beds.map(b => <option key={b.id} value={b.id}>{b.bedNumber}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><select className={inp} value={type} onChange={e => setType(e.target.value)}>{ADM_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Expected stay (days)"><input type="number" className={inp} value={los} onChange={e => setLos(e.target.value)} /></Field>
        </div>
        <Field label="Admission diagnosis" req><input className={inp} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Diagnosis" /></Field>
        <Field label="Chief complaint"><input className={inp} value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="Optional" /></Field>
        <div className="grid grid-cols-2 gap-3 items-end">
          <Field label="Deposit (₹)"><input type="number" className={inp} value={deposit} onChange={e => setDeposit(e.target.value)} /></Field>
          <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5"><span className="text-sm text-gray-700">Critical</span><input type="checkbox" checked={critical} onChange={e => setCritical(e.target.checked)} className="h-5 w-5" style={{ accentColor: brandColor }} /></label>
        </div>
        {critical && <Field label="Critical level"><select className={inp} value={critLevel} onChange={e => setCritLevel(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field>}
        <Field label="Admission notes"><textarea rows={2} className={inp} value={admNotes} onChange={e => setAdmNotes(e.target.value)} placeholder="Optional" /></Field>
        <SubmitBtn onClick={submit} saving={saving} label="Admit patient" brandColor={brandColor} />
      </div>
    </Sheet>
  )
}

function DischargeSheet({ admission, brandColor, onClose, onDone }) {
  const [diagnosis, setDiagnosis] = useState(admission.admissionDiagnosis || '')
  const [condition, setCondition] = useState('Stable')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!diagnosis || !condition) { toast.error('Enter diagnosis and condition'); return }
    setSaving(true)
    try {
      const res = await client.patch('/inpatient', { resource: 'discharge', id: admission.id, dischargeDiagnosis: diagnosis, dischargeCondition: condition, dischargeNotes: notes || undefined })
      if (res.success !== false) { toast.success('Patient discharged'); onDone() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to discharge') } finally { setSaving(false) }
  }
  return (
    <Sheet onClose={onClose} title={`Discharge · ${pName(admission.patient)}`}>
      <div className="space-y-3.5">
        <Field label="Discharge diagnosis" req><input className={inp} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} /></Field>
        <Field label="Condition" req><select className={inp} value={condition} onChange={e => setCondition(e.target.value)}>{COND.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Notes"><input className={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></Field>
        <SubmitBtn onClick={submit} saving={saving} label="Discharge patient" brandColor={brandColor} />
      </div>
    </Sheet>
  )
}

function TransferSheet({ admission, wards, brandColor, onClose, onDone }) {
  const [toWardId, setToWardId] = useState('')
  const [toBedId, setToBedId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const beds = (wards.find(w => w.id === toWardId)?.beds || []).filter(b => b.status === 'available')
  const submit = async () => {
    if (!toWardId || !toBedId) { toast.error('Select target ward and bed'); return }
    setSaving(true)
    try {
      const res = await client.post('/inpatient', { resource: 'transfer', admissionId: admission.id, toWardId, toBedId, transferReason: reason || undefined })
      if (res.success !== false) { toast.success('Patient transferred'); onDone() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to transfer') } finally { setSaving(false) }
  }
  return (
    <Sheet onClose={onClose} title={`Transfer · ${pName(admission.patient)}`}>
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="To ward" req><select className={inp} value={toWardId} onChange={e => { setToWardId(e.target.value); setToBedId('') }}><option value="">Select</option>{wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
          <Field label="To bed" req><select className={inp} value={toBedId} onChange={e => setToBedId(e.target.value)} disabled={!toWardId}><option value="">Select</option>{beds.map(b => <option key={b.id} value={b.id}>{b.bedNumber}</option>)}</select></Field>
        </div>
        <Field label="Reason"><input className={inp} value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional" /></Field>
        <SubmitBtn onClick={submit} saving={saving} label="Transfer patient" brandColor={brandColor} />
      </div>
    </Sheet>
  )
}

const NOTE_TYPES = ['progress', 'nursing', 'doctor', 'observation']
function NoteSheet({ admission, brandColor, onClose, onDone }) {
  const [type, setType] = useState('progress')
  const [text, setText] = useState('')
  const [vit, setVit] = useState({ bp: '', temp: '', pulse: '', spo2: '', weight: '' })
  const [saving, setSaving] = useState(false)
  const sv = (k, v) => setVit(s => ({ ...s, [k]: v }))
  const submit = async () => {
    if (!text) { toast.error('Note text is required'); return }
    setSaving(true)
    try {
      const res = await client.post('/inpatient', { resource: 'note', admissionId: admission.id, type, text, vitals: vit })
      if (res?.success !== false) { toast.success('Note added'); onDone() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to add note') } finally { setSaving(false) }
  }
  return (
    <Sheet onClose={onClose} title={`Clinical note · ${pName(admission.patient)}`}>
      <div className="space-y-3.5">
        <Field label="Type"><select className={inp} value={type} onChange={e => setType(e.target.value)}>{NOTE_TYPES.map(t => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select></Field>
        <Field label="Note" req><textarea rows={4} className={inp} value={text} onChange={e => setText(e.target.value)} placeholder="Clinical note…" /></Field>
        <div className="rounded-2xl bg-gray-50 p-3">
          <p className="text-[11px] font-semibold text-gray-500 mb-2">Vitals (optional)</p>
          <div className="grid grid-cols-3 gap-2">
            <input className={inp} placeholder="BP" value={vit.bp} onChange={e => sv('bp', e.target.value)} />
            <input className={inp} placeholder="Temp" value={vit.temp} onChange={e => sv('temp', e.target.value)} />
            <input className={inp} placeholder="Pulse" value={vit.pulse} onChange={e => sv('pulse', e.target.value)} />
            <input className={inp} placeholder="SpO₂" value={vit.spo2} onChange={e => sv('spo2', e.target.value)} />
            <input className={inp} placeholder="Weight" value={vit.weight} onChange={e => sv('weight', e.target.value)} />
          </div>
        </div>
        <SubmitBtn onClick={submit} saving={saving} label="Add note" brandColor={brandColor} />
      </div>
    </Sheet>
  )
}

function BillSheet({ admission, wardNm, brandColor, onClose }) {
  const [billing, setBilling] = useState(undefined)
  const [dailyRate, setDailyRate] = useState('')
  const [busy, setBusy] = useState(false)
  const [c, setC] = useState({ name: '', type: 'Service', amount: '', quantity: '1' })
  const fetchBilling = useCallback(() => { client.get('/inpatient', { params: { resource: 'billing', admissionId: admission.id } }).then(r => setBilling(r?.data || null)).catch(() => setBilling(null)) }, [admission.id])
  useEffect(() => { fetchBilling() }, [fetchBilling])
  const genBill = async () => { if (!dailyRate) { toast.error('Enter daily room rate'); return } setBusy(true); try { const res = await client.post('/inpatient', { resource: 'billing', admissionId: admission.id, dailyRate: parseFloat(dailyRate) || 0 }); if (res.success !== false) { toast.success('Bill generated'); fetchBilling() } else toast.error(res.error || 'Failed') } catch (e) { toast.error(e.message || 'Failed') } finally { setBusy(false) } }
  const addCharge = async () => { if (!c.name || !c.amount) { toast.error('Name and amount required'); return } setBusy(true); try { const res = await client.post('/inpatient', { resource: 'charge', billingId: billing.id, name: c.name, type: c.type, amount: parseFloat(c.amount) || 0, quantity: parseInt(c.quantity) || 1 }); if (res.success !== false) { toast.success('Charge added'); setC({ name: '', type: 'Service', amount: '', quantity: '1' }); fetchBilling() } else toast.error(res.error || 'Failed') } catch (e) { toast.error(e.message || 'Failed') } finally { setBusy(false) } }
  const days = admission.admissionDate ? daysBetween(admission.admissionDate, admission.dischargeDate || new Date()) : 0
  const room = billing ? (billing.dailyRate || 0) * days : 0
  const extra = billing ? (billing.charges || []).reduce((s, x) => s + (x.amount || 0) * (x.quantity || 1), 0) : 0
  const total = room + extra
  return (
    <Sheet onClose={onClose} title={`Billing · ${pName(admission.patient)}`}>
      {billing === undefined ? <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
        : billing === null ? (
          <div className="space-y-3.5">
            <p className="text-sm text-gray-500">No bill yet. Enter the daily room rate to generate one.</p>
            <Field label="Daily room rate (₹)" req><input type="number" className={inp} value={dailyRate} onChange={e => setDailyRate(e.target.value)} /></Field>
            <SubmitBtn onClick={genBill} saving={busy} label="Generate bill" brandColor={brandColor} />
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="rounded-2xl p-3.5 text-white" style={{ background: brandColor }}>
              <p className="text-white/80 text-xs">Net payable (after ₹{(admission.depositAmount || 0).toLocaleString()} deposit)</p>
              <p className="text-2xl font-extrabold leading-tight">₹{Math.max(0, total - (admission.depositAmount || 0)).toLocaleString()}</p>
              <p className="text-white/70 text-[11px] mt-1">Room ₹{room.toLocaleString()} ({days}d × ₹{(billing.dailyRate || 0).toLocaleString()}) + charges ₹{extra.toLocaleString()}</p>
            </div>
            {(billing.charges || []).length > 0 && (
              <div className="rounded-2xl bg-gray-50 p-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-gray-500">Charges</p>
                {(billing.charges || []).map((x, i) => <div key={i} className="flex justify-between text-sm"><span className="text-gray-700 truncate">{x.name} <span className="text-gray-400">×{x.quantity || 1}</span></span><span className="font-semibold">₹{((x.amount || 0) * (x.quantity || 1)).toLocaleString()}</span></div>)}
              </div>
            )}
            <div className="rounded-2xl bg-gray-50 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-gray-500">Add charge</p>
              <input className={inp} placeholder="Charge name" value={c.name} onChange={e => setC(s => ({ ...s, name: e.target.value }))} />
              <div className="grid grid-cols-3 gap-2">
                <input className={inp} placeholder="Type" value={c.type} onChange={e => setC(s => ({ ...s, type: e.target.value }))} />
                <input type="number" className={inp} placeholder="Amount" value={c.amount} onChange={e => setC(s => ({ ...s, amount: e.target.value }))} />
                <input type="number" className={inp} placeholder="Qty" value={c.quantity} onChange={e => setC(s => ({ ...s, quantity: e.target.value }))} />
              </div>
              <button onClick={addCharge} disabled={busy} className="w-full rounded-xl py-2.5 text-sm font-semibold bg-gray-200 text-gray-700 active:scale-95 transition disabled:opacity-60">Add charge</button>
            </div>
            <button onClick={() => printFinalBill(admission, wardNm, billing)} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition" style={{ backgroundColor: brandColor }}><Printer className="h-5 w-5" />Print final bill</button>
          </div>
        )}
    </Sheet>
  )
}

const WARD_TYPES = ['General', 'Private', 'Semi-Private', 'ICU', 'NICU', 'Maternity', 'Pediatric', 'Isolation']
function AddWardSheet({ brandColor, onClose, onDone }) {
  const [f, setF] = useState({ name: '', type: 'General', capacity: '', dailyRate: '' })
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!f.name) { toast.error('Ward name is required'); return }
    setSaving(true)
    try { const res = await client.post('/inpatient', { resource: 'ward', name: f.name, type: f.type, capacity: parseInt(f.capacity) || 0, dailyRate: parseFloat(f.dailyRate) || 0 }); if (res.success !== false) { toast.success('Ward added'); onDone() } else toast.error(res.error || 'Failed') } catch (e) { toast.error(e.message || 'Failed') } finally { setSaving(false) }
  }
  return (
    <Sheet onClose={onClose} title="Add ward">
      <div className="space-y-3.5">
        <Field label="Ward name" req><input className={inp} value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} /></Field>
        <Field label="Type"><select className={inp} value={f.type} onChange={e => setF(s => ({ ...s, type: e.target.value }))}>{WARD_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Capacity (beds)"><input type="number" className={inp} value={f.capacity} onChange={e => setF(s => ({ ...s, capacity: e.target.value }))} /></Field>
          <Field label="Daily rate (₹)"><input type="number" className={inp} value={f.dailyRate} onChange={e => setF(s => ({ ...s, dailyRate: e.target.value }))} /></Field>
        </div>
        <SubmitBtn onClick={submit} saving={saving} label="Add ward" brandColor={brandColor} />
      </div>
    </Sheet>
  )
}

const BED_TYPES = ['Standard', 'Electric', 'ICU', 'Pediatric']
function AddBedSheet({ ward, brandColor, onClose, onDone }) {
  const [bedNumber, setBedNumber] = useState('')
  const [bedType, setBedType] = useState('Standard')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!bedNumber) { toast.error('Bed number is required'); return }
    setSaving(true)
    try { const res = await client.post('/inpatient', { resource: 'bed', wardId: ward.id, bedNumber, bedType }); if (res.success !== false) { toast.success('Bed added'); onDone() } else toast.error(res.error || 'Failed') } catch (e) { toast.error(e.message || 'Failed') } finally { setSaving(false) }
  }
  return (
    <Sheet onClose={onClose} title={`Add bed · ${ward.name}`}>
      <div className="space-y-3.5">
        <Field label="Bed number" req><input className={inp} value={bedNumber} onChange={e => setBedNumber(e.target.value)} /></Field>
        <Field label="Bed type"><select className={inp} value={bedType} onChange={e => setBedType(e.target.value)}>{BED_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
        <SubmitBtn onClick={submit} saving={saving} label="Add bed" brandColor={brandColor} />
      </div>
    </Sheet>
  )
}

function ListSkeleton() { return <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white elev-1 animate-pulse" />)}</div> }
function Centered({ icon: Icon, title, sub, inline }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center animate-fade ${inline ? 'py-16' : 'py-24'}`}>
      <div className="h-20 w-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-4"><Icon className="h-9 w-9 text-gray-400" /></div>
      <p className="font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[240px]">{sub}</p>
    </div>
  )
}
