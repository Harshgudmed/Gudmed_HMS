import { useState, useEffect, useMemo } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import { BadgeIndianRupee, Inbox, X, Check, Loader2, Wallet, Clock3, CircleCheck } from 'lucide-react'

const rupee = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`
const dName = (d) => d ? `Dr. ${d.fullName?.replace(/^Dr\.?\s*/i, '')}` : '—'
const CHIPS = [{ k: 'all', l: 'All' }, { k: 'pending', l: 'Pending' }, { k: 'settled', l: 'Settled' }]

export default function MobileDoctorAccountability({ brandColor = '#2E4168' }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [settle, setSettle] = useState(null) // commission being settled

  const fetchAll = () => {
    setItems(null); setError(null)
    client.get('/doctor-accountability', { params: { resource: 'commissions', limit: 200 } })
      .then(res => setItems(res?.data || []))
      .catch(e => setError(e.message || 'Failed to load commissions'))
  }
  useEffect(fetchAll, [])

  const summary = useMemo(() => {
    const list = items || []
    const isSettled = c => c.status === 'settled'
    return {
      total: list.reduce((a, c) => a + (c.commissionAmount || 0), 0),
      pending: list.filter(c => !isSettled(c)).reduce((a, c) => a + (c.commissionAmount || 0), 0),
      settled: list.filter(isSettled).reduce((a, c) => a + (c.commissionAmount || 0), 0),
    }
  }, [items])

  const filtered = useMemo(() => {
    const list = items || []
    if (filter === 'all') return list
    if (filter === 'settled') return list.filter(c => c.status === 'settled')
    return list.filter(c => c.status !== 'settled')
  }, [items, filter])

  if (error) return <Centered icon={BadgeIndianRupee} title="Couldn’t load" sub={error} />
  if (!items) return <div className="pt-1 space-y-3"><div className="h-24 rounded-3xl bg-white elev-1 animate-pulse" />{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white elev-1 animate-pulse" />)}</div>

  return (
    <div className="pb-2 pt-1">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Stat Icon={Wallet} label="Total" value={rupee(summary.total)} tint="text-blue-600" bg="bg-blue-50" />
        <Stat Icon={Clock3} label="Pending" value={rupee(summary.pending)} tint="text-amber-600" bg="bg-amber-50" />
        <Stat Icon={CircleCheck} label="Settled" value={rupee(summary.settled)} tint="text-emerald-600" bg="bg-emerald-50" />
      </div>

      <div className="mt-4 flex gap-2">
        {CHIPS.map(c => { const on = filter === c.k; return <button key={c.k} onClick={() => setFilter(c.k)} className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`} style={on ? { backgroundColor: brandColor } : undefined}>{c.l}</button> })}
        <span className="ml-auto self-center text-xs text-gray-400">{filtered.length} entries</span>
      </div>

      {filtered.length === 0 ? <Centered icon={Inbox} title="No commissions" sub="Nothing for this filter." inline /> : (
        <div className="mt-3 space-y-3 stagger">
          {filtered.map(c => {
            const settled = c.status === 'settled'
            return (
              <div key={c.id} className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[14px] text-gray-900 truncate">{dName(c.doctor)}</p>
                    <p className="text-[11px] text-gray-400">{c.commissionType === 'percentage' && c.commissionRate ? `${c.commissionRate}%` : ''}{c.invoiceId ? ` · Inv ${c.invoiceId}` : ''}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${settled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{settled ? 'Settled' : 'Pending'}</span>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <div className="text-[11px] text-gray-400">Invoice {rupee(c.invoiceAmount)}{c.settlementRef ? ` · Ref ${c.settlementRef}` : ''}</div>
                  <div className="text-lg font-extrabold" style={{ color: brandColor }}>{rupee(c.commissionAmount)}</div>
                </div>
                {!settled && (
                  <button onClick={() => setSettle(c)} className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white active:scale-95 transition" style={{ backgroundColor: brandColor }}><Check className="h-3.5 w-3.5" />Settle commission</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {settle && <SettleSheet commission={settle} brandColor={brandColor} onClose={() => setSettle(null)} onDone={(id, ref, note) => { setItems(prev => prev.map(x => x.id === id ? { ...x, status: 'settled', settledAt: new Date().toISOString(), settlementRef: ref, settlementNote: note } : x)); setSettle(null) }} />}
    </div>
  )
}

function SettleSheet({ commission, brandColor, onClose, onDone }) {
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const inp = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-gray-400 bg-white'
  const submit = async () => {
    setSaving(true)
    try {
      const res = await client.patch('/doctor-accountability?resource=settle', { commissionIds: [commission.id], settlementNote: note, settlementRef: ref })
      if (res?.success !== false) { toast.success('Commission settled'); onDone(commission.id, ref, note) } else toast.error(res.error || 'Failed to settle')
    } catch (e) { toast.error(e.message || 'Failed to settle') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">Settle commission</h3><button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
        <div className="rounded-2xl bg-emerald-50 p-3 mb-3.5"><p className="text-sm font-semibold text-emerald-800">{dName(commission.doctor)}</p><p className="text-xs text-emerald-700">Commission: <b>{rupee(commission.commissionAmount)}</b></p></div>
        <div className="space-y-3.5">
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Settlement reference</label><input className={inp} value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. UTR / cheque no." /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Note</label><input className={inp} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" /></div>
          <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Confirm settlement</button>
        </div>
      </div>
    </div>
  )
}

function Stat({ Icon, label, value, tint, bg }) {
  return (
    <div className="rounded-2xl bg-white p-3 elev-2 border border-gray-100/70 flex flex-col items-center text-center">
      <div className={`h-8 w-8 rounded-xl ${bg} ${tint} flex items-center justify-center mb-1.5`}><Icon className="h-[18px] w-[18px]" /></div>
      <p className="text-sm font-extrabold text-gray-900 leading-none">{value}</p>
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
