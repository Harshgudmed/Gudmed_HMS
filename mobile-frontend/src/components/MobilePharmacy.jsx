import { useState, useEffect, useMemo, useCallback } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import {
  Pill, Search, Inbox, Boxes, AlertTriangle, PackageX, Plus, Pencil, Trash2,
  PackagePlus, Minus, X, ShoppingCart, ClipboardList, Receipt, Check, Loader2,
  LayoutDashboard, Layers, Truck, Calendar, Printer,
} from 'lucide-react'

/* ── helpers ─────────────────────────────────────────────────────────────── */
function shade(hex, percent) {
  const h = (hex || '#2E4168').replace('#', '')
  if (h.length !== 6) return hex
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const t = percent < 0 ? 0 : 255, p = Math.abs(percent) / 100
  r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
}
const rupee = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`
const rupee2 = (n) => `₹${(Number(n) || 0).toFixed(2)}`
const hexA = (hex, a) => { try { const h = (hex || '#2E4168').replace('#', ''); const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h; const n = parseInt(f, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})` } catch { return `rgba(46,65,104,${a})` } }
const expiryInfo = (d) => { if (!d) return { label: '—', cls: 'text-gray-400' }; const t = new Date(d).getTime(); const now = Date.now(); if (t <= now) return { label: 'Expired', cls: 'text-rose-600' }; if (t < now + 30 * 864e5) return { label: 'Expiring soon', cls: 'text-amber-600' }; return { label: fmtDate(d), cls: 'text-gray-500' } }
const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Powder', 'Other']
const inputCls = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-gray-400 bg-white'

function stockStatus(d) {
  const q = d.quantityInStock || 0
  if (q <= 0) return { label: 'Out of stock', badge: 'bg-rose-50 text-rose-600', iconBg: 'bg-rose-50', iconFg: 'text-rose-500' }
  if (q <= (d.reorderLevel || 0)) return { label: `Low · ${q} left`, badge: 'bg-amber-50 text-amber-600', iconBg: 'bg-amber-50', iconFg: 'text-amber-500' }
  return { label: `${q} in stock`, badge: 'bg-emerald-50 text-emerald-600', iconBg: 'bg-teal-50', iconFg: 'text-teal-500' }
}

const TABS = [
  { key: 'inventory', label: 'Inventory', Icon: Boxes },
  { key: 'prescriptions', label: 'Prescriptions', Icon: ClipboardList },
  { key: 'batches', label: 'Batches', Icon: Layers },
  { key: 'purchase-orders', label: 'Purchase', Icon: Truck },
  { key: 'sell', label: 'Sell', Icon: ShoppingCart },
  { key: 'sales', label: 'Sales', Icon: Receipt },
]

/* ── reusable bottom sheet ───────────────────────────────────────────────── */
function Sheet({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
const Field = ({ label, required, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-gray-500">{label}{required && <span className="text-rose-500"> *</span>}</label>
    {children}
  </div>
)

/* ════════════════════════════════════════════════════════════════════════ */
export default function MobilePharmacy({ brandColor = '#2E4168' }) {
  const [tab, setTab] = useState('inventory')
  const [drugs, setDrugs] = useState(null)
  const [error, setError] = useState(null)

  const fetchDrugs = useCallback(() => {
    return client.get('/pharmacy/drugs', { params: { limit: 1000 } })
      .then(res => setDrugs((res?.data || []).filter(d => d.isActive !== false)))
      .catch(err => setError(err.message || 'Failed to load pharmacy'))
  }, [])
  useEffect(() => { fetchDrugs() }, [fetchDrugs])

  return (
    <div className="pb-2">
      {/* Tab bar */}
      <div className="sticky top-14 z-20 -mx-3 px-3 pt-1 pb-2.5 bg-gray-50/95 backdrop-blur">
        <div className="-mx-1 flex gap-2 overflow-x-auto no-scrollbar px-1">
          {TABS.map(t => {
            const on = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                style={on ? { backgroundColor: brandColor } : undefined}>
                <t.Icon className="h-4 w-4" />{t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'inventory' && <InventoryTab drugs={drugs} error={error} brandColor={brandColor} refetch={fetchDrugs} />}
      {tab === 'prescriptions' && <PrescriptionsTab brandColor={brandColor} />}
      {tab === 'batches' && <BatchesTab drugs={drugs || []} brandColor={brandColor} />}
      {tab === 'purchase-orders' && <PurchaseOrdersTab drugs={drugs || []} brandColor={brandColor} />}
      {tab === 'sell' && <SellTab drugs={drugs || []} brandColor={brandColor} onSold={fetchDrugs} />}
      {tab === 'sales' && <SalesTab brandColor={brandColor} />}
    </div>
  )
}

/* ── BATCHES ─────────────────────────────────────────────────────────────── */
function BatchesTab({ drugs, brandColor }) {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const fetchBatches = useCallback(() => { client.get('/pharmacy/batches', { params: { limit: 2000 } }).then(r => setList(r?.data || [])).catch(e => setError(e.message || 'Failed')) }, [])
  useEffect(() => { fetchBatches() }, [fetchBatches])
  const drugName = (id) => drugs.find(d => d.id === id)?.drugName || '—'
  const openAdd = () => { setEditingId(null); setForm({ drugId: '', batchNumber: '', expiryDate: '', manufactureDate: '', quantityReceived: '', costPricePerUnit: '' }) }
  const openEdit = (b) => { setEditingId(b.id); setForm({ drugId: b.drugId || '', batchNumber: b.batchNumber || '', expiryDate: (b.expiryDate || '').slice(0, 10), manufactureDate: (b.manufactureDate || '').slice(0, 10), quantityReceived: String(b.quantityReceived ?? b.quantityRemaining ?? ''), costPricePerUnit: String(b.costPricePerUnit ?? '') }) }
  const save = async () => {
    if (!form.drugId || !form.batchNumber || !form.expiryDate) { toast.error('Drug, batch no. and expiry are required'); return }
    setSaving(true)
    try {
      const payload = { drugId: form.drugId, batchNumber: form.batchNumber, expiryDate: form.expiryDate, manufactureDate: form.manufactureDate || undefined, quantityReceived: parseInt(form.quantityReceived) || 1, costPricePerUnit: parseFloat(form.costPricePerUnit) || 0 }
      const res = editingId ? await client.patch(`/pharmacy/batches/${editingId}`, payload) : await client.post('/pharmacy/batches', payload)
      if (res.success !== false) { toast.success(editingId ? 'Batch updated' : 'Batch added'); setForm(null); setEditingId(null); fetchBatches() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to save batch') } finally { setSaving(false) }
  }
  const del = async (b) => { try { const res = await client.delete(`/pharmacy/batches/${b.id}`); if (res.success !== false) { toast.success('Batch removed'); fetchBatches() } else toast.error(res.error || 'Failed') } catch (e) { toast.error(e.message || 'Failed') } }

  if (error) return <Centered icon={Layers} title="Couldn’t load batches" sub={error} />
  if (!list) return <div className="mt-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white elev-1 animate-pulse" />)}</div>
  const shown = q ? list.filter(b => b.batchNumber?.toLowerCase().includes(q.toLowerCase()) || drugName(b.drugId).toLowerCase().includes(q.toLowerCase())) : list

  return (
    <div className="mt-1">
      <div className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 elev-2 mb-3"><Search className="h-5 w-5 text-gray-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search batch or drug…" className="flex-1 bg-transparent text-sm outline-none" /></div>
      {shown.length === 0 ? <Centered icon={Inbox} title="No batches" sub="Add a batch with ＋." inline /> : (
        <div className="space-y-3 stagger">
          {shown.map(b => { const ex = expiryInfo(b.expiryDate); return (
            <div key={b.id} className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[14px] text-gray-900 truncate">{drugName(b.drugId)}</p>
                <p className="text-[11px] text-gray-400">Batch {b.batchNumber} · Qty {b.quantityRemaining ?? b.quantityReceived ?? 0}</p>
                <p className={`text-[11px] font-medium ${ex.cls}`}>{ex.label === 'Expired' || ex.label === 'Expiring soon' ? `${ex.label} · ${fmtDate(b.expiryDate)}` : `Exp ${ex.label}`}</p>
              </div>
              <button onClick={() => openEdit(b)} className="h-9 w-9 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center active:scale-90"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => del(b)} className="h-9 w-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center active:scale-90"><Trash2 className="h-4 w-4" /></button>
            </div>
          ) })}
        </div>
      )}
      <button onClick={openAdd} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="Add batch"><Plus className="h-7 w-7" /></button>
      <Sheet open={!!form} onClose={() => { setForm(null); setEditingId(null) }} title={editingId ? 'Edit batch' : 'Add batch'}>
        {form && (
          <div className="space-y-3.5">
            <Field label="Drug" required><select className={inputCls} value={form.drugId} onChange={e => setForm(f => ({ ...f, drugId: e.target.value }))}><option value="">Select drug</option>{drugs.map(d => <option key={d.id} value={d.id}>{d.drugName} {d.strength || ''}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Batch number" required><input className={inputCls} value={form.batchNumber} onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))} /></Field>
              <Field label="Quantity"><input type="number" className={inputCls} value={form.quantityReceived} onChange={e => setForm(f => ({ ...f, quantityReceived: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expiry date" required><input type="date" className={inputCls} value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} /></Field>
              <Field label="Mfg date"><input type="date" className={inputCls} value={form.manufactureDate} onChange={e => setForm(f => ({ ...f, manufactureDate: e.target.value }))} /></Field>
            </div>
            <Field label="Cost / unit (₹)"><input type="number" className={inputCls} value={form.costPricePerUnit} onChange={e => setForm(f => ({ ...f, costPricePerUnit: e.target.value }))} /></Field>
            <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{editingId ? 'Save batch' : 'Add batch'}</button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

/* ── PURCHASE ORDERS ─────────────────────────────────────────────────────── */
const PO_NEXT = { draft: { label: 'Submit', status: 'submitted' }, submitted: { label: 'Approve', status: 'approved' } }
function PurchaseOrdersTab({ drugs, brandColor }) {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)            // create PO
  const [poItems, setPoItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(null)
  const [receive, setReceive] = useState(null)      // { po, items:[…] }
  const [receiving, setReceiving] = useState(false)
  const fetchPOs = useCallback(() => { client.get('/pharmacy/purchase-orders', { params: { limit: 1000 } }).then(r => setList(r?.data || [])).catch(e => setError(e.message || 'Failed')) }, [])
  useEffect(() => { fetchPOs() }, [fetchPOs])
  const drugName = (id) => drugs.find(d => d.id === id)?.drugName || '—'
  const parseItems = (po) => { const it = po.items; if (Array.isArray(it)) return it; if (typeof it === 'string') { try { return JSON.parse(it) } catch { return [] } } return [] }

  const openCreate = () => { setForm({ supplierName: '', supplierContact: '', expectedDeliveryDate: '', notes: '' }); setPoItems([]) }
  const addPoItem = (d) => { if (poItems.find(i => i.drugId === d.id)) return; setPoItems(p => [...p, { drugId: d.id, drugName: d.drugName, quantityOrdered: 1, unitCost: d.costPrice || 0 }]) }
  const savePO = async () => {
    if (!form.supplierName || poItems.length === 0) { toast.error('Add supplier and at least one item'); return }
    setSaving(true)
    try {
      const res = await client.post('/pharmacy/purchase-orders', { ...form, items: poItems })
      if (res.success !== false) { toast.success('Purchase order created'); setForm(null); setPoItems([]); fetchPOs() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to create PO') } finally { setSaving(false) }
  }
  const updateStatus = async (po, status) => {
    setBusy(po.id)
    try { const res = await client.patch(`/pharmacy/purchase-orders/${po.id}`, { status }); if (res.success !== false) { toast.success(`PO ${status}`); fetchPOs() } else toast.error(res.error || 'Failed') } catch (e) { toast.error(e.message || 'Failed') } finally { setBusy(null) }
  }
  const openReceive = (po) => setReceive({ po, items: parseItems(po).map(i => ({ ...i, quantityReceived: i.quantityOrdered || i.quantity || 1, batchNumber: '', expiryDate: '' })) })
  const doReceive = async () => {
    setReceiving(true)
    try { const res = await client.patch(`/pharmacy/purchase-orders/${receive.po.id}/receive`, { items: receive.items }); if (res.success !== false) { toast.success('PO received — batches created'); setReceive(null); fetchPOs() } else toast.error(res.error || 'Failed') } catch (e) { toast.error(e.message || 'Failed to receive') } finally { setReceiving(false) }
  }

  if (error) return <Centered icon={Truck} title="Couldn’t load orders" sub={error} />
  if (!list) return <div className="mt-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white elev-1 animate-pulse" />)}</div>

  return (
    <div className="mt-1">
      {list.length === 0 ? <Centered icon={Inbox} title="No purchase orders" sub="Create one with ＋." inline /> : (
        <div className="space-y-3 stagger">
          {list.map(po => { const items = parseItems(po); const total = items.reduce((s, i) => s + (i.unitCost || 0) * (i.quantityOrdered || i.quantity || 0), 0); const st = (po.status || 'draft').toLowerCase(); const next = PO_NEXT[st]; return (
            <div key={po.id} className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="font-semibold text-[14px] text-gray-900 truncate">{po.supplierName || 'Supplier'}</p><p className="text-[11px] text-gray-400">{po.poNumber || ''} · {items.length} item{items.length !== 1 ? 's' : ''}{total > 0 ? ` · ${rupee2(total)}` : ''}</p></div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize bg-gray-100 text-gray-600">{st}</span>
              </div>
              <div className="mt-2.5 flex gap-2">
                {next && <button onClick={() => updateStatus(po, next.status)} disabled={busy === po.id} className="flex-1 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-700 active:scale-95 transition disabled:opacity-60">{busy === po.id ? '…' : next.label}</button>}
                {st === 'approved' && <button onClick={() => openReceive(po)} className="flex-1 rounded-xl py-2 text-xs font-semibold text-white active:scale-95 transition" style={{ backgroundColor: brandColor }}>Receive</button>}
                {st !== 'received' && st !== 'cancelled' && <button onClick={() => updateStatus(po, 'cancelled')} disabled={busy === po.id} className="flex-1 rounded-xl py-2 text-xs font-semibold bg-rose-50 text-rose-600 active:scale-95 transition disabled:opacity-60">Cancel</button>}
              </div>
            </div>
          ) })}
        </div>
      )}
      <button onClick={openCreate} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="New PO"><Plus className="h-7 w-7" /></button>

      {/* Create PO */}
      <Sheet open={!!form} onClose={() => setForm(null)} title="New purchase order">
        {form && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Supplier" required><input className={inputCls} value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} /></Field>
              <Field label="Contact"><input className={inputCls} value={form.supplierContact} onChange={e => setForm(f => ({ ...f, supplierContact: e.target.value }))} /></Field>
            </div>
            <Field label="Expected delivery"><input type="date" className={inputCls} value={form.expectedDeliveryDate} onChange={e => setForm(f => ({ ...f, expectedDeliveryDate: e.target.value }))} /></Field>
            <Field label="Add items">
              <select className={inputCls} value="" onChange={e => { const d = drugs.find(x => x.id === e.target.value); if (d) addPoItem(d) }}><option value="">Select drug to add…</option>{drugs.map(d => <option key={d.id} value={d.id}>{d.drugName} {d.strength || ''}</option>)}</select>
            </Field>
            {poItems.map((it, i) => (
              <div key={it.drugId} className="rounded-xl bg-gray-50 p-2.5">
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-800 truncate">{it.drugName}</span><button onClick={() => setPoItems(p => p.filter((_, j) => j !== i))} className="text-rose-400"><Trash2 className="h-4 w-4" /></button></div>
                <div className="mt-2 grid grid-cols-2 gap-2"><input type="number" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" placeholder="Qty" value={it.quantityOrdered} onChange={e => setPoItems(p => p.map((x, j) => j === i ? { ...x, quantityOrdered: parseInt(e.target.value) || 0 } : x))} /><input type="number" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" placeholder="Unit cost" value={it.unitCost} onChange={e => setPoItems(p => p.map((x, j) => j === i ? { ...x, unitCost: parseFloat(e.target.value) || 0 } : x))} /></div>
              </div>
            ))}
            <Field label="Notes"><input className={inputCls} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field>
            <button onClick={savePO} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Create order</button>
          </div>
        )}
      </Sheet>

      {/* Receive PO */}
      <Sheet open={!!receive} onClose={() => setReceive(null)} title="Receive order">
        {receive && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Enter batch + expiry for each item; stock batches are created on receive.</p>
            {receive.items.map((it, i) => (
              <div key={i} className="rounded-xl bg-gray-50 p-2.5 space-y-2">
                <span className="text-sm font-medium text-gray-800">{it.drugName || drugName(it.drugId)}</span>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" placeholder="Qty" value={it.quantityReceived} onChange={e => setReceive(r => ({ ...r, items: r.items.map((x, j) => j === i ? { ...x, quantityReceived: parseInt(e.target.value) || 0 } : x) }))} />
                  <input className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" placeholder="Batch" value={it.batchNumber} onChange={e => setReceive(r => ({ ...r, items: r.items.map((x, j) => j === i ? { ...x, batchNumber: e.target.value } : x) }))} />
                  <input type="date" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" value={it.expiryDate} onChange={e => setReceive(r => ({ ...r, items: r.items.map((x, j) => j === i ? { ...x, expiryDate: e.target.value } : x) }))} />
                </div>
              </div>
            ))}
            <button onClick={doReceive} disabled={receiving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{receiving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Confirm receive</button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

/* ── INVENTORY ───────────────────────────────────────────────────────────── */
const SCHEDULE_TYPES = ['none', 'H', 'H1', 'X', 'G']
const emptyDrug = { drugName: '', genericName: '', brandName: '', drugCategory: '', dosageForm: 'Tablet', strength: '', sellingPrice: '', costPrice: '', markupPercentage: '', reorderLevel: '10', drugCode: '', initialQty: '0', requiresPrescription: false, scheduleType: 'none', scheme: '', batchNumber: '', expiryDate: '', manufacturingDate: '' }
const PAGE = 20

function InventoryTab({ drugs, error, brandColor, refetch }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [visible, setVisible] = useState(PAGE)
  const [form, setForm] = useState(null)        // {…drug} when add/edit sheet open
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [actionDrug, setActionDrug] = useState(null)   // drug for action sheet
  const [adjust, setAdjust] = useState(null)    // { drug, type, amount }

  const stats = useMemo(() => {
    const list = drugs || []
    return {
      total: list.length,
      low: list.filter(d => d.quantityInStock > 0 && d.quantityInStock <= (d.reorderLevel || 0)).length,
      out: list.filter(d => (d.quantityInStock || 0) <= 0).length,
      value: list.reduce((a, d) => a + (d.quantityInStock || 0) * (d.sellingPrice || 0), 0),
    }
  }, [drugs])
  const categories = useMemo(() => ['All', ...Array.from(new Set((drugs || []).map(d => d.drugCategory).filter(Boolean))).sort()], [drugs])
  const filtered = useMemo(() => {
    let list = drugs || []
    if (cat !== 'All') list = list.filter(d => d.drugCategory === cat)
    if (q) { const s = q.toLowerCase(); list = list.filter(d => d.drugName?.toLowerCase().includes(s) || d.genericName?.toLowerCase().includes(s)) }
    return list
  }, [drugs, cat, q])
  useEffect(() => { setVisible(PAGE) }, [q, cat])

  const openAdd = () => { setEditingId(null); setForm({ ...emptyDrug }) }
  const openEdit = (d) => {
    setActionDrug(null); setEditingId(d.id)
    setForm({ drugName: d.drugName || '', genericName: d.genericName || '', brandName: d.brandName || '', drugCategory: d.drugCategory || '', dosageForm: d.dosageForm || 'Tablet', strength: d.strength || '', sellingPrice: String(d.sellingPrice ?? ''), costPrice: String(d.costPrice ?? ''), markupPercentage: String(d.markupPercentage ?? ''), reorderLevel: String(d.reorderLevel ?? '10'), drugCode: d.drugCode || '', initialQty: '0', requiresPrescription: !!d.requiresPrescription, scheduleType: d.requiresPrescription ? 'H' : 'none', scheme: '', batchNumber: '', expiryDate: '', manufacturingDate: '' })
  }

  const saveDrug = async () => {
    if (!form.drugName || !form.drugCategory || !form.dosageForm || !form.strength) { toast.error('Fill all required fields'); return }
    setSaving(true)
    try {
      const payload = {
        drugName: form.drugName, genericName: form.genericName || undefined, brandName: form.brandName || undefined,
        drugCategory: form.drugCategory, dosageForm: form.dosageForm, strength: form.strength,
        sellingPrice: parseFloat(form.sellingPrice) || 0, costPrice: parseFloat(form.costPrice) || 0,
        markupPercentage: parseFloat(form.markupPercentage) || 0,
        reorderLevel: parseInt(form.reorderLevel) || 10,
        requiresPrescription: (form.scheduleType && form.scheduleType !== 'none') || form.requiresPrescription,
        description: [form.scheduleType && form.scheduleType !== 'none' ? `SCH:${form.scheduleType}` : '', form.scheme ? `Scheme: ${form.scheme}` : ''].filter(Boolean).join(' | ') || undefined,
      }
      if (form.drugCode) payload.drugCode = form.drugCode
      if (!editingId) { if (!payload.drugCode) payload.drugCode = `DRG${Date.now()}`; payload.quantityInStock = parseInt(form.initialQty) || 0 }
      const res = editingId ? await client.patch(`/pharmacy/drugs/${editingId}`, payload) : await client.post('/pharmacy/drugs', payload)
      if (res.success) {
        if (!editingId && form.batchNumber && form.expiryDate && parseInt(form.initialQty) > 0) {
          await client.post('/pharmacy/batches', { drugId: res.data.id, batchNumber: form.batchNumber, expiryDate: form.expiryDate, manufactureDate: form.manufacturingDate || undefined, quantityReceived: parseInt(form.initialQty), costPricePerUnit: parseFloat(form.costPrice) || 0 }).catch(() => {})
        }
        toast.success(editingId ? 'Medicine updated' : 'Medicine added'); setForm(null); setEditingId(null); await refetch()
      }
      else toast.error(res.error || 'Failed to save')
    } catch { toast.error('Failed to save medicine') } finally { setSaving(false) }
  }

  const doDelete = async (d) => {
    setActionDrug(null)
    try { const res = await client.delete(`/pharmacy/drugs/${d.id}`); if (res.success) { toast.success('Medicine deleted'); refetch() } else toast.error(res.error || 'Failed') }
    catch { toast.error('Failed to delete') }
  }
  const doAdjust = async () => {
    const cur = adjust.drug.quantityInStock || 0
    const amt = parseInt(adjust.amount) || 0
    const next = adjust.type === 'add' ? cur + amt : Math.max(0, cur - amt)
    try { const res = await client.patch(`/pharmacy/drugs/${adjust.drug.id}`, { quantityInStock: next }); if (res.success) { toast.success(`Stock → ${next} units`); setAdjust(null); refetch() } else toast.error(res.error || 'Failed') }
    catch { toast.error('Failed to adjust stock') }
  }

  if (error) return <Centered icon={Pill} title="Couldn’t load pharmacy" sub={error} />
  if (!drugs) return <PharmacySkeleton />

  return (
    <div className="relative">
      {/* hero + mini stats */}
      <div className="relative overflow-hidden rounded-3xl p-4 text-white elev-3" style={{ background: `linear-gradient(135deg, ${shade(brandColor, 16)}, ${shade(brandColor, -24)})` }}>
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <p className="text-xs text-white/75">Total stock value</p>
        <p className="text-3xl font-extrabold tracking-tight mt-1">{rupee(stats.value)}</p>
        <p className="text-xs text-white/80 mt-1">{stats.total} medicines · {categories.length - 1} categories</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <MiniStat Icon={Boxes} label="Medicines" value={stats.total} tint="text-blue-600" bg="bg-blue-50" />
        <MiniStat Icon={AlertTriangle} label="Low stock" value={stats.low} tint="text-amber-600" bg="bg-amber-50" />
        <MiniStat Icon={PackageX} label="Out" value={stats.out} tint="text-rose-600" bg="bg-rose-50" />
      </div>

      {/* search + chips */}
      <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 elev-2">
        <Search className="h-5 w-5 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search medicines…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400" />
      </div>
      <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto no-scrollbar px-1">
        {categories.map(c => {
          const on = cat === c
          return <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition active:scale-95 ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`} style={on ? { backgroundColor: brandColor } : undefined}>{c}</button>
        })}
      </div>

      {/* list */}
      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? <Centered icon={Inbox} title="No medicines" sub={q ? `Nothing matches “${q}”.` : 'Add your first medicine.'} inline /> : (
          filtered.slice(0, visible).map(d => {
            const st = stockStatus(d)
            return (
              <button key={d.id} onClick={() => setActionDrug(d)} className="w-full text-left flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70 active:scale-[.99] transition">
                <div className={`h-12 w-12 shrink-0 rounded-2xl ${st.iconBg} ${st.iconFg} flex items-center justify-center`}><Pill className="h-6 w-6" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5"><p className="font-semibold text-[15px] text-gray-900 truncate capitalize">{d.drugName}</p>{d.strength && <span className="text-[11px] text-gray-400 shrink-0">{d.strength}</span>}</div>
                  {d.genericName && <p className="text-xs text-gray-500 truncate capitalize">{d.genericName}{d.dosageForm ? ` · ${d.dosageForm}` : ''}</p>}
                  <div className="mt-1.5 flex items-center gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.badge}`}>{st.label}</span>{d.requiresPrescription && <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">Rx</span>}</div>
                </div>
                <div className="shrink-0 text-right"><p className="text-[15px] font-extrabold text-gray-900">{rupee(d.sellingPrice)}</p><p className="text-[10px] text-gray-400">tap to manage</p></div>
              </button>
            )
          })
        )}
        {visible < filtered.length && (
          <button onClick={() => setVisible(v => v + PAGE)} className="mx-auto mt-1 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold elev-2 active:scale-95 transition" style={{ color: brandColor }}>Show more ({filtered.length - visible})</button>
        )}
      </div>

      {/* Floating add */}
      <button onClick={openAdd} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="Add medicine">
        <Plus className="h-7 w-7" />
      </button>

      {/* Action sheet */}
      <Sheet open={!!actionDrug} onClose={() => setActionDrug(null)} title={actionDrug?.drugName}>
        <div className="space-y-2">
          <SheetAction Icon={Pencil} label="Edit medicine" onClick={() => openEdit(actionDrug)} />
          <SheetAction Icon={PackagePlus} label="Adjust stock" sub={`Current: ${actionDrug?.quantityInStock ?? 0} units`} onClick={() => { setAdjust({ drug: actionDrug, type: 'add', amount: '' }); setActionDrug(null) }} />
          <SheetAction Icon={Trash2} label="Delete medicine" danger onClick={() => doDelete(actionDrug)} />
        </div>
      </Sheet>

      {/* Add / Edit form */}
      <Sheet open={!!form} onClose={() => { setForm(null); setEditingId(null) }} title={editingId ? 'Edit medicine' : 'Add medicine'}>
        {form && (
          <div className="space-y-3.5">
            <Field label="Medicine name" required><input className={inputCls} value={form.drugName} onChange={e => setForm(f => ({ ...f, drugName: e.target.value }))} placeholder="e.g. Paracetamol" /></Field>
            <Field label="Generic / salt"><input className={inputCls} value={form.genericName} onChange={e => setForm(f => ({ ...f, genericName: e.target.value }))} placeholder="e.g. Acetaminophen" /></Field>
            <Field label="Brand / company"><input className={inputCls} value={form.brandName} onChange={e => setForm(f => ({ ...f, brandName: e.target.value }))} placeholder="e.g. Crocin" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" required><input className={inputCls} value={form.drugCategory} onChange={e => setForm(f => ({ ...f, drugCategory: e.target.value }))} placeholder="Analgesics" /></Field>
              <Field label="Form" required>
                <select className={inputCls} value={form.dosageForm} onChange={e => setForm(f => ({ ...f, dosageForm: e.target.value }))}>{DOSAGE_FORMS.map(x => <option key={x}>{x}</option>)}</select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Strength" required><input className={inputCls} value={form.strength} onChange={e => setForm(f => ({ ...f, strength: e.target.value }))} placeholder="500mg" /></Field>
              <Field label="Reorder level"><input type="number" className={inputCls} value={form.reorderLevel} onChange={e => setForm(f => ({ ...f, reorderLevel: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Selling price (₹)"><input type="number" className={inputCls} value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} /></Field>
              <Field label="Cost price (₹)"><input type="number" className={inputCls} value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Markup %"><input type="number" className={inputCls} value={form.markupPercentage} onChange={e => setForm(f => ({ ...f, markupPercentage: e.target.value }))} /></Field>
              <Field label="Barcode / code"><input className={inputCls} value={form.drugCode} onChange={e => setForm(f => ({ ...f, drugCode: e.target.value }))} placeholder="Auto if blank" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Schedule"><select className={inputCls} value={form.scheduleType} onChange={e => setForm(f => ({ ...f, scheduleType: e.target.value }))}>{SCHEDULE_TYPES.map(s => <option key={s} value={s}>{s === 'none' ? 'OTC (none)' : `Schedule ${s}`}</option>)}</select></Field>
              <Field label="Scheme / offer"><input className={inputCls} value={form.scheme} onChange={e => setForm(f => ({ ...f, scheme: e.target.value }))} placeholder="e.g. 10+1" /></Field>
            </div>
            {form.scheduleType !== 'none' && <p className="-mt-1.5 text-[11px] font-medium text-violet-600">Rx required (Schedule {form.scheduleType})</p>}
            {!editingId && (
              <div className="rounded-2xl bg-gray-50 p-3 space-y-3">
                <p className="text-[11px] font-semibold text-gray-500">Opening stock & batch</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Initial qty"><input type="number" className={inputCls} value={form.initialQty} onChange={e => setForm(f => ({ ...f, initialQty: e.target.value }))} /></Field>
                  <Field label="Batch no."><input className={inputCls} value={form.batchNumber} onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))} /></Field>
                  <Field label="Expiry date"><input type="date" className={inputCls} value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} /></Field>
                  <Field label="Mfg date"><input type="date" className={inputCls} value={form.manufacturingDate} onChange={e => setForm(f => ({ ...f, manufacturingDate: e.target.value }))} /></Field>
                </div>
              </div>
            )}
            <button onClick={saveDrug} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{editingId ? 'Save changes' : 'Add medicine'}
            </button>
          </div>
        )}
      </Sheet>

      {/* Adjust stock */}
      <Sheet open={!!adjust} onClose={() => setAdjust(null)} title="Adjust stock">
        {adjust && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{adjust.drug.drugName} · current <b className="text-gray-800">{adjust.drug.quantityInStock || 0}</b> units</p>
            <div className="grid grid-cols-2 gap-2">
              {['add', 'remove'].map(t => (
                <button key={t} onClick={() => setAdjust(a => ({ ...a, type: t }))} className={`rounded-xl py-2.5 text-sm font-semibold capitalize transition ${adjust.type === t ? 'text-white' : 'bg-gray-100 text-gray-600'}`} style={adjust.type === t ? { backgroundColor: brandColor } : undefined}>{t} stock</button>
              ))}
            </div>
            <Field label="Quantity"><input type="number" autoFocus className={inputCls} value={adjust.amount} onChange={e => setAdjust(a => ({ ...a, amount: e.target.value }))} placeholder="0" /></Field>
            <button onClick={doAdjust} className="w-full rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition" style={{ backgroundColor: brandColor }}>Update stock</button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function SheetAction({ Icon, label, sub, danger, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 rounded-2xl p-3.5 active:scale-[.99] transition ${danger ? 'bg-rose-50' : 'bg-gray-50'}`}>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${danger ? 'bg-rose-100 text-rose-600' : 'bg-white text-gray-600 elev-1'}`}><Icon className="h-5 w-5" /></div>
      <div className="text-left"><p className={`text-sm font-semibold ${danger ? 'text-rose-600' : 'text-gray-800'}`}>{label}</p>{sub && <p className="text-xs text-gray-400">{sub}</p>}</div>
    </button>
  )
}

/* ── PRESCRIPTIONS ───────────────────────────────────────────────────────── */
const RX_CHIPS = [{ key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'fully_dispensed', label: 'Dispensed' }]

function PrescriptionsTab({ brandColor }) {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('pending')
  const [busy, setBusy] = useState(null)

  const fetchRx = useCallback(() => {
    setList(null)
    client.get('/pharmacy/prescriptions', { params: { limit: 200 } })
      .then(res => setList(res?.data || []))
      .catch(err => setError(err.message || 'Failed to load prescriptions'))
  }, [])
  useEffect(() => { fetchRx() }, [fetchRx])

  const dispense = async (rx) => {
    setBusy(rx.id)
    try {
      const res = await client.patch(`/pharmacy/prescriptions/${rx.id}`, { status: 'fully_dispensed', dispensedAt: new Date().toISOString() })
      if (res.success) {
        const items = Array.isArray(rx.items) ? rx.items : Array.isArray(rx.prescriptionItems) ? rx.prescriptionItems : Array.isArray(rx.medications) ? rx.medications : (() => { try { const p = JSON.parse(rx.items); return Array.isArray(p) ? p : [] } catch { return [] } })()
        const total = items.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 0), 0)
        if (rx.patientId && total > 0) {
          client.post('/billing', { resource: 'invoice', patientId: rx.patientId, items: items.map(i => ({ type: 'pharmacy', description: i.drugName, quantity: i.quantity, unitPrice: i.unitPrice || 0, discount: 0, tax: 0, total: (i.unitPrice || 0) * (i.quantity || 0) })) }).catch(() => {})
        }
        printRxLabel(rx, items)
        toast.success('Prescription dispensed'); fetchRx()
      } else toast.error(res.error || 'Failed')
    } catch { toast.error('Failed to dispense') } finally { setBusy(null) }
  }

  if (error) return <Centered icon={ClipboardList} title="Couldn’t load" sub={error} />
  if (!list) return <div className="mt-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white elev-1 animate-pulse" />)}</div>

  const filtered = status === 'all' ? list : list.filter(r => status === 'pending' ? r.status !== 'fully_dispensed' && r.status !== 'cancelled' : r.status === status)

  return (
    <div className="mt-1">
      <div className="-mx-1 flex gap-2 overflow-x-auto no-scrollbar px-1 mb-3">
        {RX_CHIPS.map(c => { const on = status === c.key; return <button key={c.key} onClick={() => setStatus(c.key)} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`} style={on ? { backgroundColor: brandColor } : undefined}>{c.label}</button> })}
      </div>
      {filtered.length === 0 ? <Centered icon={Inbox} title="No prescriptions" sub="Nothing here for this filter." inline /> : (
        <div className="space-y-3 stagger">
          {filtered.map(rx => {
            const items = Array.isArray(rx.items) ? rx.items
              : Array.isArray(rx.prescriptionItems) ? rx.prescriptionItems
              : Array.isArray(rx.medications) ? rx.medications
              : (() => { try { const p = JSON.parse(rx.items); return Array.isArray(p) ? p : [] } catch { return [] } })()
            const total = items.reduce((s, i) => s + (i.unitPrice || i.unitCost || 0) * (i.quantity || i.quantityPrescribed || 0), 0)
            const done = rx.status === 'fully_dispensed'
            return (
              <div key={rx.id} className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[15px] text-gray-900 truncate">{rx.patient ? `${rx.patient.firstName || ''} ${rx.patient.lastName || ''}`.trim() : 'Patient'}</p>
                    <p className="text-xs text-gray-500 truncate">{rx.doctor?.fullName ? `Dr. ${rx.doctor.fullName.replace(/^Dr\.?\s*/i, '')}` : '—'} · {rx.prescriptionDate ? fmtDate(rx.prescriptionDate) : '—'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{done ? 'Dispensed' : 'Pending'}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}{total > 0 ? ` · ${rupee2(total)}` : ''}</span>
                </div>
                {!done && (
                  <button onClick={() => dispense(rx)} disabled={busy === rx.id} className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-white text-sm font-semibold active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>
                    {busy === rx.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Dispense
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── print helpers ───────────────────────────────────────────────────────── */
function printDoc(html) { const w = window.open('', '_blank'); if (!w) { toast.error('Allow pop-ups to print'); return } w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300) }
const orgName = () => { try { return localStorage.getItem('hospitalName') || 'Hospital' } catch { return 'Hospital' } }
function printSaleReceipt(items, total, payment) {
  const now = new Date().toLocaleString('en-IN'); const rcp = `RCP${Date.now().toString().slice(-8)}`
  const rows = items.map(it => `<tr><td>${it.drugName}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">₹${(it.unitPrice || 0).toFixed(2)}</td><td style="text-align:right">₹${(it.total || 0).toFixed(2)}</td></tr>`).join('')
  printDoc(`<!DOCTYPE html><html><head><title>Receipt</title><style>body{font-family:Arial;font-size:12px;padding:16px}h2{text-align:center;margin:0}.b{background:#1e3a5f;color:#fff;text-align:center;padding:5px;font-weight:bold;margin:8px 0}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:5px;text-align:left}td{padding:5px;border-bottom:1px solid #eee}.t td{font-weight:bold;border-top:2px solid #1e3a5f}</style></head><body><h2>${orgName()}</h2><div class="b">SALE RECEIPT</div><p>Receipt: <b>${rcp}</b> &nbsp;|&nbsp; ${now} &nbsp;|&nbsp; Payment: <b>${payment.toUpperCase()}</b></p><table><thead><tr><th>Drug</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}<tr class="t"><td colspan="3" style="text-align:right">TOTAL</td><td style="text-align:right">₹${total.toFixed(2)}</td></tr></tbody></table></body></html>`)
}
function printRxLabel(rx, items) {
  const name = rx.patient ? `${rx.patient.firstName || ''} ${rx.patient.lastName || ''}`.trim() : 'Patient'
  const rows = items.map(i => `<tr><td>${i.drugName || i.drug?.drugName || '—'}</td><td>${i.dosage || ''}</td><td style="text-align:center">${i.quantity || i.quantityPrescribed || ''}</td><td>${i.duration || ''}</td></tr>`).join('')
  printDoc(`<!DOCTYPE html><html><head><title>Rx Label</title><style>body{font-family:Arial;font-size:12px;padding:16px}h2{text-align:center;margin:0}.b{background:#1e3a5f;color:#fff;text-align:center;padding:5px;font-weight:bold;margin:8px 0}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:5px;text-align:left}td{padding:5px;border-bottom:1px solid #eee}</style></head><body><h2>${orgName()}</h2><div class="b">DISPENSING LABEL</div><p>Patient: <b>${name}</b> &nbsp;|&nbsp; UHID: ${rx.patient?.mrn || '—'} &nbsp;|&nbsp; ${new Date().toLocaleDateString('en-IN')}</p><table><thead><tr><th>Drug</th><th>Dosage</th><th>Qty</th><th>Duration</th></tr></thead><tbody>${rows}</tbody></table></body></html>`)
}

/* ── SELL (POS) ──────────────────────────────────────────────────────────── */
function SellTab({ drugs, brandColor, onSold }) {
  const [q, setQ] = useState('')
  const [cart, setCart] = useState([])   // [{ drugId, quantity }]
  const [pay, setPay] = useState('cash')
  const [saving, setSaving] = useState(false)

  const results = useMemo(() => {
    if (!q) return []
    const s = q.toLowerCase()
    return drugs.filter(d => (d.quantityInStock || 0) > 0 && (d.drugName?.toLowerCase().includes(s) || d.genericName?.toLowerCase().includes(s))).slice(0, 8)
  }, [q, drugs])

  const add = (d) => {
    setQ('')
    setCart(c => c.find(i => i.drugId === d.id) ? c.map(i => i.drugId === d.id ? { ...i, quantity: i.quantity + 1 } : i) : [...c, { drugId: d.id, quantity: 1 }])
  }
  const setQty = (id, delta) => setCart(c => c.map(i => i.drugId === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i))
  const remove = (id) => setCart(c => c.filter(i => i.drugId !== id))
  const drugOf = (id) => drugs.find(d => d.id === id)
  const total = cart.reduce((s, i) => s + (drugOf(i.drugId)?.sellingPrice || 0) * i.quantity, 0)

  const complete = async () => {
    if (!cart.length) { toast.error('Add items to the cart'); return }
    setSaving(true)
    try {
      const items = cart.map(i => { const d = drugOf(i.drugId); return { drugId: i.drugId, drugName: d?.drugName || '', quantity: i.quantity, unitPrice: d?.sellingPrice || 0, total: (d?.sellingPrice || 0) * i.quantity } })
      const res = await client.post('/pharmacy/sales', { items, paymentMethod: pay, paymentStatus: 'paid' })
      if (res.success) { printSaleReceipt(items, total, pay); toast.success(`Sale completed — ${rupee2(total)}`); setCart([]); onSold?.() } else toast.error(res.error || 'Failed')
    } catch { toast.error('Failed to record sale') } finally { setSaving(false) }
  }

  return (
    <div className="mt-1 pb-24">
      <div className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 elev-2">
        <Search className="h-5 w-5 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search medicine to add…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400" />
      </div>
      {results.length > 0 && (
        <div className="mt-2 rounded-2xl bg-white elev-2 overflow-hidden divide-y divide-gray-100">
          {results.map(d => (
            <button key={d.id} onClick={() => add(d)} className="w-full flex items-center justify-between gap-2 p-3 text-left active:bg-gray-50">
              <div className="min-w-0"><p className="text-sm font-medium text-gray-800 truncate capitalize">{d.drugName} <span className="text-xs text-gray-400">{d.strength}</span></p><p className="text-[11px] text-gray-400">{d.quantityInStock} in stock</p></div>
              <span className="text-sm font-bold shrink-0" style={{ color: brandColor }}>{rupee(d.sellingPrice)}</span>
            </button>
          ))}
        </div>
      )}

      <h3 className="mt-5 mb-2 text-sm font-bold text-gray-700">Cart ({cart.length})</h3>
      {cart.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center elev-1"><ShoppingCart className="h-8 w-8 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-400">Search above to add medicines.</p></div>
      ) : (
        <div className="space-y-2.5">
          {cart.map(i => {
            const d = drugOf(i.drugId)
            return (
              <div key={i.drugId} className="flex items-center gap-3 rounded-2xl bg-white p-3 elev-2">
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-gray-800 truncate capitalize">{d?.drugName}</p><p className="text-[11px] text-gray-400">{rupee(d?.sellingPrice)} each</p></div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setQty(i.drugId, -1)} className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center active:scale-90"><Minus className="h-4 w-4 text-gray-600" /></button>
                  <span className="w-6 text-center text-sm font-bold">{i.quantity}</span>
                  <button onClick={() => setQty(i.drugId, 1)} className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center active:scale-90"><Plus className="h-4 w-4 text-gray-600" /></button>
                  <button onClick={() => remove(i.drugId)} className="ml-1 h-7 w-7 rounded-lg bg-rose-50 flex items-center justify-center active:scale-90"><X className="h-4 w-4 text-rose-500" /></button>
                </div>
              </div>
            )
          })}
          <div className="flex gap-2 pt-1">
            {['cash', 'card', 'upi', 'insurance'].map(m => <button key={m} onClick={() => setPay(m)} className={`flex-1 rounded-xl py-2 text-[11px] font-semibold uppercase transition ${pay === m ? 'text-white' : 'bg-white text-gray-500 border border-gray-200'}`} style={pay === m ? { backgroundColor: brandColor } : undefined}>{m}</button>)}
          </div>
        </div>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-16 inset-x-0 z-30 px-3 pb-3 pt-2 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent">
          <button onClick={complete} disabled={saving} className="w-full flex items-center justify-between rounded-2xl px-5 py-3.5 text-white font-bold elev-4 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>
            <span className="flex items-center gap-2">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Complete Sale</span>
            <span>{rupee2(total)}</span>
          </button>
        </div>
      )}
    </div>
  )
}

/* ── SALES history ───────────────────────────────────────────────────────── */
function SalesTab({ brandColor }) {
  const [sales, setSales] = useState(null)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('today')
  useEffect(() => {
    client.get('/pharmacy/sales').then(res => setSales(res?.data || [])).catch(err => setError(err.message || 'Failed to load sales'))
  }, [])
  if (error) return <Centered icon={Receipt} title="Couldn’t load sales" sub={error} />
  if (!sales) return <div className="mt-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white elev-1 animate-pulse" />)}</div>
  const now = new Date()
  const inRange = (s) => {
    if (range === 'all') return true
    const d = new Date(s.createdAt); if (isNaN(d)) return false
    if (range === 'today') return d.toDateString() === now.toDateString()
    if (range === 'week') return d >= new Date(now.getTime() - 7 * 864e5)
    if (range === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    return true
  }
  const shown = sales.filter(inRange)
  const revenue = shown.reduce((a, s) => a + (s.totalAmount ?? s.total ?? 0), 0)
  return (
    <div className="mt-1">
      <div className="-mx-1 flex gap-2 overflow-x-auto no-scrollbar px-1 mb-3">
        {[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['all', 'All time']].map(([k, l]) => { const on = range === k; return <button key={k} onClick={() => setRange(k)} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`} style={on ? { backgroundColor: brandColor } : undefined}>{l}</button> })}
      </div>
      <div className="rounded-2xl p-3.5 mb-3 elev-2 text-white" style={{ background: brandColor }}>
        <p className="text-white/80 text-xs">{shown.length} sale{shown.length !== 1 ? 's' : ''}</p>
        <p className="text-2xl font-extrabold leading-tight">{rupee(revenue)}</p>
      </div>
      {shown.length === 0 ? <Centered icon={Receipt} title="No sales" sub="Nothing in this period." inline /> : (
      <div className="space-y-3 stagger">
      {shown.map((s, i) => {
        const items = s.items || []
        const total = s.totalAmount ?? s.total ?? items.reduce((a, it) => a + (it.total || 0), 0)
        return (
          <div key={s.id || i} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
            <div className="h-11 w-11 shrink-0 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Receipt className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[14px] text-gray-900 truncate">{s.receiptNumber || s.invoiceNumber || `Sale #${(s.id || '').slice(-6) || i + 1}`}</p>
              <p className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''} · {(s.paymentMethod || 'cash').toUpperCase()} · {s.createdAt ? fmtDate(s.createdAt) : '—'}</p>
            </div>
            <span className="text-[15px] font-extrabold shrink-0" style={{ color: brandColor }}>{rupee2(total)}</span>
          </div>
        )
      })}
      </div>
      )}
    </div>
  )
}

/* ── shared bits ─────────────────────────────────────────────────────────── */
function MiniStat({ Icon, label, value, tint, bg }) {
  return (
    <div className="rounded-2xl bg-white p-3 elev-2 border border-gray-100/70 flex flex-col items-center">
      <div className={`h-8 w-8 rounded-xl ${bg} ${tint} flex items-center justify-center mb-1.5`}><Icon className="h-[18px] w-[18px]" /></div>
      <p className="text-lg font-extrabold text-gray-900 leading-none">{value}</p>
      <p className="text-[10px] text-gray-500 mt-1">{label}</p>
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
function PharmacySkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-24 rounded-3xl bg-white elev-1 animate-pulse" />
      <div className="grid grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white elev-1 animate-pulse" />)}</div>
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[76px] rounded-2xl bg-white elev-1 animate-pulse" />)}
    </div>
  )
}
