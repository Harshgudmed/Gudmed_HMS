import { useState, useEffect, useMemo, useCallback } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import { Scan, Search, Inbox, ClipboardList, X, Check, Loader2, Plus, Printer, Trash2, ShieldCheck } from 'lucide-react'

const initials = (p) => `${p?.firstName?.[0] || ''}${p?.lastName?.[0] || ''}`.toUpperCase() || 'P'
const avatarGradient = (g) => g === 'female' ? 'from-rose-400 to-pink-500' : g === 'male' ? 'from-blue-400 to-indigo-500' : 'from-violet-400 to-purple-500'
const pName = (p) => p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : 'Unknown patient'
const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
const rupee = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`
function stColor(s) {
  const m = {
    ordered: 'bg-blue-50 text-blue-600', scheduled: 'bg-blue-50 text-blue-600', pending: 'bg-blue-50 text-blue-600',
    in_progress: 'bg-amber-50 text-amber-600', performed: 'bg-indigo-50 text-indigo-600',
    reported: 'bg-emerald-50 text-emerald-600', verified: 'bg-emerald-50 text-emerald-600', completed: 'bg-emerald-50 text-emerald-600',
    cancelled: 'bg-rose-50 text-rose-600', rejected: 'bg-rose-50 text-rose-600',
  }
  return m[s] || 'bg-gray-100 text-gray-500'
}
const fmtStatus = (s) => (s || '').replace(/_/g, ' ')
function printDoc(html) { const w = window.open('', '_blank', 'width=900,height=780'); if (!w) { toast.error('Allow pop-ups to print'); return } w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500) }
const orgName = () => { try { return localStorage.getItem('hospitalName') || 'Hospital' } catch { return 'Hospital' } }
const fmtDT = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
const fmtFull = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const ageOf = (p) => { if (p?.age != null) return p.age; if (!p?.dateOfBirth) return '—'; const d = new Date(p.dateOfBirth); return isNaN(d) ? '—' : Math.floor((Date.now() - d) / (365.25 * 864e5)) }
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

function printRadInvoice(order, priceMap) {
  const price = (priceMap && priceMap[order.examId]) || order.exam?.price || 0
  const printDate = fmtDT(new Date()), orderDate = order.orderDate ? fmtDT(order.orderDate) : '—', patientName = pName(order.patient)
  printDoc(`<!DOCTYPE html><html><head><title>Radiology Invoice</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11pt;padding:30px}.header{display:flex;justify-content:space-between;border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:20px}.hosp-name{font-size:18pt;font-weight:bold;color:#1e3a5f}.banner{background:#1e3a5f;color:#fff;text-align:center;padding:6px 0;font-size:13pt;font-weight:bold;letter-spacing:3px;margin-bottom:16px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}.info-box{border:1px solid #ccc;border-radius:4px;padding:10px}.info-box h4{font-size:8.5pt;color:#1e3a5f;font-weight:bold;text-transform:uppercase;margin-bottom:6px;border-bottom:1px solid #eee;padding-bottom:4px}.row{display:flex;justify-content:space-between;font-size:9.5pt;margin-bottom:3px}table{width:100%;border-collapse:collapse;margin-bottom:12px}thead th{background:#1e3a5f;color:#fff;padding:7px 10px;text-align:left;font-size:9.5pt}tbody td{padding:7px 10px;border-bottom:1px solid #eee}.total-wrap{display:flex;justify-content:flex-end}.total-box{width:260px;border:2px solid #1e3a5f;border-radius:4px;overflow:hidden}.total-row{display:flex;justify-content:space-between;padding:6px 12px;font-size:10.5pt;border-bottom:1px solid #eee}.total-final{background:#1e3a5f;color:#fff;font-weight:bold;font-size:12pt}.footer{margin-top:24px;border-top:1px solid #ccc;padding-top:8px;font-size:8pt;color:#888;text-align:center}@media print{body{padding:10px}}
</style></head><body>
<div class="header"><div><div class="hosp-name">${orgName()}</div><div style="font-size:9pt;color:#555">Radiology &amp; Imaging Department</div></div><div style="text-align:right;font-size:9.5pt;color:#555">Order #: <strong>${order.orderNumber || '—'}</strong><br/>Date: ${orderDate}<br/>Print: ${printDate}</div></div>
<div class="banner">RADIOLOGY INVOICE</div>
<div class="info-grid"><div class="info-box"><h4>Patient Details</h4><div class="row"><span style="color:#666">Name</span><span><strong>${patientName}</strong></span></div><div class="row"><span style="color:#666">UHID</span><span>${order.patient?.mrn || '—'}</span></div><div class="row"><span style="color:#666">Priority</span><span style="text-transform:uppercase;font-weight:bold">${order.urgency || 'routine'}</span></div></div><div class="info-box"><h4>Order Details</h4><div class="row"><span style="color:#666">Order #</span><span>${order.orderNumber || '—'}</span></div><div class="row"><span style="color:#666">Modality</span><span style="text-transform:uppercase">${order.exam?.examCategory || order.exam?.modality || '—'}</span></div><div class="row"><span style="color:#666">Exam</span><span>${order.exam?.examName || '—'}</span></div></div></div>
<table><thead><tr><th>#</th><th>Description</th><th>Category</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead><tbody><tr><td>1</td><td><strong>${order.exam?.examName || '—'}</strong>${order.clinicalIndication ? '<br/><span style="font-size:9pt;color:#666">Indication: ' + order.clinicalIndication.substring(0, 60) + '</span>' : ''}</td><td style="text-transform:uppercase">${order.exam?.examCategory || '—'}</td><td style="text-align:right">1</td><td style="text-align:right">&#8377;${price.toLocaleString()}</td><td style="text-align:right">&#8377;${price.toLocaleString()}</td></tr></tbody></table>
<div class="total-wrap"><div class="total-box"><div class="total-row"><span>Subtotal</span><span>&#8377;${price.toLocaleString()}</span></div><div class="total-row"><span>Discount</span><span>&#8377;0</span></div><div class="total-row total-final"><span>TOTAL DUE</span><span>&#8377;${price.toLocaleString()}</span></div></div></div>
<div class="footer">${orgName()} — Radiology &amp; Imaging &nbsp;|&nbsp; System-generated invoice &nbsp;|&nbsp; Printed: ${printDate}</div>
</body></html>`)
}

function printRadReport(report, order) {
  const patientName = pName(order.patient), printDate = fmtDT(new Date())
  const reportedDate = report.reportedAt ? fmtDT(report.reportedAt) : printDate
  const verifiedDate = report.verifiedAt ? fmtDT(report.verifiedAt) : null
  printDoc(`<!DOCTYPE html><html><head><title>Radiology Report — ${order.orderNumber || ''}</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Times New Roman',Times,serif;font-size:11pt;color:#000}.page{max-width:210mm;margin:0 auto;padding:14mm 14mm 10mm 14mm}.hosp-header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px double #1e3a5f;padding-bottom:10px;margin-bottom:10px}.hosp-name{font-size:20pt;font-weight:bold;color:#1e3a5f}.banner{background:#1e3a5f;color:#fff;text-align:center;padding:5px 0;font-size:13pt;font-weight:bold;letter-spacing:3px;margin-bottom:10px}.status-badge{display:inline-block;padding:2px 10px;border-radius:3px;font-size:9pt;font-weight:bold}.status-final{background:#d1fae5;color:#065f46;border:1px solid #6ee7b7}.status-draft{background:#fef9c3;color:#854d0e;border:1px solid #fde047}.critical-banner{background:#fef2f2;border:2px solid #dc2626;padding:8px 12px;margin-bottom:10px;border-radius:3px}.info-box{border:1px solid #333;margin-bottom:10px}.info-box-hdr{background:#1e3a5f;color:#fff;padding:3px 10px;font-size:9pt;font-weight:bold;text-transform:uppercase}.info-box-hdr2{background:#4a7099;color:#fff;padding:3px 10px;font-size:9pt;font-weight:bold}.info-grid{display:grid;grid-template-columns:repeat(4,1fr)}.info-cell{padding:5px 10px;border-right:1px solid #ccc;border-bottom:1px solid #ccc}.info-cell:last-child{border-right:none}.info-label{font-size:7.5pt;color:#555;font-weight:bold;text-transform:uppercase}.info-value{font-size:10pt;margin-top:1px}.section{margin-bottom:12px}.section-header{font-weight:bold;font-size:10pt;color:#1e3a5f;border-bottom:1.5px solid #1e3a5f;padding-bottom:2px;margin-bottom:5px;text-transform:uppercase}.section-body{font-size:10.5pt;line-height:1.6;white-space:pre-wrap;padding-left:4px}.impression-box{border:2px solid #1e3a5f;padding:12px;background:#f0f4f8;margin-bottom:12px}.sig-section{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:18px;padding-top:10px;border-top:2px solid #000}.sig-line{border-bottom:1px solid #000;height:42px;margin-bottom:5px}.sig-label{font-size:9pt;color:#444;line-height:1.6}.footer{margin-top:14px;border-top:1px solid #ccc;padding-top:5px;font-size:8pt;color:#888;text-align:center}@media print{.page{padding:8mm}}
</style></head><body><div class="page">
<div class="hosp-header"><div><div class="hosp-name">${orgName()}</div><div style="font-size:9pt;color:#555">Radiology &amp; Imaging Department</div></div><div style="font-size:8.5pt;color:#555;text-align:right">Order #: <strong>${order.orderNumber || '—'}</strong><br/>Report Date: ${reportedDate}<br/>Print: ${printDate}</div></div>
<div class="banner">RADIOLOGY REPORT</div>
<div style="margin-bottom:8px"><span class="status-badge ${report.status === 'final' ? 'status-final' : 'status-draft'}">${(report.status || 'draft').toUpperCase()}</span>${report.hasCriticalFindings ? '&nbsp;&nbsp;<span style="color:#dc2626;font-weight:bold">&#9888; CRITICAL VALUES PRESENT</span>' : ''}</div>
${report.hasCriticalFindings ? `<div class="critical-banner"><div style="font-weight:bold;color:#dc2626">&#9888; CRITICAL FINDINGS — IMMEDIATE NOTIFICATION REQUIRED</div><div style="font-size:10.5pt;margin-top:4px">${report.criticalFindings || 'See findings section'}</div></div>` : ''}
<div class="info-box"><div class="info-box-hdr">Patient Information</div><div class="info-grid"><div class="info-cell"><div class="info-label">Patient Name</div><div class="info-value"><strong>${patientName}</strong></div></div><div class="info-cell"><div class="info-label">UHID</div><div class="info-value">${order.patient?.mrn || '—'}</div></div><div class="info-cell"><div class="info-label">Urgency</div><div class="info-value" style="text-transform:uppercase">${order.urgency || 'routine'}</div></div><div class="info-cell"><div class="info-label">Order Date</div><div class="info-value">${order.orderDate ? fmtFull(order.orderDate) : '—'}</div></div></div>
<div class="info-box-hdr2">Study Details</div><div class="info-grid"><div class="info-cell"><div class="info-label">Exam</div><div class="info-value"><strong>${order.exam?.examName || '—'}</strong></div></div><div class="info-cell"><div class="info-label">Category</div><div class="info-value" style="text-transform:uppercase">${order.exam?.examCategory || '—'}</div></div><div class="info-cell"><div class="info-label">Reported By</div><div class="info-value">Dr. Radiologist</div></div><div class="info-cell"><div class="info-label">Verified By</div><div class="info-value">${verifiedDate ? 'Dr. Verifier' : '—'}</div></div></div></div>
${order.clinicalIndication ? `<div class="section"><div class="section-header">Clinical Indication</div><div class="section-body">${order.clinicalIndication}</div></div>` : ''}
${report.technique ? `<div class="section"><div class="section-header">Technique</div><div class="section-body">${report.technique}</div></div>` : ''}
${report.comparedWithPrevious ? `<div class="section"><div class="section-header">Comparison</div><div class="section-body">Compared with previous study. ${report.comparisonNotes || ''}</div></div>` : ''}
<div class="section"><div class="section-header">Findings</div><div class="section-body">${report.findings || '—'}</div></div>
<div class="impression-box"><div style="font-weight:bold;font-size:11pt;color:#1e3a5f;text-transform:uppercase;margin-bottom:6px">Impression</div><div style="font-size:11pt;line-height:1.7">${report.impression || '—'}</div></div>
${report.recommendations ? `<div style="border-left:4px solid #1e3a5f;padding:8px 12px;background:#f8fafc;margin-bottom:12px"><strong style="color:#1e3a5f">Recommendations:</strong><div style="margin-top:4px">${report.recommendations}</div></div>` : ''}
<div class="sig-section"><div><div class="sig-line"></div><div class="sig-label"><strong>Reported By:</strong> Dr. Radiologist<br/>Date &amp; Time: ${reportedDate}</div></div><div><div class="sig-line"></div><div class="sig-label"><strong>Verified By:</strong> ${verifiedDate ? 'Dr. Verifier' : '—'}<br/>Date &amp; Time: ${verifiedDate || 'Not yet verified'}</div></div></div>
<div class="footer">${orgName()} — Radiology &amp; Imaging Department &nbsp;|&nbsp; Confidential — for requesting physician only &nbsp;|&nbsp; Printed: ${printDate}</div>
</div></body></html>`)
}

export default function MobileRadiology({ brandColor = '#2E4168' }) {
  const [tab, setTab] = useState('orders')
  return (
    <div className="pb-2">
      <div className="sticky top-14 z-20 -mx-3 px-3 pt-1 pb-2.5 bg-gray-50/95 backdrop-blur">
        <div className="flex gap-2">
          {[['orders', 'Orders', ClipboardList], ['catalog', 'Exam Catalog', Scan]].map(([k, l, Icon]) => {
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
  const [reportOrder, setReportOrder] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const act = async (o, patch, msg) => {
    setBusyId(o.id)
    try {
      const res = await client.patch('/radiology', { resource: 'order', id: o.id, ...patch })
      if (res?.success !== false) { setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ...patch } : x)); toast.success(msg) }
      else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to update order') } finally { setBusyId(null) }
  }
  const fetchReport = async (orderId) => { const res = await client.get('/radiology', { params: { resource: 'reports', limit: 2000 } }); return (res?.data || []).find(r => r.orderId === orderId) }
  const verify = async (o) => { setBusyId(o.id); try { const rep = await fetchReport(o.id); if (!rep) { toast.error('No report to verify'); return } await client.patch('/radiology', { resource: 'report', id: rep.id, status: 'final', verifiedAt: new Date().toISOString() }); setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: 'verified' } : x)); toast.success('Report verified') } catch (e) { toast.error(e.message || 'Failed to verify') } finally { setBusyId(null) } }
  const printReport = async (o) => { setBusyId(o.id); try { const rep = await fetchReport(o.id); if (!rep) { toast.error('No report found'); return } printRadReport(rep, o) } catch (e) { toast.error(e.message || 'Failed') } finally { setBusyId(null) } }
  const invoice = async (o) => { setBusyId(o.id); try { const res = await client.get('/radiology', { params: { resource: 'exams', limit: 2000 } }); const pm = {}; (res?.data || []).forEach(e => { pm[e.id] = e.price }); printRadInvoice(o, pm) } catch { printRadInvoice(o, {}) } finally { setBusyId(null) } }

  const fetchOrders = useCallback(() => {
    client.get('/radiology', { params: { resource: 'orders', limit: 150 } })
      .then(res => setOrders(res?.data || []))
      .catch(err => setError(err.message || 'Failed to load radiology orders'))
  }, [])
  useEffect(() => { fetchOrders() }, [fetchOrders])

  const statuses = useMemo(() => ['all', ...Array.from(new Set((orders || []).map(o => o.status).filter(Boolean)))], [orders])
  const filtered = useMemo(() => status === 'all' ? (orders || []) : (orders || []).filter(o => o.status === status), [orders, status])

  if (error) return <Centered icon={Scan} title="Couldn’t load orders" sub={error} />
  if (!orders) return <ListSkeleton />
  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto no-scrollbar px-1 mb-3">
        {statuses.map(s => { const on = status === s; return <button key={s} onClick={() => setStatus(s)} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`} style={on ? { backgroundColor: brandColor } : undefined}>{s === 'all' ? 'All' : fmtStatus(s)}</button> })}
      </div>
      {filtered.length === 0 ? <Centered icon={Inbox} title="No radiology orders" sub="Nothing for this filter." inline /> : (
        <div className="space-y-3 stagger">
          {filtered.map(o => {
            const acts = []
            if (!o.status || o.status === 'ordered' || o.status === 'pending' || o.status === 'scheduled') acts.push({ label: 'Start', patch: { status: 'in_progress' }, msg: 'Started' })
            else if (o.status === 'in_progress') acts.push({ label: 'Complete', patch: { status: 'completed', examPerformedAt: new Date().toISOString() }, msg: 'Marked completed' })
            else if (o.status === 'completed') acts.push({ label: 'Write report', report: true })
            return (
            <div key={o.id} className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br ${avatarGradient(o.patient?.gender)} flex items-center justify-center text-white font-bold text-xs`}>{initials(o.patient)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><p className="font-semibold text-[14px] text-gray-900 truncate">{pName(o.patient)}</p><span className="text-[11px] text-gray-400 shrink-0">{fmtDate(o.orderDate)}</span></div>
                  <p className="text-[11px] text-gray-400 truncate">{o.orderNumber}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${stColor(o.status)}`}>{fmtStatus(o.status) || 'ordered'}</span>
                    {o.urgency && o.urgency !== 'normal' && o.urgency !== 'routine' && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 capitalize">{o.urgency}</span>}
                  </div>
                </div>
              </div>
              {o.exam && (
                <div className="mt-2.5 flex items-center gap-2 border-t border-gray-50 pt-2.5">
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 truncate">{o.exam.examName}</span>
                  {o.exam.modality && <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">{o.exam.modality}</span>}
                </div>
              )}
              {acts.length > 0 && (
                <div className="mt-2.5 flex gap-2">
                  {acts.map(a => (
                    <button key={a.label} disabled={busyId === o.id} onClick={() => a.report ? setReportOrder(o) : act(o, a.patch, a.msg)} className="flex-1 rounded-xl py-2 text-xs font-semibold text-white active:scale-95 transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>
                      {busyId === o.id ? '…' : a.label}
                    </button>
                  ))}
                </div>
              )}
              {(o.status === 'completed' || o.status === 'reported' || o.status === 'verified') && (
                <div className="mt-2 flex gap-2">
                  {o.status === 'reported' && <button onClick={() => verify(o)} disabled={busyId === o.id} className="flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold bg-emerald-50 text-emerald-600 active:scale-95 transition disabled:opacity-60"><ShieldCheck className="h-3.5 w-3.5" />Verify</button>}
                  {(o.status === 'reported' || o.status === 'verified') && <button onClick={() => printReport(o)} disabled={busyId === o.id} className="flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-600 active:scale-95 transition"><Printer className="h-3.5 w-3.5" />Report</button>}
                  <button onClick={() => invoice(o)} disabled={busyId === o.id} className="flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-600 active:scale-95 transition"><Printer className="h-3.5 w-3.5" />Invoice</button>
                </div>
              )}
              {(!o.status || o.status === 'ordered' || o.status === 'pending' || o.status === 'scheduled' || o.status === 'in_progress') && (
                <button onClick={() => act(o, { status: 'cancelled' }, 'Order cancelled')} disabled={busyId === o.id} className="mt-2 w-full rounded-xl py-2 text-xs font-semibold bg-rose-50 text-rose-600 active:scale-95 transition disabled:opacity-60">Cancel order</button>
              )}
            </div>
            )
          })}
        </div>
      )}
      {reportOrder && <ReportSheet order={reportOrder} brandColor={brandColor} onClose={() => setReportOrder(null)} onDone={() => { setOrders(prev => prev.map(x => x.id === reportOrder.id ? { ...x, status: 'reported' } : x)); setReportOrder(null) }} />}
      <button onClick={() => setShowCreate(true)} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="New radiology order"><Plus className="h-7 w-7" /></button>
      {showCreate && <CreateOrderSheet brandColor={brandColor} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchOrders() }} />}
    </div>
  )
}

function ReportSheet({ order, brandColor, onClose, onDone }) {
  const [findings, setFindings] = useState('')
  const [impression, setImpression] = useState('')
  const [technique, setTechnique] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [critical, setCritical] = useState(false)
  const [criticalFindings, setCriticalFindings] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!findings || !impression) { toast.error('Findings and impression are required'); return }
    setSaving(true)
    try {
      const res = await client.post('/radiology', { resource: 'report', orderId: order.id, findings, impression, technique: technique || undefined, recommendations: recommendations || undefined, hasCriticalFindings: critical, criticalFindings: critical ? (criticalFindings || undefined) : undefined })
      if (res?.success !== false) { toast.success('Report saved'); onDone() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to save report') } finally { setSaving(false) }
  }
  const ta = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none bg-white'
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">Radiology report</h3><button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
        {order.exam && <p className="mb-3 text-sm text-gray-500">{order.exam.examName}{order.exam.modality ? ` · ${order.exam.modality}` : ''}</p>}
        <div className="space-y-3.5">
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Technique</label><input className={ta} value={technique} onChange={e => setTechnique(e.target.value)} placeholder="Optional" /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Findings <span className="text-rose-500">*</span></label><textarea rows={4} className={ta} value={findings} onChange={e => setFindings(e.target.value)} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Impression <span className="text-rose-500">*</span></label><textarea rows={3} className={ta} value={impression} onChange={e => setImpression(e.target.value)} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Recommendations</label><textarea rows={2} className={ta} value={recommendations} onChange={e => setRecommendations(e.target.value)} placeholder="Optional" /></div>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={critical} onChange={e => setCritical(e.target.checked)} className="h-4 w-4" style={{ accentColor: brandColor }} />Critical findings present</label>
          {critical && <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Critical findings detail</label><textarea rows={2} className={ta} value={criticalFindings} onChange={e => setCriticalFindings(e.target.value)} /></div>}
          <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Save report</button>
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
      const res = await client.get('/radiology', { params: { resource: 'exams', limit: LIMIT, offset: nextOffset } })
      const data = res.data ?? []
      setItems(prev => append ? [...prev, ...data] : data)
      setTotal(res.meta?.total ?? data.length); setOffset(nextOffset)
    } finally { setLoading(false); setLoadingMore(false) }
  }, [])
  useEffect(() => { load(0, false) }, [load])

  const shown = useMemo(() => {
    if (!q) return items
    const s = q.toLowerCase()
    return items.filter(t => t.examName?.toLowerCase().includes(s) || t.examCode?.toLowerCase().includes(s) || t.modality?.toLowerCase().includes(s) || t.examCategory?.toLowerCase().includes(s))
  }, [items, q])
  const del = async (t) => { try { const res = await client.patch('/radiology', { resource: 'exam', id: t.id, isActive: false }); if (res?.success !== false) { setItems(prev => prev.filter(x => x.id !== t.id)); toast.success('Exam removed') } else toast.error(res.error || 'Failed') } catch (e) { toast.error(e.message || 'Failed') } }

  return (
    <div>
      <div className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 elev-2 mb-3">
        <Search className="h-5 w-5 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${total.toLocaleString('en-IN')} exams (loaded ${items.length})…`} className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400" />
      </div>
      {loading ? <ListSkeleton /> : (
        <>
          <div className="space-y-2.5 stagger">
            {shown.map(t => (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Scan className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[14px] text-gray-900 truncate">{t.examName}</p>
                  <p className="text-[11px] text-gray-400 truncate">{[t.modality, t.bodyPart, t.examCategory].filter(Boolean).join(' · ')}</p>
                </div>
                {t.price != null && <span className="text-[14px] font-extrabold shrink-0" style={{ color: brandColor }}>{rupee(t.price)}</span>}
                <button onClick={() => del(t)} className="h-8 w-8 shrink-0 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center active:scale-90"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {shown.length === 0 && <Centered icon={Inbox} title="No exams" sub={q ? `Nothing loaded matches “${q}”. Load more to search further.` : '—'} inline />}
          </div>
          {items.length < total && (
            <button onClick={() => load(offset + LIMIT, true)} disabled={loadingMore} className="mx-auto mt-4 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold elev-2 active:scale-95 transition disabled:opacity-60" style={{ color: brandColor }}>{loadingMore ? 'Loading…' : `Load more (${total - items.length})`}</button>
          )}
        </>
      )}
      <button onClick={() => setShowAdd(true)} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="Add exam"><Plus className="h-7 w-7" /></button>
      {showAdd && <AddExamSheet brandColor={brandColor} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(0, false) }} />}
    </div>
  )
}

function AddExamSheet({ brandColor, onClose, onAdded }) {
  const [f, setF] = useState({ examName: '', examCode: '', examCategory: '', modality: '', bodyPart: '', price: '', estimatedDuration: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const I = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none bg-white'
  const L = (t) => <label className="text-xs font-medium text-gray-500">{t}</label>
  const submit = async () => {
    if (!f.examName || !f.examCode || !f.bodyPart) { toast.error('Name, code and body part are required'); return }
    setSaving(true)
    try {
      const res = await client.post('/radiology', { resource: 'exam', examName: f.examName, examCode: f.examCode, examCategory: f.examCategory || undefined, modality: f.modality || undefined, bodyPart: f.bodyPart, price: parseFloat(f.price) || 0, estimatedDuration: parseInt(f.estimatedDuration) || 30 })
      if (res?.success !== false) { toast.success('Exam added to catalog'); onAdded() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to add exam') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">Add radiology exam</h3><button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3">
          <div className="space-y-1.5">{L('Exam name *')}<input className={I} value={f.examName} onChange={e => set('examName', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">{L('Code *')}<input className={I} value={f.examCode} onChange={e => set('examCode', e.target.value)} /></div>
            <div className="space-y-1.5">{L('Body part *')}<input className={I} value={f.bodyPart} onChange={e => set('bodyPart', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">{L('Modality')}<input className={I} value={f.modality} onChange={e => set('modality', e.target.value)} placeholder="X-ray, CT, MRI…" /></div>
            <div className="space-y-1.5">{L('Category')}<input className={I} value={f.examCategory} onChange={e => set('examCategory', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">{L('Price (₹)')}<input type="number" className={I} value={f.price} onChange={e => set('price', e.target.value)} /></div>
            <div className="space-y-1.5">{L('Duration (min)')}<input type="number" className={I} value={f.estimatedDuration} onChange={e => set('estimatedDuration', e.target.value)} /></div>
          </div>
          <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Add exam</button>
        </div>
      </div>
    </div>
  )
}

function CreateOrderSheet({ brandColor, onClose, onCreated }) {
  const [pq, setPq] = useState(''); const [pres, setPres] = useState([]); const [patient, setPatient] = useState(null)
  const [exams, setExams] = useState([]); const [eq, setEq] = useState(''); const [exam, setExam] = useState(null)
  const [f, setF] = useState({ clinicalIndication: '', provisionalDiagnosis: '', relevantHistory: '', urgency: 'routine', scheduledDate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const I = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none bg-white'
  useEffect(() => { client.get('/radiology', { params: { resource: 'exams', limit: 300 } }).then(r => setExams(r?.data || [])).catch(() => {}) }, [])
  useEffect(() => { if (!pq || patient) { setPres([]); return } const t = setTimeout(() => client.get('/patients', { params: { search: pq, limit: 6 } }).then(r => setPres(r?.data || [])).catch(() => {}), 300); return () => clearTimeout(t) }, [pq, patient])
  const eResults = useMemo(() => { if (!eq) return []; const s = eq.toLowerCase(); return exams.filter(e => e.examName?.toLowerCase().includes(s) || e.modality?.toLowerCase().includes(s)).slice(0, 6) }, [eq, exams])
  const submit = async () => {
    if (!patient) { toast.error('Select a patient'); return }
    if (!exam) { toast.error('Select an exam'); return }
    if (!f.clinicalIndication) { toast.error('Clinical indication is required'); return }
    setSaving(true)
    try {
      const res = await client.post('/radiology', { resource: 'order', patientId: patient.id, examId: exam.id, clinicalIndication: f.clinicalIndication, provisionalDiagnosis: f.provisionalDiagnosis || undefined, relevantHistory: f.relevantHistory || undefined, urgency: f.urgency, scheduledDate: f.scheduledDate || undefined, notes: f.notes || undefined })
      if ((exam.price || 0) > 0) client.post('/billing', { resource: 'invoice', patientId: patient.id, items: [{ type: 'radiology', referenceId: exam.id, description: exam.examName, quantity: 1, unitPrice: exam.price || 0, discount: 0, tax: 0, total: exam.price || 0 }] }).catch(() => {})
      if (res?.success !== false) { toast.success('Radiology order created'); onCreated() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to create order') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[94vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">New radiology order</h3><button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3.5">
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Patient <span className="text-rose-500">*</span></label>
            {patient ? (
              <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5"><span className="text-sm font-medium text-gray-800 truncate">{pName(patient)} · {patient.mrn}</span><button onClick={() => { setPatient(null); setPq('') }} className="text-xs text-rose-500 font-semibold">Change</button></div>
            ) : (<>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5"><Search className="h-4 w-4 text-gray-400" /><input value={pq} onChange={e => setPq(e.target.value)} placeholder="Search patient…" className="flex-1 bg-transparent text-sm outline-none" /></div>
              {pres.length > 0 && <div className="rounded-xl border border-gray-100 bg-white elev-1 overflow-hidden divide-y divide-gray-100">{pres.map(p => <button key={p.id} onClick={() => { setPatient(p); setPres([]) }} className="w-full text-left px-3.5 py-2.5 active:bg-gray-50"><p className="text-sm font-medium text-gray-800 truncate">{pName(p)}</p><p className="text-[11px] text-gray-400">UHID {p.mrn}</p></button>)}</div>}
            </>)}
          </div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Exam <span className="text-rose-500">*</span></label>
            {exam ? (
              <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5"><span className="text-sm font-medium text-gray-800 truncate">{exam.examName}{exam.modality ? ` · ${exam.modality}` : ''}</span><button onClick={() => { setExam(null); setEq('') }} className="text-xs text-rose-500 font-semibold">Change</button></div>
            ) : (<>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5"><Search className="h-4 w-4 text-gray-400" /><input value={eq} onChange={e => setEq(e.target.value)} placeholder="Search exam…" className="flex-1 bg-transparent text-sm outline-none" /></div>
              {eResults.length > 0 && <div className="rounded-xl border border-gray-100 bg-white elev-1 overflow-hidden divide-y divide-gray-100">{eResults.map(e => <button key={e.id} onClick={() => { setExam(e); setEq('') }} className="w-full flex items-center justify-between px-3.5 py-2.5 text-left active:bg-gray-50"><span className="text-sm text-gray-800 truncate">{e.examName}</span><span className="text-xs text-gray-400">{e.modality || ''}</span></button>)}</div>}
            </>)}
          </div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Clinical indication <span className="text-rose-500">*</span></label><textarea rows={2} className={I} value={f.clinicalIndication} onChange={e => set('clinicalIndication', e.target.value)} placeholder="Reason for exam…" /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Provisional diagnosis</label><input className={I} value={f.provisionalDiagnosis} onChange={e => set('provisionalDiagnosis', e.target.value)} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Relevant history</label><textarea rows={2} className={I} value={f.relevantHistory} onChange={e => set('relevantHistory', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Urgency</label><select className={I} value={f.urgency} onChange={e => set('urgency', e.target.value)}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option></select></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Scheduled date</label><input type="date" className={I} value={f.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Notes</label><input className={I} value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
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
