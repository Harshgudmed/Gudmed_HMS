// ─────────────────────────────────────────────────────────────────────────────
// Role-based access configuration (web).
//
// Single source of truth for: which modules each role can see, where each role
// lands after login, and the master module registry the sidebar/router build from.
//
// Gated by VITE_AUTH_ENFORCED — when 'false' (default) the app keeps its legacy
// behaviour (no login, flat routes) so the live demo is unaffected. Flip to 'true'
// (build/deploy env) to turn on login + per-role URLs.
// ─────────────────────────────────────────────────────────────────────────────

export const AUTH_ENFORCED = import.meta.env.VITE_AUTH_ENFORCED === 'true'

// Master registry of every module. `path` is the suffix mounted under /:role.
// `toggle` is the key in the org's modulesEnabled map (null = always available).
export const MODULES = {
  dashboard:            { path: '',                      label: 'Dashboard',            toggle: null },
  patients:             { path: 'patients',              label: 'Patients',             toggle: 'patients' },
  preTriage:            { path: 'pre-triage',            label: 'Pre-Triage',           toggle: 'preTriage' },
  queue:                { path: 'queue',                 label: 'Queue',                toggle: 'queue' },
  triage:               { path: 'triage',                label: 'Triage',               toggle: 'triage' },
  appointments:         { path: 'appointments',          label: 'Appointments',         toggle: null },
  consultations:        { path: 'consultations',         label: 'Consultations',        toggle: 'consultations' },
  pharmacy:             { path: 'pharmacy',              label: 'Pharmacy',             toggle: 'pharmacy' },
  laboratory:           { path: 'laboratory',            label: 'Laboratory',           toggle: 'laboratory' },
  radiology:            { path: 'radiology',             label: 'Radiology',            toggle: 'radiology' },
  inpatient:            { path: 'inpatient',             label: 'Inpatient',            toggle: 'inpatient' },
  billing:              { path: 'billing',               label: 'Billing',              toggle: null },
  reports:              { path: 'reports',               label: 'Reports',              toggle: 'reports' },
  doctorAccountability: { path: 'doctor-accountability', label: 'Doctor Accountability', toggle: 'doctorAccountability' },
  deathCertificates:    { path: 'death-certificates',    label: 'Death Certificates',   toggle: 'deathCertificates' },
  patientCrm:           { path: 'patient-crm',           label: 'Patient CRM',          toggle: 'patientCrm' },
  settings:             { path: 'settings',              label: 'Settings',             toggle: null },
}

// Roles enabled on the web app for v1. Extend this map to add the remaining roles.
export const ROLES = {
  admin: {
    label: 'Administrator',
    home: 'dashboard',
    modules: [
      'dashboard', 'patients', 'preTriage', 'queue', 'triage', 'consultations',
      'pharmacy', 'laboratory', 'radiology', 'inpatient', 'reports',
      'doctorAccountability', 'patientCrm', 'deathCertificates', 'settings',
    ],
  },
  patient_crm: {
    label: 'Patient CRM',
    home: 'patientCrm',
    modules: ['dashboard', 'patientCrm'],
  },
  doctor: {
    label: 'Doctor',
    home: 'consultations',
    modules: ['dashboard', 'queue', 'consultations', 'patients', 'doctorAccountability'],
  },
  receptionist: {
    label: 'Receptionist',
    home: 'appointments',
    modules: ['dashboard', 'appointments', 'queue', 'patients', 'patientCrm', 'billing'],
  },
}

export const KNOWN_ROLES = Object.keys(ROLES)

// Hero imagery for each login page — real hospital photos (Unsplash CDN) with a
// role-coloured gradient overlay. If a photo fails to load, the gradient remains,
// so the panel never looks broken.
export const LOGIN_HERO = {
  admin: {
    color: '#2563eb',
    img: '/login/admin.jpg', // place the file at frontend/public/login/admin.jpg
    title: 'Hospital Administration',
    subtitle: 'Oversee every department, staff and setting in one place.',
  },
  doctor: {
    color: '#0891b2',
    img: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1200&q=70',
    title: 'Doctor Portal',
    subtitle: 'Your patients, consultations, prescriptions and reports.',
  },
  receptionist: {
    color: '#9333ea',
    img: '/login/reception.png', // file at frontend/public/login/reception.png
    title: 'Front Desk',
    subtitle: 'Appointments, check-ins and patient routing.',
  },
  patient_crm: {
    color: '#e11d48',
    img: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=70',
    title: 'Patient CRM',
    subtitle: 'Coordinate and route each patient through their care.',
  },
  patient: {
    color: '#0d9488',
    img: '/login/patient.jpeg', // file at frontend/public/login/patient.jpeg
    title: 'Patient Portal',
    subtitle: 'Your appointments, reports and bills — in real time.',
  },
}

export function isKnownRole(role) {
  return Object.prototype.hasOwnProperty.call(ROLES, role)
}

// Absolute path a user should land on after logging in (their role's home module).
export function homePathFor(role) {
  // Patients live in their own portal, not the staff role layout.
  if (role === 'patient') return '/patient'
  const cfg = ROLES[role]
  if (!cfg) return '/'
  const home = MODULES[cfg.home]?.path || ''
  return home ? `/${role}/${home}` : `/${role}`
}
