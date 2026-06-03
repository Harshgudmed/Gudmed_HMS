import { useState, useEffect, useCallback } from 'react'
import { getOrgSettings } from '@/lib/orgSettings'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Users, Calendar, Clock, DollarSign, FlaskConical, Pill, BedDouble,
  AlertCircle, TrendingUp, Timer, UserPlus, Stethoscope, Receipt, Activity
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import client from '@/api/client'

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
]

const INSURANCE_PROVIDERS = [
  'CGHS', 'ESIC', 'PM-JAY', 'Star Health', 'HDFC ERGO', 'Niva Bupa',
  'LIC Health', 'United India', 'New India Assurance', 'Oriental Insurance',
]

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'waiting': return 'bg-blue-100 text-blue-800'
    case 'in_progress':
    case 'in_service': return 'bg-green-100 text-green-800'
    case 'completed': return 'bg-gray-100 text-gray-800'
    case 'cancelled': return 'bg-red-100 text-red-800'
    case 'scheduled': return 'bg-purple-100 text-purple-800'
    case 'checked_in': return 'bg-yellow-100 text-yellow-800'
    case 'confirmed': return 'bg-teal-100 text-teal-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

const emptyPatientForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'male',
  phonePrimary: '',
  phoneSecondary: '',
  email: '',
  region: '',
  zone: '',
  woreda: '',
  kebele: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  bloodGroup: '',
  hasInsurance: false,
  insuranceProvider: '',
  insuranceId: '',
}

export default function DashboardModule() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [orgInfo, setOrgInfo] = useState({ name: 'Hospital', address: '', city: '', phone: '', email: '' })
  const [loading, setLoading] = useState(true)
  const [showNewPatient, setShowNewPatient] = useState(false)
  const [patientForm, setPatientForm] = useState(emptyPatientForm)
  const [savingPatient, setSavingPatient] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const res = await client.get('/dashboard')
      if (res.success) setData(res.data)
    } catch {
      // silently ignore on dashboard
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])
  useEffect(() => { getOrgSettings().then(setOrgInfo) }, [])

  const stats = data?.stats || {}
  const queue = data?.queue || []
  const upcomingAppointments = data?.upcomingAppointments || []
  const occupancyPct = stats.occupiedBeds && (stats.occupiedBeds + stats.availableBeds) > 0
    ? Math.round((stats.occupiedBeds / (stats.occupiedBeds + stats.availableBeds)) * 100) : 0

  const handleQueueAction = async (queueId, action) => {
    try {
      await client.patch(`/triage/${queueId}`, { status: action === 'called' ? 'called' : 'in_service' })
      toast.success(`Queue ${action} successfully`)
      fetchDashboard()
    } catch {
      toast.error(`Failed to ${action} queue item`)
    }
  }

  const handleRegisterPatient = async (e) => {
    e.preventDefault()
    setSavingPatient(true)
    try {
      const res = await client.post('/patients', {
        ...patientForm,
        hasInsurance: patientForm.hasInsurance === true || patientForm.hasInsurance === 'true',
      })
      if (res.success) {
        toast.success(`Patient UHID ${res.data.mrn} registered successfully`)
        setShowNewPatient(false)
        setPatientForm(emptyPatientForm)
        fetchDashboard()
      } else {
        toast.error(res.error || 'Failed to register patient')
      }
    } catch {
      toast.error('Failed to register patient')
    } finally {
      setSavingPatient(false)
    }
  }

  const setField = (field, value) => setPatientForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <Button onClick={() => setShowNewPatient(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          New Patient
        </Button>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all" onClick={() => navigate('/patients')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Patients</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats.totalPatients || 0).toLocaleString()}</div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" /> Active records
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg hover:border-purple-300 transition-all" onClick={() => navigate('/queue')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Today's Appointments</CardTitle>
            <Calendar className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAppointments || 0}</div>
            <p className="text-xs text-gray-500">Scheduled today</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg hover:border-orange-300 transition-all" onClick={() => navigate('/triage')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Queue Waiting</CardTitle>
            <Clock className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.queueWaiting || 0}</div>
            <p className="text-xs text-gray-500">In waiting area</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg hover:border-green-300 transition-all" onClick={() => navigate('/billing')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Today's Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹ {(stats.todayRevenue || 0).toLocaleString()}</div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" /> Collected today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-lg hover:border-cyan-300 transition-all" onClick={() => navigate('/laboratory')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending Lab Orders</CardTitle>
            <FlaskConical className="h-5 w-5 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingLabOrders || 0}</div>
            <Progress value={65} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg hover:border-pink-300 transition-all" onClick={() => navigate('/pharmacy')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending Prescriptions</CardTitle>
            <Pill className="h-5 w-5 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingPrescriptions || 0}</div>
            <Progress value={72} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all" onClick={() => navigate('/inpatient')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Bed Occupancy</CardTitle>
            <BedDouble className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.occupiedBeds || 0}/{(stats.occupiedBeds || 0) + (stats.availableBeds || 0)}</div>
            <Progress value={occupancyPct} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg hover:border-red-300 transition-all" onClick={() => navigate('/consultations')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Critical Alerts</CardTitle>
            <AlertCircle className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.criticalAlerts || 0}</div>
            <p className="text-xs text-red-600">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue + Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Queue</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/triage')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : queue.length > 0 ? (
                <div className="space-y-3">
                  {queue.slice(0, 10).map((q) => (
                    <div key={q.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="font-mono font-bold text-blue-600">{q.queueNumber}</p>
                          <p className="text-xs text-gray-500">{q.serviceArea}</p>
                        </div>
                        <div>
                          <p className="font-medium">{q.patient?.firstName} {q.patient?.lastName}</p>
                          <p className="text-xs text-gray-500">
                            <Timer className="inline h-3 w-3 mr-1" />
                            {formatDistanceToNow(new Date(q.joinedQueueAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusBadgeClass(q.status)}>
                          {q.status.replace('_', ' ')}
                        </Badge>
                        {q.status === 'waiting' && (
                          <Button size="sm" onClick={() => handleQueueAction(q.id, 'called')}>
                            Call
                          </Button>
                        )}
                        {q.status === 'called' && (
                          <Button size="sm" onClick={() => handleQueueAction(q.id, 'in_service')}>
                            Start
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No patients in queue</div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Today's Appointments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Today's Appointments</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/appointments')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {upcomingAppointments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAppointments.slice(0, 10).map((apt) => (
                    <div key={apt.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {apt.patient?.firstName} {apt.patient?.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {apt.appointmentTime} &bull; {apt.chiefComplaint || 'Consultation'}
                        </p>
                      </div>
                      <Badge className={getStatusBadgeClass(apt.status)}>
                        {apt.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No appointments today</div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => setShowNewPatient(true)}>
              <UserPlus className="h-6 w-6" />
              <span>New Patient</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/appointments')}>
              <Calendar className="h-6 w-6" />
              <span>Book Appointment</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/triage')}>
              <Stethoscope className="h-6 w-6" />
              <span>Triage Patient</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/laboratory')}>
              <FlaskConical className="h-6 w-6" />
              <span>Lab Order</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/pharmacy')}>
              <Pill className="h-6 w-6" />
              <span>Dispense</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/billing')}>
              <Receipt className="h-6 w-6" />
              <span>New Invoice</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* New Patient Dialog */}
      <Dialog open={showNewPatient} onOpenChange={setShowNewPatient}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register New Patient</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegisterPatient} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input value={patientForm.firstName} onChange={e => setField('firstName', e.target.value)} required placeholder="First name" />
              </div>
              <div>
                <Label>Middle Name</Label>
                <Input value={patientForm.middleName} onChange={e => setField('middleName', e.target.value)} placeholder="Middle name" />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input value={patientForm.lastName} onChange={e => setField('lastName', e.target.value)} required placeholder="Last name" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Date of Birth *</Label>
                <Input type="date" value={patientForm.dateOfBirth} onChange={e => setField('dateOfBirth', e.target.value)} required />
              </div>
              <div>
                <Label>Gender *</Label>
                <Select value={patientForm.gender} onValueChange={v => setField('gender', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Blood Group</Label>
                <Select value={patientForm.bloodGroup} onValueChange={v => setField('bloodGroup', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                      <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Primary Phone *</Label>
                <Input value={patientForm.phonePrimary} onChange={e => setField('phonePrimary', e.target.value)} placeholder="+91 XXXXX XXXXX" required />
              </div>
              <div>
                <Label>Secondary Phone</Label>
                <Input value={patientForm.phoneSecondary} onChange={e => setField('phoneSecondary', e.target.value)} placeholder="+91 XXXXX XXXXX" />
              </div>
            </div>

            <div>
              <Label>Email</Label>
              <Input type="email" value={patientForm.email} onChange={e => setField('email', e.target.value)} placeholder="patient@email.com" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>State</Label>
                <Select value={patientForm.region} onValueChange={v => setField('region', v)}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>City / District</Label>
                <Input value={patientForm.zone} onChange={e => setField('zone', e.target.value)} placeholder="City or district" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Emergency Contact</Label>
                <Input value={patientForm.emergencyContactName} onChange={e => setField('emergencyContactName', e.target.value)} placeholder="Contact name" />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input value={patientForm.emergencyContactPhone} onChange={e => setField('emergencyContactPhone', e.target.value)} placeholder="+91 XXXXX XXXXX" />
              </div>
              <div>
                <Label>Relationship</Label>
                <Input value={patientForm.emergencyContactRelationship} onChange={e => setField('emergencyContactRelationship', e.target.value)} placeholder="e.g. Spouse" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="hasInsurance"
                checked={patientForm.hasInsurance}
                onChange={e => setField('hasInsurance', e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="hasInsurance">Has Insurance</Label>
            </div>

            {patientForm.hasInsurance && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Insurance Provider</Label>
                  <Select value={patientForm.insuranceProvider} onValueChange={v => setField('insuranceProvider', v)}>
                    <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                    <SelectContent>
                      {INSURANCE_PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Insurance ID</Label>
                  <Input value={patientForm.insuranceId} onChange={e => setField('insuranceId', e.target.value)} placeholder="Policy / Member ID" />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowNewPatient(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingPatient}>
                {savingPatient ? 'Registering...' : 'Register Patient'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
