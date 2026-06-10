import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Users, Search, RefreshCw, FlaskConical, Scan, BedDouble, Pill, Loader2, UserCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchableSelect } from '@/components/ui/searchable-select'
import client from '@/api/client'
import { useAuth } from '@/lib/auth'

const POLL_MS = 10000
const PAGE = 15

const DEPTS = [
  { key: 'lab',       label: 'Lab',       Icon: FlaskConical, color: 'text-amber-600' },
  { key: 'radiology', label: 'Radiology', Icon: Scan,         color: 'text-cyan-600' },
  { key: 'ipd',       label: 'IPD',       Icon: BedDouble,    color: 'text-indigo-600' },
  { key: 'pharmacy',  label: 'Pharmacy',  Icon: Pill,         color: 'text-purple-600' },
]

function age(dob) {
  if (!dob) return ''
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) + 'y'
}

export default function PatientCrmModule() {
  const { user } = useAuth()
  const canAssign = ['admin', 'super_admin', 'receptionist'].includes(user?.role)

  const [patients, setPatients] = useState([])
  const [crmUsers, setCrmUsers] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const firstLoad = useRef(true)

  const fetchData = useCallback(async (silent) => {
    if (silent) setRefreshing(true)
    try {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) })
      if (search) params.set('search', search)
      const res = await client.get(`/patients?${params.toString()}`)
      setPatients(res.data || [])
      setTotal(res.meta?.total || 0)
    } catch (e) {
      if (!silent) toast.error(e.message || 'Failed to load patients')
    } finally {
      if (firstLoad.current) { setLoading(false); firstLoad.current = false }
      if (silent) setRefreshing(false)
    }
  }, [page, search])

  // CRM users (for the assign dropdown) — only needed by staff who can assign.
  useEffect(() => {
    if (canAssign) client.get('/patient-crm/users').then((r) => setCrmUsers(r.data || [])).catch(() => {})
  }, [canAssign])

  // Initial load + live sync.
  useEffect(() => {
    fetchData(false)
    const interval = setInterval(() => fetchData(true), POLL_MS)
    const onFocus = () => { if (document.visibilityState !== 'hidden') fetchData(true) }
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [fetchData])

  async function assign(patientId, crmUserId) {
    setBusyId(patientId)
    try {
      await client.post('/patient-crm/assign', { patientId, crmUserId: crmUserId === '__none' ? null : crmUserId })
      toast.success(crmUserId === '__none' ? 'Unassigned' : 'Patient assigned')
      fetchData(true)
    } catch (e) { toast.error(e.message || 'Assign failed') } finally { setBusyId(null) }
  }

  async function route(patientId, dept) {
    setBusyId(patientId)
    try {
      const res = await client.post('/patient-crm/route', { patientId, departments: [dept] })
      const outcome = res.data?.[dept] || 'done'
      if (outcome === 'created') toast.success(`Sent to ${dept.toUpperCase()}`)
      else toast.message(`${dept.toUpperCase()}: ${outcome}`)
      fetchData(true)
    } catch (e) { toast.error(e.message || 'Routing failed') } finally { setBusyId(null) }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Patient Coordination
            <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-normal text-gray-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              {refreshing ? 'Syncing…' : 'Live'}
            </span>
          </CardTitle>
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-8"
              placeholder="Search name / UHID / phone"
              value={search}
              onChange={(e) => { setPage(0); setSearch(e.target.value) }}
            />
          </div>
        </div>
        {!canAssign && (
          <p className="text-xs text-gray-500">Showing only the patients assigned to you. New assignments appear automatically.</p>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : patients.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            {canAssign ? 'No patients found.' : 'No patients are assigned to you yet.'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  {canAssign && <TableHead>Assigned coordinator</TableHead>}
                  <TableHead>Routed to</TableHead>
                  <TableHead className="text-right">Send to department</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((p) => (
                  <TableRow key={p.id} className={busyId === p.id ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="font-medium">{[p.firstName, p.lastName].filter(Boolean).join(' ')}</div>
                      <div className="text-xs text-gray-500">UHID {p.mrn}{p.dateOfBirth ? ` · ${age(p.dateOfBirth)}` : ''}{p.gender ? ` · ${p.gender}` : ''}</div>
                    </TableCell>

                    {canAssign && (
                      <TableCell>
                        <SearchableSelect
                          className="h-8 w-52"
                          value={p.assignedCrmUserId || '__none'}
                          onChange={(v) => assign(p.id, v)}
                          placeholder="Unassigned"
                          searchPlaceholder="Search coordinator…"
                          emptyText="No coordinators"
                          options={[
                            { value: '__none', label: 'Unassigned' },
                            ...crmUsers.map((u) => ({ value: u.id, label: u.fullName, sublabel: u.email })),
                          ]}
                        />
                      </TableCell>
                    )}

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.labReportCount > 0 && <Badge variant="outline" className="text-amber-700">Lab {p.labReportCount}</Badge>}
                        {p.radiologyReportCount > 0 && <Badge variant="outline" className="text-cyan-700">Rad {p.radiologyReportCount}</Badge>}
                        {p.admittedCount > 0 && <Badge variant="outline" className="text-indigo-700">IPD</Badge>}
                        {!p.labReportCount && !p.radiologyReportCount && !p.admittedCount && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        {DEPTS.map(({ key, label, Icon, color }) => (
                          <Button
                            key={key}
                            variant="outline" size="sm"
                            disabled={busyId === p.id}
                            onClick={() => route(p.id, key)}
                            className="h-7 px-2 text-xs"
                            title={`Send to ${label}`}
                          >
                            <Icon className={`h-3.5 w-3.5 mr-1 ${color}`} /> {label}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination + refresh */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-3">
            <span>{total} patient{total === 1 ? '' : 's'}</span>
            <button onClick={() => fetchData(true)} className="flex items-center gap-1 hover:text-gray-700">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>Prev</Button>
              <span>Page {page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((n) => n + 1)}>Next</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
