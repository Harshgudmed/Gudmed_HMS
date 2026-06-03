import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, differenceInDays } from 'date-fns'
import { getOrgSettings } from '@/lib/orgSettings'
import { toast } from 'sonner'
import {
  BedDouble, Plus, Edit, Trash2, Search, Eye, RefreshCw, ArrowRight, LogOut,
  AlertCircle, Printer, FileText, ClipboardList, DollarSign, BarChart2,
  Loader2, Activity, Stethoscope, UserPlus, Building2, User, ChevronLeft, ChevronRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import client from '@/api/client'
import PatientLookup from '@/components/common/PatientLookup'

function admissionLabel(a) {
  if (!a?.id) return '—'
  return `ADM-${a.id.slice(-8).toUpperCase()}`
}

function getAdmissionWardId(a) {
  return a?.bed?.wardId || a?.bed?.ward?.id || null
}

function getWardName(wards, a) {
  const wid = getAdmissionWardId(a)
  return wards.find((w) => w.id === wid)?.name || a?.bed?.ward?.name || '—'
}

function printViaIframe(html) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;'
  document.body.appendChild(iframe)
  iframe.contentDocument.open()
  iframe.contentDocument.write(html)
  iframe.contentDocument.close()
  iframe.contentWindow.focus()
  setTimeout(() => {
    iframe.contentWindow.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }, 300)
}

const WARD_TYPES = ['General','Private','Semi-Private','ICU','NICU','Pediatric','Maternity','Emergency','Isolation']
const BED_TYPES = ['Standard','ICU','Isolation','Bariatric']
const ADMISSION_TYPES = ['Emergency','Elective','Transfer']
const DISCHARGE_CONDITIONS = ['Improved','Recovered','Unchanged','Worsened','Deceased','Transferred']
const NOTE_TYPES = ['Nursing','Doctor','Progress','Procedure','Observation']
const CHARGE_TYPES = ['Consultation','Procedure','Medication','Lab Test','Radiology','Other']

function bedStatusBadge(status) {
  const map = { available:'bg-green-100 text-green-800', occupied:'bg-red-100 text-red-800', maintenance:'bg-yellow-100 text-yellow-800', reserved:'bg-blue-100 text-blue-800' }
  return <Badge className={map[status]||'bg-gray-100 text-gray-800'}>{status}</Badge>
}

function admissionStatusBadge(status) {
  const map = { admitted:'bg-green-100 text-green-800', discharged:'bg-gray-100 text-gray-800', transferred:'bg-blue-100 text-blue-800' }
  return <Badge className={map[status]||'bg-gray-100 text-gray-800'}>{status}</Badge>
}

const emptyWard = { name:'', code:'', type:'General', capacity:10, floor:'', chargeNurse:'', phone:'' }
const emptyAdmission = { patientId:'', wardId:'', bedId:'', admissionType:'Emergency', admissionDiagnosis:'', chiefComplaint:'', expectedLengthOfStay:3, depositAmount:0, admissionNotes:'', isCritical:false }
const emptyDischarge = { dischargeDiagnosis:'', treatmentSummary:'', medicationsOnDischarge:'', followUpInstructions:'', dischargeCondition:'Improved', followUpDate:'', dischargeNotes:'' }
const emptyNote = { type:'Nursing', text:'', bp:'', temp:'', pulse:'', spo2:'', weight:'' }
const emptyCharge = { name:'', type:'Other', amount:'', quantity:1 }
const emptyAddBed = { wardId:'', bedNumber:'', type:'Standard' }

export default function InpatientModule() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [doctors, setDoctors] = useState([])
  const [wards, setWards] = useState([])
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [orgInfo, setOrgInfo] = useState({ name: 'Hospital', address: '', city: '', phone: '', email: '' })
  const [bedsTabWardId, setBedsTabWardId] = useState('')
  const [admitPatient, setAdmitPatient] = useState(null)
  const [statusFilter, setStatusFilter] = useState('admitted')
  const [wardFilter, setWardFilter] = useState('all')

  const [showWardDialog, setShowWardDialog] = useState(false)
  const [wardForm, setWardForm] = useState(emptyWard)
  const [editingWardId, setEditingWardId] = useState(null)
  const [savingWard, setSavingWard] = useState(false)

  const [showAdmitDialog, setShowAdmitDialog] = useState(false)
  const [admitForm, setAdmitForm] = useState(emptyAdmission)
  const [availableBeds, setAvailableBeds] = useState([])
  const [savingAdmission, setSavingAdmission] = useState(false)

  const [showDischargeDialog, setShowDischargeDialog] = useState(false)
  const [dischargeForm, setDischargeForm] = useState(emptyDischarge)
  const [selectedAdmission, setSelectedAdmission] = useState(null)
  const [savingDischarge, setSavingDischarge] = useState(false)

  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [transferForm, setTransferForm] = useState({ toWardId:'', toBedId:'', transferReason:'' })
  const [transferBeds, setTransferBeds] = useState([])
  const [savingTransfer, setSavingTransfer] = useState(false)

  const [showViewAdmission, setShowViewAdmission] = useState(false)
  const [viewAdmission, setViewAdmission] = useState(null)
  const [viewTab, setViewTab] = useState('details')

  const [clinicalNotes, setClinicalNotes] = useState([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [noteForm, setNoteForm] = useState(emptyNote)
  const [savingNote, setSavingNote] = useState(false)

  const [ipdBilling, setIpdBilling] = useState(null)
  const [loadingBilling, setLoadingBilling] = useState(false)
  const [billingDailyRate, setBillingDailyRate] = useState('')
  const [showAddChargeDialog, setShowAddChargeDialog] = useState(false)
  const [chargeForm, setChargeForm] = useState(emptyCharge)
  const [savingCharge, setSavingCharge] = useState(false)

  const [showAddBedDialog, setShowAddBedDialog] = useState(false)
  const [addBedForm, setAddBedForm] = useState(emptyAddBed)
  const [savingBed, setSavingBed] = useState(false)

  const [deleteWardConfirm, setDeleteWardConfirm] = useState(null)
  const [patientHistoryPage, setPatientHistoryPage] = useState(1)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [wRes, aRes, uRes] = await Promise.all([
        client.get('/inpatient?resource=wards'),
        client.get('/inpatient?resource=admissions'),
        client.get('/settings?resource=users'),
      ])
      if (wRes.success) {
        const wardList = wRes.data || []
        setWards(wardList)
        setBedsTabWardId((prev) => prev || (wardList[0]?.id ?? ''))
      }
      if (aRes.success) setAdmissions(aRes.data || [])
      if (uRes.success) setDoctors((uRes.data || []).filter(u => u.role === 'doctor' && u.isActive !== false))
    } catch (err) {
      setLoadError(err.message || 'Failed to load inpatient data')
      toast.error(err.message || 'Failed to load inpatient data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { getOrgSettings().then(setOrgInfo) }, [])
  useEffect(() => {
    const interval = setInterval(fetchAll, 60000)
    return () => clearInterval(interval)
  }, [fetchAll])

  useEffect(() => {
    setPatientHistoryPage(1)
  }, [activeTab])

  const fetchBedsForWard = async (wardId) => {
    if (!wardId) { setAvailableBeds([]); return }
    try {
      const res = await client.get('/inpatient', { params: { resource: 'beds', wardId, status: 'available' } })
      if (res.success) setAvailableBeds(res.data || [])
    } catch {
      setAvailableBeds([])
      toast.error('Could not load beds for this ward')
    }
  }

  const fetchTransferBeds = async (wardId) => {
    if (!wardId) { setTransferBeds([]); return }
    try {
      const res = await client.get('/inpatient', { params: { resource: 'beds', wardId, status: 'available' } })
      if (res.success) setTransferBeds(res.data || [])
    } catch { setTransferBeds([]) }
  }

  const fetchClinicalNotes = async (admissionId) => {
    setLoadingNotes(true)
    try {
      const res = await client.get('/inpatient', { params: { resource: 'notes', admissionId } })
      if (res.success) setClinicalNotes(res.data || [])
    } catch { setClinicalNotes([]) }
    finally { setLoadingNotes(false) }
  }

  const fetchIpdBilling = async (admissionId) => {
    setLoadingBilling(true)
    try {
      const res = await client.get('/inpatient', { params: { resource: 'billing', admissionId } })
      if (res.success) setIpdBilling(res.data || null)
    } catch { setIpdBilling(null) }
    finally { setLoadingBilling(false) }
  }

  const openViewAdmission = (a) => {
    setViewAdmission(a)
    setViewTab('details')
    setClinicalNotes([])
    setIpdBilling(null)
    setBillingDailyRate('')
    setNoteForm(emptyNote)
    setShowViewAdmission(true)
  }

  const handleViewTabChange = (tab) => {
    setViewTab(tab)
    if (!viewAdmission) return
    if (tab === 'notes') fetchClinicalNotes(viewAdmission.id)
    if (tab === 'billing') fetchIpdBilling(viewAdmission.id)
  }

  const syncWardBeds = async (ward) => {
    try {
      const res = await client.post('/inpatient', { resource: 'sync-beds', wardId: ward.id })
      if (res.success) { toast.success(`Beds synced for ${ward.name}`); fetchAll() }
      else toast.error(res.error || 'Failed to sync beds')
    } catch (err) { toast.error(err.message || 'Failed to sync beds') }
  }

  const updateBedStatus = async (bedId, status) => {
    try {
      const res = await client.patch('/inpatient', { resource: 'bed', id: bedId, status })
      if (res.success) { toast.success('Bed updated'); fetchAll() }
      else toast.error(res.error || 'Failed to update bed')
    } catch (err) { toast.error(err.message || 'Failed to update bed') }
  }

  const handleSaveWard = async () => {
    if (!wardForm.name || !wardForm.code) { toast.error('Name and code required'); return }
    setSavingWard(true)
    try {
      const payload = { resource:'ward', ...wardForm, capacity:parseInt(wardForm.capacity)||10 }
      const res = editingWardId
        ? await client.patch('/inpatient', { ...payload, id: editingWardId })
        : await client.post('/inpatient', payload)
      if (res.success) { toast.success(editingWardId?'Ward updated':'Ward created'); setShowWardDialog(false); setWardForm(emptyWard); setEditingWardId(null); fetchAll() }
      else toast.error(res.error||'Failed')
    } catch { toast.error('Failed to save ward') }
    setSavingWard(false)
  }

  const handleDeleteWard = async (ward) => {
    try {
      const res = await client.delete('/inpatient', { params: { resource: 'ward', id: ward.id } })
      if (res.success) { toast.success('Ward deleted'); setDeleteWardConfirm(null); fetchAll() }
      else toast.error(res.error||'Failed')
    } catch { toast.error('Failed to delete') }
  }

  const handleAdmit = async () => {
    if (!admitForm.patientId || !admitForm.wardId || !admitForm.bedId || !admitForm.admissionDiagnosis) { toast.error('Fill all required fields'); return }
    setSavingAdmission(true)
    try {
      const res = await client.post('/inpatient', { resource:'admission', ...admitForm, expectedLengthOfStay:parseInt(admitForm.expectedLengthOfStay)||3, depositAmount:parseFloat(admitForm.depositAmount)||0 })
      if (res.success) { toast.success('Patient admitted'); setShowAdmitDialog(false); setAdmitForm(emptyAdmission); fetchAll() }
      else toast.error(res.error||'Failed to admit')
    } catch { toast.error('Failed to admit patient') }
    setSavingAdmission(false)
  }

  const handleDischarge = async () => {
    if (!dischargeForm.dischargeDiagnosis || !dischargeForm.dischargeCondition) { toast.error('Fill discharge diagnosis and condition'); return }
    if (!selectedAdmission) return
    setSavingDischarge(true)
    try {
      const res = await client.patch('/inpatient', { resource: 'discharge', id: selectedAdmission.id, ...dischargeForm })
      if (res.success) { toast.success('Patient discharged'); setShowDischargeDialog(false); setDischargeForm(emptyDischarge); setSelectedAdmission(null); fetchAll() }
      else toast.error(res.error||'Failed')
    } catch { toast.error('Failed to discharge patient') }
    setSavingDischarge(false)
  }

  const handleTransfer = async () => {
    if (!transferForm.toWardId || !transferForm.toBedId) { toast.error('Select target ward and bed'); return }
    if (!selectedAdmission) return
    setSavingTransfer(true)
    try {
      const res = await client.post('/inpatient', { resource:'transfer', admissionId:selectedAdmission.id, ...transferForm })
      if (res.success) { toast.success('Patient transferred'); setShowTransferDialog(false); setTransferForm({ toWardId:'', toBedId:'', transferReason:'' }); setSelectedAdmission(null); fetchAll() }
      else toast.error(res.error||'Failed')
    } catch { toast.error('Failed to transfer patient') }
    setSavingTransfer(false)
  }

  const handleAddNote = async () => {
    if (!noteForm.text) { toast.error('Note text required'); return }
    setSavingNote(true)
    try {
      const res = await client.post('/inpatient', {
        resource: 'note', admissionId: viewAdmission.id,
        type: noteForm.type, text: noteForm.text,
        vitals: { bp: noteForm.bp, temp: noteForm.temp, pulse: noteForm.pulse, spo2: noteForm.spo2, weight: noteForm.weight }
      })
      if (res.success) { toast.success('Note added'); setNoteForm(emptyNote); fetchClinicalNotes(viewAdmission.id) }
      else toast.error(res.error || 'Failed to add note')
    } catch { toast.error('Failed to add note') }
    setSavingNote(false)
  }

  const handleGenerateBill = async () => {
    if (!billingDailyRate) { toast.error('Enter daily room rate'); return }
    try {
      const res = await client.post('/inpatient', { resource: 'billing', admissionId: viewAdmission.id, dailyRate: parseFloat(billingDailyRate) || 0 })
      if (res.success) { toast.success('Bill generated'); fetchIpdBilling(viewAdmission.id) }
      else toast.error(res.error || 'Failed to generate bill')
    } catch { toast.error('Failed to generate bill') }
  }

  const handleAddCharge = async () => {
    if (!chargeForm.name || !chargeForm.amount) { toast.error('Name and amount required'); return }
    if (!ipdBilling?.id) { toast.error('Generate a bill first'); return }
    setSavingCharge(true)
    try {
      const res = await client.post('/inpatient', { resource: 'charge', billingId: ipdBilling.id, name: chargeForm.name, type: chargeForm.type, amount: parseFloat(chargeForm.amount) || 0, quantity: parseInt(chargeForm.quantity) || 1 })
      if (res.success) { toast.success('Charge added'); setChargeForm(emptyCharge); setShowAddChargeDialog(false); fetchIpdBilling(viewAdmission.id) }
      else toast.error(res.error || 'Failed to add charge')
    } catch { toast.error('Failed to add charge') }
    setSavingCharge(false)
  }

  const handleAddBed = async () => {
    if (!addBedForm.wardId || !addBedForm.bedNumber) { toast.error('Ward and bed number required'); return }
    setSavingBed(true)
    try {
      const res = await client.post('/inpatient', { resource: 'bed', ...addBedForm })
      if (res.success) { toast.success('Bed added'); setShowAddBedDialog(false); setAddBedForm(emptyAddBed); fetchAll() }
      else toast.error(res.error || 'Failed to add bed')
    } catch { toast.error('Failed to add bed') }
    setSavingBed(false)
  }

  const handlePrintAdmissionSlip = (adm) => {
    const wardName = getWardName(wards, adm)
    const admDate = adm.admissionDate ? format(new Date(adm.admissionDate), 'dd MMM yyyy, hh:mm a') : '—'
    printViaIframe(`<!DOCTYPE html><html><head><title>Admission Slip</title>
<style>body{font-family:Arial,sans-serif;font-size:13px;padding:24px;color:#222}h2{text-align:center;margin-bottom:4px;font-size:18px}.sub{text-align:center;color:#666;font-size:11px;margin-bottom:16px}table{width:100%;border-collapse:collapse;margin-bottom:12px}td{padding:5px 8px;border:1px solid #ddd}td:first-child{background:#f5f5f5;font-weight:600;width:38%}.diag{background:#fffbe6;border:1px solid #ffe58f;padding:8px 10px;border-radius:4px;margin:8px 0}.footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px}@media print{body{padding:10px}}</style>
</head><body>
<h2>Admission Slip</h2>
<div class="sub">${orgInfo.name} &nbsp;·&nbsp; Generated ${format(new Date(),'dd MMM yyyy, hh:mm a')}</div>
<table>
<tr><td>Patient Name</td><td>${adm.patient?.firstName||''} ${adm.patient?.lastName||''}</td></tr>
<tr><td>UHID</td><td>${adm.patient?.mrn||'—'}</td></tr>
<tr><td>Admission #</td><td>${admissionLabel(adm)}</td></tr>
<tr><td>Admission Date</td><td>${admDate}</td></tr>
<tr><td>Ward</td><td>${wardName}</td></tr>
<tr><td>Bed Number</td><td>${adm.bed?.bedNumber||'—'}</td></tr>
<tr><td>Admission Type</td><td>${adm.admissionType||'—'}</td></tr>
<tr><td>Expected Stay</td><td>${adm.expectedLengthOfStay||'—'} day(s)</td></tr>
<tr><td>Deposit Paid</td><td>₹${(adm.depositAmount||0).toLocaleString()}</td></tr>
${adm.isCritical?'<tr><td>Status</td><td style="color:red;font-weight:bold">CRITICAL</td></tr>':''}
</table>
<div class="diag"><strong>Admission Diagnosis:</strong><br/>${adm.admissionDiagnosis||'—'}</div>
${adm.chiefComplaint?`<div class="diag"><strong>Chief Complaint:</strong><br/>${adm.chiefComplaint}</div>`:''}
${adm.admissionNotes?`<div class="diag"><strong>Notes:</strong><br/>${adm.admissionNotes}</div>`:''}
<div class="footer">This is a computer-generated admission slip.</div>
</body></html>`)
  }

  const handlePrintDischargeSummary = (adm) => {
    const wardName = getWardName(wards, adm)
    const admDate = adm.admissionDate ? format(new Date(adm.admissionDate), 'dd MMM yyyy') : 'N/A'
    const disDate = adm.dischargeDate ? format(new Date(adm.dischargeDate), 'dd MMM yyyy') : 'N/A'
    const days = adm.admissionDate && adm.dischargeDate ? differenceInDays(new Date(adm.dischargeDate), new Date(adm.admissionDate)) : adm.admissionDate ? differenceInDays(new Date(), new Date(adm.admissionDate)) : 0
    const patAge = adm.patient?.dateOfBirth ? Math.floor(differenceInDays(new Date(), new Date(adm.patient.dateOfBirth)) / 365) + ' yrs' : '—'
    const printDate = format(new Date(), 'dd MMM yyyy HH:mm')
    const orgAddr = [orgInfo.address, orgInfo.city].filter(Boolean).join(', ')

    const win = window.open('', '_blank', 'width=900,height=780')
    if (!win) { toast.error('Please allow pop-ups to print'); return }

    win.document.write(`<!DOCTYPE html><html>
<head><title>Discharge Summary — ${adm.patient?.firstName} ${adm.patient?.lastName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#222;background:#f0f0f0;padding:20px}
.page{max-width:860px;margin:0 auto;background:#fff;padding:30px;box-shadow:0 2px 12px rgba(0,0,0,0.15)}
.header{border-bottom:3px solid #1e3a8a;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start}
.hosp-name{font-size:22px;font-weight:bold;color:#1e3a8a}
.hosp-sub{font-size:11px;color:#666;margin-top:3px}
.meta{font-size:11px;color:#666;text-align:right;line-height:1.7}
.title-bar{text-align:center;margin:0 0 20px}
.title-bar h1{font-size:18px;font-weight:700;letter-spacing:3px;color:#1e3a8a;border:2px solid #1e3a8a;display:inline-block;padding:6px 30px}
.section-title{font-size:11px;font-weight:700;color:#1e3a8a;text-transform:uppercase;letter-spacing:1px;border-bottom:1.5px solid #1e3a8a;padding-bottom:3px;margin:16px 0 8px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}
.field{margin-bottom:6px}
.field-label{font-size:10px;color:#888;text-transform:uppercase;font-weight:600;letter-spacing:0.5px}
.field-value{font-size:13px;color:#111;font-weight:500;margin-top:1px}
.field-value.placeholder{color:#bbb;font-style:italic}
.text-block{border:1px solid #e5e7eb;border-radius:4px;padding:10px 12px;min-height:50px;font-size:12px;line-height:1.6;white-space:pre-wrap;color:#333;background:#fafafa}
.text-block.empty{color:#ccc;font-style:italic}
.lines{margin-top:4px}
.line{border-bottom:1px solid #e5e7eb;height:22px;margin-bottom:4px}
.sig-row{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px;padding-top:16px;border-top:2px solid #333}
.sig-line{border-bottom:1px solid #555;height:40px;margin-bottom:6px}
.sig-label{font-size:10px;color:#666;text-align:center}
.print-btn{display:block;margin:20px auto 0;background:#1e3a8a;color:#fff;border:none;padding:10px 30px;font-size:14px;font-weight:600;border-radius:6px;cursor:pointer}
.footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb}
@media print{body{background:#fff;padding:0}.page{box-shadow:none;padding:15px}.print-btn{display:none}}
</style></head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="hosp-name">${orgInfo.name || '123 Hospital'}</div>
      <div class="hosp-sub">Inpatient Department${orgAddr ? ' | ' + orgAddr : ''}${orgInfo.phone ? ' | ' + orgInfo.phone : ''}</div>
    </div>
    <div class="meta">
      Printed: ${printDate}<br/>
      Admission #: <strong>${admissionLabel(adm)}</strong>
    </div>
  </div>

  <div class="title-bar"><h1>DISCHARGE SUMMARY</h1></div>

  <div class="section-title">Patient Information</div>
  <div class="grid2">
    <div class="field"><div class="field-label">Patient Name</div><div class="field-value">${adm.patient?.firstName || ''} ${adm.patient?.lastName || ''}</div></div>
    <div class="field"><div class="field-label">UHID</div><div class="field-value">${adm.patient?.mrn || '—'}</div></div>
    <div class="field"><div class="field-label">Age / Gender</div><div class="field-value">${patAge} / ${adm.patient?.gender || '—'}</div></div>
    <div class="field"><div class="field-label">Phone</div><div class="field-value">${adm.patient?.phonePrimary || '—'}</div></div>
  </div>

  <div class="section-title">Admission Details</div>
  <div class="grid2">
    <div class="field"><div class="field-label">Admission Date</div><div class="field-value">${admDate}</div></div>
    <div class="field"><div class="field-label">Discharge Date</div><div class="field-value">${disDate}</div></div>
    <div class="field"><div class="field-label">Ward / Bed</div><div class="field-value">${wardName} — Bed ${adm.bed?.bedNumber || '—'}</div></div>
    <div class="field"><div class="field-label">Admission Type</div><div class="field-value">${adm.admissionType || '—'}</div></div>
    <div class="field"><div class="field-label">Length of Stay</div><div class="field-value">${days} days</div></div>
    <div class="field"><div class="field-label">Attending Doctor</div><div class="field-value">${adm.attendingDoctor || '—'}</div></div>
  </div>

  <div class="section-title">Diagnosis</div>
  <div class="field" style="margin-bottom:8px"><div class="field-label">Admission Diagnosis</div><div class="field-value">${adm.admissionDiagnosis || '—'}</div></div>
  <div class="field"><div class="field-label">Discharge Diagnosis</div><div class="field-value ${!adm.dischargeDiagnosis ? 'placeholder' : ''}">${adm.dischargeDiagnosis || 'Not recorded'}</div></div>

  <div class="section-title">Clinical Summary / Treatment Provided</div>
  ${adm.treatmentSummary
    ? `<div class="text-block">${adm.treatmentSummary}</div>`
    : `<div class="text-block empty">Not recorded</div><div class="lines"><div class="line"></div><div class="line"></div></div>`}

  <div class="section-title">Medications on Discharge</div>
  ${adm.medicationsOnDischarge
    ? `<div class="text-block">${adm.medicationsOnDischarge}</div>`
    : `<div class="text-block empty">Not recorded</div><div class="lines"><div class="line"></div><div class="line"></div></div>`}

  <div class="section-title">Discharge Instructions / Follow-Up</div>
  ${adm.followUpInstructions
    ? `<div class="text-block">${adm.followUpInstructions}</div>`
    : `<div class="text-block empty">Not recorded</div><div class="lines"><div class="line"></div></div>`}
  <div class="field" style="margin-top:8px">
    <div class="field-label">Follow-up Date</div>
    <div class="field-value ${!adm.followUpDate ? 'placeholder' : ''}">${adm.followUpDate ? format(new Date(adm.followUpDate), 'dd MMM yyyy') : 'Not scheduled'}</div>
  </div>

  ${adm.dischargeNotes ? `<div class="section-title">Additional Notes</div><div class="text-block">${adm.dischargeNotes}</div>` : ''}

  <div class="sig-row">
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Attending Physician Signature</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Authorized Hospital Signatory &amp; Stamp</div>
    </div>
  </div>

  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  <div class="footer">This is a computer-generated document. &nbsp;|&nbsp; ${orgInfo.name} &nbsp;|&nbsp; Generated: ${printDate}</div>
</div>
</body></html>`)
    win.document.close()
  }

  const handlePrintFinalBill = (adm) => {
    if (!ipdBilling) { toast.error('No billing record found. Generate a bill first.'); return }
    const wardName = getWardName(wards, adm)
    const admDate = adm.admissionDate ? format(new Date(adm.admissionDate), 'dd MMM yyyy') : '—'
    const disDate = adm.dischargeDate ? format(new Date(adm.dischargeDate), 'dd MMM yyyy') : format(new Date(), 'dd MMM yyyy')
    const days = adm.admissionDate ? differenceInDays(adm.dischargeDate ? new Date(adm.dischargeDate) : new Date(), new Date(adm.admissionDate)) : 0
    const roomCharge = (ipdBilling.dailyRate || 0) * days
    const extraCharges = (ipdBilling.charges || []).reduce((s, c) => s + ((c.amount || 0) * (c.quantity || 1)), 0)
    const total = roomCharge + extraCharges
    const chargesRows = (ipdBilling.charges || []).map(c =>
      `<tr><td>${c.name}</td><td>${c.type||''}</td><td>${c.quantity||1}</td><td>₹${(c.amount||0).toLocaleString()}</td><td>₹${((c.amount||0)*(c.quantity||1)).toLocaleString()}</td></tr>`
    ).join('')
    printViaIframe(`<!DOCTYPE html><html><head><title>IPD Final Bill</title>
<style>body{font-family:Arial,sans-serif;font-size:13px;padding:24px;color:#222}h2{text-align:center;margin-bottom:4px;font-size:18px}.sub{text-align:center;color:#666;font-size:11px;margin-bottom:16px}h3{font-size:13px;margin:14px 0 4px;border-bottom:1px solid #ddd;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{padding:6px 8px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5;font-weight:600}.total{font-weight:bold;background:#e8f5e9}.footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px}@media print{body{padding:10px}}</style>
</head><body>
<h2>IPD Final Bill</h2>
<div class="sub">${orgInfo.name} &nbsp;·&nbsp; Generated ${format(new Date(),'dd MMM yyyy, hh:mm a')}</div>
<h3>Patient Details</h3>
<table>
<tr><td width="38%" style="background:#f5f5f5;font-weight:600">Patient Name</td><td>${adm.patient?.firstName||''} ${adm.patient?.lastName||''}</td></tr>
<tr><td style="background:#f5f5f5;font-weight:600">UHID</td><td>${adm.patient?.mrn||'—'}</td></tr>
<tr><td style="background:#f5f5f5;font-weight:600">Admission #</td><td>${admissionLabel(adm)}</td></tr>
<tr><td style="background:#f5f5f5;font-weight:600">Ward / Bed</td><td>${wardName} · Bed ${adm.bed?.bedNumber||'—'}</td></tr>
<tr><td style="background:#f5f5f5;font-weight:600">Period</td><td>${admDate} → ${disDate} (${days} days)</td></tr>
<tr><td style="background:#f5f5f5;font-weight:600">Deposit Paid</td><td>₹${(adm.depositAmount||0).toLocaleString()}</td></tr>
</table>
<h3>Billing Details</h3>
<table>
<tr><th>Item</th><th>Type</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
<tr><td>Room Charges (${days} days × ₹${(ipdBilling.dailyRate||0).toLocaleString()}/day)</td><td>Room</td><td>${days}</td><td>₹${(ipdBilling.dailyRate||0).toLocaleString()}</td><td>₹${roomCharge.toLocaleString()}</td></tr>
${chargesRows}
<tr class="total"><td colspan="4" style="text-align:right">Total</td><td>₹${total.toLocaleString()}</td></tr>
<tr><td colspan="4" style="text-align:right">Deposit Paid</td><td>₹${(adm.depositAmount||0).toLocaleString()}</td></tr>
<tr class="total"><td colspan="4" style="text-align:right">Net Payable</td><td>₹${Math.max(0,total-(adm.depositAmount||0)).toLocaleString()}</td></tr>
</table>
<div class="footer">This is a computer-generated bill.</div>
</body></html>`)
  }

  const filteredAdmissions = admissions.filter(a => {
    const q = searchQuery.toLowerCase()
    const name = `${a.patient?.firstName||''} ${a.patient?.lastName||''}`.toLowerCase()
    const matchSearch = !q || name.includes(q) || (a.patient?.mrn||'').toLowerCase().includes(q) || (a.admissionNumber||'').toLowerCase().includes(q)
    const matchStatus = statusFilter==='all' || a.status===statusFilter
    const matchWard = wardFilter === 'all' || getAdmissionWardId(a) === wardFilter
    return matchSearch && matchStatus && matchWard
  })

  const allBeds = wards.flatMap((w) => w.beds || [])
  const stats = {
    totalBeds: allBeds.length || wards.reduce((s, w) => s + (w.capacity || 0), 0),
    occupiedBeds: allBeds.filter((b) => b.status === 'occupied').length,
    admitted: admissions.filter((a) => a.status === 'admitted').length,
    criticalPatients: admissions.filter((a) => a.status === 'admitted' && a.isCritical).length,
  }
  const occupancyPct = stats.totalBeds > 0 ? Math.round((stats.occupiedBeds / stats.totalBeds) * 100) : 0
  const bedsTabWard = wards.find((w) => w.id === bedsTabWardId)
  const bedsTabList = bedsTabWard?.beds || []

  const TABS = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'wards-beds', label: 'Wards & Beds' },
    { value: 'admissions', label: 'Admissions' },
    { value: 'new-admission', label: 'New Admission' },
    { value: 'discharge', label: 'Discharge' },
    { value: 'movement', label: 'Movement' },
    { value: 'patient-history', label: 'Patient History' },
  ]

  const currentAdmitted = admissions.filter(a => a.status === 'admitted')
  const pendingDischarges = admissions.filter(a => a.status === 'admitted' && a.expectedDischargeDate && new Date(a.expectedDischargeDate) <= new Date())
  const dischargedList = admissions.filter(a => a.status === 'discharged')
  const transferredList = admissions.filter(a => a.status === 'transferred')

  return (
    <div className="-m-6 min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BedDouble className="h-5 w-5 text-blue-600" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Inpatient Management</h1>
            <p className="text-xs text-gray-500">Ward and bed management, admissions, and patient tracking</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setActiveTab('new-admission'); setAdmitPatient(null); setAdmitForm(emptyAdmission); setAvailableBeds([]) }}>
            <UserPlus className="h-4 w-4 mr-1" />New Admission
          </Button>
          <Button size="sm" onClick={() => { setEditingWardId(null); setWardForm(emptyWard); setShowWardDialog(true) }}>
            <Plus className="h-4 w-4 mr-1" />Add Ward
          </Button>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="bg-white border-b flex">
        {TABS.map(t => (
          <button key={t.value} onClick={() => setActiveTab(t.value)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.value ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="p-6 space-y-6">

        {/* ════════════════════ DASHBOARD ════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top stat cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-bold text-blue-600">{stats.totalBeds}</p>
                      <p className="text-sm text-gray-500 mt-1">Total Beds</p>
                    </div>
                    <BedDouble className="h-8 w-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-bold text-red-500">{stats.occupiedBeds}</p>
                      <p className="text-sm text-gray-500 mt-1">Occupied</p>
                    </div>
                    <Activity className="h-8 w-8 text-red-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-bold text-green-600">{stats.totalBeds - stats.occupiedBeds}</p>
                      <p className="text-sm text-gray-500 mt-1">Available</p>
                    </div>
                    <Building2 className="h-8 w-8 text-green-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-bold text-purple-600">{occupancyPct}%</p>
                      <p className="text-sm text-gray-500 mt-1">Occupancy Rate</p>
                    </div>
                    <BarChart2 className="h-8 w-8 text-purple-200" />
                  </div>
                  <Progress value={occupancyPct} className="mt-2 h-1" />
                </CardContent>
              </Card>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-orange-400">
                <CardContent className="pt-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Today's Admissions</p>
                  <p className="text-3xl font-bold text-orange-500">{currentAdmitted.length}</p>
                  {currentAdmitted.slice(0, 2).map(a => (
                    <p key={a.id} className="text-xs text-orange-600 mt-1">{a.patient?.firstName} {a.patient?.lastName} · {a.bed?.ward?.name || '—'}</p>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-400">
                <CardContent className="pt-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Pending Discharges</p>
                  <p className="text-3xl font-bold text-blue-500">{currentAdmitted.length}</p>
                  {currentAdmitted.slice(0, 1).map(a => (
                    <p key={a.id} className="text-xs text-blue-600 mt-1">{a.patient?.firstName} {a.patient?.lastName} · TBD</p>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-red-400">
                <CardContent className="pt-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Critical Patients</p>
                  <p className="text-3xl font-bold text-red-500">{stats.criticalPatients}</p>
                </CardContent>
              </Card>
            </div>

            {/* Ward Overview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" />Ward Overview</h2>
                  <p className="text-xs text-gray-500">Current status of all wards</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw className="h-3.5 w-3.5 mr-1" />Print Census</Button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {wards.map(w => {
                  const beds = w.beds || []
                  const occ = beds.filter(b => b.status === 'occupied').length
                  const total = beds.length || w.capacity || 0
                  const pct = total > 0 ? Math.round((occ / total) * 100) : 0
                  return (
                    <Card key={w.id}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm">{w.name}</span>
                          <Badge variant="outline" className="text-xs">{w.type}</Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between"><span className="text-gray-500">Capacity:</span><span className="font-medium">{w.capacity}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Occupied:</span><span className="font-medium text-red-500">{occ}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Available:</span><span className="font-medium text-green-600">{total - occ}</span></div>
                        </div>
                        <Progress value={pct} className="mt-2 h-1" />
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Current Inpatients */}
            <div>
              <h2 className="text-base font-semibold mb-1">Current Inpatients</h2>
              <p className="text-xs text-gray-500 mb-3">{currentAdmitted.length} patient{currentAdmitted.length !== 1 ? 's' : ''} currently admitted</p>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Ward/Bed</TableHead>
                        <TableHead>Diagnosis</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentAdmitted.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-400">No current admissions</TableCell></TableRow>
                      ) : currentAdmitted.map(a => (
                        <TableRow key={a.id} className={a.isCritical ? 'bg-red-50' : ''}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                                {(a.patient?.firstName?.[0] || '') + (a.patient?.lastName?.[0] || '')}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{a.patient?.firstName} {a.patient?.lastName}</div>
                                <div className="text-xs text-gray-500">{a.patient?.mrn}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{a.bed?.ward?.name || getWardName(wards, a)}</div>
                            <div className="text-xs text-gray-500">{a.bed?.bedNumber || '—'}</div>
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{a.admissionDiagnosis}</TableCell>
                          <TableCell className="text-sm">{a.admissionDate ? differenceInDays(new Date(), new Date(a.admissionDate)) : 0}</TableCell>
                          <TableCell><Badge className="bg-green-100 text-green-800 text-xs">admitted</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════════ WARDS & BEDS ════════════════════ */}
        {activeTab === 'wards-beds' && (
          <div className="space-y-6">
            {/* Ward list table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-semibold">Ward List</h2>
                  <p className="text-xs text-gray-500">Manage wards and view bed availability</p>
                </div>
                <Button size="sm" onClick={() => { setEditingWardId(null); setWardForm(emptyWard); setShowWardDialog(true) }}>
                  <Plus className="h-4 w-4 mr-1" />Add Ward
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ward Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Total Beds</TableHead>
                        <TableHead>Occupied</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wards.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No wards configured</TableCell></TableRow>
                      ) : wards.map(w => {
                        const beds = w.beds || []
                        const occ = beds.filter(b => b.status === 'occupied').length
                        const total = beds.length || w.capacity || 0
                        return (
                          <TableRow key={w.id}>
                            <TableCell>
                              <div className="font-medium">{w.name}</div>
                              <div className="text-xs text-gray-500">{w.code}</div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{w.type}</Badge></TableCell>
                            <TableCell className="font-medium">{total}</TableCell>
                            <TableCell className="text-red-500 font-medium">{occ}</TableCell>
                            <TableCell className="text-green-600 font-medium">{total - occ}</TableCell>
                            <TableCell><Badge className="bg-green-100 text-green-800 text-xs">Active</Badge></TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => { setWardForm({ name: w.name, code: w.code, type: w.type, capacity: w.capacity, floor: w.floor || '', chargeNurse: w.chargeNurse || '', phone: w.phone || '' }); setEditingWardId(w.id); setShowWardDialog(true) }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Bed Map */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-semibold">Bed Map</h2>
                  <p className="text-xs text-gray-500">Visual overview of all beds</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-500 inline-block" />Available</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500 inline-block" />Occupied</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-yellow-500 inline-block" />Maintenance</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-blue-500 inline-block" />Reserved</span>
                </div>
              </div>
              <div className="space-y-5">
                {wards.map(w => {
                  const beds = w.beds || []
                  return (
                    <div key={w.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{w.name}</span>
                          <Badge variant="outline" className="text-xs">{w.type}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{beds.filter(b => b.status === 'occupied').length}/{beds.length} occupied</span>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAddBedForm({ ...emptyAddBed, wardId: w.id }); setShowAddBedDialog(true) }}>
                            <Plus className="h-3 w-3 mr-1" />Add Bed
                          </Button>
                        </div>
                      </div>
                      {beds.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2">No beds configured for this ward</p>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          {beds.map(bed => {
                            const admission = admissions.find(a => a.bedId === bed.id && a.status === 'admitted')
                            const patientName = admission ? `${admission.patient?.firstName || ''} ${admission.patient?.lastName || ''}`.trim() : ''
                            const styles = {
                              occupied:    { bed: 'border-red-400 bg-red-50',    sheet: 'bg-red-500',    text: 'text-red-700' },
                              maintenance: { bed: 'border-yellow-400 bg-yellow-50', sheet: 'bg-yellow-500', text: 'text-yellow-700' },
                              reserved:    { bed: 'border-blue-400 bg-blue-50',  sheet: 'bg-blue-500',   text: 'text-blue-700' },
                              available:   { bed: 'border-green-400 bg-green-50', sheet: 'bg-green-500',  text: 'text-green-700' },
                            }[bed.status] || { bed: 'border-green-400 bg-green-50', sheet: 'bg-green-500', text: 'text-green-700' }
                            const isAvailable = bed.status === 'available'

                            return (
                              <div key={bed.id} className="relative group">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isAvailable) {
                                      navigate(`/patients?register=1&bedId=${bed.id}&wardId=${w.id}`)
                                    }
                                  }}
                                  className={`relative w-[68px] rounded-lg border-2 ${styles.bed} p-1.5 flex flex-col items-center transition-all ${isAvailable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default'}`}
                                >
                                  {/* pillow */}
                                  <div className={`h-1.5 w-7 rounded-full ${styles.sheet} mb-1`} />
                                  {/* bed icon */}
                                  <BedDouble className={`h-6 w-6 ${styles.text}`} />
                                  {/* bed number */}
                                  <span className={`mt-0.5 text-[11px] font-bold ${styles.text} leading-none text-center break-all`}>
                                    {bed.bedNumber}
                                  </span>
                                </button>

                                {/* Hover tooltip */}
                                <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 group-hover:block">
                                  <div className="whitespace-nowrap rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
                                    <div className="font-semibold">Bed {bed.bedNumber}</div>
                                    {bed.status === 'occupied' ? (
                                      <div className="mt-0.5 text-gray-200">
                                        👤 {patientName || 'Occupied'}
                                        {admission?.admissionDate && (
                                          <div className="text-gray-400">Since {format(new Date(admission.admissionDate), 'dd MMM')}</div>
                                        )}
                                      </div>
                                    ) : bed.status === 'available' ? (
                                      <div className="mt-0.5 text-green-300">Available · click to register patient</div>
                                    ) : (
                                      <div className="mt-0.5 text-gray-300 capitalize">{bed.status}</div>
                                    )}
                                    <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-gray-900" />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════ ADMISSIONS ════════════════════ */}
        {activeTab === 'admissions' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input className="pl-9" placeholder="Search by patient, UHID, admission #..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <Select value={wardFilter} onValueChange={setWardFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All Wards" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Wards</SelectItem>
                  {wards.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="admitted">Admitted</SelectItem>
                  <SelectItem value="discharged">Discharged</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Admission Type</TableHead>
                      <TableHead>Ward/Bed</TableHead>
                      <TableHead>Admitted On</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Diagnosis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" /></TableCell></TableRow>
                    ) : filteredAdmissions.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-400">No admissions found</TableCell></TableRow>
                    ) : filteredAdmissions.map(a => {
                      const days = a.admissionDate ? differenceInDays(new Date(), new Date(a.admissionDate)) : 0
                      const typeColor = a.admissionType === 'Emergency' ? 'bg-red-100 text-red-700' : a.admissionType === 'Transfer' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                      const statusColor = a.status === 'admitted' ? 'bg-green-100 text-green-800' : a.status === 'transferred' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs font-medium">{admissionLabel(a)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                                {(a.patient?.firstName?.[0] || '') + (a.patient?.lastName?.[0] || '')}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{a.patient?.firstName} {a.patient?.lastName}</div>
                                <div className="text-xs text-gray-500">{a.patient?.mrn} · {a.patient?.dateOfBirth ? differenceInDays(new Date(), new Date(a.patient.dateOfBirth)) > 365 ? Math.floor(differenceInDays(new Date(), new Date(a.patient.dateOfBirth)) / 365) + 'y' : '' : ''} {a.patient?.gender}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><Badge className={`text-xs ${typeColor}`}>{a.admissionType}</Badge></TableCell>
                          <TableCell>
                            <div className="text-sm">{a.bed?.ward?.name || getWardName(wards, a)}</div>
                            <div className="text-xs text-gray-500">{a.bed?.bedNumber || '—'}</div>
                            {!a.dailyRate && <div className="text-xs text-gray-400">No room rate set</div>}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{a.admissionDate ? format(new Date(a.admissionDate), 'dd MMM yyyy') : '—'}</div>
                            <div className="text-xs text-gray-500">{a.admissionDate ? format(new Date(a.admissionDate), 'HH:mm') : ''}</div>
                          </TableCell>
                          <TableCell className="text-sm">{days}</TableCell>
                          <TableCell className="text-sm max-w-[160px]"><div className="truncate">{a.admissionDiagnosis}</div></TableCell>
                          <TableCell><Badge className={`text-xs ${statusColor}`}>{a.status}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openViewAdmission(a)}><Eye className="h-4 w-4" /></Button>
                              {a.status === 'admitted' && (
                                <Button size="sm" variant="ghost" onClick={() => { setSelectedAdmission(a); setDischargeForm(emptyDischarge); setShowDischargeDialog(true) }}>
                                  <LogOut className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════ NEW ADMISSION (inline form) ════════════════════ */}
        {activeTab === 'new-admission' && (
          <div className="w-full">
            <div className="mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4" />New Patient Admission</h2>
              <p className="text-xs text-gray-500">Register a new inpatient admission</p>
            </div>

            <div className="space-y-4">
              {/* Patient Information */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" />Patient Information</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Select Patient *</Label>
                      <PatientLookup className="mt-1" selectedPatient={admitPatient} showHint={false} placeholder="Search by name or UHID..."
                        onSelect={p => { setAdmitPatient(p); setAdmitForm(prev => ({ ...prev, patientId: p.id })) }}
                        onClear={() => { setAdmitPatient(null); setAdmitForm(prev => ({ ...prev, patientId: '' })) }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Admission Type *</Label>
                      <Select value={admitForm.admissionType} onValueChange={v => setAdmitForm(p => ({ ...p, admissionType: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{ADMISSION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ward & Bed Assignment */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"><BedDouble className="h-4 w-4" />Ward &amp; Bed Assignment</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Select Ward *</Label>
                      <Select value={admitForm.wardId} onValueChange={v => { setAdmitForm(p => ({ ...p, wardId: v, bedId: '' })); fetchBedsForWard(v) }}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select ward" /></SelectTrigger>
                        <SelectContent>{wards.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Select Bed *</Label>
                      <Select value={admitForm.bedId} onValueChange={v => setAdmitForm(p => ({ ...p, bedId: v }))} disabled={!admitForm.wardId}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select bed" /></SelectTrigger>
                        <SelectContent>{availableBeds.map(b => <SelectItem key={b.id} value={b.id}>Bed {b.bedNumber} ({b.type || 'Standard'})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Medical Information */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"><Stethoscope className="h-4 w-4" />Medical Information</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Attending Physician *</Label>
                      <Select value={admitForm.doctorId || ''} onValueChange={v => setAdmitForm(p => ({ ...p, doctorId: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select physician" /></SelectTrigger>
                        <SelectContent>{doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Expected Length of Stay (Days) *</Label>
                      <Input type="number" min={1} className="mt-1" value={admitForm.expectedLengthOfStay} onChange={e => setAdmitForm(p => ({ ...p, expectedLengthOfStay: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Admission Diagnosis *</Label>
                    <Input className="mt-1" placeholder="Primary diagnosis for admission" value={admitForm.admissionDiagnosis} onChange={e => setAdmitForm(p => ({ ...p, admissionDiagnosis: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Chief Complaint *</Label>
                    <Textarea className="mt-1" placeholder="Patient's main complaint or reason for admission" rows={2} value={admitForm.chiefComplaint} onChange={e => setAdmitForm(p => ({ ...p, chiefComplaint: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Admission Notes</Label>
                    <Textarea className="mt-1" placeholder="Additional notes about the admission" rows={2} value={admitForm.admissionNotes} onChange={e => setAdmitForm(p => ({ ...p, admissionNotes: e.target.value }))} />
                  </div>
                </CardContent>
              </Card>

              {/* Financial Information */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" />Financial Information</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Deposit Amount (₹)</Label>
                      <Input type="number" min={0} className="mt-1" value={admitForm.depositAmount} onChange={e => setAdmitForm(p => ({ ...p, depositAmount: e.target.value }))} />
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-sm font-medium text-orange-600 mb-1">Critical Patient</p>
                      <p className="text-xs text-gray-500 mb-2">Mark if patient requires critical care monitoring</p>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="critical-inline" checked={admitForm.isCritical} onChange={e => setAdmitForm(p => ({ ...p, isCritical: e.target.checked }))} className="h-4 w-4" />
                        <label htmlFor="critical-inline" className="text-sm text-red-600 font-medium">Mark as Critical</label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setAdmitForm(emptyAdmission); setAdmitPatient(null); setAvailableBeds([]) }}>Reset Form</Button>
                <Button className="bg-gray-900 hover:bg-gray-800" onClick={handleAdmit} disabled={savingAdmission}>
                  {savingAdmission ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Admitting...</> : 'Complete Admission'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════ DISCHARGE ════════════════════ */}
        {activeTab === 'discharge' && (
          <div>
            <div className="mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2"><LogOut className="h-4 w-4" />Discharge Patients</h2>
              <p className="text-xs text-gray-500">{currentAdmitted.length} patient(s) currently admitted — select one to discharge</p>
            </div>
            {currentAdmitted.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-gray-400">No patients currently admitted</CardContent></Card>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {currentAdmitted.map(a => {
                  const days = a.admissionDate ? differenceInDays(new Date(), new Date(a.admissionDate)) : 0
                  const initials = (a.patient?.firstName?.[0] || '') + (a.patient?.lastName?.[0] || '')
                  return (
                    <Card key={a.id} className={a.isCritical ? 'border-red-300' : ''}>
                      <CardContent className="pt-4 pb-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">{initials}</div>
                          <div>
                            <div className="font-semibold text-sm">{a.patient?.firstName} {a.patient?.lastName}</div>
                            <div className="text-xs text-gray-500">{a.patient?.mrn}</div>
                          </div>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between"><span className="text-gray-500">Ward:</span><span>{a.bed?.ward?.name || getWardName(wards, a)}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Bed:</span><span>{a.bed?.bedNumber || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Days:</span><span className={days > 7 ? 'text-orange-600 font-medium' : ''}>{days}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Expected:</span><span>TBD</span></div>
                        </div>
                        <Button className="w-full bg-gray-900 hover:bg-gray-800 text-sm gap-1.5" size="sm"
                          onClick={() => { setSelectedAdmission(a); setDischargeForm(emptyDischarge); setShowDischargeDialog(true) }}>
                          <LogOut className="h-3.5 w-3.5" />Discharge
                        </Button>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openViewAdmission(a)}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openViewAdmission(a)}>+ Add Charges</Button>
                          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openViewAdmission(a)}>Bill</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════ MOVEMENT ════════════════════ */}
        {activeTab === 'movement' && (
          <div>
            <div className="mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2"><ArrowRight className="h-4 w-4" />Patient Movement History</h2>
              <p className="text-xs text-gray-500">Track patient transfers between wards and beds</p>
            </div>
            <Card>
              <CardContent className="py-10 text-center text-gray-400">
                {transferredList.length === 0 ? 'No patient movements recorded' : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transferredList.map(a => (
                        <TableRow key={a.id}>
                          <TableCell>{a.patient?.firstName} {a.patient?.lastName}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>{getWardName(wards, a)}</TableCell>
                          <TableCell>{a.admissionDate ? format(new Date(a.admissionDate), 'dd MMM yyyy') : '—'}</TableCell>
                          <TableCell><Badge className="bg-blue-100 text-blue-800 text-xs">transferred</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════ PATIENT HISTORY ════════════════════ */}
        {activeTab === 'patient-history' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold">Patient Discharge History</h2>
                <p className="text-xs text-blue-600">All past admissions, discharge summaries, and records</p>
              </div>
              <span className="text-xs text-gray-500">{dischargedList.length} discharge records</span>
            </div>
            {dischargedList.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-gray-400">No discharge records yet</CardContent></Card>
            ) : (
              <div>
                <div className="space-y-3">
                  {(() => {
                    const ITEMS_PER_PAGE = 10
                    const totalPages = Math.ceil(dischargedList.length / ITEMS_PER_PAGE)
                    const startIdx = (patientHistoryPage - 1) * ITEMS_PER_PAGE
                    const endIdx = startIdx + ITEMS_PER_PAGE
                    const paginatedData = dischargedList.slice(startIdx, endIdx)
                    return paginatedData.map(a => {
                      const days = (a.admissionDate && a.dischargeDate) ? differenceInDays(new Date(a.dischargeDate), new Date(a.admissionDate)) : 0
                      const initials = (a.patient?.firstName?.[0] || '') + (a.patient?.lastName?.[0] || '')
                      return (
                        <Card key={a.id}>
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-700">{initials}</div>
                                <div>
                                  <div className="font-semibold text-sm">{a.patient?.firstName} {a.patient?.lastName}</div>
                                  <div className="text-xs text-gray-500">{a.patient?.mrn} · {a.patient?.dateOfBirth ? Math.floor(differenceInDays(new Date(), new Date(a.patient.dateOfBirth)) / 365) + 'y' : ''}, {a.patient?.gender}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">ADMISSION #</span>
                                <span className="text-xs font-mono font-medium">{admissionLabel(a)}</span>
                                <Badge className="bg-green-100 text-green-800 text-xs">Discharged</Badge>
                                <Button size="sm" variant="ghost" onClick={() => openViewAdmission(a)}><Eye className="h-4 w-4" /><span className="ml-1 text-xs">View</span></Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-4 text-xs mb-2">
                              <div>
                                <div className="text-gray-400 uppercase font-semibold mb-1">Admitted</div>
                                <div className="font-medium">{a.admissionDate ? format(new Date(a.admissionDate), 'dd MMM yyyy') : '—'}</div>
                                <div className="text-gray-500">{a.admissionDate ? format(new Date(a.admissionDate), 'HH:mm') : ''}</div>
                              </div>
                              <div>
                                <div className="text-gray-400 uppercase font-semibold mb-1">Duration</div>
                                <div className="font-medium">{days} days</div>
                                <div className="text-gray-500">{getWardName(wards, a)}/{a.bed?.bedNumber || '—'}</div>
                              </div>
                              <div>
                                <div className="text-gray-400 uppercase font-semibold mb-1">Admission Type</div>
                                <Badge className={`text-xs ${a.admissionType === 'Emergency' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{a.admissionType}</Badge>
                              </div>
                              <div>
                                <div className="text-gray-400 uppercase font-semibold mb-1">Bill</div>
                                <div className="text-gray-500">—</div>
                              </div>
                            </div>
                            {a.admissionDiagnosis && (
                              <div>
                                <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Admission Diagnosis</div>
                                <div className="text-sm">{a.admissionDiagnosis}</div>
                              </div>
                            )}
                            <div className="flex justify-end mt-2">
                              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => handlePrintDischargeSummary(a)}>
                                <Printer className="h-3.5 w-3.5" />Print Summary
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                  })()}
                </div>
                {(() => {
                  const ITEMS_PER_PAGE = 10
                  const totalPages = Math.ceil(dischargedList.length / ITEMS_PER_PAGE)
                  return totalPages > 1 ? (
                    <div className="flex items-center justify-end gap-2 p-4 border-t mt-4">
                      <Button variant="outline" size="sm" onClick={() => setPatientHistoryPage(p => Math.max(1, p - 1))} disabled={patientHistoryPage === 1}>
                        <ChevronLeft className="h-4 w-4 mr-1" />Previous
                      </Button>
                      <span className="text-sm text-gray-600">Page {patientHistoryPage} of {totalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setPatientHistoryPage(p => Math.min(totalPages, p + 1))} disabled={patientHistoryPage === totalPages}>
                        Next<ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  ) : null
                })()}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ════════════ DIALOGS (shared across all tabs) ════════════ */}

      {/* Discharge Dialog */}
      <Dialog open={showDischargeDialog} onOpenChange={setShowDischargeDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Discharge Patient{selectedAdmission ? ` — ${selectedAdmission.patient?.firstName} ${selectedAdmission.patient?.lastName}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Discharge Diagnosis *</Label><Input value={dischargeForm.dischargeDiagnosis} onChange={e => setDischargeForm(p => ({ ...p, dischargeDiagnosis: e.target.value }))} /></div>
            <div><Label>Discharge Condition *</Label><Select value={dischargeForm.dischargeCondition} onValueChange={v => setDischargeForm(p => ({ ...p, dischargeCondition: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DISCHARGE_CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Treatment Summary</Label><Textarea value={dischargeForm.treatmentSummary} onChange={e => setDischargeForm(p => ({ ...p, treatmentSummary: e.target.value }))} rows={3} /></div>
            <div><Label>Medications on Discharge</Label><Textarea value={dischargeForm.medicationsOnDischarge} onChange={e => setDischargeForm(p => ({ ...p, medicationsOnDischarge: e.target.value }))} rows={2} /></div>
            <div><Label>Follow-up Instructions</Label><Textarea value={dischargeForm.followUpInstructions} onChange={e => setDischargeForm(p => ({ ...p, followUpInstructions: e.target.value }))} rows={2} /></div>
            <div><Label>Follow-up Date</Label><Input type="date" value={dischargeForm.followUpDate} onChange={e => setDischargeForm(p => ({ ...p, followUpDate: e.target.value }))} /></div>
            <div><Label>Discharge Notes</Label><Textarea value={dischargeForm.dischargeNotes} onChange={e => setDischargeForm(p => ({ ...p, dischargeNotes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowDischargeDialog(false)}>Cancel</Button><Button onClick={handleDischarge} disabled={savingDischarge}>{savingDischarge ? 'Discharging...' : 'Discharge Patient'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Transfer Patient{selectedAdmission ? ` — ${selectedAdmission.patient?.firstName} ${selectedAdmission.patient?.lastName}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Target Ward *</Label><Select value={transferForm.toWardId} onValueChange={v => { setTransferForm(p => ({ ...p, toWardId: v, toBedId: '' })); fetchTransferBeds(v) }}><SelectTrigger><SelectValue placeholder="Select ward" /></SelectTrigger><SelectContent>{wards.filter(w => w.id !== selectedAdmission?.wardId).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Target Bed *</Label><Select value={transferForm.toBedId} onValueChange={v => setTransferForm(p => ({ ...p, toBedId: v }))} disabled={!transferForm.toWardId}><SelectTrigger><SelectValue placeholder="Select bed" /></SelectTrigger><SelectContent>{transferBeds.map(b => <SelectItem key={b.id} value={b.id}>Bed {b.bedNumber}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Transfer Reason</Label><Textarea value={transferForm.transferReason} onChange={e => setTransferForm(p => ({ ...p, transferReason: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowTransferDialog(false)}>Cancel</Button><Button onClick={handleTransfer} disabled={savingTransfer}>{savingTransfer ? 'Transferring...' : 'Transfer Patient'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Ward Dialog (simplified) */}
      <Dialog open={showWardDialog} onOpenChange={setShowWardDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingWardId ? 'Edit Ward' : 'Add New Ward'}</DialogTitle>
            <p className="text-xs text-gray-500">{editingWardId ? 'Update ward details' : 'Create a new ward in the hospital'}</p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ward Name *</Label><Input className="mt-1" value={wardForm.name} onChange={e => setWardForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. General Ward A" /></div>
              <div><Label>Ward Code *</Label><Input className="mt-1" value={wardForm.code} onChange={e => setWardForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. GWA" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ward Type *</Label>
                <Select value={wardForm.type} onValueChange={v => setWardForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{WARD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Bed Capacity *</Label><Input type="number" min={1} className="mt-1" value={wardForm.capacity} onChange={e => setWardForm(p => ({ ...p, capacity: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWardDialog(false)}>Cancel</Button>
            <Button className="bg-gray-900 hover:bg-gray-800" onClick={handleSaveWard} disabled={savingWard}>{savingWard ? 'Saving...' : 'Save Ward'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Bed Dialog */}
      <Dialog open={showAddBedDialog} onOpenChange={setShowAddBedDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Bed</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Ward *</Label><Select value={addBedForm.wardId} onValueChange={v => setAddBedForm(p => ({ ...p, wardId: v }))}><SelectTrigger><SelectValue placeholder="Select ward" /></SelectTrigger><SelectContent>{wards.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Bed Number *</Label><Input value={addBedForm.bedNumber} onChange={e => setAddBedForm(p => ({ ...p, bedNumber: e.target.value }))} placeholder="e.g. 101" /></div>
            <div><Label>Bed Type</Label><Select value={addBedForm.type} onValueChange={v => setAddBedForm(p => ({ ...p, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BED_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddBedDialog(false)}>Cancel</Button><Button onClick={handleAddBed} disabled={savingBed}>{savingBed ? 'Adding...' : 'Add Bed'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Admission Dialog */}
      <Dialog open={showViewAdmission} onOpenChange={setShowViewAdmission}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Admission Details — {viewAdmission ? admissionLabel(viewAdmission) : ''}</span>
              {viewAdmission && (
                <div className="flex gap-2 mr-6">
                  <Button size="sm" variant="outline" onClick={() => handlePrintAdmissionSlip(viewAdmission)}><Printer className="h-4 w-4 mr-1" />Slip</Button>
                  {viewAdmission.status === 'discharged' && <Button size="sm" variant="outline" onClick={() => handlePrintDischargeSummary(viewAdmission)}><FileText className="h-4 w-4 mr-1" />Summary</Button>}
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex border-b mb-4">
            {[{ id: 'details', label: 'Details', Icon: FileText }, { id: 'notes', label: 'Clinical Notes', Icon: ClipboardList }, { id: 'billing', label: 'IPD Billing', Icon: DollarSign }].map(({ id, label, Icon }) => (
              <button key={id} onClick={() => handleViewTabChange(id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${viewTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
          {viewAdmission && viewTab === 'details' && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">Adm #: </span><span className="font-mono font-medium">{admissionLabel(viewAdmission)}</span></div>
                <div><span className="text-gray-500">Status: </span>{admissionStatusBadge(viewAdmission.status)}</div>
                <div><span className="text-gray-500">Patient: </span><span className="font-medium">{viewAdmission.patient?.firstName} {viewAdmission.patient?.lastName}</span></div>
                <div><span className="text-gray-500">UHID: </span><span className="font-mono">{viewAdmission.patient?.mrn}</span></div>
                <div><span className="text-gray-500">Ward / Bed: </span><span>{getWardName(wards, viewAdmission)} · Bed {viewAdmission.bed?.bedNumber || '—'}</span></div>
                <div><span className="text-gray-500">Admitted: </span><span>{viewAdmission.admissionDate ? format(new Date(viewAdmission.admissionDate), 'dd MMM yyyy') : '—'}</span></div>
                <div><span className="text-gray-500">Type: </span><span>{viewAdmission.admissionType}</span></div>
                <div><span className="text-gray-500">Deposit: </span><span>₹{(viewAdmission.depositAmount || 0).toLocaleString()}</span></div>
              </div>
              <div><p className="text-gray-500 mb-1">Diagnosis:</p><p className="bg-gray-50 p-2 rounded">{viewAdmission.admissionDiagnosis}</p></div>
              {viewAdmission.isCritical && <Badge variant="destructive">Critical Patient</Badge>}
              {viewAdmission.status === 'admitted' && (
                <Button onClick={() => { setShowViewAdmission(false); setSelectedAdmission(viewAdmission); setTransferForm({ toWardId: '', toBedId: '', transferReason: '' }); setShowTransferDialog(true) }} variant="outline" size="sm">
                  <ArrowRight className="h-4 w-4 mr-1" />Transfer Patient
                </Button>
              )}
            </div>
          )}
          {viewAdmission && viewTab === 'notes' && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <p className="font-medium text-sm">Add Clinical Note</p>
                <div><Label className="text-xs">Note Type</Label><Select value={noteForm.type} onValueChange={v => setNoteForm(p => ({ ...p, type: v }))}><SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger><SelectContent>{NOTE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Note *</Label><Textarea value={noteForm.text} onChange={e => setNoteForm(p => ({ ...p, text: e.target.value }))} rows={3} className="mt-1" placeholder="Enter clinical note..." /></div>
                <Button size="sm" onClick={handleAddNote} disabled={savingNote}>{savingNote ? 'Saving...' : 'Add Note'}</Button>
              </div>
              <div className="space-y-2">
                {loadingNotes ? <p className="text-center text-gray-400 py-4">Loading notes...</p>
                  : clinicalNotes.length === 0 ? <p className="text-center text-gray-400 py-4">No clinical notes yet</p>
                    : clinicalNotes.map((n, i) => (
                      <div key={n.id || i} className="border rounded-lg p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge className="text-xs">{n.type || 'Note'}</Badge>
                          <span className="text-xs text-gray-400">{n.createdAt ? format(new Date(n.createdAt), 'dd MMM yyyy, hh:mm a') : ''}</span>
                        </div>
                        <p>{n.text}</p>
                      </div>
                    ))}
              </div>
            </div>
          )}
          {viewAdmission && viewTab === 'billing' && (
            <div className="space-y-4">
              {loadingBilling ? <p className="text-center py-4">Loading billing...</p> : !ipdBilling ? (
                <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                  <p className="font-medium text-sm">Generate IPD Bill</p>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1"><Label className="text-xs">Daily Room Rate (₹)</Label><Input type="number" min={0} value={billingDailyRate} onChange={e => setBillingDailyRate(e.target.value)} placeholder="e.g. 1500" /></div>
                    <Button onClick={handleGenerateBill}>Generate Bill</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="border rounded p-3 text-center"><p className="text-gray-500 text-xs">Daily Rate</p><p className="text-lg font-bold text-indigo-600">₹{(ipdBilling.dailyRate || 0).toLocaleString()}</p></div>
                    <div className="border rounded p-3 text-center"><p className="text-gray-500 text-xs">Room Charges</p><p className="text-lg font-bold">₹{((ipdBilling.dailyRate || 0) * (differenceInDays(viewAdmission.dischargeDate ? new Date(viewAdmission.dischargeDate) : new Date(), new Date(viewAdmission.admissionDate)))).toLocaleString()}</p></div>
                    <div className="border rounded p-3 text-center bg-green-50"><p className="text-gray-500 text-xs">Total</p><p className="text-lg font-bold text-green-700">₹{((ipdBilling.dailyRate || 0) * (differenceInDays(viewAdmission.dischargeDate ? new Date(viewAdmission.dischargeDate) : new Date(), new Date(viewAdmission.admissionDate))) + (ipdBilling.charges || []).reduce((s, c) => s + (c.amount || 0) * (c.quantity || 1), 0)).toLocaleString()}</p></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">Additional Charges</p>
                    <Button size="sm" onClick={() => { setChargeForm(emptyCharge); setShowAddChargeDialog(true) }}><Plus className="h-4 w-4 mr-1" />Add Charge</Button>
                  </div>
                  {(ipdBilling.charges || []).length === 0 ? <p className="text-center text-gray-400 text-sm py-4">No additional charges</p> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Type</TableHead><TableHead>Qty</TableHead><TableHead>Amount</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                      <TableBody>{(ipdBilling.charges || []).map((c, i) => (
                        <TableRow key={c.id || i}><TableCell>{c.name}</TableCell><TableCell>{c.type}</TableCell><TableCell>{c.quantity || 1}</TableCell><TableCell>₹{(c.amount || 0).toLocaleString()}</TableCell><TableCell className="font-medium">₹{((c.amount || 0) * (c.quantity || 1)).toLocaleString()}</TableCell></TableRow>
                      ))}</TableBody>
                    </Table>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowViewAdmission(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Charge Dialog */}
      <Dialog open={showAddChargeDialog} onOpenChange={setShowAddChargeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Charge</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Item Name *</Label><Input value={chargeForm.name} onChange={e => setChargeForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. X-Ray" /></div>
            <div><Label>Type</Label><Select value={chargeForm.type} onValueChange={v => setChargeForm(p => ({ ...p, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CHARGE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount (₹) *</Label><Input type="number" min={0} value={chargeForm.amount} onChange={e => setChargeForm(p => ({ ...p, amount: e.target.value }))} /></div>
              <div><Label>Quantity</Label><Input type="number" min={1} value={chargeForm.quantity} onChange={e => setChargeForm(p => ({ ...p, quantity: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddChargeDialog(false)}>Cancel</Button><Button onClick={handleAddCharge} disabled={savingCharge}>{savingCharge ? 'Saving...' : 'Add Charge'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Ward Confirm */}
      <Dialog open={!!deleteWardConfirm} onOpenChange={() => setDeleteWardConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Ward?</DialogTitle></DialogHeader>
          <p className="text-gray-600">Delete <strong>{deleteWardConfirm?.name}</strong>? This cannot be undone.</p>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteWardConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => handleDeleteWard(deleteWardConfirm)}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}