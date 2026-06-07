import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '@/api/client'
import { Search, Phone, ChevronRight, UserRound, UserPlus, Inbox } from 'lucide-react'
import PatientFormSheet from '@/components/MobilePatientForm'

const LIMIT = 15

const fullName = (p) => [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')
const initials = (p) => `${p.firstName?.[0] || ''}${p.lastName?.[0] || ''}`.toUpperCase() || 'P'
function age(dob) {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d)) return null
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000))
}
const avatarGradient = (g) =>
  g === 'female' ? 'from-rose-400 to-pink-500'
  : g === 'male' ? 'from-blue-400 to-indigo-500'
  : 'from-violet-400 to-purple-500'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
]

export default function MobilePatients({ brandColor = '#2E4168' }) {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setSearch(input.trim()), 350)
    return () => clearTimeout(t)
  }, [input])

  const load = useCallback(async (nextOffset, append) => {
    append ? setLoadingMore(true) : setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (status !== 'all') params.set('status', status)
      params.set('limit', String(LIMIT))
      params.set('offset', String(nextOffset))
      const res = await client.get(`/patients?${params}`)
      const data = res.data ?? []
      setItems(prev => append ? [...prev, ...data] : data)
      setTotal(res.meta?.total ?? data.length)
      setOffset(nextOffset)
    } catch (err) {
      setError(err.message || 'Failed to load patients')
    } finally {
      setLoading(false); setLoadingMore(false)
    }
  }, [search, status])

  useEffect(() => { load(0, false) }, [load])

  const hasMore = items.length < total

  return (
    <div className="pb-2">
      {/* Sticky search + filters */}
      <div className="sticky top-14 z-20 -mx-3 px-3 pt-1 pb-3 bg-gray-50/95 backdrop-blur">
        <div className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 elev-2">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Search by name, UHID or phone…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>
        <div className="mt-3 flex gap-2">
          {FILTERS.map(f => {
            const on = status === f.key
            return (
              <button
                key={f.key}
                onClick={() => setStatus(f.key)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition active:scale-95 ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                style={on ? { backgroundColor: brandColor } : undefined}
              >
                {f.label}
              </button>
            )
          })}
          <span className="ml-auto self-center text-xs text-gray-400">
            {loading ? '…' : `${total.toLocaleString('en-IN')} total`}
          </span>
        </div>
      </div>

      {/* Register FAB + form */}
      <button onClick={() => setShowForm(true)} className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full text-white elev-4 flex items-center justify-center active:scale-90 transition" style={{ backgroundColor: brandColor }} aria-label="Register patient">
        <UserPlus className="h-6 w-6" />
      </button>
      {showForm && <PatientFormSheet brandColor={brandColor} patient={null} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(0, false) }} />}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(0, false)} brandColor={brandColor} />
      ) : items.length === 0 ? (
        <EmptyState query={search} />
      ) : (
        <>
          <div className="space-y-3 stagger">
            {items.map(p => (
              <PatientCard key={p.id || p.mrn} p={p} onOpen={() => navigate(`/patients/${p.id}`, { state: { patient: p } })} />
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => load(offset + LIMIT, true)}
              disabled={loadingMore}
              className="mx-auto mt-5 mb-1 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold elev-2 active:scale-95 transition disabled:opacity-60"
              style={{ color: brandColor }}
            >
              {loadingMore ? 'Loading…' : 'Load more patients'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function PatientCard({ p, onOpen }) {
  const a = age(p.dateOfBirth)
  const g = p.gender ? p.gender[0].toUpperCase() + p.gender.slice(1) : '—'
  const meta = [a != null ? `${a} yrs` : null, g].filter(Boolean).join(' · ')
  return (
    <div onClick={onOpen} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70 active:scale-[.99] transition cursor-pointer">
      <div className={`h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br ${avatarGradient(p.gender)} flex items-center justify-center text-white font-bold text-sm`}>
        {initials(p)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[15px] text-gray-900 truncate">{fullName(p) || 'Unknown'}</p>
          {p.status === 'active' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
          <span>{meta}</span>
          {p.bloodGroup && <span className="font-semibold text-rose-500">{p.bloodGroup}</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 tracking-wide">UHID {p.mrn}</span>
          {p.phonePrimary && <span className="text-[11px] text-gray-400 truncate">{p.phonePrimary}</span>}
        </div>
      </div>
      {p.phonePrimary ? (
        <a
          href={`tel:${p.phonePrimary}`}
          onClick={e => e.stopPropagation()}
          className="h-9 w-9 shrink-0 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center active:scale-90 transition"
          aria-label="Call patient"
        >
          <Phone className="h-[18px] w-[18px]" />
        </a>
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-1">
      <div className="h-12 w-12 rounded-2xl bg-gray-100 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-2/5 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-1/4 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-1/3 rounded bg-gray-100 animate-pulse" />
      </div>
    </div>
  )
}

function EmptyState({ query }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade">
      <div className="h-20 w-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-4">
        <Inbox className="h-9 w-9 text-gray-400" />
      </div>
      <p className="font-semibold text-gray-700">No patients found</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[220px]">
        {query ? `Nothing matches “${query}”. Try a different name or UHID.` : 'No patients to show yet.'}
      </p>
    </div>
  )
}

function ErrorState({ message, onRetry, brandColor }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade">
      <div className="h-20 w-20 rounded-3xl bg-rose-50 flex items-center justify-center mb-4">
        <UserRound className="h-9 w-9 text-rose-400" />
      </div>
      <p className="font-semibold text-gray-700">Couldn’t load patients</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[240px]">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-full px-5 py-2 text-sm font-semibold text-white active:scale-95 transition" style={{ backgroundColor: brandColor }}>
        Try again
      </button>
    </div>
  )
}
