import { useState, useEffect, useMemo, useCallback } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import { FlaskConical, Search, Inbox, ClipboardList, X, Check, Loader2, Plus, Printer, Trash2, ShieldCheck } from 'lucide-react'

const initials = (p) => `${p?.firstName?.[0] || ''}${p?.lastName?.[0] || ''}`.toUpperCase() || 'P'
const avatarGradient = (g) => g === 'female' ? 'from-rose-400 to-pink-500' : g === 'male' ? 'from-blue-400 to-indigo-500' : 'from-violet-400 to-purple-500'
const pName = (p) => p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : 'Unknown patient'
const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
const rupee = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`
function parseTests(t) { if (Array.isArray(t)) return t; if (typeof t === 'string') { try { return JSON.parse(t) } catch { return [] } } return [] }
function stColor(s) {
  const m = {
    ordered: 'bg-blue-50 text-blue-600', pending: 'bg-blue-50 text-blue-600',
    sample_collected: 'bg-amber-50 text-amber-600',
    results_entered: 'bg-indigo-50 text-indigo-600', in_progress: 'bg-indigo-50 text-indigo-600',
    verified: 'bg-emerald-50 text-emerald-600', reported: 'bg-emerald-50 text-emerald-600', completed: 'bg-emerald-50 text-emerald-600',
    rejected: 'bg-rose-50 text-rose-600', cancelled: 'bg-rose-50 text-rose-600',
  }
  return m[s] || 'bg-gray-100 text-gray-500'
}
const fmtStatus = (s) => (s || '').replace(/_/g, ' ')
function printDoc(html) { const w = window.open('', '_blank', 'width=900,height=780'); if (!w) { toast.error('Allow pop-ups to print'); return } w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500) }
const orgName = () => { try { return localStorage.getItem('hospitalName') || 'Hospital' } catch { return 'Hospital' } }
const fmtDT = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
const fmtD = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const ageOf = (p) => { if (p?.age != null) return p.age; if (!p?.dateOfBirth) return '—'; const d = new Date(p.dateOfBirth); return isNaN(d) ? '—' : Math.floor((Date.now() - d) / (365.25 * 864e5)) }
const drNm = (n) => n ? 'Dr. ' + n.replace(/^Dr\.?\s*/i, '') : '—'
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

function printLabReport(order, results) {
  const printDate = fmtDT(new Date()), orderDate = fmtDT(order.orderDate)
  const collectedDate = order.sampleCollectedAt ? fmtDT(order.sampleCollectedAt) : '—'
  const orderResults = results || [], hasResults = orderResults.length > 0
  const hasAbnormal = orderResults.some(r => r.isAbnormal || r.isCritical)
  const tests = parseTests(order.tests)
  const resultRows = hasResults
    ? orderResults.map(r => {
      const refRange = r.referenceRangeText || (r.referenceRangeMin != null && r.referenceRangeMax != null ? `${r.referenceRangeMin} – ${r.referenceRangeMax}` : '—')
      const rowClass = r.isCritical ? 'result-critical' : r.isAbnormal ? 'result-abnormal' : ''
      const flagStyle = r.flag === 'H' ? 'color:#b45309;font-weight:bold' : r.flag === 'L' ? 'color:#1d4ed8;font-weight:bold' : r.isCritical ? 'color:#dc2626;font-weight:bold' : ''
      const valStyle = r.isAbnormal || r.isCritical ? 'font-weight:bold;color:' + (r.isCritical ? '#dc2626' : '#b45309') : 'font-weight:bold'
      return `<tr class="${rowClass}"><td>${r.testName}</td><td style="${valStyle}">${r.resultValue}</td><td>${r.resultUnit || '—'}</td><td>${refRange}</td><td style="${flagStyle}">${r.isCritical ? '⚠ CRITICAL' : r.flag || 'N'}</td><td>${r.status === 'verified' ? '✓ Verified' : r.status === 'final' ? '✓ Final' : 'Reported'}</td></tr>`
    }).join('')
    : tests.map(t => `<tr><td>${t.testName}</td><td colspan="4" style="color:#888;font-style:italic">Result pending</td><td>—</td></tr>`).join('')
  const vr = orderResults.filter(r => r.verifiedBy)
  const verifiedBy = vr.length ? vr[0].verifiedBy : null
  const verifiedAt = vr.length && vr[0].verifiedAt ? fmtDT(vr[0].verifiedAt) : null
  const enteredBy = orderResults.length ? orderResults[0].enteredBy : null
  printDoc(`<!DOCTYPE html><html><head><title>Laboratory Report — ${order.orderNumber || ''}</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#000;background:#fff}.page{max-width:210mm;margin:0 auto;padding:12mm 14mm 10mm 14mm}.hosp-header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #1e3a5f;padding-bottom:10px;margin-bottom:10px}.hosp-name{font-size:19pt;font-weight:bold;color:#1e3a5f;line-height:1}.hosp-sub{font-size:9pt;color:#555;margin-top:2px}.hosp-contact{font-size:8.5pt;color:#555;text-align:right;line-height:1.6}.report-banner{background:#1e3a5f;color:#fff;text-align:center;padding:5px 0;font-size:13pt;font-weight:bold;letter-spacing:3px;margin-bottom:10px}.info-box{border:1px solid #333;margin-bottom:10px}.info-box-hdr{background:#1e3a5f;color:#fff;padding:3px 10px;font-size:9pt;font-weight:bold;letter-spacing:1px;text-transform:uppercase}.info-box-hdr2{background:#4a7099;color:#fff;padding:3px 10px;font-size:9pt;font-weight:bold}.info-grid{display:grid;grid-template-columns:repeat(4,1fr)}.info-cell{padding:5px 10px;border-right:1px solid #ccc;border-bottom:1px solid #ccc}.info-cell:last-child{border-right:none}.info-label{font-size:7.5pt;color:#555;font-weight:bold;text-transform:uppercase;letter-spacing:0.3px}.info-value{font-size:10pt;margin-top:1px}.clinical-bar{padding:7px 12px;background:#f0f4f8;border-left:4px solid #1e3a5f;margin-bottom:10px;font-size:10pt}table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:9.5pt}thead th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:left;font-size:9pt;font-weight:600}td{padding:5px 8px;border-bottom:1px solid #e8e8e8;vertical-align:middle}tr:nth-child(even) td{background:#f9f9f9}.result-abnormal td{background:#fffbeb!important}.result-critical td{background:#fef2f2!important}.abnormal-legend{font-size:8.5pt;color:#666;padding:5px 8px;background:#f8f9fa;border:1px solid #e0e0e0;margin-bottom:10px;border-radius:3px}.critical-note{background:#fef2f2;border:1px solid #dc2626;padding:8px 12px;margin-bottom:10px;font-size:9.5pt;color:#991b1b;border-radius:3px}.sig-section{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:16px;padding-top:10px;border-top:2px solid #000}.sig-line{border-bottom:1px solid #000;height:40px;margin-bottom:5px}.sig-label{font-size:9pt;color:#444;line-height:1.6}.footer{margin-top:12px;border-top:1px solid #ccc;padding-top:5px;font-size:8pt;color:#888;text-align:center}@media print{body{padding:0}.page{padding:8mm}}
</style></head><body><div class="page">
  <div class="hosp-header"><div><div class="hosp-name">${orgName()}</div><div class="hosp-sub">Laboratory &amp; Pathology Department</div><div class="hosp-sub">Accredited Clinical Laboratory Services</div></div><div class="hosp-contact">Order #: <strong>${order.orderNumber || '—'}</strong><br/>${order.accessionNumber ? `Accession #: <strong>${order.accessionNumber}</strong><br/>` : ''}Printed: ${printDate}</div></div>
  <div class="report-banner">LABORATORY REPORT</div>
  <div class="info-box"><div class="info-box-hdr">Patient Information</div><div class="info-grid">
    <div class="info-cell"><div class="info-label">Patient Name</div><div class="info-value"><strong>${pName(order.patient)}</strong></div></div>
    <div class="info-cell"><div class="info-label">UHID</div><div class="info-value">${order.patient?.mrn || '—'}</div></div>
    <div class="info-cell"><div class="info-label">Age / Sex</div><div class="info-value">${ageOf(order.patient)} yrs / ${cap(order.patient?.gender || '')}</div></div>
    <div class="info-cell"><div class="info-label">Requesting Physician</div><div class="info-value">${order.doctor?.fullName ? drNm(order.doctor.fullName) : '—'}</div></div>
  </div><div class="info-box-hdr2">Order Details</div><div class="info-grid">
    <div class="info-cell"><div class="info-label">Order Date</div><div class="info-value">${orderDate}</div></div>
    <div class="info-cell"><div class="info-label">Collection Date</div><div class="info-value">${collectedDate}</div></div>
    <div class="info-cell"><div class="info-label">Priority</div><div class="info-value" style="text-transform:uppercase;font-weight:bold;color:${order.priority === 'stat' ? '#dc2626' : order.priority === 'urgent' ? '#d97706' : '#333'}">${order.priority || 'routine'}</div></div>
    <div class="info-cell"><div class="info-label">Report Status</div><div class="info-value" style="color:#065f46;font-weight:bold">COMPLETED</div></div>
  </div></div>
  ${order.clinicalIndication ? `<div class="clinical-bar"><strong>Clinical Indication:</strong> ${order.clinicalIndication}</div>` : ''}
  ${order.provisionalDiagnosis ? `<div class="clinical-bar"><strong>Provisional Diagnosis:</strong> ${order.provisionalDiagnosis}</div>` : ''}
  ${hasAbnormal ? `<div class="critical-note">⚠ This report contains abnormal/critical values. Please review highlighted results and contact the laboratory for clarification if needed.</div>` : ''}
  <table><thead><tr><th style="width:28%">TEST NAME</th><th style="width:13%">RESULT</th><th style="width:10%">UNIT</th><th style="width:22%">REFERENCE RANGE</th><th style="width:12%">FLAG</th><th style="width:15%">STATUS</th></tr></thead><tbody>${resultRows}</tbody></table>
  ${hasAbnormal ? `<div class="abnormal-legend"><strong>Flag Legend:</strong> &nbsp; H = High &nbsp; L = Low &nbsp; N = Normal &nbsp; A = Abnormal &nbsp; ⚠ CRITICAL = Requires immediate attention</div>` : ''}
  ${order.notes ? `<div class="clinical-bar" style="margin-bottom:10px"><strong>Notes:</strong> ${order.notes}</div>` : ''}
  <div class="sig-section"><div><div class="sig-line"></div><div class="sig-label"><strong>Reported By:</strong> ${enteredBy || 'Lab Technologist'}<br/>Report Date: ${printDate}</div></div><div><div class="sig-line"></div><div class="sig-label"><strong>Verified By:</strong> ${verifiedBy || '—'}<br/>${verifiedAt ? `Verification Date: ${verifiedAt}` : 'Not yet verified'}</div></div></div>
  <div class="footer">${orgName()} — Laboratory &amp; Pathology Department &nbsp;|&nbsp; This report is confidential and intended solely for the requesting physician &nbsp;|&nbsp; Printed: ${printDate}</div>
</div></body></html>`)
}

function printLabInvoice(order, priceMap) {
  const invoiceDate = fmtD(new Date()), orderDate = fmtDT(order.orderDate)
  const tests = parseTests(order.tests)
  const lineItems = tests.map(t => ({ name: t.testName, code: t.testCode || (t.testName || '').substring(0, 4).toUpperCase(), price: (priceMap && (priceMap[t.testId] ?? priceMap[t.testName])) || t.price || 0 }))
  const subtotal = lineItems.reduce((s, i) => s + i.price, 0), tax = Math.round(subtotal * 0.05), total = subtotal + tax
  const rowsHtml = lineItems.map((item, idx) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${idx + 1}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb"><strong>${item.name}</strong></td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;color:#555">${item.code}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${item.price.toLocaleString()}</td></tr>`).join('')
  printDoc(`<!DOCTYPE html><html><head><title>Lab Invoice — ${order.orderNumber || ''}</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:30px;background:#fff;color:#000;font-size:10pt}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:14px;border-bottom:2.5px solid #1e3a5f}.hosp-name{font-size:20pt;font-weight:bold;color:#1e3a5f;line-height:1}.hosp-sub{font-size:8.5pt;color:#666;margin-top:3px}.inv-label{font-size:22pt;font-weight:bold;color:#1e3a5f;letter-spacing:2px;text-align:right}.inv-meta{font-size:9pt;color:#555;margin-top:3px;text-align:right}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}.info-box{background:#f8fafc;border:1px solid #e2e8f0;padding:12px 14px;border-radius:4px}.info-label{font-size:7.5pt;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-weight:700}.info-value{font-size:10.5pt;font-weight:700;color:#1e293b}.info-sub{font-size:8.5pt;color:#666;margin-top:2px}table{width:100%;border-collapse:collapse;margin-bottom:16px}thead{background:#1e3a5f;color:#fff}thead th{padding:9px 12px;text-align:left;font-size:8.5pt;letter-spacing:0.5px;text-transform:uppercase}thead th:last-child{text-align:right}.total-section{display:flex;justify-content:flex-end;margin-bottom:20px}.total-box{width:260px}.total-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e5e7eb;font-size:10pt;color:#444}.total-final{display:flex;justify-content:space-between;padding:10px 0;font-size:13pt;font-weight:bold;color:#1e3a5f;border-top:2px solid #1e3a5f;margin-top:4px}.payment-note{margin-bottom:32px;padding:10px 14px;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;font-size:9pt;color:#166534}.sig-row{display:flex;justify-content:space-between;margin-top:40px}.sig-box{text-align:center;width:200px}.sig-line{border-bottom:1px solid #333;height:40px;margin-bottom:5px}.sig-lbl{font-size:8.5pt;color:#555}.footer{border-top:1px solid #ddd;margin-top:16px;padding-top:8px;text-align:center;font-size:7.5pt;color:#999}@media print{body{padding:15px}}
</style></head><body>
<div class="header"><div><div class="hosp-name">${orgName()}</div><div class="hosp-sub">Laboratory &amp; Pathology Services</div></div><div><div class="inv-label">INVOICE</div><div class="inv-meta">No: LAB-${order.orderNumber || ''}</div><div class="inv-meta">Date: ${invoiceDate}</div></div></div>
<div class="info-grid"><div class="info-box"><div class="info-label">Bill To (Patient)</div><div class="info-value">${pName(order.patient)}</div><div class="info-sub">UHID: ${order.patient?.mrn || '—'}</div><div class="info-sub">Age / Gender: ${ageOf(order.patient)} yrs / ${cap(order.patient?.gender || '')}</div></div><div class="info-box"><div class="info-label">Order Information</div><div class="info-value">${order.orderNumber || '—'}</div><div class="info-sub">Order Date: ${orderDate}</div><div class="info-sub">Priority: <strong style="text-transform:uppercase;color:${order.priority === 'stat' ? '#dc2626' : order.priority === 'urgent' ? '#d97706' : '#333'}">${order.priority || 'routine'}</strong></div>${order.accessionNumber ? `<div class="info-sub">Accession: ${order.accessionNumber}</div>` : ''}</div></div>
<table><thead><tr><th style="width:36px">#</th><th>Test Description</th><th style="width:90px">Code</th><th style="width:130px;text-align:right">Amount (₹)</th></tr></thead><tbody>${rowsHtml}</tbody></table>
<div class="total-section"><div class="total-box"><div class="total-row"><span>Subtotal</span><span>₹ ${subtotal.toLocaleString()}</span></div><div class="total-row"><span>Discount</span><span>₹ 0</span></div><div class="total-row"><span>Tax (GST 5%)</span><span>₹ ${tax.toLocaleString()}</span></div><div class="total-final"><span>TOTAL DUE</span><span>₹ ${total.toLocaleString()}</span></div></div></div>
<div class="payment-note"><strong>Payment Instructions:</strong> Please make payment at the billing counter. Quote Order No. <strong>${order.orderNumber || ''}</strong> when paying.</div>
<div class="sig-row"><div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Patient / Authorised Signature</div></div><div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Lab In-charge / Cashier</div></div></div>
<div class="footer">${orgName()} — Laboratory &amp; Pathology Department &nbsp;|&nbsp; This is a computer-generated invoice &nbsp;|&nbsp; Printed: ${invoiceDate}</div>
</body></html>`)
}

export default function MobileLaboratory({ brandColor = '#2E4168' }) {
  const [tab, setTab] = useState('orders')
  return (
    <div className="pb-2">
      <div className="sticky top-14 z-20 -mx-3 px-3 pt-1 pb-2.5 bg-gray-50/95 backdrop-blur">
        <div className="flex gap-2">
          {[['orders', 'Orders', ClipboardList], ['catalog', 'Test Catalog', FlaskConical]].map(([k, l, Icon]) => {
            const on = tab === k
            return <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`} style={on ? { backgroundColor: brandColor } : undefined}><Icon className="h-4 w-4" />{l}</button>
          })}
        </div>
      </div>
      {tab === 'orders' ? <OrdersTab brandColor={brandColor} /> : <CatalogTab brandColor={brandColor} />}
    </div>
  )
}

function OrdersTab({ brandColor }) {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('all')
  const [busyId, setBusyId] = useState(null)
  const [resultOrder, setResultOrder] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const act = async (o, patch, msg) => {
    setBusyId(o.id)
    try {
      const res = await client.patch('/laboratory', { resource: 'order', id: o.id, ...patch })
      if (res?.success !== false) { setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ...patch } : x)); toast.success(msg) }
      else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to update order') } finally { setBusyId(null) }
  }

  const fetchResults = async (orderId) => { const res = await client.get('/laboratory', { params: { resource: 'results', limit: 2000 } }); return (res?.data || []).filter(r => r.orderId === orderId) }
  const verify = async (o) => {
    setBusyId(o.id)
    try {
      const rs = await fetchResults(o.id)
      if (!rs.length) { toast.error('No results to verify'); return }
      for (const r of rs) await client.patch('/laboratory', { resource: 'result', id: r.id, verifiedAt: new Date().toISOString() })
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: 'verified' } : x)); toast.success('Results verified')
    } catch (e) { toast.error(e.message || 'Failed to verify') } finally { setBusyId(null) }
  }
  const report = async (o) => { setBusyId(o.id); try { const rs = await fetchResults(o.id); printLabReport(o, rs) } catch { printLabReport(o, []) } finally { setBusyId(null) } }
  const invoice = async (o) => { setBusyId(o.id); try { const res = await client.get('/laboratory', { params: { resource: 'tests', limit: 2000 } }); const pm = {}; (res?.data || []).forEach(t => { pm[t.id] = t.price; pm[t.testName] = t.price }); printLabInvoice(o, pm) } catch { printLabInvoice(o, {}) } finally { setBusyId(null) } }

  const fetchOrders = useCallback(() => {
    client.get('/laboratory', { params: { resource: 'orders', limit: 100 } })
      .then(res => setOrders(res?.data || []))
      .catch(err => setError(err.message || 'Failed to load lab orders'))
  }, [])
  useEffect(() => { fetchOrders() }, [fetchOrders])

  const statuses = useMemo(() => ['all', ...Array.from(new Set((orders || []).map(o => o.status).filter(Boolean)))], [orders])
  const filtered = useMemo(() => status === 'all' ? (orders || []) : (orders || []).filter(o => o.status === status), [orders, status])

  if (error) return <Centered icon={FlaskConical} title="Couldn’t load orders" sub={error} />
  if (!orders) return <ListSkeleton />
  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto no-scrollbar px-1 mb-3">
        {statuses.map(s => { const on = status === s; return <button key={s} onClick={() => setStatus(s)} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`} style={on ? { backgroundColor: brandColor } : undefined}>{s === 'all' ? 'All' : fmtStatus(s)}</button> })}
      </div>
      {filtered.length === 0 ? <Centered icon={Inbox} title="No lab orders" sub="Nothing for this filter." inline /> : (
        <div className="space-y-3 stagger">
          {filtered.map(o => {
            const tests = parseTests(o.tests)
            const acts = []
            if (!o.status || o.status === 'ordered' || o.status === 'pending') acts.push({ label: 'Collect sample', patch: { status: 'sample_collected', sampleCollectedAt: new Date().toISOString(), accessionNumber: `ACC${Date.now()}` }, msg: 'Sample collected' })
            else if (o.status === 'sample_collected') acts.push({ label: 'Start processing', patch: { status: 'in_progress' }, msg: 'Processing started' })
            else if (o.status === 'in_progress') acts.push({ label: 'Complete', patch: { status: 'completed' }, msg: 'Order completed' })
            return (
              <div key={o.id} className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
                <div className="flex items-center gap-3">
                  <div className={`h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br ${avatarGradient(o.patient?.gender)} flex items-center justify-center text-white font-bold text-xs`}>{initials(o.patient)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><p className="font-semibold text-[14px] text-gray-900 truncate">{pName(o.patient)}</p><span className="text-[11px] text-gray-400 shrink-0">{fmtDate(o.orderDate)}</span></div>
                    <p className="text-[11px] text-gray-400 truncate">{o.orderNumber}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${stColor(o.status)}`}>{fmtStatus(o.status) || 'ordered'}</span>
                      {o.priority && o.priority !== 'normal' && o.priority !== 'routine' && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 capitalize">{o.priority}</span>}
                    </div>
                  </div>
                </div>
                {tests.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-gray-50 pt-2.5">
                    {tests.slice(0, 4).map((t, i) => <span key={i} className="rounded-md bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700">{t.testName || t.name || 'Test'}</span>)}
                    {tests.length > 4 && <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">+{tests.length - 4}</span>}
                  </div>
                )}
                {(acts.length > 0 || o.status === 'in_progress' || o.status === 'sample_collected') && (
                  <div className="mt-2.5 flex gap-2">
                    {(o.status === 'in_progress' || o.status === 'sample_collected') && (
                      <button onClick={() => setResultOrder(o)} className="flex-1 rounded-xl py-2 text-xs font-semibold bg-cyan-50 text-cyan-700 active:scale-95 transition">Enter results</button>
                    )}
                    {acts.map(a => (
                      <button key={a.label} disabled={busyId === o.id} onClick={() => act(o, a.patch, a.msg)} className="flex-1 rounded-xl py-2 text-xs font-semibold text-white active:scale-95 transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>
                        {busyId === o.id ? '…' : a.label}
                      </button>
                    ))}
                  </div>
                )}
                {(o.status === 'completed' || o.status === 'verified' || o.status === 'reported') && (
                  <div className="mt-2 flex gap-2">
                    {o.status !== 'verified' && <button onClick={() => verify(o)} disabled={busyId === o.id} className="flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold bg-emerald-50 text-emerald-600 active:scale-95 transition disabled:opacity-60"><ShieldCheck className="h-3.5 w-3.5" />Verify</button>}
                    <button onClick={() => report(o)} disabled={busyId === o.id} className="flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-600 active:scale-95 transition"><Printer className="h-3.5 w-3.5" />Report</button>
                    <button onClick={() => invoice(o)} disabled={busyId === o.id} className="flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-600 active:scale-95 transition"><Printer className="h-3.5 w-3.5" />Invoice</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {resultOrder && <ResultSheet order={resultOrder} brandColor={brandColor} onClose={() => setResultOrder(null)} onDone={() => { setOrders(prev => prev.map(x => x.id === resultOrder.id ? { ...x, status: 'completed' } : x)); setResultOrder(null) }} />}
      <button onClick={() => setShowCreate(true)} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="New lab order"><Plus className="h-7 w-7" /></button>
      {showCreate && <CreateOrderSheet brandColor={brandColor} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchOrders() }} />}
    </div>
  )
}

function ResultSheet({ order, brandColor, onClose, onDone }) {
  const tests = parseTests(order.tests)
  const [vals, setVals] = useState({})
  const [saving, setSaving] = useState(false)
  const setVal = (id, k, v) => setVals(s => ({ ...s, [id]: { ...(s[id] || {}), [k]: v } }))
  const submit = async () => {
    const entries = tests.filter(t => vals[t.testId]?.value)
    if (entries.length === 0) { toast.error('Enter at least one result'); return }
    setSaving(true)
    try {
      for (const t of entries) {
        const r = vals[t.testId]
        await client.post('/laboratory', { resource: 'result', orderId: order.id, testId: t.testId, resultValue: r.value, isAbnormal: !!r.abnormal, isCritical: !!r.critical, flag: r.critical ? 'A' : r.abnormal ? 'H' : 'N', comment: r.comment || undefined })
      }
      await client.patch('/laboratory', { resource: 'order', id: order.id, status: 'completed' })
      toast.success('Results saved')
      onDone()
    } catch (e) { toast.error(e.message || 'Failed to save results') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">Enter results</h3><button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3">
          {tests.length === 0 && <p className="text-sm text-gray-400">No tests on this order.</p>}
          {tests.map(t => (
            <div key={t.testId} className="rounded-2xl bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-800">{t.testName || 'Test'}</p>
              <input className="mt-2 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none bg-white" placeholder="Result value" value={vals[t.testId]?.value || ''} onChange={e => setVal(t.testId, 'value', e.target.value)} />
              <div className="mt-2 flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={!!vals[t.testId]?.abnormal} onChange={e => setVal(t.testId, 'abnormal', e.target.checked)} className="h-4 w-4" />Abnormal</label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={!!vals[t.testId]?.critical} onChange={e => setVal(t.testId, 'critical', e.target.checked)} className="h-4 w-4" />Critical</label>
              </div>
            </div>
          ))}
          <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Save results & complete</button>
        </div>
      </div>
    </div>
  )
}

function CatalogTab({ brandColor }) {
  const LIMIT = 40
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [q, setQ] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async (nextOffset, append) => {
    append ? setLoadingMore(true) : setLoading(true)
    try {
      const res = await client.get('/laboratory', { params: { resource: 'tests', limit: LIMIT, offset: nextOffset } })
      const data = res.data ?? []
      setItems(prev => append ? [...prev, ...data] : data)
      setTotal(res.meta?.total ?? data.length); setOffset(nextOffset)
    } finally { setLoading(false); setLoadingMore(false) }
  }, [])
  useEffect(() => { load(0, false) }, [load])

  const shown = useMemo(() => {
    if (!q) return items
    const s = q.toLowerCase()
    return items.filter(t => t.testName?.toLowerCase().includes(s) || t.testCode?.toLowerCase().includes(s) || t.testCategory?.toLowerCase().includes(s))
  }, [items, q])
  const del = async (t) => { try { const res = await client.patch('/laboratory', { resource: 'test', id: t.id, isActive: false }); if (res?.success !== false) { setItems(prev => prev.filter(x => x.id !== t.id)); toast.success('Test removed') } else toast.error(res.error || 'Failed') } catch (e) { toast.error(e.message || 'Failed') } }

  return (
    <div>
      <div className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 elev-2 mb-3">
        <Search className="h-5 w-5 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${total.toLocaleString('en-IN')} tests (loaded ${items.length})…`} className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400" />
      </div>
      {loading ? <ListSkeleton /> : (
        <>
          <div className="space-y-2.5 stagger">
            {shown.map(t => (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center"><FlaskConical className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[14px] text-gray-900 truncate">{t.testName}</p>
                  <p className="text-[11px] text-gray-400 truncate">{[t.testCode, t.testCategory, t.specimenType].filter(Boolean).join(' · ')}</p>
                </div>
                {t.price != null && <span className="text-[14px] font-extrabold shrink-0" style={{ color: brandColor }}>{rupee(t.price)}</span>}
                <button onClick={() => del(t)} className="h-8 w-8 shrink-0 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center active:scale-90"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {shown.length === 0 && <Centered icon={Inbox} title="No tests" sub={q ? `Nothing loaded matches “${q}”. Load more to search further.` : '—'} inline />}
          </div>
          {items.length < total && (
            <button onClick={() => load(offset + LIMIT, true)} disabled={loadingMore} className="mx-auto mt-4 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold elev-2 active:scale-95 transition disabled:opacity-60" style={{ color: brandColor }}>{loadingMore ? 'Loading…' : `Load more (${total - items.length})`}</button>
          )}
        </>
      )}
      <button onClick={() => setShowAdd(true)} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="Add test"><Plus className="h-7 w-7" /></button>
      {showAdd && <AddTestSheet brandColor={brandColor} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(0, false) }} />}
    </div>
  )
}

function AddTestSheet({ brandColor, onClose, onAdded }) {
  const [f, setF] = useState({ testName: '', testCode: '', testCategory: '', specimenType: '', unit: '', price: '', turnaroundTime: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const I = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none bg-white'
  const L = (t) => <label className="text-xs font-medium text-gray-500">{t}</label>
  const submit = async () => {
    if (!f.testName || !f.testCode || !f.testCategory) { toast.error('Name, code and category are required'); return }
    setSaving(true)
    try {
      const res = await client.post('/laboratory', { resource: 'test', testName: f.testName, testCode: f.testCode, testCategory: f.testCategory, specimenType: f.specimenType || undefined, unit: f.unit || undefined, price: Number(f.price) || 0, turnaroundTime: Number(f.turnaroundTime) || undefined })
      if (res?.success !== false) { toast.success('Test added to catalog'); onAdded() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to add test') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">Add lab test</h3><button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3">
          <div className="space-y-1.5">{L('Test name *')}<input className={I} value={f.testName} onChange={e => set('testName', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">{L('Code *')}<input className={I} value={f.testCode} onChange={e => set('testCode', e.target.value)} /></div>
            <div className="space-y-1.5">{L('Category *')}<input className={I} value={f.testCategory} onChange={e => set('testCategory', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">{L('Specimen')}<input className={I} value={f.specimenType} onChange={e => set('specimenType', e.target.value)} placeholder="e.g. Blood" /></div>
            <div className="space-y-1.5">{L('Unit')}<input className={I} value={f.unit} onChange={e => set('unit', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">{L('Price (₹)')}<input type="number" className={I} value={f.price} onChange={e => set('price', e.target.value)} /></div>
            <div className="space-y-1.5">{L('TAT (hrs)')}<input type="number" className={I} value={f.turnaroundTime} onChange={e => set('turnaroundTime', e.target.value)} /></div>
          </div>
          <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Add test</button>
        </div>
      </div>
    </div>
  )
}

function CreateOrderSheet({ brandColor, onClose, onCreated }) {
  const [pq, setPq] = useState(''); const [pres, setPres] = useState([]); const [patient, setPatient] = useState(null)
  const [tests, setTests] = useState([]); const [tq, setTq] = useState(''); const [picked, setPicked] = useState([])
  const [priority, setPriority] = useState('routine')
  const [indication, setIndication] = useState(''); const [diagnosis, setDiagnosis] = useState(''); const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const I = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none bg-white'
  useEffect(() => { client.get('/laboratory', { params: { resource: 'tests', limit: 300 } }).then(r => setTests(r?.data || [])).catch(() => {}) }, [])
  useEffect(() => { if (!pq || patient) { setPres([]); return } const t = setTimeout(() => client.get('/patients', { params: { search: pq, limit: 6 } }).then(r => setPres(r?.data || [])).catch(() => {}), 300); return () => clearTimeout(t) }, [pq, patient])
  const tResults = useMemo(() => { if (!tq) return []; const s = tq.toLowerCase(); return tests.filter(t => t.testName?.toLowerCase().includes(s) || t.testCode?.toLowerCase().includes(s)).slice(0, 6) }, [tq, tests])
  const submit = async () => {
    if (!patient) { toast.error('Select a patient'); return }
    if (!picked.length) { toast.error('Add at least one test'); return }
    setSaving(true)
    try {
      const res = await client.post('/laboratory', { resource: 'order', patientId: patient.id, tests: picked.map(t => ({ testId: t.id, testName: t.testName, urgency: priority })), clinicalIndication: indication || undefined, provisionalDiagnosis: diagnosis || undefined, priority, notes: notes || undefined })
      const total = picked.reduce((s, t) => s + (t.price || 0), 0)
      if (total > 0) client.post('/billing', { resource: 'invoice', patientId: patient.id, items: picked.map(t => ({ type: 'laboratory', referenceId: t.id, description: t.testName, quantity: 1, unitPrice: t.price || 0, discount: 0, tax: 0, total: t.price || 0 })) }).catch(() => {})
      if (res?.success !== false) { toast.success('Lab order created'); onCreated() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to create order') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[94vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">New lab order</h3><button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3.5">
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Patient <span className="text-rose-500">*</span></label>
            {patient ? (
              <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5"><span className="text-sm font-medium text-gray-800 truncate">{pName(patient)} · {patient.mrn}</span><button onClick={() => { setPatient(null); setPq('') }} className="text-xs text-rose-500 font-semibold">Change</button></div>
            ) : (<>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5"><Search className="h-4 w-4 text-gray-400" /><input value={pq} onChange={e => setPq(e.target.value)} placeholder="Search patient…" className="flex-1 bg-transparent text-sm outline-none" /></div>
              {pres.length > 0 && <div className="rounded-xl border border-gray-100 bg-white elev-1 overflow-hidden divide-y divide-gray-100">{pres.map(p => <button key={p.id} onClick={() => { setPatient(p); setPres([]) }} className="w-full text-left px-3.5 py-2.5 active:bg-gray-50"><p className="text-sm font-medium text-gray-800 truncate">{pName(p)}</p><p className="text-[11px] text-gray-400">UHID {p.mrn}</p></button>)}</div>}
            </>)}
          </div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Add tests <span className="text-rose-500">*</span></label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5"><Search className="h-4 w-4 text-gray-400" /><input value={tq} onChange={e => setTq(e.target.value)} placeholder="Search lab test…" className="flex-1 bg-transparent text-sm outline-none" /></div>
            {tResults.length > 0 && <div className="rounded-xl border border-gray-100 bg-white elev-1 overflow-hidden divide-y divide-gray-100">{tResults.map(t => <button key={t.id} onClick={() => { if (!picked.find(x => x.id === t.id)) setPicked(p => [...p, t]); setTq('') }} className="w-full flex items-center justify-between px-3.5 py-2.5 text-left active:bg-gray-50"><span className="text-sm text-gray-800 truncate">{t.testName}</span><Plus className="h-4 w-4 text-gray-400" /></button>)}</div>}
            {picked.length > 0 && <div className="flex flex-wrap gap-1.5">{picked.map(t => <span key={t.id} className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-1 text-[11px] font-medium text-cyan-700">{t.testName}<button onClick={() => setPicked(p => p.filter(x => x.id !== t.id))}><X className="h-3 w-3" /></button></span>)}</div>}
          </div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Priority</label><select className={I} value={priority} onChange={e => setPriority(e.target.value)}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option></select></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Clinical indication</label><input className={I} value={indication} onChange={e => setIndication(e.target.value)} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Provisional diagnosis</label><input className={I} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Notes</label><input className={I} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Create order</button>
        </div>
      </div>
    </div>
  )
}

function ListSkeleton() { return <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[76px] rounded-2xl bg-white elev-1 animate-pulse" />)}</div> }
function Centered({ icon: Icon, title, sub, inline }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center animate-fade ${inline ? 'py-16' : 'py-24'}`}>
      <div className="h-20 w-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-4"><Icon className="h-9 w-9 text-gray-400" /></div>
      <p className="font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[230px]">{sub}</p>
    </div>
  )
}
