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
  clinicalOrders:       { path: 'clinical-orders',       label: 'Doctor Notes & Orders',       toggle: null },
  dayCare:              { path: 'day-care',              label: 'Day Care',             toggle: 'dayCare' },
  ambulance:            { path: 'ambulance',             label: 'Ambulance',            toggle: 'ambulance' },
  insurance:            { path: 'insurance',             label: 'TPA / Insurance',      toggle: 'insurance' },
  billing:              { path: 'billing',               label: 'Billing',              toggle: null },
  reports:              { path: 'reports',               label: 'Reports',              toggle: 'reports' },
  doctorAccountability: { path: 'doctor-accountability', label: 'Doctor Accountability', toggle: 'doctorAccountability' },
  deathCertificates:    { path: 'death-certificates',    label: 'Death Certificates',   toggle: 'deathCertificates' },
  patientCrm:           { path: 'patient-crm',           label: 'Patient Coordination', toggle: 'patientCrm' },
  settings:             { path: 'settings',              label: 'Settings',             toggle: null },
}

// Roles enabled on the web app for v1. Extend this map to add the remaining roles.
export const ROLES = {
  admin: {
    label: 'Administrator',
    home: 'dashboard',
    modules: [
      'dashboard', 'patients', 'preTriage', 'queue', 'triage', 'consultations',
      'pharmacy', 'laboratory', 'radiology', 'inpatient', 'dayCare', 'ambulance',
      'insurance', 'billing', 'reports',
      'doctorAccountability', 'patientCrm', 'deathCertificates', 'settings',
    ],
  },
  patient_crm: {
    label: 'Patient Coordinator',
    home: 'patientCrm',
    modules: ['dashboard', 'patientCrm'],
  },
  doctor: {
    label: 'Doctor',
    home: 'consultations',
    modules: ['dashboard', 'queue', 'consultations', 'clinicalOrders', 'patients', 'doctorAccountability'],
  },
  receptionist: {
    label: 'Receptionist',
    home: 'appointments',
    modules: ['dashboard', 'appointments', 'queue', 'patients', 'patientCrm', 'billing'],
  },

  // ── Phase 3.0: clinical-orders roles. Mapped in backend rbac.js already; these
  //    entries activate login + per-role landing/sidebar on the web app. ──
  nurse: {
    label: 'Nurse',
    home: 'inpatient',
    modules: ['dashboard', 'inpatient', 'patients'],
  },
  pharmacist: {
    label: 'Pharmacist',
    home: 'pharmacy',
    modules: ['dashboard', 'pharmacy', 'inpatient'],
  },
  lab_technician: {
    label: 'Lab Technician',
    home: 'laboratory',
    modules: ['dashboard', 'laboratory'],
  },
  radiology_technician: {
    label: 'Radiology Technician',
    home: 'radiology',
    modules: ['dashboard', 'radiology'],
  },
  billing: {
    label: 'Billing',
    home: 'billing',
    modules: ['dashboard', 'billing', 'inpatient', 'reports'],
  },
  housekeeping: {
    label: 'Housekeeping',
    home: 'inpatient',
    modules: ['dashboard', 'inpatient'],
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
    title: 'Patient Coordinator',
    subtitle: 'Coordinate and route each patient through their care.',
  },
  nurse: {
    color: '#0d9488',
    img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=70',
    title: 'Nursing Station',
    subtitle: 'Vitals, eMAR, clinical notes and bedside orders.',
  },
  pharmacist: {
    color: '#7c3aed',
    img: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=70',
    title: 'Pharmacy',
    subtitle: 'Dispense, inventory and medication orders.',
  },
  lab_technician: {
    color: '#0284c7',
    img: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1200&q=70',
    title: 'Laboratory',
    subtitle: 'Samples, processing and verified results.',
  },
  radiology_technician: {
    color: '#4f46e5',
    img: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=1200&q=70',
    title: 'Radiology',
    subtitle: 'Imaging worklist, scheduling and reports.',
  },
  billing: {
    color: '#d97706',
    img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=70',
    title: 'Billing',
    subtitle: 'Bills, receipts, payments and collections.',
  },
  housekeeping: {
    color: '#16a34a',
    img: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=70',
    title: 'Housekeeping',
    subtitle: 'Bed turnover and cleaning worklist.',
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
