import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '@/api/client'
import { Search, Phone, BadgeCheck, Stethoscope, Inbox } from 'lucide-react'

const GRADIENTS = [
  'from-blue-500 to-indigo-600', 'from-teal-500 to-emerald-600', 'from-violet-500 to-purple-600',
  'from-cyan-500 to-blue-600', 'from-rose-500 to-pink-600', 'from-amber-500 to-orange-600',
]
const hash = (s = '') => s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
const gradientFor = (name) => GRADIENTS[hash(name) % GRADIENTS.length]
const initials = (name = '') => name.replace(/^Dr\.?\s*/i, '').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'Dr'

export default function MobileDoctors({ brandColor = '#2E4168' }) {
  const navigate = useNavigate()
  const [doctors, setDoctors] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [spec, setSpec] = useState('All')

  useEffect(() => {
    let alive = true
    client.get('/settings', { params: { resource: 'users' } })
      .then(res => { if (alive) setDoctors((res?.data || []).filter(u => u.role === 'doctor')) })
      .catch(err => { if (alive) setError(err.message || 'Failed to load doctors') })
    return () => { alive = false }
  }, [])

  const specialties = useMemo(() => {
    const set = new Set((doctors || []).map(d => d.specialization).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [doctors])

  const filtered = useMemo(() => {
    let list = doctors || []
    if (spec !== 'All') list = list.filter(d => d.specialization === spec)
    if (q) {
      const s = q.toLowerCase()
      list = list.filter(d => d.fullName?.toLowerCase().includes(s) || d.specialization?.toLowerCase().includes(s))
    }
    return list
  }, [doctors, spec, q])

  return (
    <div className="pb-2">
      {/* Sticky search + specialty chips */}
      <div className="sticky top-14 z-20 -mx-3 px-3 pt-1 pb-3 bg-gray-50/95 backdrop-blur">
        <div className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 elev-2">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search doctors or specialities…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>
        {doctors && (
          <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto no-scrollbar px-1">
            {specialties.map(s => {
              const on = spec === s
              return (
                <button
                  key={s}
                  onClick={() => setSpec(s)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition active:scale-95 ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                  style={on ? { backgroundColor: brandColor } : undefined}
                >
                  {s}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* List */}
      {error ? (
        <EmptyState icon={Stethoscope} title="Couldn’t load doctors" sub={error} />
      ) : !doctors ? (
        <div className="space-y-3">{Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Inbox} title="No doctors found" sub={q ? `Nothing matches “${q}”.` : 'Try another speciality.'} />
      ) : (
        <div className="space-y-3 stagger">
          {filtered.map(d => (
            <DoctorCard key={d.id} d={d} onOpen={() => navigate(`/doctors/${d.id}`, { state: { doctor: d } })} />
          ))}
        </div>
      )}
    </div>
  )
}

function DoctorCard({ d, onOpen }) {
  return (
    <div onClick={onOpen} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70 active:scale-[.99] transition cursor-pointer">
      <div className="relative shrink-0">
        <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${gradientFor(d.fullName)} flex items-center justify-center text-white font-bold text-sm`}>
          {initials(d.fullName)}
        </div>
        <BadgeCheck className="absolute -bottom-1 -right-1 h-5 w-5 text-blue-500 fill-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[15px] text-gray-900 truncate">Dr. {d.fullName?.replace(/^Dr\.?\s*/i, '')}</p>
        <p className="text-xs font-medium truncate mt-0.5 text-blue-600">{d.specialization || 'General Physician'}</p>
        {d.department?.name && <p className="text-[11px] text-gray-400 truncate mt-0.5">{d.department.name}</p>}
      </div>
      {d.phone && (
        <a href={`tel:${d.phone}`} onClick={e => e.stopPropagation()} className="h-9 w-9 shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center active:scale-90 transition" aria-label="Call doctor">
          <Phone className="h-[18px] w-[18px]" />
        </a>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-1">
      <div className="h-12 w-12 rounded-2xl bg-gray-100 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/2 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-1/3 rounded bg-gray-100 animate-pulse" />
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade">
      <div className="h-20 w-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="h-9 w-9 text-gray-400" />
      </div>
      <p className="font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[230px]">{sub}</p>
    </div>
  )
}
