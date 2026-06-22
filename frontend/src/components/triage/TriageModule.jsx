import { useState, useMemo, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertCircle, Stethoscope, Activity, Shield, Plus, Search,
  Baby, Timer, AlertTriangle, Loader2, RefreshCw, ArrowRight
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import client from '@/api/client'
import PatientLookup from '@/components/common/PatientLookup'

const URGENCY_LEVELS = {
  red:    { label: 'Emergency',  description: 'Immediate - Life threatening', color: 'bg-red-500',    textColor: 'text-white', waitTime: '< 5 min' },
  yellow: { label: 'Urgent',     description: 'Within 10 minutes',            color: 'bg-yellow-500', textColor: 'text-white', waitTime: '< 10 min' },
  green:  { label: 'Non-Urgent', description: 'Normal queue',                 color: 'bg-green-500',  textColor: 'text-white', waitTime: 'Normal' },
  black:  { label: 'Deceased',   description: 'No vital signs',               color: 'bg-gray-700',   textColor: 'text-white', waitTime: 'N/A' },
}

const TRIAGE_TYPES = {
  emergency:  { label: 'Emergency Triage',  icon: AlertCircle, color: 'border-red-300 bg-red-50' },
  pediatric:  { label: 'Pediatric ETAT',    icon: Baby,        color: 'border-orange-300 bg-orange-50' },
  mch:        { label: 'MCH Triage',        icon: Activity,    color: 'border-pink-300 bg-pink-50' },
  psychiatric:{ label: 'Psychiatric Triage',icon: Shield,      color: 'border-purple-300 bg-purple-50' },
}

const TRIAGE_ITEMS_PER_PAGE = 10

const triageSchema = z.object({
  patientId:             z.string().min(1, 'Patient is required'),
  triageType:            z.enum(['emergency', 'pediatric', 'mch', 'psychiatric']),
  urgencyLevel:          z.enum(['red', 'yellow', 'green', 'black']),
  chiefComplaint:        z.string().min(5, 'Chief complaint is required'),
  temperature:           z.number().optional(),
  bloodPressureSystolic: z.number().optional(),
  bloodPressureDiastolic:z.number().optional(),
  pulseRate:             z.number().optional(),
  respiratoryRate:       z.number().optional(),
  spO2:                  z.number().optional(),
  weight:                z.number().optional(),
  notes:                 z.string().optional(),
})

function calculateAge(dob) {
  if (!dob) return 'N/A'
  const birthDate = new Date(dob)
  if (isNaN(birthDate.getTime())) return 'N/A'
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}

export default function TriageModule() {
  const [activeTab, setActiveTab]                   = useState('dashboard')
  const [selectedTriageType, setSelectedTriageType] = useState('all')
  const [searchQuery, setSearchQuery]               = useState('')
  const [showNewTriageDialog, setShowNewTriageDialog] = useState(false)
  const [selectedPatient, setSelectedPatient]       = useState(null)
  const [patientSearch, setPatientSearch]           = useState('')
  const [isSubmitting, setIsSubmitting]             = useState(false)
  const [patients, setPatients]                     = useState([])
  const [triageRecords, setTriageRecords]           = useState([])
  const [loading, setLoading]                       = useState(true)
  const [error, setError]                           = useState(null)
  const [triageCurrentPage, setTriageCurrentPage]   = useState(1)

  const form = useForm({
    resolver: zodResolver(triageSchema),
    defaultValues: {
      patientId: '', triageType: 'emergency', urgencyLevel: 'green', chiefComplaint: '', notes: '',
    },
  })

  // Patients loaded once on mount — no need to reload every 30 seconds
  const fetchPatients = useCallback(async () => {
    try {
      const res = await client.get('/patients?status=active&limit=500')
      setPatients(res.data ?? [])
    } catch { /* non-fatal */ }
  }, [])

  // Only triage records are polled on the interval
  const fetchTriageRecords = useCallback(async () => {
    setError(null)
    try {
      // Fetch all records so client-side stats and filters work
      const res = await client.get(`/triage?limit=500&offset=0`)
      const raw = res.data ?? []
      setTriageRecords(raw.map(q => ({
        id: q.id,
        patientId: q.patientId,
        patient: q.patient,
        triageType: q.serviceArea === 'Emergency' ? 'emergency' :
                    q.serviceArea === 'Pediatric' ? 'pediatric' :
                    q.serviceArea === 'MCH' ? 'mch' :
                    q.serviceArea === 'Psychiatric' ? 'psychiatric' : 'emergency',
        urgencyLevel: q.priority === 'urgent' ? 'red' : 'green',
        chiefComplaint: q.serviceType || q.serviceArea || 'General',
        status: q.status,
        createdAt: new Date(q.joinedQueueAt),
        waitTime: q.waitTime,
      })))
    } catch (err) {
      setError(err.message || 'Failed to load triage records')
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchPatients(), fetchTriageRecords()])
    setLoading(false)
  }, [fetchPatients, fetchTriageRecords])

  useEffect(() => {
    fetchData()
    // Only poll triage records — not patients — every 30 seconds
    const interval = setInterval(fetchTriageRecords, 30000)
    return () => clearInterval(interval)
  }, [fetchData, fetchTriageRecords])

  // Reset page to 1 when triageRecords changes
  useEffect(() => {
    setTriageCurrentPage(1)
  }, [triageRecords.length])

  const stats = useMemo(() => {
    const today = new Date()
    const todayRecords = triageRecords.filter(r =>
      r?.createdAt && new Date(r.createdAt).toDateString() === today.toDateString()
    )
    return {
      total:     todayRecords.length,
      emergency: todayRecords.filter(r => r.urgencyLevel === 'red').length,
      urgent:    todayRecords.filter(r => r.urgencyLevel === 'yellow').length,
      nonUrgent: todayRecords.filter(r => r.urgencyLevel === 'green').length,
      waiting:   todayRecords.filter(r => r.status === 'waiting').length,
      inProgress:todayRecords.filter(r => r.status === 'in_progress').length,
    }
  }, [triageRecords])

  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients.slice(0, 20)
    const lower = patientSearch.toLowerCase()
    return patients.filter(p =>
      p?.firstName?.toLowerCase().includes(lower) ||
      p?.lastName?.toLowerCase().includes(lower) ||
      p?.mrn?.toLowerCase().includes(lower)
    ).slice(0, 20)
  }, [patients, patientSearch])

  const filteredRecords = useMemo(() =>
    triageRecords.filter(r => {
      if (selectedTriageType !== 'all' && r.triageType !== selectedTriageType) return false
      if (searchQuery) {
        const lower = searchQuery.toLowerCase()
        const name = r.patient ? `${r.patient.firstName} ${r.patient.lastName}`.toLowerCase() : ''
        return name.includes(lower) || r.chiefComplaint.toLowerCase().includes(lower)
      }
      return true
    }), [triageRecords, selectedTriageType, searchQuery])

  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true)
      await client.post('/triage', {
        patientId:   data.patientId,
        serviceArea: data.triageType === 'emergency' ? 'Emergency' :
                     data.triageType === 'pediatric'  ? 'Pediatric' :
                     data.triageType === 'mch'        ? 'MCH' : 'OPD',
        priority: data.urgencyLevel === 'red' ? 'urgent' : 'normal',
      })
      toast.success('Triage assessment completed successfully')
      setShowNewTriageDialog(false)
      form.reset()
      setSelectedPatient(null)
      fetchData()
    } catch (err) {
      toast.error('Failed to complete triage assessment')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
        <p className="text-gray-500">Loading triage data...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 mb-4">Failed to load triage data</p>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Stethoscope className="h-8 w-8 text-red-600" />
            Triage System
          </h1>
          <p className="text-gray-500">Multi-type triage (Emergency, Pediatric ETAT, MCH, Psychiatric)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setShowNewTriageDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Triage
          </Button>
        </div>
      </div>

      {/* Triage Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(TRIAGE_TYPES).map(([key, type]) => {
          const Icon = type.icon
          return (
            <Card key={key} className={`border-2 cursor-pointer hover:shadow-lg transition ${type.color}`}
              onClick={() => { setSelectedTriageType(key); form.setValue('triageType', key); setShowNewTriageDialog(true) }}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    key === 'emergency' ? 'bg-red-500' : key === 'pediatric' ? 'bg-orange-500' : key === 'mch' ? 'bg-pink-500' : 'bg-purple-500'
                  }`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">{type.label}</p>
                    <p className="text-sm text-gray-600">
                      {key === 'emergency' ? 'Life-threatening cases' : key === 'pediatric' ? 'Children under 15' : key === 'mch' ? 'Maternal & Child Health' : 'Mental health cases'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Color Codes Legend */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Triage Color Codes (WHO ETAT Compatible)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(URGENCY_LEVELS).map(([key, level]) => (
              <div key={key} className={`flex items-center gap-3 p-4 rounded-lg ${level.color} ${level.textColor}`}>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="font-bold">{key.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-bold">{level.label}</p>
                  <p className="text-sm opacity-90">{level.description}</p>
                  <p className="text-xs opacity-75">Wait: {level.waitTime}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { count: stats.emergency, label: 'Emergency (Red)',    bg: 'bg-red-50',    text: 'text-red-700',    sub: 'text-red-600' },
          { count: stats.urgent,    label: 'Urgent (Yellow)',    bg: 'bg-yellow-50', text: 'text-yellow-700', sub: 'text-yellow-600' },
          { count: stats.nonUrgent, label: 'Non-Urgent (Green)', bg: 'bg-green-50',  text: 'text-green-700',  sub: 'text-green-600' },
          { count: stats.waiting,   label: 'Waiting',            bg: 'bg-blue-50',   text: 'text-blue-700',   sub: 'text-blue-600' },
          { count: stats.inProgress,label: 'In Progress',        bg: 'bg-orange-50', text: 'text-orange-700', sub: 'text-orange-600' },
          { count: stats.total,     label: "Today's Total",      bg: '',             text: '',                sub: 'text-gray-600' },
        ].map(({ count, label, bg, text, sub }) => (
          <Card key={label} className={bg}>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className={`text-3xl font-bold ${text}`}>{count}</p>
                <p className={`text-sm ${sub}`}>{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="waiting">Waiting List</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Triage Assessments</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('waiting')}>View All</Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No triage assessments yet</p>
                  <p className="text-sm">Click "New Triage" to start an assessment</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {filteredRecords.slice(0, 10).map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${URGENCY_LEVELS[record.urgencyLevel].color}`}>
                            <span className="font-bold text-white">{record.urgencyLevel.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {record.patient ? `${record.patient.firstName} ${record.patient.lastName}` : 'Unknown Patient'}
                            </p>
                            <p className="text-sm text-gray-500">{record.chiefComplaint}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{TRIAGE_TYPES[record.triageType]?.label}</Badge>
                              <span className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(record.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Badge className={
                          record.status === 'waiting' ? 'bg-blue-100 text-blue-700 border-0' :
                          record.status === 'in_progress' ? 'bg-orange-100 text-orange-700 border-0' :
                          'bg-green-100 text-green-700 border-0'
                        }>
                          {record.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Waiting List */}
        <TabsContent value="waiting" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Select value={selectedTriageType} onValueChange={setSelectedTriageType}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Filter by type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="pediatric">Pediatric ETAT</SelectItem>
                    <SelectItem value="mch">MCH</SelectItem>
                    <SelectItem value="psychiatric">Psychiatric</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search patients..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Priority</TableHead><TableHead>Patient</TableHead><TableHead>Type</TableHead>
                    <TableHead>Chief Complaint</TableHead><TableHead>Wait Time</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.filter(r => r.status === 'waiting').length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No patients waiting</TableCell></TableRow>
                  ) : (
                    filteredRecords
                      .filter(r => r.status === 'waiting')
                      .sort((a, b) => ({ red: 0, yellow: 1, green: 2, black: 3 }[a.urgencyLevel] - { red: 0, yellow: 1, green: 2, black: 3 }[b.urgencyLevel]))
                      .slice((triageCurrentPage - 1) * TRIAGE_ITEMS_PER_PAGE, triageCurrentPage * TRIAGE_ITEMS_PER_PAGE)
                      .map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${URGENCY_LEVELS[record.urgencyLevel].color}`}>
                              <span className="font-bold text-white text-sm">{record.urgencyLevel.charAt(0).toUpperCase()}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{record.patient?.firstName?.[0]}{record.patient?.lastName?.[0]}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{record.patient ? `${record.patient.firstName} ${record.patient.lastName}` : 'Unknown'}</p>
                                <p className="text-xs text-gray-500">{record.patient?.mrn}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{TRIAGE_TYPES[record.triageType]?.label}</Badge></TableCell>
                          <TableCell>{record.chiefComplaint}</TableCell>
                          <TableCell>
                            <Timer className="inline h-4 w-4 mr-1 text-gray-400" />
                            {formatDistanceToNow(new Date(record.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell><Badge className="bg-blue-100 text-blue-700 border-0">Waiting</Badge></TableCell>
                          <TableCell><Button size="sm">Start Assessment</Button></TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
              {filteredRecords.filter(r => r.status === 'waiting').length > TRIAGE_ITEMS_PER_PAGE && (
                <div className="flex items-center justify-end gap-2 p-4 border-t">
                  <Button variant="outline" size="sm" onClick={() => setTriageCurrentPage(prev => Math.max(1, prev - 1))} disabled={triageCurrentPage === 1}>
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {triageCurrentPage} of {Math.ceil(filteredRecords.filter(r => r.status === 'waiting').length / TRIAGE_ITEMS_PER_PAGE)}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setTriageCurrentPage(prev => prev + 1)} disabled={triageCurrentPage >= Math.ceil(filteredRecords.filter(r => r.status === 'waiting').length / TRIAGE_ITEMS_PER_PAGE)}>
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Triage History</CardTitle>
              <CardDescription>Completed triage assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Patient</TableHead><TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead><TableHead>Chief Complaint</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.filter(r => r.status === 'completed').length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No completed assessments</TableCell></TableRow>
                  ) : (
                    filteredRecords.filter(r => r.status === 'completed').map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{new Date(record.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{record.patient ? `${record.patient.firstName} ${record.patient.lastName}` : 'Unknown'}</TableCell>
                        <TableCell><Badge variant="outline">{TRIAGE_TYPES[record.triageType]?.label}</Badge></TableCell>
                        <TableCell>
                          <Badge className={`${URGENCY_LEVELS[record.urgencyLevel].color} border-0`}>
                            {URGENCY_LEVELS[record.urgencyLevel].label}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.chiefComplaint}</TableCell>
                        <TableCell><Badge className="bg-green-100 text-green-700 border-0">Completed</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Triage Dialog */}
      <Dialog open={showNewTriageDialog} onOpenChange={setShowNewTriageDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Triage Assessment</DialogTitle>
            <DialogDescription>Perform triage assessment for a patient</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Patient Selection */}
              <FormField control={form.control} name="patientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient *</FormLabel>
                  <PatientLookup
                    showHint={false}
                    selectedPatient={null}
                    onSelect={(p) => {
                      setPatients(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev])
                      field.onChange(p.id)
                      setSelectedPatient(p)
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )} />

              {selectedPatient && (
                <Card className="bg-gray-50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{selectedPatient.firstName[0]}{selectedPatient.lastName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                        <p className="text-sm text-gray-500">{selectedPatient.mrn} • {calculateAge(selectedPatient.dateOfBirth)} yrs • {selectedPatient.gender}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Triage Type */}
              <FormField control={form.control} name="triageType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Triage Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select triage type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="emergency">Emergency Triage</SelectItem>
                      <SelectItem value="pediatric">Pediatric ETAT</SelectItem>
                      <SelectItem value="mch">MCH Triage</SelectItem>
                      <SelectItem value="psychiatric">Psychiatric Triage</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Urgency Level */}
              <FormField control={form.control} name="urgencyLevel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Urgency Level *</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-4 gap-4">
                      {Object.entries(URGENCY_LEVELS).map(([key, level]) => (
                        <div key={key}>
                          <RadioGroupItem value={key} id={`urgency-${key}`} className="peer sr-only" />
                          <Label htmlFor={`urgency-${key}`}
                            className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer hover:bg-accent transition ${field.value === key ? `${level.color} ${level.textColor}` : 'border-muted bg-popover'}`}>
                            <span className="font-bold text-lg">{key.charAt(0).toUpperCase()}</span>
                            <span className="text-sm">{level.label}</span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Chief Complaint */}
              <FormField control={form.control} name="chiefComplaint" render={({ field }) => (
                <FormItem>
                  <FormLabel>Chief Complaint *</FormLabel>
                  <FormControl><Textarea placeholder="Patient's main complaint..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Vital Signs */}
              <div>
                <h4 className="font-medium mb-3">Vital Signs (Optional)</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { name: 'temperature',           label: 'Temperature (°F)',  placeholder: '98.6', step: '0.1' },
                    { name: 'bloodPressureSystolic',  label: 'BP Systolic (mmHg)',placeholder: '120' },
                    { name: 'bloodPressureDiastolic', label: 'BP Diastolic (mmHg)',placeholder: '80' },
                    { name: 'pulseRate',              label: 'Pulse Rate (bpm)',  placeholder: '72' },
                    { name: 'respiratoryRate',        label: 'Respiratory Rate',  placeholder: '16' },
                    { name: 'spO2',                   label: 'SpO₂ (%)',          placeholder: '98', step: '0.1' },
                  ].map(({ name, label, placeholder, step }) => (
                    <FormField key={name} control={form.control} name={name} render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input type="number" step={step || '1'} placeholder={placeholder} {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} />
                        </FormControl>
                      </FormItem>
                    )} />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowNewTriageDialog(false); form.reset(); setSelectedPatient(null) }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Complete Triage'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
