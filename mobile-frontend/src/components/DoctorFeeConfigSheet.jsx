import { useState, useEffect } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import { X, Plus, Trash2, Loader2, Check } from 'lucide-react'

const inp = 'w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-gray-400 bg-white'

// Unified per-doctor setup for mobile: base fee + follow-up day-ranges + commission.
export default function DoctorFeeConfigSheet({ doctorId, doctorName, brandColor = '#2E4168', onClose }) {
  const [loading, setLoading] = useState(true)
  const [baseFee, setBaseFee] = useState('')
  const [comm, setComm] = useState({ commissionType: 'percentage', commissionRate: '10', isActive: true, notes: '' })
  const [rows, setRows] = useState([])
  const [savingCfg, setSavingCfg] = useState(false)
  const [savingKey, setSavingKey] = useState(null)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  function mapRows(data) {
    return (data || []).sort((a, b) => a.fromDays - b.fromDays).map(s => ({
      key: s.id, id: s.id, fromDays: String(s.fromDays), toDays: String(s.toDays),
      feeAmount: String(s.feeAmount), isActive: s.isActive, notes: s.notes || '',
    }))
  }

  async function load() {
    setLoading(true)
    try {
      const [dRes, sRes] = await Promise.all([
        client.get('/doctor-accountability', { params: { resource: 'doctors' } }),
        client.get('/fee-slabs', { params: { doctorId } }),
      ])
      const doc = (dRes?.data || []).find(d => d.id === doctorId)
      setBaseFee(doc?.consultationFee != null ? String(doc.consultationFee) : '')
      const c = doc?.commissionConfig
      setComm(c
        ? { commissionType: c.commissionType, commissionRate: String(c.commissionRate), isActive: c.isActive, notes: c.notes || '' }
        : { commissionType: 'percentage', commissionRate: '10', isActive: true, notes: '' })
      setRows(mapRows(sRes?.data))
    } catch {
      toast.error('Failed to load configuration')
    }
    setLoading(false)
  }

  async function saveSetup() {
    const fee = baseFee === '' ? null : parseFloat(baseFee)
    if (baseFee !== '' && (isNaN(fee) || fee < 0)) { toast.error('Enter a valid base fee'); return }
    const rate = parseFloat(comm.commissionRate)
    if (isNaN(rate) || rate < 0) { toast.error('Enter a valid commission rate'); return }
    setSavingCfg(true)
    try {
      const res = await client.post('/doctor-accountability?resource=config', {
        doctorId, consultationFee: fee,
        commissionType: comm.commissionType, commissionRate: rate,
        isActive: comm.isActive, notes: comm.notes || null,
      })
      if (res?.success !== false) toast.success('Doctor setup saved')
      else toast.error(res.error || 'Failed to save')
    } catch (e) { toast.error(e.message || 'Failed to save') }
    setSavingCfg(false)
  }

  function updateRow(key, patch) { setRows(p => p.map(r => (r.key === key ? { ...r, ...patch } : r))) }
  function addRange() {
    setRows(p => {
      const last = p[p.length - 1]
      const from = last && last.toDays !== '' ? last.toDays : ''
      return [...p, { key: `new-${Date.now()}`, id: null, fromDays: from, toDays: '', feeAmount: '', isActive: true, notes: '' }]
    })
  }
  function validateRow(row) {
    const f = parseInt(row.fromDays), t = parseInt(row.toDays), fee = parseFloat(row.feeAmount)
    if (isNaN(f) || isNaN(t) || isNaN(fee)) return 'From, To and Charge are required'
    if (f < 0 || t < 0) return 'Days cannot be negative'
    if (f >= t) return 'From must be less than To'
    if (fee < 0) return 'Charge cannot be negative'
    const ov = rows.find(r => r.key !== row.key && r.fromDays !== '' && r.toDays !== '' && f < parseInt(r.toDays) && t > parseInt(r.fromDays))
    if (ov) return `Overlaps with ${ov.fromDays}-${ov.toDays} days`
    return null
  }
  async function reload() {
    const s = await client.get('/fee-slabs', { params: { doctorId } })
    setRows(mapRows(s?.data))
  }
  async function saveRow(row) {
    const e = validateRow(row); if (e) { toast.error(e); return }
    setSavingKey(row.key)
    const payload = { fromDays: parseInt(row.fromDays), toDays: parseInt(row.toDays), feeAmount: parseFloat(row.feeAmount), isActive: row.isActive, notes: row.notes || null }
    try {
      const res = row.id
        ? await client.patch(`/fee-slabs/${row.id}`, payload)
        : await client.post('/fee-slabs', { doctorId, ...payload })
      if (res?.success !== false) { toast.success(row.id ? 'Range updated' : 'Range added'); await reload() }
      else toast.error(res.error || 'Failed to save range')
    } catch { toast.error('Error saving range') }
    setSavingKey(null)
  }
  async function deleteRow(row) {
    if (!row.id) { setRows(p => p.filter(r => r.key !== row.key)); return }
    if (!confirm('Delete this day-range?')) return
    try {
      const res = await client.delete(`/fee-slabs/${row.id}`)
      if (res?.success !== false) { toast.success('Range deleted'); await reload() }
      else toast.error(res.error || 'Failed to delete')
    } catch { toast.error('Error deleting range') }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Fees &amp; Commission</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        {doctorName && <p className="-mt-2 mb-3 text-sm text-gray-500">{doctorName}</p>}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : (
          <div className="space-y-5">
            {/* ① New Patient base fee */}
            <section>
              <h4 className="text-sm font-bold text-gray-800 mb-1.5">① New Patient Fee</h4>
              <label className="text-xs font-medium text-gray-500">Base charge (₹)</label>
              <input type="number" min={0} step={50} className={inp + ' mt-1'} value={baseFee} onChange={e => setBaseFee(e.target.value)} placeholder="e.g. 1000" />
              <p className="text-[11px] text-gray-400 mt-1">Charged on the first visit and after the 30-day reset.</p>
            </section>

            {/* ② Follow-up ranges */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-gray-800">② Follow-up Charges (by days)</h4>
                <button onClick={addRange} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: brandColor }}><Plus className="h-3.5 w-3.5" />Add</button>
              </div>
              {rows.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">No ranges yet. Tap "Add" to create one.</p>
              ) : (
                <div className="space-y-2">
                  {rows.map(row => (
                    <div key={row.key} className={`rounded-xl border p-2.5 ${row.id ? 'border-gray-200' : 'border-amber-300 bg-amber-50'}`}>
                      <div className="grid grid-cols-3 gap-2">
                        <div><label className="text-[10px] text-gray-400">From day</label><input type="number" min={0} className={inp} value={row.fromDays} onChange={e => updateRow(row.key, { fromDays: e.target.value })} placeholder="0" /></div>
                        <div><label className="text-[10px] text-gray-400">To day</label><input type="number" min={0} className={inp} value={row.toDays} onChange={e => updateRow(row.key, { toDays: e.target.value })} placeholder="3" /></div>
                        <div><label className="text-[10px] text-gray-400">Charge ₹</label><input type="number" min={0} step={50} className={inp} value={row.feeAmount} onChange={e => updateRow(row.key, { feeAmount: e.target.value })} placeholder="0=free" /></div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-xs text-gray-600">
                          <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={row.isActive} onChange={e => updateRow(row.key, { isActive: e.target.checked })} />Active
                        </label>
                        <div className="flex gap-1.5">
                          <button onClick={() => saveRow(row)} disabled={savingKey === row.key} className="rounded-lg px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: brandColor }}>{savingKey === row.key ? '…' : (row.id ? 'Save' : 'Add')}</button>
                          <button onClick={() => deleteRow(row)} className="rounded-lg px-2 py-1 text-rose-600 border border-rose-200"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-2">After 30 days → charged as a New Patient (base fee).</p>
            </section>

            {/* ③ Commission */}
            <section>
              <h4 className="text-sm font-bold text-gray-800 mb-1.5">③ Commission</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-gray-500">Type</label>
                  <select className={inp + ' mt-1'} value={comm.commissionType} onChange={e => setComm(c => ({ ...c, commissionType: e.target.value }))}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500">Rate {comm.commissionType === 'percentage' ? '(%)' : '(₹)'}</label>
                  <input type="number" min={0} className={inp + ' mt-1'} value={comm.commissionRate} onChange={e => setComm(c => ({ ...c, commissionRate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500">Status</label>
                  <select className={inp + ' mt-1'} value={comm.isActive ? 'active' : 'inactive'} onChange={e => setComm(c => ({ ...c, isActive: e.target.value === 'active' }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500">Notes</label>
                  <input className={inp + ' mt-1'} value={comm.notes} onChange={e => setComm(c => ({ ...c, notes: e.target.value }))} placeholder="optional" />
                </div>
              </div>
            </section>

            <button onClick={saveSetup} disabled={savingCfg} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>
              {savingCfg ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Save Doctor Setup
            </button>
            <p className="text-[11px] text-gray-400 text-center -mt-1">Base fee &amp; commission save together. Each follow-up range has its own Save.</p>
          </div>
        )}
      </div>
    </div>
  )
}
