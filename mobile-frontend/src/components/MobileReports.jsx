import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { toast } from 'sonner'
import client from '@/api/client'
import { Users, CalendarDays, BedDouble, Clock3, TrendingUp, Activity, RefreshCw, BarChart3, FileText, Download, Printer, Receipt } from 'lucide-react'

const TYPE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#06B6D4', '#EC4899', '#8B5CF6']

function barColor(rate) {
  if (rate >= 85) return 'bg-rose-500'
  if (rate >= 60) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export default function MobileReports({ brandColor = '#2E4168' }) {
  const [tab, setTab] = useState('dashboard')
  return (
    <div className="pb-2">
      <div className="sticky top-14 z-20 -mx-3 px-3 pt-1 pb-2.5 bg-gray-50/95 backdrop-blur">
        <div className="flex gap-2">
          {[['dashboard', 'Dashboard', BarChart3], ['reports', 'Reports', FileText]].map(([k, l, Icon]) => {
            const on = tab === k
            return <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`} style={on ? { backgroundColor: brandColor } : undefined}><Icon className="h-4 w-4" />{l}</button>
          })}
        </div>
      </div>
      {tab === 'dashboard' ? <DashboardBody brandColor={brandColor} /> : <ReportsTab brandColor={brandColor} />}
    </div>
  )
}

function DashboardBody({ brandColor = '#2E4168' }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const fetchAll = () => {
    setError(null); setData(null)
    Promise.all([
      client.get('/analytics', { params: { resource: 'ward-occupancy' } }).catch(() => null),
      client.get('/analytics', { params: { resource: 'admission-stats' } }).catch(() => null),
      client.get('/patients', { params: { limit: 1 } }).catch(() => null),
      client.get('/appointments', { params: { limit: 1 } }).catch(() => null),
    ]).then(([w, s, p, ap]) => {
      const wards = (w?.data || []).filter(Boolean)
      const stats = s?.data || {}
      // normalise admissionsByType (merge duplicate-cased keys)
      const byType = {}
      Object.entries(stats.admissionsByType || {}).forEach(([k, v]) => {
        const key = k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()
        byType[key] = (byType[key] || 0) + v
      })
      const capacity = wards.reduce((a, x) => a + (x.capacity || 0), 0)
      const occupied = wards.reduce((a, x) => a + (x.occupied || 0), 0)
      setData({
        wards: [...wards].sort((a, b) => b.occupancyRate - a.occupancyRate),
        stats,
        byType: Object.entries(byType).map(([name, value]) => ({ name, value })),
        capacity, occupied,
        occupancyRate: capacity ? Math.round((occupied / capacity) * 100) : 0,
        patients: p?.meta?.total ?? null,
        appointments: ap?.meta?.total ?? null,
      })
    }).catch(e => setError(e.message || 'Failed to load analytics'))
  }

  useEffect(fetchAll, [])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade">
        <div className="h-16 w-16 rounded-2xl bg-rose-50 flex items-center justify-center mb-4"><Activity className="h-7 w-7 text-rose-400" /></div>
        <p className="font-semibold text-gray-700">Couldn’t load analytics</p>
        <p className="mt-1 text-sm text-gray-400 max-w-[240px]">{error}</p>
        <button onClick={fetchAll} className="mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}><RefreshCw className="h-4 w-4" /> Retry</button>
      </div>
    )
  }
  if (!data) return <ReportsSkeleton />

  const occ = [
    { name: 'Occupied', value: data.occupied, color: brandColor },
    { name: 'Available', value: Math.max(data.capacity - data.occupied, 0), color: '#E5E7EB' },
  ]

  return (
    <div className="pb-2 space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 stagger">
        <Kpi Icon={Users} label="Total Patients" value={fmt(data.patients)} brandColor={brandColor} />
        <Kpi Icon={CalendarDays} label="Appointments" value={fmt(data.appointments)} brandColor={brandColor} />
        <Kpi Icon={BedDouble} label="Active Admissions" value={fmt(data.stats.activeAdmissions)} brandColor={brandColor} />
        <Kpi Icon={Clock3} label="Avg. Stay (days)" value={fmt(data.stats.avgLengthOfStay)} brandColor={brandColor} />
      </div>

      {/* Bed occupancy ring */}
      <Section title="Bed Occupancy">
        <div className="rounded-3xl bg-white p-4 elev-2 border border-gray-100/70 flex items-center gap-4">
          <div className="relative h-[136px] w-[136px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={occ} dataKey="value" innerRadius={50} outerRadius={66} startAngle={90} endAngle={-270} paddingAngle={occ[1].value ? 2 : 0} stroke="none">
                  {occ.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold" style={{ color: brandColor }}>{data.occupancyRate}%</span>
              <span className="text-[10px] text-gray-400">occupied</span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <Legend dot={brandColor} label="Occupied beds" value={data.occupied} />
            <Legend dot="#E5E7EB" label="Available beds" value={Math.max(data.capacity - data.occupied, 0)} dark />
            <div className="pt-1 border-t border-gray-100">
              <Legend dot="transparent" label="Total beds" value={data.capacity} bold />
            </div>
          </div>
        </div>
      </Section>

      {/* Admissions by type */}
      {data.byType.length > 0 && (
        <Section title="Admissions by Type">
          <div className="rounded-3xl bg-white p-4 elev-2 border border-gray-100/70 flex items-center gap-4">
            <div className="h-[120px] w-[120px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.byType} dataKey="value" innerRadius={38} outerRadius={58} paddingAngle={2} stroke="none">
                    {data.byType.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2.5">
              {data.byType.map((t, i) => (
                <Legend key={t.name} dot={TYPE_COLORS[i % TYPE_COLORS.length]} label={t.name} value={t.value} />
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Ward occupancy bars */}
      {data.wards.length > 0 && (
        <Section title="Ward Occupancy" right={`${data.wards.length} wards`}>
          <div className="rounded-3xl bg-white p-4 elev-2 border border-gray-100/70 space-y-3.5">
            {data.wards.map(w => (
              <div key={w.wardId}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-700 truncate pr-2">{w.wardName}</span>
                  <span className="text-xs text-gray-400 shrink-0">{w.occupied}/{w.capacity} · {w.occupancyRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${barColor(w.occupancyRate)} transition-all`} style={{ width: `${Math.min(w.occupancyRate, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-300">
        <TrendingUp className="h-3.5 w-3.5" /> Live data from your hospital
      </div>
    </div>
  )
}

const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'))

function Kpi({ Icon, label, value, brandColor }) {
  return (
    <div className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
      <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-2.5" style={{ backgroundColor: `${brandColor}14`, color: brandColor }}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <p className="text-2xl font-extrabold leading-none tracking-tight" style={{ color: brandColor }}>{value}</p>
      <p className="text-[11px] text-gray-500 mt-1.5">{label}</p>
    </div>
  )
}

function Section({ title, right, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-0.5">
        <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
        {right && <span className="text-xs text-gray-400">{right}</span>}
      </div>
      {children}
    </div>
  )
}

function Legend({ dot, label, value, dark, bold }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: dot === 'transparent' ? 'transparent' : dot }} />
      <span className={`text-xs flex-1 ${dark ? 'text-gray-400' : 'text-gray-600'} ${bold ? 'font-semibold text-gray-700' : ''}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'font-extrabold text-gray-900' : 'font-bold text-gray-800'}`}>{fmt(value)}</span>
    </div>
  )
}

function printDoc(html) { const w = window.open('', '_blank', 'width=900,height=750'); if (!w) { toast.error('Allow pop-ups to print'); return } w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400) }
const orgName = () => { try { return localStorage.getItem('hospitalName') || 'Hospital' } catch { return 'Hospital' } }

function ReportsTab({ brandColor }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    Promise.allSettled([
      client.get('/patients', { params: { limit: 2000 } }),
      client.get('/billing', { params: { resource: 'invoices' } }),
      client.get('/appointments'),
      client.get('/inpatient', { params: { resource: 'admissions' } }),
    ]).then(([p, i, a, adm]) => {
      const arr = r => r.status === 'fulfilled' ? (Array.isArray(r.value?.data) ? r.value.data : (r.value?.data?.data || [])) : []
      setD({ patients: arr(p), invoices: arr(i), appointments: arr(a), admissions: arr(adm) })
    }).catch(e => setErr(e.message || 'Failed'))
  }, [])
  const dt = (x) => x ? new Date(x).toLocaleDateString('en-IN') : ''
  const REPORTS = d ? [
    { key: 'patients', name: 'Patient list', desc: 'All registered patients', Icon: Users, rows: d.patients.length, build: () => [['UHID', 'First Name', 'Last Name', 'Gender', 'DOB', 'Phone', 'Blood Group', 'Insurance', 'Registered'], ...d.patients.map(p => [p.mrn, p.firstName, p.lastName, p.gender, dt(p.dateOfBirth), p.phonePrimary || '', p.bloodGroup || '', p.hasInsurance ? 'Yes' : 'No', dt(p.createdAt)])] },
    { key: 'invoices', name: 'Revenue / invoices', desc: 'Billing invoices & payments', Icon: Receipt, rows: d.invoices.length, build: () => [['Invoice #', 'Patient', 'UHID', 'Date', 'Total', 'Paid', 'Balance', 'Status'], ...d.invoices.map(v => [v.invoiceNumber, v.patient ? `${v.patient.firstName} ${v.patient.lastName}` : '', v.patient?.mrn || '', dt(v.invoiceDate), (v.totalAmount || 0).toFixed(2), (v.amountPaid || 0).toFixed(2), (v.balanceDue ?? 0).toFixed(2), v.paymentStatus])] },
    { key: 'appointments', name: 'Appointments', desc: 'All appointments', Icon: CalendarDays, rows: d.appointments.length, build: () => [['Date', 'Time', 'Patient', 'UHID', 'Doctor', 'Type', 'Status'], ...d.appointments.map(a => [dt(a.appointmentDate), a.appointmentTime || '', a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '', a.patient?.mrn || '', a.doctor?.fullName || '', a.appointmentType || '', a.status])] },
    { key: 'admissions', name: 'Admissions', desc: 'Inpatient admissions', Icon: BedDouble, rows: d.admissions.length, build: () => [['Patient', 'UHID', 'Ward', 'Bed', 'Admitted', 'Discharged', 'Status', 'Type'], ...d.admissions.map(a => [a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '', a.patient?.mrn || '', a.bed?.ward?.name || '', a.bed?.bedNumber || '', dt(a.admissionDate), dt(a.dischargeDate), a.status, a.admissionType || ''])] },
  ] : []
  const exportCSV = (rep) => {
    const rows = rep.build()
    if (rows.length <= 1) { toast.error('No data to export'); return }
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${rep.key}_${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url)
    toast.success(`Exported ${rows.length - 1} rows`)
  }
  const printRep = (rep) => {
    const rows = rep.build(); if (rows.length <= 1) { toast.error('No data'); return }
    const head = rows[0].map(h => `<th>${h}</th>`).join('')
    const body = rows.slice(1).map(r => `<tr>${r.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')
    printDoc(`<!DOCTYPE html><html><head><title>${rep.name}</title><style>body{font-family:Arial;font-size:11px;padding:20px}h2{margin:0}.sub{color:#666;font-size:11px;margin-bottom:10px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:5px 6px;text-align:left;font-size:10px}td{padding:4px 6px;border-bottom:1px solid #eee}</style></head><body><h2>${orgName()} — ${rep.name}</h2><div class="sub">${rep.rows} records · ${new Date().toLocaleString('en-IN')}</div><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`)
  }
  if (err) return <div className="py-24 text-center text-sm text-gray-400">{err}</div>
  if (!d) return <div className="mt-3 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white elev-1 animate-pulse" />)}</div>
  return (
    <div className="mt-1 space-y-3">
      <p className="px-0.5 text-xs text-gray-400">Export a CSV to download, or Print for a printable sheet.</p>
      {REPORTS.map(rep => (
        <div key={rep.key} className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}14`, color: brandColor }}><rep.Icon className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1"><p className="font-semibold text-[14px] text-gray-900">{rep.name}</p><p className="text-[11px] text-gray-400">{rep.desc} · {rep.rows} records</p></div>
          </div>
          <div className="mt-2.5 flex gap-2">
            <button onClick={() => exportCSV(rep)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white active:scale-95 transition" style={{ backgroundColor: brandColor }}><Download className="h-3.5 w-3.5" />Export CSV</button>
            <button onClick={() => printRep(rep)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-gray-100 text-gray-600 active:scale-95 transition"><Printer className="h-3.5 w-3.5" />Print</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white elev-1 animate-pulse" />)}
      </div>
      <div className="h-44 rounded-3xl bg-white elev-1 animate-pulse" />
      <div className="h-40 rounded-3xl bg-white elev-1 animate-pulse" />
    </div>
  )
}
