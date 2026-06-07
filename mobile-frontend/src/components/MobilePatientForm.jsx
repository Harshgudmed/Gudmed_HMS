import { useState, useEffect } from 'react'
import client from '@/api/client'
import { toast } from 'sonner'
import { X, Check, Loader2, Users, Phone, MapPin, AlertCircle, Shield, Stethoscope } from 'lucide-react'

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
]
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const INSURANCE_PROVIDERS = [
  'CGHS', 'ESIC', 'PM-JAY (Ayushman Bharat)', 'Star Health', 'HDFC ERGO',
  'Niva Bupa', 'Care Health', 'ICICI Lombard', 'Bajaj Allianz', 'LIC Health',
  'United India', 'New India Assurance', 'Oriental Insurance', 'National Insurance',
  'Max Bupa', 'Reliance Health', 'SBI Health', 'Tata AIG',
]
const APPOINTMENT_TYPES = ['OPD', 'Emergency', 'Follow-up', 'Specialist', 'Teleconsultation', 'Procedure']
const PRIORITY_LEVELS = ['Routine', 'Urgent', 'Emergency', 'Critical']
const TYPE_MAP = { 'Follow-up': 'follow_up', Emergency: 'emergency' }
const PRIORITY_MAP = { Urgent: 'urgent', Emergency: 'urgent', Critical: 'urgent' }
const NON_CONSULTATION = new Set(['inpatient', 'ipd', 'radiology', 'laboratory', 'lab', 'pathology', 'pharmacy', 'billing', 'reception', 'administration', 'admin', 'store', 'inventory', 'nursing', 'housekeeping'])

const inp = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-gray-400 bg-white'
const fmtDob = (d) => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? '' : x.toISOString().slice(0, 10) }
const drName = (n) => `Dr. ${(n || '').replace(/^Dr\.?\s*/i, '')}`
const Field = ({ label, req, children }) => <div className="space-y-1.5"><label className="text-xs font-medium text-gray-500">{label}{req && <span className="text-rose-500"> *</span>}</label>{children}</div>
const Section = ({ Icon, title, children }) => <div className="rounded-2xl bg-gray-50 p-3.5 space-y-3"><p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Icon className="h-4 w-4" style={{ color: 'currentColor' }} />{title}</p>{children}</div>

export default function PatientFormSheet({ brandColor = '#2E4168', patient, onClose, onSaved }) {
  const editing = !!patient
  const initialProvider = patient?.insuranceProvider || ''
  const initialOther = !!initialProvider && !INSURANCE_PROVIDERS.includes(initialProvider)
  const [f, setF] = useState({
    firstName: patient?.firstName || '', middleName: patient?.middleName || '', lastName: patient?.lastName || '',
    gender: patient?.gender || 'male', dateOfBirth: fmtDob(patient?.dateOfBirth),
    phonePrimary: patient?.phonePrimary || '', email: patient?.email || '',
    houseNumber: patient?.houseNumber || '', kebele: patient?.kebele || '', zone: patient?.zone || '', region: patient?.region || '', postalCode: patient?.postalCode || '',
    emergencyContactName: patient?.emergencyContactName || '', emergencyContactPhone: patient?.emergencyContactPhone || '', emergencyContactRelationship: patient?.emergencyContactRelationship || '',
    bloodGroup: patient?.bloodGroup || '',
    hasInsurance: !!patient?.hasInsurance, providerSel: initialOther ? 'Other' : initialProvider, providerOther: initialOther ? initialProvider : '', insuranceId: patient?.insuranceId || '',
    // appointment (register only)
    department: '', doctor: '', appointmentType: 'OPD', priority: 'Routine', appointmentDate: '', appointmentTime: '', consultationFee: '',
  })
  const [doctors, setDoctors] = useState([])
  const [departments, setDepartments] = useState([])
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  useEffect(() => {
    if (editing) return
    client.get('/settings', { params: { resource: 'users' } }).then(r => setDoctors((r?.data || []).filter(u => u.role === 'doctor'))).catch(() => {})
    client.get('/settings', { params: { resource: 'departments' } }).then(r => setDepartments(r?.data || [])).catch(() => {})
  }, [editing])

  const doctorDeptIds = new Set(doctors.map(d => d.departmentId).filter(Boolean))
  const departmentOptions = departments.filter(d => doctorDeptIds.has(d.id) && !NON_CONSULTATION.has((d.name || '').trim().toLowerCase()))
  const availableDoctors = f.department ? doctors.filter(d => d.departmentId === f.department) : doctors

  const submit = async () => {
    if (!f.firstName || f.firstName.length < 2 || !f.lastName || f.lastName.length < 2) { toast.error('First and last name are required'); return }
    if (!f.dateOfBirth) { toast.error('Date of birth is required'); return }
    if (!f.phonePrimary || f.phonePrimary.length < 10) { toast.error('A valid primary phone is required'); return }
    if (f.hasInsurance && (!f.providerSel || (f.providerSel === 'Other' && !f.providerOther) || !f.insuranceId)) { toast.error('Insurance provider and policy number are required'); return }
    if (!editing && (!f.doctor || !f.appointmentDate)) { toast.error('Select a doctor and appointment date'); return }
    setSaving(true)
    try {
      const provider = f.hasInsurance ? (f.providerSel === 'Other' ? f.providerOther : f.providerSel) : ''
      const payload = {
        firstName: f.firstName, middleName: f.middleName || undefined, lastName: f.lastName,
        gender: f.gender, dateOfBirth: f.dateOfBirth, phonePrimary: f.phonePrimary, email: f.email || undefined,
        houseNumber: f.houseNumber || undefined, kebele: f.kebele || undefined, zone: f.zone || undefined, region: f.region || undefined, postalCode: f.postalCode || undefined,
        emergencyContactName: f.emergencyContactName || undefined, emergencyContactPhone: f.emergencyContactPhone || undefined, emergencyContactRelationship: f.emergencyContactRelationship || undefined,
        bloodGroup: f.bloodGroup || undefined,
        hasInsurance: f.hasInsurance,
        insuranceProvider: f.hasInsurance ? (provider || undefined) : undefined,
        insuranceId: f.hasInsurance ? (f.insuranceId || undefined) : undefined,
      }
      const res = editing ? await client.patch(`/patients/${patient.id}`, payload) : await client.post('/patients', payload)
      if (res.success === false) { toast.error(res.error || 'Failed'); setSaving(false); return }
      const saved = res.data || { ...patient, ...payload }

      // Register also books the first appointment (like desktop)
      let booked = false
      if (!editing && saved?.id && f.doctor && f.appointmentDate) {
        try {
          await client.post('/appointments', {
            patientId: saved.id, doctorId: f.doctor,
            ...(f.department ? { departmentId: f.department } : {}),
            appointmentDate: new Date(f.appointmentDate).toISOString(),
            appointmentTime: f.appointmentTime || '09:00', durationMinutes: 30,
            appointmentType: TYPE_MAP[f.appointmentType] || 'new_patient',
            priority: PRIORITY_MAP[f.priority] || 'normal',
            consultationFee: parseFloat(f.consultationFee) || undefined,
          })
          booked = true
        } catch (err) { toast.error(`Patient registered, but appointment booking failed: ${err.message || ''}`) }
      }
      toast.success(editing ? 'Patient updated' : booked ? `Registered ${saved.mrn || ''} & appointment booked` : `Patient registered${saved.mrn ? ` · ${saved.mrn}` : ''}`)
      onSaved?.(saved)
    } catch (e) { toast.error(e.message || 'Failed to save patient') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[94vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-7 animate-[slideUp_.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit patient' : 'Register new patient'}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          {/* Patient details */}
          <Section Icon={Users} title="Patient details">
            <Field label="First name" req><input className={inp} value={f.firstName} onChange={e => set('firstName', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Middle name"><input className={inp} value={f.middleName} onChange={e => set('middleName', e.target.value)} /></Field>
              <Field label="Last name" req><input className={inp} value={f.lastName} onChange={e => set('lastName', e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="DOB" req><input type="date" className={inp} value={f.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} /></Field>
              <Field label="Gender" req><select className={inp} value={f.gender} onChange={e => set('gender', e.target.value)}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
              <Field label="Blood"><select className={inp} value={f.bloodGroup} onChange={e => set('bloodGroup', e.target.value)}><option value="">—</option>{BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}</select></Field>
            </div>
          </Section>

          {/* Contact */}
          <Section Icon={Phone} title="Contact">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primary phone" req><input className={inp} value={f.phonePrimary} onChange={e => set('phonePrimary', e.target.value)} placeholder="+91 XXXXX XXXXX" /></Field>
              <Field label="Email"><input type="email" className={inp} value={f.email} onChange={e => set('email', e.target.value)} /></Field>
            </div>
          </Section>

          {/* Address */}
          <Section Icon={MapPin} title="Address">
            <div className="grid grid-cols-2 gap-3">
              <Field label="House / Flat / Building no."><input className={inp} value={f.houseNumber} onChange={e => set('houseNumber', e.target.value)} placeholder="e.g. 12-B" /></Field>
              <Field label="Village / Town"><input className={inp} value={f.kebele} onChange={e => set('kebele', e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="City / District"><input className={inp} value={f.zone} onChange={e => set('zone', e.target.value)} /></Field>
              <Field label="State"><select className={inp} value={f.region} onChange={e => set('region', e.target.value)}><option value="">Select</option>{INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
              <Field label="PIN code"><input className={inp} value={f.postalCode} onChange={e => set('postalCode', e.target.value)} inputMode="numeric" maxLength={6} /></Field>
            </div>
          </Section>

          {/* Emergency contact */}
          <Section Icon={AlertCircle} title="Emergency contact">
            <Field label="Contact name"><input className={inp} value={f.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact phone"><input className={inp} value={f.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)} /></Field>
              <Field label="Relationship"><input className={inp} value={f.emergencyContactRelationship} onChange={e => set('emergencyContactRelationship', e.target.value)} placeholder="e.g. Spouse" /></Field>
            </div>
          </Section>

          {/* Insurance */}
          <Section Icon={Shield} title="Insurance">
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.hasInsurance} onChange={e => set('hasInsurance', e.target.checked)} className="h-4 w-4" style={{ accentColor: brandColor }} />Patient has health insurance</label>
            {f.hasInsurance && (
              <div className="space-y-3">
                <Field label="Insurance provider" req><select className={inp} value={f.providerSel} onChange={e => set('providerSel', e.target.value)}><option value="">Select provider</option>{INSURANCE_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}<option value="Other">Other (type below)</option></select></Field>
                {f.providerSel === 'Other' && <Field label="Provider name (other)" req><input className={inp} value={f.providerOther} onChange={e => set('providerOther', e.target.value)} /></Field>}
                <Field label="Insurance ID / Policy no." req><input className={inp} value={f.insuranceId} onChange={e => set('insuranceId', e.target.value)} placeholder="e.g. POL123456789" /></Field>
              </div>
            )}
          </Section>

          {/* Appointment details — register only (books first appointment) */}
          {!editing && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-3">
              <p className="text-sm font-semibold text-blue-700 flex items-center gap-1.5"><Stethoscope className="h-4 w-4" />Appointment details</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Department"><select className={inp} value={f.department} onChange={e => setF(s => ({ ...s, department: e.target.value, doctor: '', consultationFee: '' }))}><option value="">{departmentOptions.length ? 'Select' : 'All'}</option>{departmentOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
                <Field label="Doctor" req><select className={inp} value={f.doctor} onChange={e => { const doc = availableDoctors.find(d => d.id === e.target.value); setF(s => ({ ...s, doctor: e.target.value, consultationFee: doc?.consultationFee != null ? String(doc.consultationFee) : '' })) }}><option value="">Select doctor</option>{availableDoctors.map(d => <option key={d.id} value={d.id}>{drName(d.fullName)}{d.consultationFee != null ? ` (₹${d.consultationFee})` : ''}</option>)}</select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Appointment type"><select className={inp} value={f.appointmentType} onChange={e => set('appointmentType', e.target.value)}>{APPOINTMENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Priority"><select className={inp} value={f.priority} onChange={e => set('priority', e.target.value)}>{PRIORITY_LEVELS.map(p => <option key={p}>{p}</option>)}</select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" req><input type="date" className={inp} value={f.appointmentDate} onChange={e => set('appointmentDate', e.target.value)} /></Field>
                <Field label="Time"><input type="time" className={inp} value={f.appointmentTime} onChange={e => set('appointmentTime', e.target.value)} /></Field>
              </div>
              <Field label="Consultation fee (₹)"><input type="number" readOnly tabIndex={-1} className={`${inp} bg-gray-100 text-gray-600`} value={f.consultationFee} placeholder="Set by selected doctor" /></Field>
            </div>
          )}

          <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-white font-bold elev-2 active:scale-[.99] transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{editing ? 'Save changes' : 'Register patient'}
          </button>
        </div>
      </div>
    </div>
  )
}
