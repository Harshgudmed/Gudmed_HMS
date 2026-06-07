import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import client from '@/api/client'
import { Menu, X, ChevronLeft } from 'lucide-react'
import { BOTTOM_NAV, SERVICES, TITLE_BY_PATH } from '@/lib/nav'
import MobileHome from '@/components/MobileHome'
import SplashScreen from '@/components/SplashScreen'

import MobilePreTriage from '@/components/MobilePreTriage'
import MobileAppointments from '@/components/MobileAppointments'
import MobileConsultations from '@/components/MobileConsultations'
import MobileConsultationDetail from '@/components/MobileConsultationDetail'
import MobilePatients from '@/components/MobilePatients'
import MobilePatientDetail from '@/components/MobilePatientDetail'
import MobileDoctors from '@/components/MobileDoctors'
import MobileDoctorDetail from '@/components/MobileDoctorDetail'
import MobilePharmacy from '@/components/MobilePharmacy'
import MobileLaboratory from '@/components/MobileLaboratory'
import MobileRadiology from '@/components/MobileRadiology'
import MobileInpatient from '@/components/MobileInpatient'
import BillingPage from './pages/BillingPage.jsx'
import MobileReports from '@/components/MobileReports'
import MobileSettings from '@/components/MobileSettings'
import MobileDeathCertificates from '@/components/MobileDeathCertificates'
import MobileDoctorAccountability from '@/components/MobileDoctorAccountability'
import MobileQueue from '@/components/MobileQueue'

function withAlpha(hex, alpha = '1A') {
  const h = (hex || '').replace('#', '')
  return h.length === 6 ? `#${h}${alpha}` : hex
}

export default function App() {
  const [hospitalName, setHospitalName] = useState('GudMed HMS')
  const [brandColor, setBrandColor] = useState('#2E4168')
  const [modulesEnabled, setModulesEnabled] = useState({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSplash, setShowSplash] = useState(true)

  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === '/'
  const isPatientDetail = location.pathname.startsWith('/patients/')
  const isDoctorDetail = location.pathname.startsWith('/doctors/')
  const isConsultDetail = location.pathname.startsWith('/consultations/')
  const immersive = isHome || isPatientDetail || isDoctorDetail || isConsultDetail
  const title = TITLE_BY_PATH[location.pathname] || hospitalName

  useEffect(() => {
    client.get('/settings').then(res => {
      const s = res.data?.settings || {}
      const orgName = res.data?.name || s.hospitalName
      if (orgName) { setHospitalName(orgName); document.title = orgName }
      if (res.data?.primaryColor) setBrandColor(res.data.primaryColor)
      if (res.data?.modulesEnabled) setModulesEnabled(res.data.modulesEnabled)
    }).catch(() => {})

    const onName = (e) => setHospitalName(e.detail)
    const onBrand = (e) => { if (e.detail?.primaryColor) setBrandColor(e.detail.primaryColor) }
    const onModules = (e) => setModulesEnabled(e.detail || {})
    window.addEventListener('hospitalNameChange', onName)
    window.addEventListener('brandingChange', onBrand)
    window.addEventListener('modulesChange', onModules)
    return () => {
      window.removeEventListener('hospitalNameChange', onName)
      window.removeEventListener('brandingChange', onBrand)
      window.removeEventListener('modulesChange', onModules)
    }
  }, [])

  // Close the More sheet whenever the route changes.
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const enabled = (mod) => !mod || modulesEnabled[mod] !== false
  const bottomItems = BOTTOM_NAV.filter(i => enabled(i.mod))
  const menuItems = SERVICES.filter(i => enabled(i.mod))

  return (
    <div className="min-h-screen bg-gray-50">
      {showSplash && (
        <SplashScreen brandColor={brandColor} hospitalName={hospitalName} onDone={() => setShowSplash(false)} />
      )}

      {/* Per-screen top bar (Home & detail screens have their own immersive header) */}
      {!immersive && (
        <header className="fixed top-0 inset-x-0 z-30 h-14 flex items-center gap-2 px-3 bg-white border-b border-gray-100 shadow-sm">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-9 w-9 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 active:scale-95 transition"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-bold text-gray-900 truncate">{title}</span>
        </header>
      )}

      {/* Content */}
      <main className={immersive ? 'pb-24' : 'pt-14 pb-24'}>
        <div className={immersive ? '' : 'px-3 pt-3'}>
          <Routes>
            <Route path="/" element={<MobileHome brandColor={brandColor} hospitalName={hospitalName} modulesEnabled={modulesEnabled} />} />
            <Route path="/pre-triage"            element={<MobilePreTriage brandColor={brandColor} />} />
            <Route path="/queue"                 element={<MobileQueue brandColor={brandColor} />} />
            <Route path="/triage"                element={<MobileQueue brandColor={brandColor} />} />
            <Route path="/appointments"          element={<MobileAppointments brandColor={brandColor} />} />
            <Route path="/consultations"         element={<MobileConsultations brandColor={brandColor} />} />
            <Route path="/consultations/:id"     element={<MobileConsultationDetail brandColor={brandColor} />} />
            <Route path="/patients"              element={<MobilePatients brandColor={brandColor} />} />
            <Route path="/patients/:id"          element={<MobilePatientDetail brandColor={brandColor} />} />
            <Route path="/doctors"               element={<MobileDoctors brandColor={brandColor} />} />
            <Route path="/doctors/:id"           element={<MobileDoctorDetail brandColor={brandColor} />} />
            <Route path="/pharmacy"              element={<MobilePharmacy brandColor={brandColor} />} />
            <Route path="/laboratory"            element={<MobileLaboratory brandColor={brandColor} />} />
            <Route path="/radiology"             element={<MobileRadiology brandColor={brandColor} />} />
            <Route path="/inpatient"             element={<MobileInpatient brandColor={brandColor} />} />
            <Route path="/billing"               element={<BillingPage />} />
            <Route path="/reports"               element={<MobileReports brandColor={brandColor} />} />
            <Route path="/death-certificates"    element={<MobileDeathCertificates brandColor={brandColor} />} />
            <Route path="/doctor-accountability" element={<MobileDoctorAccountability brandColor={brandColor} />} />
            <Route path="/settings"              element={<MobileSettings brandColor={brandColor} />} />
          </Routes>
        </div>
      </main>

      {/* Modern bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex items-stretch justify-around h-16 max-w-lg mx-auto">
          {bottomItems.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className="flex flex-1 flex-col items-center justify-center gap-1">
              {({ isActive }) => (
                <>
                  <div
                    className="flex items-center justify-center h-9 w-9 rounded-xl transition-all"
                    style={isActive ? { backgroundColor: withAlpha(brandColor) } : undefined}
                  >
                    <Icon className="h-[22px] w-[22px]" style={{ color: isActive ? brandColor : '#9aa3af' }} />
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: isActive ? brandColor : '#9aa3af' }}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button type="button" onClick={() => setMenuOpen(true)} className="flex flex-1 flex-col items-center justify-center gap-1">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl">
              <Menu className="h-[22px] w-[22px]" style={{ color: '#9aa3af' }} />
            </div>
            <span className="text-[10px] font-medium" style={{ color: '#9aa3af' }}>More</span>
          </button>
        </div>
      </nav>

      {/* "More" bottom sheet — all modules */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute bottom-0 inset-x-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.18s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-300" />
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-bold text-gray-900">All Modules</span>
              <button type="button" onClick={() => setMenuOpen(false)} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-x-3 gap-y-5">
              {menuItems.map(({ to, label, Icon, tint, fg }) => (
                <NavLink key={to} to={to} end={to === '/'} className="flex flex-col items-center gap-1.5 active:scale-95 transition">
                  <div className={`h-14 w-14 rounded-2xl ${tint} ${fg} flex items-center justify-center shadow-sm`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-medium text-gray-600 text-center leading-tight">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      <Toaster richColors position="top-center" />
    </div>
  )
}
