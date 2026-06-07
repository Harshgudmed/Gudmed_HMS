import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '@/api/client'
import { Stethoscope, ChevronRight, Plus } from 'lucide-react'
import ConsultationCreateSheet from '@/components/ConsultationCreateSheet'

const LIMIT = 15
const initials = (p) => `${p?.firstName?.[0] || ''}${p?.lastName?.[0] || ''}`.toUpperCase() || 'P'
const avatarGradient = (g) => g === 'female' ? 'from-rose-400 to-pink-500' : g === 'male' ? 'from-blue-400 to-indigo-500' : 'from-violet-400 to-purple-500'
const pName = (p) => p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : 'Unknown patient'
const dName = (d) => d ? `Dr. ${d.fullName?.replace(/^Dr\.?\s*/i, '')}` : '—'
const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }

const VISIT = {
  outpatient: { label: 'Outpatient', bg: 'bg-blue-50', text: 'text-blue-600' },
  inpatient: { label: 'Inpatient', bg: 'bg-indigo-50', text: 'text-indigo-600' },
  emergency: { label: 'Emergency', bg: 'bg-rose-50', text: 'text-rose-600' },
  follow_up: { label: 'Follow-up', bg: 'bg-amber-50', text: 'text-amber-600' },
}

export default function MobileConsultations({ brandColor = '#2E4168' }) {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async (nextOffset, append) => {
    append ? setLoadingMore(true) : setLoading(true)
    setError(null)
    try {
      const res = await client.get('/consultations', { params: { limit: LIMIT, offset: nextOffset } })
      const data = res.data ?? []
      setItems(prev => append ? [...prev, ...data] : data)
      setTotal(res.meta?.total ?? data.length)
      setOffset(nextOffset)
    } catch (err) { setError(err.message || 'Failed to load consultations') }
    finally { setLoading(false); setLoadingMore(false) }
  }, [])

  useEffect(() => { load(0, false) }, [load])
  const hasMore = items.length < total

  if (error) return <Centered icon={Stethoscope} title="Couldn’t load consultations" sub={error} retry={() => load(0, false)} brandColor={brandColor} />
  if (loading) return <div className="space-y-3 pt-1">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} />)}</div>
  return (
    <div className="pb-2 pt-1">
      <p className="px-0.5 mb-2 text-xs text-gray-400">{total.toLocaleString('en-IN')} consultations</p>
      <div className="space-y-3 stagger">
        {items.map(c => {
          const v = VISIT[c.visitType] || { label: c.visitType || 'Visit', bg: 'bg-gray-100', text: 'text-gray-500' }
          const summary = c.diagnosis || c.chiefComplaint || c.treatmentPlan || '—'
          return (
            <button key={c.id} onClick={() => navigate(`/consultations/${c.id}`, { state: { consultation: c } })} className="w-full text-left flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70 active:scale-[.99] transition">
              <div className={`h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br ${avatarGradient(c.patient?.gender)} flex items-center justify-center text-white font-bold text-xs`}>{initials(c.patient)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[14px] text-gray-900 truncate">{pName(c.patient)}</p>
                  <span className="text-[11px] text-gray-400 shrink-0">{fmtDate(c.visitDate)}</span>
                </div>
                <p className="text-xs text-blue-600 truncate mt-0.5">{dName(c.doctor)}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${v.bg} ${v.text}`}>{v.label}</span>
                  <span className="text-[11px] text-gray-400 truncate">{summary}</span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 self-center" />
            </button>
          )
        })}
      </div>
      {hasMore && (
        <button onClick={() => load(offset + LIMIT, true)} disabled={loadingMore} className="mx-auto mt-5 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold elev-2 active:scale-95 transition disabled:opacity-60" style={{ color: brandColor }}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
      <button onClick={() => setShowCreate(true)} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="New consultation"><Plus className="h-7 w-7" /></button>
      {showCreate && <ConsultationCreateSheet brandColor={brandColor} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(0, false) }} />}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-1">
      <div className="h-11 w-11 rounded-2xl bg-gray-100 animate-pulse" />
      <div className="flex-1 space-y-2"><div className="h-3.5 w-2/5 rounded bg-gray-100 animate-pulse" /><div className="h-3 w-1/3 rounded bg-gray-100 animate-pulse" /><div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" /></div>
    </div>
  )
}

function Centered({ icon: Icon, title, sub, retry, brandColor }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade">
      <div className="h-20 w-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-4"><Icon className="h-9 w-9 text-gray-400" /></div>
      <p className="font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[230px]">{sub}</p>
      {retry && <button onClick={retry} className="mt-4 rounded-full px-5 py-2 text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}>Try again</button>}
    </div>
  )
}
