import { useState, useEffect, useMemo, useCallback } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import { ListChecks, Inbox, PhoneCall, Check } from 'lucide-react'

const initials = (p) => `${p?.firstName?.[0] || ''}${p?.lastName?.[0] || ''}`.toUpperCase() || 'P'
const avatarGradient = (g) => g === 'female' ? 'from-rose-400 to-pink-500' : g === 'male' ? 'from-blue-400 to-indigo-500' : 'from-violet-400 to-purple-500'
const pName = (p) => p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : 'Unknown patient'
const fmtStatus = (s) => (s || '').replace(/_/g, ' ')
function stColor(s) {
  return { waiting: 'bg-amber-50 text-amber-600', called: 'bg-blue-50 text-blue-600', in_service: 'bg-indigo-50 text-indigo-600', completed: 'bg-emerald-50 text-emerald-600', cancelled: 'bg-rose-50 text-rose-600' }[s] || 'bg-gray-100 text-gray-500'
}
const isUrgent = (p) => ['urgent', 'emergency', 'high', 'critical'].includes((p || '').toLowerCase())

export default function MobileQueue({ brandColor = '#2E4168' }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('active')
  const [busyId, setBusyId] = useState(null)

  const fetchQueue = useCallback(() => {
    setError(null)
    client.get('/triage', { params: { resource: 'queue', limit: 200 } })
      .then(res => setItems((res?.data || res || []).filter(Boolean)))
      .catch(e => setError(e.message || 'Failed to load queue'))
  }, [])
  useEffect(() => { fetchQueue() }, [fetchQueue])

  const act = async (entry, status, msg) => {
    setBusyId(entry.id)
    try {
      const res = await client.patch('/triage', { id: entry.id, status, resource: 'queue' })
      if (res?.success !== false) { setItems(prev => prev.map(x => x.id === entry.id ? { ...x, status } : x)); toast.success(msg) }
      else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to update queue') } finally { setBusyId(null) }
  }

  const filtered = useMemo(() => {
    const list = items || []
    if (filter === 'all') return list
    if (filter === 'completed') return list.filter(e => e.status === 'completed')
    return list.filter(e => e.status !== 'completed' && e.status !== 'cancelled')
  }, [items, filter])

  if (error) return <Centered icon={ListChecks} title="Couldn’t load queue" sub={error} />
  if (!items) return <div className="pt-1 space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white elev-1 animate-pulse" />)}</div>

  return (
    <div className="pb-2 pt-1">
      <div className="flex gap-2 mb-3">
        {[['active', 'Active'], ['completed', 'Completed'], ['all', 'All']].map(([k, l]) => { const on = filter === k; return <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`} style={on ? { backgroundColor: brandColor } : undefined}>{l}</button> })}
        <span className="ml-auto self-center text-xs text-gray-400">{filtered.length} in queue</span>
      </div>

      {filtered.length === 0 ? <Centered icon={Inbox} title="Queue is empty" sub="No patients for this filter." inline /> : (
        <div className="space-y-3 stagger">
          {filtered.map(e => {
            const acts = []
            if (e.status === 'waiting') acts.push({ label: 'Call', to: 'called', msg: 'Patient called', Icon: PhoneCall })
            if (e.status === 'called' || e.status === 'in_service') acts.push({ label: 'Complete', to: 'completed', msg: 'Service completed', Icon: Check })
            return (
              <div key={e.id} className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center justify-center pr-3 border-r border-gray-100">
                    <span className="text-[13px] font-extrabold leading-none" style={{ color: brandColor }}>{e.queueNumber || '—'}</span>
                    {e.waitTime != null && <span className="text-[9px] text-gray-400 mt-0.5">{e.waitTime}m</span>}
                  </div>
                  <div className={`h-10 w-10 shrink-0 rounded-2xl bg-gradient-to-br ${avatarGradient(e.patient?.gender)} flex items-center justify-center text-white font-bold text-xs`}>{initials(e.patient)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[14px] text-gray-900 truncate">{pName(e.patient)}</p>
                    <p className="text-[11px] text-gray-400 truncate capitalize">{[e.serviceArea, e.serviceType].filter(Boolean).join(' · ')}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${stColor(e.status)}`}>{fmtStatus(e.status) || 'waiting'}</span>
                      {isUrgent(e.priority) && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 capitalize">{e.priority}</span>}
                    </div>
                  </div>
                </div>
                {acts.length > 0 && (
                  <div className="mt-2.5 flex gap-2 border-t border-gray-50 pt-2.5">
                    {acts.map(a => (
                      <button key={a.to} disabled={busyId === e.id} onClick={() => act(e, a.to, a.msg)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white active:scale-95 transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>
                        <a.Icon className="h-3.5 w-3.5" />{busyId === e.id ? '…' : a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
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
