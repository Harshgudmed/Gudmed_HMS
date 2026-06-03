import { useState, useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { Toaster } from 'sonner'
import client from '@/api/client'
import { HOSPITAL_NAME } from '@/lib/brand'
import Logo from '@/components/Logo'

function isLightColor(hex) {
  const h = (hex || '#ffffff').replace('#', '')
  if (h.length !== 6) return true
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}
import DashboardPage from './pages/DashboardPage.jsx'
import PreTriagePage from './pages/PreTriagePage.jsx'
import TriagePage from './pages/TriagePage.jsx'
import AppointmentsPage from './pages/AppointmentsPage.jsx'
import ConsultationsPage from './pages/ConsultationsPage.jsx'
import PatientsPage from './pages/PatientsPage.jsx'
import PharmacyPage from './pages/PharmacyPage.jsx'
import LaboratoryPage from './pages/LaboratoryPage.jsx'
import RadiologyPage from './pages/RadiologyPage.jsx'
import InpatientPage from './pages/InpatientPage.jsx'
import BillingPage from './pages/BillingPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import DeathCertificatePage from './pages/DeathCertificatePage.jsx'
import DoctorAccountabilityPage from './pages/DoctorAccountabilityPage.jsx'
import QueuePage from './pages/QueuePage.jsx'

const NAV_ITEMS = [
  { to: '/',                      label: 'Dashboard' },
  { to: '/patients',              label: 'Patients' },
  { to: '/pre-triage',            label: 'Pre-Triage' },
  { to: '/queue',                 label: 'Queue' },
  { to: '/triage',                label: 'Triage' },
  // Hidden from sidebar — available as tabs inside Queue Management
  // { to: '/appointments',          label: 'Appointments' },
  { to: '/consultations',         label: 'Consultations' },
  { to: '/pharmacy',              label: 'Pharmacy' },
  { to: '/laboratory',            label: 'Laboratory' },
  { to: '/radiology',             label: 'Radiology' },
  // { to: '/billing',               label: 'Billing' },
  { to: '/inpatient',             label: 'Inpatient' },
  { to: '/reports',               label: 'Reports' },
  { to: '/doctor-accountability', label: 'Doctor Accountability' },
  { to: '/death-certificates',    label: 'Death Certificates' },
  { to: '/settings',              label: 'Settings' },
]

function applyBranding(settings) {
  if (!settings) return
  const root = document.documentElement
  if (settings.primaryColor)   root.style.setProperty('--color-primary', settings.primaryColor)
  if (settings.secondaryColor) root.style.setProperty('--color-secondary', settings.secondaryColor)
  if (settings.navbarColor)    root.style.setProperty('--color-navbar', settings.navbarColor)
  if (settings.headerColor)    root.style.setProperty('--color-header', settings.headerColor)
  if (settings.hospitalName) {
    document.title = settings.hospitalName
  }
}

export default function App() {
  const [navbarColor, setNavbarColor] = useState('#2E4168')
  const [hospitalName, setHospitalName] = useState('Hospital HMS')

  useEffect(() => {
    client.get('/settings').then(res => {
      const s = res.data?.settings || {}
      if (s.navbarColor)   setNavbarColor(s.navbarColor)
      if (s.hospitalName)  setHospitalName(s.hospitalName || res.data?.name || 'Hospital HMS')
      applyBranding({ ...s, hospitalName: s.hospitalName || res.data?.name })
    }).catch(() => {})

    const onColorChange = (e) => {
      setNavbarColor(e.detail.navbarColor || e.detail)
      applyBranding(e.detail)
    }
    const onNameChange  = (e) => setHospitalName(e.detail)

    window.addEventListener('navbarColorChange', onColorChange)
    window.addEventListener('hospitalNameChange', onNameChange)
    window.addEventListener('brandingChange', onColorChange)
    return () => {
      window.removeEventListener('navbarColorChange', onColorChange)
      window.removeEventListener('hospitalNameChange', onNameChange)
      window.removeEventListener('brandingChange', onColorChange)
    }
  }, [])

  const light = isLightColor(navbarColor)
  const colored = navbarColor !== '#ffffff' && navbarColor !== '#fff'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar nav */}
      <aside
        className="fixed top-0 left-0 h-full w-56 border-r shadow-sm z-20 flex flex-col overflow-y-auto transition-colors duration-300"
        style={{ backgroundColor: navbarColor }}
      >
        <NavLink
          to="/"
          end
          title={hospitalName}
          className={`flex items-center gap-3 px-4 py-4 border-b transition-colors hover:opacity-90 ${colored && !light ? 'border-white/20' : 'border-gray-200'}`}
        >
          <Logo size={44} />
          <span className={`text-sm font-bold leading-tight ${colored && !light ? 'text-white' : 'text-blue-700'}`}>
            {hospitalName}
          </span>
        </NavLink>
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => {
                if (colored && !light) {
                  return `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`
                }
                return `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="ml-56 p-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pre-triage"            element={<PreTriagePage />} />
          <Route path="/queue"                 element={<QueuePage />} />
          <Route path="/triage"                element={<TriagePage />} />
          <Route path="/appointments"          element={<AppointmentsPage />} />
          <Route path="/consultations"         element={<ConsultationsPage />} />
          <Route path="/patients"              element={<PatientsPage />} />
          <Route path="/pharmacy"              element={<PharmacyPage />} />
          <Route path="/laboratory"            element={<LaboratoryPage />} />
          <Route path="/radiology"             element={<RadiologyPage />} />
          <Route path="/inpatient"             element={<InpatientPage />} />
          <Route path="/billing"               element={<BillingPage />} />
          <Route path="/reports"               element={<ReportsPage />} />
          <Route path="/death-certificates"    element={<DeathCertificatePage />} />
          <Route path="/doctor-accountability" element={<DoctorAccountabilityPage />} />
          <Route path="/settings"              element={<SettingsPage />} />
        </Routes>
      </main>

      <Toaster richColors position="top-right" />
    </div>
  )
}
