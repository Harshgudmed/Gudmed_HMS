import { useState, useEffect, useCallback } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import { Building2, Package, Users as UsersIcon, X, Check, Loader2, Plus, Pencil, Power, MessageCircle } from 'lucide-react'

const ORG_ID = 'org-demo'
const ALL_MODULES = [
  { key: 'patients', label: 'Patients' }, { key: 'preTriage', label: 'Pre-Triage' }, { key: 'queue', label: 'Queue' },
  { key: 'triage', label: 'Triage' }, { key: 'consultations', label: 'Consultations' }, { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'laboratory', label: 'Laboratory' }, { key: 'radiology', label: 'Radiology' }, { key: 'inpatient', label: 'Inpatient' },
  { key: 'reports', label: 'Reports' }, { key: 'doctorAccountability', label: 'Doctor Accountability' },
  { key: 'deathCertificates', label: 'Death Certificates' }, { key: 'inventory', label: 'Inventory' }, { key: 'accounting', label: 'Accounting' },
]
const ROLES = { super_admin: 'Super Administrator', admin: 'Hospital Administrator', doctor: 'Doctor/Physician', nurse: 'Nurse', receptionist: 'Receptionist', pharmacist: 'Pharmacist', lab_tech: 'Lab Technician', lab_supervisor: 'Lab Supervisor', radiologist: 'Radiologist', radiology_tech: 'Radiology Technician', billing_clerk: 'Billing Clerk', inventory_manager: 'Inventory Manager' }
const inp = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-gray-400 bg-white'
const Field = ({ label, req, children }) => <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">{label}{req && <span className="text-rose-500"> *</span>}</label>{children}</div>

export default function MobileSettings({ brandColor = '#2E4168' }) {
  const [tab, setTab] = useState('org')
  const [org, setOrg] = useState(null)
  const [users, setUsers] = useState([])
  const [depts, setDepts] = useState([])
  const [error, setError] = useState(null)

  const fetchAll = useCallback(() => {
    setError(null)
    Promise.all([
      client.get('/settings'),
      client.get('/settings', { params: { resource: 'users' } }),
      client.get('/settings', { params: { resource: 'departments' } }),
    ]).then(([o, u, d]) => { setOrg(o?.data || {}); setUsers(u?.data || []); setDepts(d?.data || []) })
      .catch(e => setError(e.message || 'Failed to load settings'))
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  if (error) return <Centered title="Couldn’t load settings" sub={error} />
  if (!org) return <div className="pt-1 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-white elev-1 animate-pulse" />)}</div>

  return (
    <div className="pb-2">
      <div className="sticky top-14 z-20 -mx-3 px-3 pt-1 pb-2.5 bg-gray-50/95 backdrop-blur">
        <div className="-mx-1 flex gap-2 overflow-x-auto no-scrollbar px-1">
          {[['org', 'Organization', Building2], ['modules', 'Modules', Package], ['users', 'Users', UsersIcon], ['notifications', 'Notifications', MessageCircle]].map(([k, l, Icon]) => {
            const on = tab === k
            return <button key={k} onClick={() => setTab(k)} className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${on ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`} style={on ? { backgroundColor: brandColor } : undefined}><Icon className="h-4 w-4" />{l}</button>
          })}
        </div>
      </div>

      {tab === 'org' && <OrgTab org={org} brandColor={brandColor} onSaved={fetchAll} />}
      {tab === 'modules' && <ModulesTab org={org} brandColor={brandColor} />}
      {tab === 'users' && <UsersTab users={users} depts={depts} brandColor={brandColor} onChanged={fetchAll} />}
      {tab === 'notifications' && <NotificationsTab brandColor={brandColor} />}
    </div>
  )
}

function NotificationsTab({ brandColor }) {
  const [team, setTeam] = useState(typeof window !== 'undefined' ? localStorage.getItem('wa_pharmacy_team') || '' : '')
  const [postConsult, setPostConsult] = useState(typeof window !== 'undefined' ? localStorage.getItem('wa_post_consultation') !== 'false' : true)
  const I = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none bg-white'
  const save = () => { try { localStorage.setItem('wa_pharmacy_team', team); localStorage.setItem('wa_post_consultation', String(postConsult)); toast.success('Notification settings saved') } catch { toast.error('Failed to save') } }
  return (
    <div className="space-y-3.5">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><strong>Current mode: wa.me links</strong> — after each action a WhatsApp chat opens with the message pre-filled; staff taps Send. No cost, no API needed.</div>
      <div className="rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-800"><MessageCircle className="h-4 w-4 text-emerald-600" />WhatsApp notifications</div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">Pharmacy team WhatsApp number</label><input className={I} value={team} onChange={e => setTeam(e.target.value)} placeholder="e.g. 9876543210" /><p className="text-[11px] text-gray-400">Notified when a new prescription is created.</p></div>
        <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5"><span className="text-sm text-gray-700">Post-consultation workflow prompt</span><input type="checkbox" checked={postConsult} onChange={e => setPostConsult(e.target.checked)} className="h-5 w-5" style={{ accentColor: brandColor }} /></label>
        <button onClick={save} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-white font-bold elev-2 active:scale-[.99] transition" style={{ backgroundColor: brandColor }}><Check className="h-5 w-5" />Save settings</button>
      </div>
      <div className="rounded-2xl bg-white p-3.5 elev-1 border border-gray-100/70">
        <p className="text-sm font-semibold text-gray-700 mb-1">Automatic sending (WhatsApp Business API)</p>
        <p className="text-[11px] text-gray-400">Set <code>WHATSAPP_API_KEY</code>, <code>WHATSAPP_API_URL</code> and <code>WHATSAPP_PROVIDER</code> (WATI / Twilio / Meta / 360dialog) in the backend <code>.env</code> to switch from wa.me links to automatic sending.</p>
      </div>
    </div>
  )
}

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry']
const ColorField = ({ label, value, onChange, placeholder, fallback }) => (
  <Field label={label}><div className="flex items-center gap-2"><input type="color" value={value || fallback || '#000000'} onChange={e => onChange(e.target.value)} className="h-10 w-12 rounded-lg border border-gray-200" /><input className={inp} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></div></Field>
)
function OrgTab({ org, brandColor, onSaved }) {
  const [f, setF] = useState({
    name: org.name || '', slug: org.slug || '', email: org.email || '', phone: org.phone || '', address: org.address || '', city: org.city || '', region: org.region || 'Maharashtra',
    openingTime: org.settings?.workingHours?.start || '08:00', closingTime: org.settings?.workingHours?.end || '17:00', appointmentDuration: String(org.settings?.appointmentDuration || 30),
    primaryColor: org.primaryColor || '#2563eb', secondaryColor: org.secondaryColor || '#7c3aed', navbarColor: org.settings?.navbarColor || '#ffffff', moduleHeaderColor: org.settings?.moduleHeaderColor || '', logoUrl: org.logoUrl || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  const save = async () => {
    if (!f.name) { toast.error('Hospital name is required'); return }
    setSaving(true)
    try {
      const res = await client.patch('/settings', {
        resource: 'organization', name: f.name, slug: f.slug || undefined, email: f.email, phone: f.phone, address: f.address, city: f.city, region: f.region,
        primaryColor: f.primaryColor, secondaryColor: f.secondaryColor, logoUrl: f.logoUrl || undefined,
        settings: { ...(org.settings || {}), workingHours: { start: f.openingTime, end: f.closingTime }, appointmentDuration: parseInt(f.appointmentDuration) || 30, navbarColor: f.navbarColor, moduleHeaderColor: f.moduleHeaderColor },
      })
      if (res?.success !== false) {
        toast.success('Organization saved')
        window.dispatchEvent(new CustomEvent('hospitalNameChange', { detail: f.name }))
        window.dispatchEvent(new CustomEvent('navbarColorChange', { detail: f.navbarColor }))
        window.dispatchEvent(new CustomEvent('brandingChange', { detail: { primaryColor: f.primaryColor, secondaryColor: f.secondaryColor, navbarColor: f.navbarColor, headerColor: f.moduleHeaderColor, hospitalName: f.name } }))
        onSaved?.()
      } else toast.error(res.error || 'Failed to save')
    } catch (e) { toast.error(e.message || 'Failed to save') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3.5 pt-1">
      <div className="rounded-2xl bg-white p-3.5 elev-1 border border-gray-100/70 space-y-3">
        <p className="text-sm font-bold text-gray-800">Hospital information</p>
        <Field label="Hospital name" req><input className={inp} value={f.name} onChange={e => set('name', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="URL slug"><input className={inp} value={f.slug} onChange={e => set('slug', e.target.value)} /></Field>
          <Field label="Email"><input type="email" className={inp} value={f.email} onChange={e => set('email', e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={inp} value={f.phone} onChange={e => set('phone', e.target.value)} /></Field>
          <Field label="City"><input className={inp} value={f.city} onChange={e => set('city', e.target.value)} /></Field>
        </div>
        <Field label="Address"><textarea rows={2} className={inp} value={f.address} onChange={e => set('address', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State"><select className={inp} value={f.region} onChange={e => set('region', e.target.value)}>{STATES.map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Country"><input className={`${inp} bg-gray-100 text-gray-500`} value="India" readOnly /></Field>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-3.5 elev-1 border border-gray-100/70 space-y-3">
        <p className="text-sm font-bold text-gray-800">Working hours</p>
        <div className="grid grid-cols-3 gap-2.5">
          <Field label="Opening"><input type="time" className={inp} value={f.openingTime} onChange={e => set('openingTime', e.target.value)} /></Field>
          <Field label="Closing"><input type="time" className={inp} value={f.closingTime} onChange={e => set('closingTime', e.target.value)} /></Field>
          <Field label="Appt (min)"><select className={inp} value={f.appointmentDuration} onChange={e => set('appointmentDuration', e.target.value)}>{['15', '30', '45', '60'].map(x => <option key={x} value={x}>{x}</option>)}</select></Field>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-3.5 elev-1 border border-gray-100/70 space-y-3">
        <p className="text-sm font-bold text-gray-800">Branding</p>
        <ColorField label="Primary colour" value={f.primaryColor} onChange={v => set('primaryColor', v)} />
        <ColorField label="Secondary colour" value={f.secondaryColor} onChange={v => set('secondaryColor', v)} />
        <ColorField label="Sidebar / navbar colour" value={f.navbarColor} onChange={v => set('navbarColor', v)} fallback="#ffffff" />
        <ColorField label="Module header colour" value={f.moduleHeaderColor} onChange={v => set('moduleHeaderColor', v)} fallback="#f0f4f8" placeholder="Leave blank for default" />
        <Field label="Hospital logo URL"><input className={inp} value={f.logoUrl} onChange={e => set('logoUrl', e.target.value)} placeholder="https://…/logo.png" /></Field>
      </div>

      <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Save organization</button>
      <p className="text-center text-[11px] text-gray-400">Brand colour updates the app instantly.</p>
    </div>
  )
}

function ModulesTab({ org, brandColor }) {
  const [modules, setModules] = useState(org.modulesEnabled || {})
  const [busy, setBusy] = useState(null)
  const toggle = async (key) => {
    const next = { ...modules, [key]: modules[key] === false ? true : false }
    setModules(next); setBusy(key)
    try {
      const res = await client.patch('/settings', { resource: 'organization', modulesEnabled: next })
      if (res?.success !== false) { window.dispatchEvent(new CustomEvent('modulesChange', { detail: next })); toast.success(`${key} ${next[key] === false ? 'disabled' : 'enabled'}`) }
      else { setModules(modules); toast.error(res.error || 'Failed') }
    } catch (e) { setModules(modules); toast.error(e.message || 'Failed') } finally { setBusy(null) }
  }
  return (
    <div className="space-y-2.5 pt-1">
      {ALL_MODULES.map(m => {
        const on = modules[m.key] !== false
        return (
          <div key={m.key} className="flex items-center justify-between rounded-2xl bg-white p-3.5 elev-1 border border-gray-100/70">
            <span className="text-sm font-medium text-gray-800">{m.label}</span>
            <button onClick={() => toggle(m.key)} disabled={busy === m.key} className={`relative h-6 w-11 rounded-full transition-colors ${on ? '' : 'bg-gray-200'}`} style={on ? { backgroundColor: brandColor } : undefined}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function UsersTab({ users, depts, brandColor, onChanged }) {
  const [form, setForm] = useState(null) // null | {} (new) | user (edit)

  const toggleStatus = async (u) => {
    try { const res = await client.patch('/settings', { resource: 'user-status', id: u.id, isActive: !u.isActive }); if (res?.success !== false) { toast.success('Status updated'); onChanged?.() } else toast.error(res.error || 'Failed') }
    catch (e) { toast.error(e.message || 'Failed') }
  }

  return (
    <div className="pt-1">
      <button onClick={() => setForm({})} className="mb-3 w-full flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold elev-2 active:scale-[.99] transition" style={{ color: brandColor }}><Plus className="h-4 w-4" />Add user</button>
      <div className="space-y-2.5 stagger">
        {users.map(u => (
          <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 elev-2 border border-gray-100/70">
            <div className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold text-white text-xs" style={{ backgroundColor: brandColor }}>{(u.fullName || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[14px] text-gray-900 truncate">{u.fullName}</p>
              <p className="text-[11px] text-gray-400 truncate">{ROLES[u.role] || u.role}{u.department?.name ? ` · ${u.department.name}` : ''}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>{u.isActive ? 'Active' : 'Inactive'}</span>
            <button onClick={() => setForm(u)} className="h-8 w-8 shrink-0 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center active:scale-90" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => toggleStatus(u)} className="h-8 w-8 shrink-0 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center active:scale-90" aria-label="Toggle status"><Power className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      {form && <UserSheet user={form.id ? form : null} depts={depts} brandColor={brandColor} onClose={() => setForm(null)} onSaved={() => { setForm(null); onChanged?.() }} />}
    </div>
  )
}

function UserSheet({ user, depts, brandColor, onClose, onSaved }) {
  const editing = !!user
  const [f, setF] = useState({ fullName: user?.fullName || '', email: user?.email || '', role: user?.role || 'doctor', departmentId: user?.departmentId || '', phone: user?.phone || '', specialization: user?.specialization || '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const submit = async () => {
    if (!f.fullName || !f.email || !f.role) { toast.error('Name, email and role are required'); return }
    setSaving(true)
    try {
      const body = { fullName: f.fullName, email: f.email, role: f.role, departmentId: f.departmentId || null, phone: f.phone || undefined, specialization: f.specialization || undefined }
      const res = editing
        ? await client.patch('/settings', { resource: 'user', id: user.id, ...body })
        : await client.post('/settings', { resource: 'user', organizationId: ORG_ID, ...body, isActive: true })
      if (res?.success !== false) { toast.success(editing ? 'User updated' : 'User added'); onSaved?.() } else toast.error(res.error || 'Failed')
    } catch (e) { toast.error(e.message || 'Failed to save user') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit user' : 'Add user'}</h3><button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3.5">
          <Field label="Full name" req><input className={inp} value={f.fullName} onChange={e => set('fullName', e.target.value)} /></Field>
          <Field label="Email" req><input type="email" className={inp} value={f.email} onChange={e => set('email', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role" req><select className={inp} value={f.role} onChange={e => set('role', e.target.value)}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Department"><select className={inp} value={f.departmentId} onChange={e => set('departmentId', e.target.value)}><option value="">—</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><input className={inp} value={f.phone} onChange={e => set('phone', e.target.value)} /></Field>
            <Field label="Specialization"><input className={inp} value={f.specialization} onChange={e => set('specialization', e.target.value)} /></Field>
          </div>
          <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{editing ? 'Save changes' : 'Add user'}</button>
        </div>
      </div>
    </div>
  )
}

function Centered({ title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade">
      <div className="h-20 w-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-4"><Building2 className="h-9 w-9 text-gray-400" /></div>
      <p className="font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[230px]">{sub}</p>
    </div>
  )
}
