import { useState, useEffect, useCallback } from 'react'
import { getOrgSettings } from '@/lib/orgSettings'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Users, Plus, Search, RefreshCw, Eye, Edit, UserPlus, Phone,
  Shield, Loader2, AlertTriangle, ChevronLeft, ChevronRight, Printer, Trash2
} from 'lucide-react'
import client from '@/api/client'

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry'
]

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const patientSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(2, 'Last name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['male', 'female', 'other']),
  phonePrimary: z.string().min(10, 'Valid phone number required'),
  phoneSecondary: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  region: z.string().optional(),
  zone: z.string().optional(),
  woreda: z.string().optional(),
  kebele: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  bloodGroup: z.string().optional(),
  hasInsurance: z.boolean().optional().default(false),
  insuranceProvider: z.string().optional(),
  insuranceId: z.string().optional(),
})

const getFullName = (p) => [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')
const calculateAge = (dob) => {
  const today = new Date()
  const birthDate = new Date(dob)
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}
const initials = (name) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

// Defined OUTSIDE PatientsModule so React never recreates the component type on re-render
function PatientForm({ form, isSubmitting, onSubmitFn, submitLabel }) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmitFn)} className="space-y-4">
        {/* Name */}
        <div className="grid grid-cols-3 gap-3">
          {['firstName', 'middleName', 'lastName'].map((name) => (
            <FormField key={name} control={form.control} name={name} render={({ field }) => (
              <FormItem>
                <FormLabel>{name === 'firstName' ? 'First Name *' : name === 'middleName' ? 'Middle Name' : 'Last Name *'}</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          ))}
        </div>

        {/* DOB & Gender */}
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
            <FormItem>
              <FormLabel>Date of Birth *</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="gender" render={({ field }) => (
            <FormItem>
              <FormLabel>Gender *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Phone & Email */}
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="phonePrimary" render={({ field }) => (
            <FormItem>
              <FormLabel>Phone (Primary) *</FormLabel>
              <FormControl><Input placeholder="+91XXXXXXXXXX" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* State & Blood Group */}
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="region" render={({ field }) => (
            <FormItem>
              <FormLabel>State / Region</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
                <SelectContent>
                  {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="bloodGroup" render={({ field }) => (
            <FormItem>
              <FormLabel>Blood Group</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                <SelectContent>
                  {BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormItem>
          )} />
        </div>

        {/* Emergency Contact */}
        <div className="grid grid-cols-3 gap-3">
          <FormField control={form.control} name="emergencyContactName" render={({ field }) => (
            <FormItem>
              <FormLabel>Emergency Contact</FormLabel>
              <FormControl><Input placeholder="Contact name" {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="emergencyContactPhone" render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Phone</FormLabel>
              <FormControl><Input placeholder="Phone number" {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="emergencyContactRelationship" render={({ field }) => (
            <FormItem>
              <FormLabel>Relationship</FormLabel>
              <FormControl><Input placeholder="e.g. Spouse" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>

        {/* Insurance */}
        <div className="grid grid-cols-3 gap-3">
          <FormField control={form.control} name="insuranceProvider" render={({ field }) => (
            <FormItem>
              <FormLabel>Insurance Provider</FormLabel>
              <FormControl><Input placeholder="e.g. Star Health" {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="insuranceId" render={({ field }) => (
            <FormItem>
              <FormLabel>Insurance ID</FormLabel>
              <FormControl><Input {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="hasInsurance" render={({ field }) => (
            <FormItem className="flex flex-col justify-end">
              <FormLabel>Has Insurance</FormLabel>
              <Select onValueChange={(v) => field.onChange(v === 'true')} value={String(field.value)}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

export default function PatientsModule() {
  const [patients, setPatients] = useState([])
  const [orgInfo, setOrgInfo] = useState({ name: 'Hospital', address: '', city: '', phone: '', email: '' })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [offset, setOffset] = useState(0)
  const limit = 20

  const [showRegDialog, setShowRegDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: '', middleName: '', lastName: '', dateOfBirth: '',
      gender: 'male', phonePrimary: '', phoneSecondary: '', email: '',
      region: '', zone: '', woreda: '', kebele: '',
      emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
      bloodGroup: '', hasInsurance: false, insuranceProvider: '', insuranceId: '',
    },
  })

  const fetchPatients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (status !== 'all') params.set('status', status)
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      const res = await client.get(`/patients?${params}`)
      setPatients(res.data ?? [])
      setTotal(res.meta?.total ?? 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, status, offset])

  useEffect(() => { fetchPatients() }, [fetchPatients])
  useEffect(() => { getOrgSettings().then(setOrgInfo) }, [])
  useEffect(() => { setOffset(0) }, [search, status])

  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true)
      const res = await client.post('/patients', data)
      toast.success(res.message || `Patient registered. UHID: ${res.data?.mrn}`)
      setShowRegDialog(false)
      form.reset()
      fetchPatients()
    } catch (err) {
      toast.error(err.message || 'Failed to register patient')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onEdit = async (data) => {
    if (!selectedPatient) return
    try {
      setIsSubmitting(true)
      await client.patch(`/patients/${selectedPatient.id}`, data)
      toast.success('Patient updated successfully')
      setShowEditDialog(false)
      fetchPatients()
    } catch (err) {
      toast.error(err.message || 'Failed to update patient')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEdit = (patient) => {
    setSelectedPatient(patient)
    form.reset({
      firstName: patient.firstName || '',
      middleName: patient.middleName || '',
      lastName: patient.lastName || '',
      dateOfBirth: patient.dateOfBirth ? format(new Date(patient.dateOfBirth), 'yyyy-MM-dd') : '',
      gender: patient.gender || 'male',
      phonePrimary: patient.phonePrimary || '',
      phoneSecondary: patient.phoneSecondary || '',
      email: patient.email || '',
      region: patient.region || '',
      zone: patient.zone || '',
      woreda: patient.woreda || '',
      kebele: patient.kebele || '',
      emergencyContactName: patient.emergencyContactName || '',
      emergencyContactPhone: patient.emergencyContactPhone || '',
      emergencyContactRelationship: patient.emergencyContactRelationship || '',
      bloodGroup: patient.bloodGroup || '',
      hasInsurance: patient.hasInsurance || false,
      insuranceProvider: patient.insuranceProvider || '',
      insuranceId: patient.insuranceId || '',
    })
    setShowEditDialog(true)
  }

  // Uses a hidden iframe instead of window.open to avoid popup blockers
  const handlePrintCard = (patient) => {
    const name = getFullName(patient)
    const age = patient.dateOfBirth ? `${calculateAge(patient.dateOfBirth)} Yrs` : '0 Yrs'
    const gender = patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : '—'
    const printedAt = format(new Date(), 'dd/MM/yyyy HH:mm')
    const dateStr = format(new Date(), 'dd / MM / yyyy')
    const orgAddr = [orgInfo.address, orgInfo.city].filter(Boolean).join(', ')
    const win = window.open('', '_blank', 'width=800,height=1050')
    if (!win) { toast.error('Please allow pop-ups to print'); return }
    win.document.write(`<!DOCTYPE html><html>
<head><title>Prescription — ${patient.mrn}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#000;background:#fff;padding:0}
.page{max-width:210mm;margin:0 auto;padding:10mm 12mm 8mm;min-height:297mm;position:relative}
.meta-top{display:flex;justify-content:space-between;font-size:8pt;color:#555;margin-bottom:6px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px}
.hosp-name{font-size:22pt;font-weight:bold;color:#1e3a8a;line-height:1}
.hosp-sub{font-size:9pt;color:#555;margin-top:2px}
.rx-logo{text-align:right}
.rx-big{font-size:36pt;font-weight:bold;font-style:italic;color:#1e3a8a;line-height:1;font-family:Georgia,serif}
.rx-label{font-size:8pt;font-weight:bold;color:#1e3a8a;letter-spacing:1px}
.blue-line{border-bottom:3px solid #1e3a8a;margin:6px 0 8px}
.dr-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-bottom:1px solid #333;padding-bottom:4px;margin-bottom:4px}
.dr-field{font-size:9pt}
.dr-label{color:#555;font-size:8pt}
.dr-line{border-bottom:1px solid #333;display:inline-block;width:140px;margin-left:2px}
.opd-no{text-align:right}
.opd-no .opd-label{font-size:8pt;font-weight:bold;color:#1e3a8a}
.opd-no .opd-val{font-size:11pt;font-weight:bold;color:#1e3a8a}
.date-row{text-align:right;font-size:9pt;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #ccc}
.date-val{font-weight:bold;font-size:10pt;color:#c00}
.patient-box{border:1px solid #333;margin-bottom:6px}
.pt-header{display:grid;grid-template-columns:2fr 1.5fr 1.5fr 1fr;border-bottom:1px solid #333}
.pt-cell{padding:4px 6px;border-right:1px solid #333;font-size:8.5pt}
.pt-cell:last-child{border-right:none}
.pt-label{font-size:7.5pt;font-weight:bold;background:#1e3a8a;color:#fff;padding:1px 4px;margin-bottom:2px;display:block}
.pt-val{font-weight:600;font-size:10pt}
.vitals-row{display:grid;grid-template-columns:repeat(7,1fr);border-top:1px solid #333}
.vt-cell{padding:3px 4px;border-right:1px solid #333;text-align:center;font-size:7.5pt}
.vt-cell:last-child{border-right:none}
.vt-lbl{font-weight:bold;color:#c00}
.vt-val{border-bottom:1px dotted #aaa;min-height:14px;margin-top:1px}
.section-title{font-size:8.5pt;font-weight:bold;color:#1e3a8a;text-transform:uppercase;letter-spacing:0.5px;margin:6px 0 2px;border-bottom:1px solid #1e3a8a;padding-bottom:1px}
.blank-line{border-bottom:1px solid #ccc;height:18px;margin-bottom:2px}
.rx-symbol{font-size:28pt;font-weight:bold;font-style:italic;color:#1e3a8a;font-family:Georgia,serif;line-height:1;margin-bottom:2px}
.rx-table{width:100%;border-collapse:collapse;margin-bottom:4px}
.rx-table th{font-size:8pt;font-weight:bold;color:#555;text-align:left;padding:2px 4px;border-bottom:1px solid #333}
.rx-table td{padding:2px 4px;border-bottom:1px dotted #ddd;height:22px;font-size:9pt}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:6px}
.follow-box{border:1.5px solid #f59e0b;border-radius:4px;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;background:#fffbeb;margin-bottom:8px}
.follow-label{font-size:8.5pt;font-weight:bold;color:#d97706}
.follow-line{border-bottom:1px solid #aaa;display:inline-block;width:200px;margin-left:4px}
.surgical{font-size:8.5pt;font-weight:bold;color:#d97706}
.sig-section{margin-top:12px;text-align:right}
.sig-line{border-bottom:1px solid #000;width:200px;display:inline-block;margin-bottom:3px}
.sig-label{font-size:8.5pt;color:#333}
.sig-dr{font-size:8pt;color:#555;border-top:1px dotted #aaa;width:200px;padding-top:2px;margin-top:2px}
.page-footer{position:absolute;bottom:8mm;left:12mm;right:12mm;border-top:1px solid #ccc;padding-top:4px;display:flex;justify-content:space-between;font-size:7.5pt;color:#777}
.print-btn{display:block;margin:16px auto 0;background:#1e3a8a;color:#fff;border:none;padding:9px 28px;font-size:13px;font-weight:600;border-radius:6px;cursor:pointer}
@media print{.print-btn{display:none}body{padding:0}.page{padding:8mm}}
</style></head>
<body>
<div class="page">
  <div class="meta-top">
    <span>${printedAt}</span>
    <span style="font-weight:bold;color:#1e3a8a">Prescription — ${patient.mrn}</span>
  </div>

  <div class="header">
    <div>
      <div class="hosp-name">${orgInfo.name || '123 Hospital'}</div>
      <div class="hosp-sub">OPD Prescription</div>
      <div class="hosp-sub" style="font-size:8pt;margin-top:2px">${orgAddr || ''}</div>
      <div class="hosp-sub" style="font-size:8pt">Tel: ${orgInfo.phone || '—'} | Email: ${orgInfo.email || '—'}</div>
    </div>
    <div class="rx-logo">
      <div class="rx-big">R<span style="font-size:18pt">x</span></div>
      <div class="rx-label">OPD PRESCRIPTION</div>
    </div>
  </div>
  <div class="blue-line"></div>

  <div style="display:grid;grid-template-columns:1fr auto;gap:16px;margin-bottom:4px">
    <div>
      <div style="font-size:9pt;margin-bottom:3px">Dr. <span class="dr-line" style="width:160px"></span> &nbsp;&nbsp; Department: <span class="dr-line" style="width:100px"></span></div>
      <div style="font-size:9pt">Qualification: <span class="dr-line" style="width:130px"></span> &nbsp;&nbsp; Reg. No: <span class="dr-line" style="width:100px"></span></div>
    </div>
    <div class="opd-no">
      <div class="opd-label">OPD NO.</div>
      <div class="opd-val">${patient.mrn}</div>
    </div>
  </div>

  <div class="date-row">Date: &nbsp;<span class="date-val">${dateStr}</span></div>

  <div class="patient-box">
    <div class="pt-header">
      <div class="pt-cell"><span class="pt-label">PATIENT NAME</span><span class="pt-val">${name}</span></div>
      <div class="pt-cell"><span class="pt-label">AGE / GENDER</span><span class="pt-val">${age} / ${gender}</span></div>
      <div class="pt-cell"><span class="pt-label">PHONE</span><span class="pt-val">${patient.phonePrimary || '—'}</span></div>
      <div class="pt-cell"><span class="pt-label">BLOOD GROUP</span><span class="pt-val" style="color:#c00">${patient.bloodGroup || '—'}</span></div>
    </div>
    <div class="vitals-row">
      <div class="vt-cell"><div class="vt-lbl">BP (MMHG)</div><div class="vt-val"></div></div>
      <div class="vt-cell"><div class="vt-lbl">PULSE (BPM)</div><div class="vt-val"></div></div>
      <div class="vt-cell"><div class="vt-lbl" style="color:#c00">TEMP (°C)</div><div class="vt-val"></div></div>
      <div class="vt-cell"><div class="vt-lbl">RR (/MIN)</div><div class="vt-val"></div></div>
      <div class="vt-cell"><div class="vt-lbl">SPO₂ (%)</div><div class="vt-val"></div></div>
      <div class="vt-cell"><div class="vt-lbl">WT (KG)</div><div class="vt-val"></div></div>
      <div class="vt-cell"><div class="vt-lbl">HT (CM)</div><div class="vt-val"></div></div>
    </div>
  </div>

  <div class="section-title">Diagnosis / Chief Complaint</div>
  <div class="blank-line"></div>
  <div class="blank-line"></div>

  <div style="margin:6px 0 2px">
    <div class="rx-symbol">R<span style="font-size:16pt">x</span></div>
    <table class="rx-table">
      <thead><tr><th style="width:24px">#</th><th>Medicine Name &amp; Strength</th><th>Dose / Frequency / Route</th><th>Duration</th></tr></thead>
      <tbody>
        ${[1,2,3,4,5,6,7].map(n => `<tr><td>${n}.</td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="two-col">
    <div>
      <div class="section-title">Advice / Instructions</div>
      <div class="blank-line"></div>
      <div class="blank-line"></div>
    </div>
    <div>
      <div class="section-title">Investigations / Tests Ordered</div>
      <div class="blank-line"></div>
      <div class="blank-line"></div>
    </div>
  </div>

  <div class="follow-box">
    <div><span class="follow-label">Follow-up Date:</span> <span class="follow-line"></span></div>
    <div class="surgical">Surgical Opinion Needed: &nbsp; YES &nbsp;/&nbsp; NO</div>
  </div>

  <div class="sig-section">
    <div class="sig-line"></div><br/>
    <div class="sig-label">Doctor Signature &amp; Stamp</div>
    <div class="sig-dr">Dr. ___________________________</div>
  </div>

  <div class="page-footer">
    <span>Patient: <strong>${name}</strong> | UHID: <strong style="color:#1e3a8a">${patient.mrn}</strong> | ${age} / ${gender}</span>
    <span>Printed: ${printedAt} &nbsp;|&nbsp; ${orgInfo.name || '123 Hospital'} — OPD Prescription</span>
  </div>
  <div style="text-align:center;font-size:7pt;color:#aaa;margin-top:8px">This prescription is valid for 30 days from the date of issue. Keep this slip for reference.</div>

  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</div>
</body></html>`)
    win.document.close()
  }

  const handleDeletePatient = async (patient) => {
    if (!window.confirm(`Delete patient "${getFullName(patient)}" (${patient.mrn})?\n\nThis will permanently remove all records. This cannot be undone.`)) return
    try {
      const res = await client.delete(`/patients/${patient.id}`)
      if (res.success) {
        toast.success(`Patient ${patient.mrn} deleted successfully`)
        fetchPatients()
      } else {
        toast.error(res.error || 'Failed to delete patient')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete patient')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-600" />
            Patients
          </h1>
          <p className="text-gray-500">Manage patient records and registrations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchPatients}>
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </Button>
          <Dialog open={showRegDialog} onOpenChange={(open) => { setShowRegDialog(open); if (!open) form.reset() }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Register Patient</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Register New Patient</DialogTitle>
                <DialogDescription>Fill in patient details. UHID will be auto-generated.</DialogDescription>
              </DialogHeader>
              <PatientForm form={form} isSubmitting={isSubmitting} onSubmitFn={onSubmit} submitLabel="Register Patient" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Patients', val: total, color: 'blue' },
          { label: 'Loaded', val: patients.length, color: 'green' },
          { label: 'Insured', val: patients.filter(p => p.hasInsurance).length, color: 'purple' },
          { label: 'VIP', val: patients.filter(p => p.isVip).length, color: 'amber' },
        ].map(({ label, val, color }) => (
          <Card key={label} className={`bg-${color}-50 border-${color}-200`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className={`text-sm text-${color}-600 font-medium`}>{label}</p>
                <p className={`text-2xl font-bold text-${color}-700`}>{val}</p>
              </div>
              <Users className={`h-8 w-8 text-${color}-400`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-10"
            placeholder="Search by name, UHID, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Patients</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-600 mb-3">{error}</p>
              <Button onClick={fetchPatients} variant="outline"><RefreshCw className="h-4 w-4 mr-2" />Retry</Button>
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No patients found</p>
              <Button className="mt-4" onClick={() => setShowRegDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />Register First Patient
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>UHID</TableHead>
                  <TableHead>Age / Gender</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Insurance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map(patient => {
                  const name = getFullName(patient)
                  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : '—'
                  return (
                    <TableRow key={patient.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-bold">
                              {initials(name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{name}</div>
                            {patient.isVip && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0 px-1 py-0">VIP</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{patient.mrn}</TableCell>
                      <TableCell>
                        <div>{age} yrs</div>
                        <div className="text-xs text-gray-500 capitalize">{patient.gender}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-gray-400" />
                          {patient.phonePrimary || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {patient.hasInsurance
                          ? <Badge className="bg-green-100 text-green-700 border-0"><Shield className="h-3 w-3 mr-1" />{patient.insuranceProvider || 'Insured'}</Badge>
                          : <Badge variant="outline" className="text-gray-400">None</Badge>
                        }
                      </TableCell>
                      <TableCell>
                        <Badge className={patient.isActive ? 'bg-green-100 text-green-700 border-0' : 'bg-gray-100 text-gray-500 border-0'}>
                          {patient.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="View"
                            onClick={() => { setSelectedPatient(patient); setShowViewDialog(true) }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" title="Edit"
                            onClick={() => openEdit(patient)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Print OPD Prescription"
                            onClick={() => handlePrintCard(patient)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Delete Patient"
                            onClick={() => handleDeletePatient(patient)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total} patients
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
              <ChevronLeft className="h-4 w-4 mr-1" />Previous
            </Button>
            <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
              Next<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold">
                  {initials(getFullName(selectedPatient))}
                </div>
                <div>
                  <p className="text-lg font-bold">{getFullName(selectedPatient)}</p>
                  <p className="text-sm text-gray-500">UHID: {selectedPatient.mrn}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Date of Birth', val: selectedPatient.dateOfBirth ? format(new Date(selectedPatient.dateOfBirth), 'dd MMM yyyy') : '—' },
                  { label: 'Age', val: selectedPatient.dateOfBirth ? `${calculateAge(selectedPatient.dateOfBirth)} years` : '—' },
                  { label: 'Gender', val: selectedPatient.gender },
                  { label: 'Blood Group', val: selectedPatient.bloodGroup || '—' },
                  { label: 'Phone', val: selectedPatient.phonePrimary || '—' },
                  { label: 'Email', val: selectedPatient.email || '—' },
                  { label: 'Region', val: selectedPatient.region || '—' },
                  { label: 'Insurance', val: selectedPatient.hasInsurance ? (selectedPatient.insuranceProvider || 'Yes') : 'No' },
                  { label: 'Emergency Contact', val: selectedPatient.emergencyContactName || '—' },
                  { label: 'Contact Phone', val: selectedPatient.emergencyContactPhone || '—' },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-gray-500 text-xs font-medium uppercase">{label}</p>
                    <p className="font-medium capitalize">{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>Close</Button>
            <Button onClick={() => { setShowViewDialog(false); if (selectedPatient) openEdit(selectedPatient) }}>
              <Edit className="h-4 w-4 mr-2" />Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
            <DialogDescription>Update patient details for {selectedPatient ? getFullName(selectedPatient) : ''}</DialogDescription>
          </DialogHeader>
          <PatientForm form={form} isSubmitting={isSubmitting} onSubmitFn={onEdit} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>
    </div>
  )
}
