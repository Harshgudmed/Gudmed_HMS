import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import client from '@/api/client'
import {
  Bell, Search, SlidersHorizontal, ArrowRight,
  Users, BedDouble, Stethoscope, UserPlus, CalendarDays, BarChart3,
} from 'lucide-react'
import { SERVICES } from '@/lib/nav'

function shade(hex, percent) {
  const h = (hex || '#2E4168').replace('#', '')
  if (h.length !== 6) return hex
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const t = percent < 0 ? 0 : 255, p = Math.abs(percent) / 100
  r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
}
const alpha = (hex, a = '1A') => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${a}` : hex)

const QUICK_ACTIONS = [
  { to: '/patients',     label: 'New Patient',  Icon: UserPlus },
  { to: '/appointments', label: 'Appointments', Icon: CalendarDays },
  { to: '/pharmacy',     label: 'Pharmacy',     Icon: Stethoscope },
  { to: '/reports',      label: 'Reports',      Icon: BarChart3 },
]

export default function MobileHome({ brandColor = '#2E4168', hospitalName = 'GudMed HMS', modulesEnabled = {} }) {
  const [stats, setStats] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([
      client.get('/patients', { params: { limit: 1 } }).catch(() => null),
      client.get('/inpatient', { params: { resource: 'admissions', limit: 1 } }).catch(() => null),
      client.get('/consultations', { params: { limit: 1 } }).catch(() => null),
    ]).then(([p, a, c]) => {
      if (!alive) return
      setStats({
        patients: p?.meta?.total ?? null,
        admitted: a?.meta?.total ?? null,
        consultations: c?.meta?.total ?? null,
      })
    })
    return () => { alive = false }
  }, [])

  const enabled = (mod) => !mod || modulesEnabled[mod] !== false
  const services = SERVICES.filter(s => enabled(s.mod))
  const filtered = q ? services.filter(s => s.label.toLowerCase().includes(q.toLowerCase())) : services

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const initials = (hospitalName || 'GM').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const statCards = [
    { key: 'patients', label: 'Patients', value: stats?.patients, Icon: Users },
    { key: 'admitted', label: 'Admitted', value: stats?.admitted, Icon: BedDouble },
    { key: 'consults', label: 'Consults', value: stats?.consultations, Icon: Stethoscope },
  ]

  return (
    <div className="pb-2">
      {/* ── Immersive gradient header ───────────────────────────── */}
      <div
        className="relative overflow-hidden px-4 pt-12 pb-20 text-white rounded-b-[32px]"
        style={{ background: `linear-gradient(150deg, ${shade(brandColor, 14)}, ${shade(brandColor, -30)})` }}
      >
        {/* decorative orbs */}
        <div className="pointer-events-none absolute -top-12 -right-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center justify-between animate-fade">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-full glass flex items-center justify-center font-bold ring-1 ring-white/20">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white/75">{greet} 👋</p>
              <p className="text-[15px] font-bold leading-tight truncate">{hospitalName}</p>
            </div>
          </div>
          <button type="button" className="relative h-10 w-10 shrink-0 rounded-full glass flex items-center justify-center active:scale-95 transition ring-1 ring-white/20">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-400 ring-2 ring-white/40" />
          </button>
        </div>

        {/* Quick-action chips */}
        <div className="relative mt-5 -mx-1 flex gap-2 overflow-x-auto no-scrollbar px-1 animate-rise" style={{ animationDelay: '.05s' }}>
          {QUICK_ACTIONS.map(({ to, label, Icon }) => (
            <NavLink
              key={label}
              to={to}
              className="flex shrink-0 items-center gap-1.5 rounded-full glass px-3.5 py-2 text-xs font-semibold ring-1 ring-white/20 active:scale-95 transition"
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* ── Floating search bar ─────────────────────────────────── */}
      <div className="px-4 -mt-9">
        <div className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 elev-3 animate-scale">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search patients, services…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: alpha(brandColor, '14') }}>
            <SlidersHorizontal className="h-4 w-4" style={{ color: brandColor }} />
          </div>
        </div>
      </div>

      {/* ── Live stat cards ─────────────────────────────────────── */}
      <div className="px-4 mt-4 grid grid-cols-3 gap-3 stagger">
        {statCards.map(({ key, label, value, Icon }) => (
          <div key={key} className="rounded-2xl bg-white p-3 elev-2 border border-gray-100/80">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: alpha(brandColor, '14'), color: brandColor }}>
              <Icon className="h-4 w-4" />
            </div>
            {stats
              ? <p className="text-[22px] font-extrabold leading-none tracking-tight" style={{ color: brandColor }}>{value ?? '—'}</p>
              : <div className="h-6 w-10 rounded bg-gray-100 animate-pulse" />}
            <p className="text-[11px] text-gray-500 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Services grid ───────────────────────────────────────── */}
      <div className="px-4 mt-7">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">Quick Services</h2>
          <span className="text-xs font-semibold" style={{ color: brandColor }}>{services.length} modules</span>
        </div>
        <div className="grid grid-cols-4 gap-x-3 gap-y-5 stagger">
          {filtered.map(({ to, label, Icon, tint, fg }) => (
            <NavLink key={to} to={to} className="flex flex-col items-center gap-1.5 active:scale-95 transition">
              <div className={`h-[58px] w-[58px] rounded-[20px] ${tint} ${fg} flex items-center justify-center elev-1`}>
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-medium text-gray-600 text-center leading-tight">{label}</span>
            </NavLink>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-4 text-center text-sm text-gray-400 py-6">No services match “{q}”.</p>
          )}
        </div>
      </div>

      {/* ── Premium banner ──────────────────────────────────────── */}
      <div className="px-4 mt-7">
        <div
          className="relative overflow-hidden rounded-3xl p-5 text-white elev-3"
          style={{ background: `linear-gradient(135deg, ${shade(brandColor, 20)}, ${shade(brandColor, -22)})` }}
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute right-10 bottom-[-30px] h-24 w-24 rounded-full bg-white/10" />
          <div className="relative flex items-center justify-between">
            <div className="min-w-0 pr-3">
              <p className="text-base font-bold">Everything in one place</p>
              <p className="text-xs text-white/85 mt-1 leading-relaxed">
                Patients, pharmacy, lab, radiology & wards — manage your hospital from your pocket.
              </p>
              <button className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold" style={{ color: shade(brandColor, -20) }}>
                Explore <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
