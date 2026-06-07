import {
  LayoutDashboard, Users, ClipboardList, ListChecks, Activity, Stethoscope,
  Pill, FlaskConical, Scan, BedDouble, BarChart3, BadgeIndianRupee,
  FileText, Settings as SettingsIcon, UserRound,
} from 'lucide-react'

// Every module shown on the Home service grid and the "More" sheet.
// `mod` matches the Settings → Modules toggle key. The soft tint/fg pairs give
// each service an Apollo/1mg-style coloured icon while the app's brand colour
// stays the hero (header, active tabs).
export const SERVICES = [
  { to: '/patients',              label: 'Patients',     Icon: Users,           tint: 'bg-blue-100',    fg: 'text-blue-600',    mod: 'patients' },
  { to: '/doctors',               label: 'Doctors',      Icon: UserRound,       tint: 'bg-green-100',   fg: 'text-green-600' },
  { to: '/pre-triage',            label: 'Pre-Triage',   Icon: ClipboardList,   tint: 'bg-amber-100',   fg: 'text-amber-600',   mod: 'preTriage' },
  { to: '/queue',                 label: 'Queue',        Icon: ListChecks,      tint: 'bg-violet-100',  fg: 'text-violet-600',  mod: 'queue' },
  { to: '/triage',                label: 'Triage',       Icon: Activity,        tint: 'bg-rose-100',    fg: 'text-rose-600',    mod: 'triage' },
  { to: '/consultations',         label: 'Consult',      Icon: Stethoscope,     tint: 'bg-emerald-100', fg: 'text-emerald-600', mod: 'consultations' },
  { to: '/pharmacy',              label: 'Pharmacy',     Icon: Pill,            tint: 'bg-teal-100',    fg: 'text-teal-600',    mod: 'pharmacy' },
  { to: '/laboratory',            label: 'Lab',          Icon: FlaskConical,    tint: 'bg-cyan-100',    fg: 'text-cyan-600',    mod: 'laboratory' },
  { to: '/radiology',             label: 'Radiology',    Icon: Scan,            tint: 'bg-indigo-100',  fg: 'text-indigo-600',  mod: 'radiology' },
  { to: '/inpatient',             label: 'Inpatient',    Icon: BedDouble,       tint: 'bg-orange-100',  fg: 'text-orange-600',  mod: 'inpatient' },
  { to: '/reports',               label: 'Reports',      Icon: BarChart3,       tint: 'bg-sky-100',     fg: 'text-sky-600',     mod: 'reports' },
  { to: '/doctor-accountability', label: 'Doctors',      Icon: BadgeIndianRupee, tint: 'bg-fuchsia-100', fg: 'text-fuchsia-600', mod: 'doctorAccountability' },
  { to: '/death-certificates',    label: 'Certificates', Icon: FileText,        tint: 'bg-slate-100',   fg: 'text-slate-600',   mod: 'deathCertificates' },
  { to: '/settings',              label: 'Settings',     Icon: SettingsIcon,    tint: 'bg-gray-100',    fg: 'text-gray-600' },
]

// The 4 quick tabs in the bottom bar (a 5th "More" button opens the full menu).
export const BOTTOM_NAV = [
  { to: '/',              label: 'Home',     Icon: LayoutDashboard },
  { to: '/patients',      label: 'Patients', Icon: Users,       mod: 'patients' },
  { to: '/consultations', label: 'Consult',  Icon: Stethoscope, mod: 'consultations' },
  { to: '/pharmacy',      label: 'Pharmacy', Icon: Pill,        mod: 'pharmacy' },
]

// Header title for each route.
export const TITLE_BY_PATH = {
  '/': 'Home',
  '/appointments': 'Appointments',
  ...Object.fromEntries(SERVICES.map(s => [s.to, s.label === 'Consult' ? 'Consultations' : s.label === 'Lab' ? 'Laboratory' : s.label === 'Doctors' ? 'Doctor Accountability' : s.label === 'Certificates' ? 'Death Certificates' : s.label])),
}
