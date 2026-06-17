import { useState, useEffect, useCallback } from 'react'
import { getOrgSettings } from '@/lib/orgSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  UserCog, IndianRupee, CheckCircle2, BarChart3,
  Search, Plus, Edit2, Trash2, CheckSquare, RefreshCw,
  Users, Clock, Wallet, Printer, FileDown, CheckCheck, ChevronLeft, ChevronRight,
} from 'lucide-react'
import client from '@/api/client'

function fmt(n) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function periodLabel(p) {
  if (!p) return '—'
  const s = String(p)
  // New format: a plain number of days. Old data may still be "YYYY-MM".
  if (/^\d+$/.test(s)) return `${s} day${s === '1' ? '' : 's'}`
  const [y, m] = s.split('-')
  if (!m) return s
  return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
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

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}><Icon className="h-5 w-5 text-white" /></div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function SetupTab() {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [configDialog, setConfigDialog] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ commissionType: 'percentage', commissionRate: '10', consultationFee: '', followUpDays: '', isActive: true, notes: '' })
  const [saving, setSaving] = useState(false)
  const [setupPage, setSetupPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await client.get('/doctor-accountability?resource=doctors')
    if (res.success) setDoctors(res.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setSetupPage(1)
  }, [search])

  function openConfig(doc) {
    setSelected(doc)
    const fee = doc.consultationFee != null ? String(doc.consultationFee) : ''
    const followUp = doc.followUpDays != null ? String(doc.followUpDays) : ''
    if (doc.commissionConfig) {
      setForm({
        commissionType: doc.commissionConfig.commissionType,
        commissionRate: String(doc.commissionConfig.commissionRate),
        consultationFee: fee,
        followUpDays: followUp,
        isActive: doc.commissionConfig.isActive,
        notes: doc.commissionConfig.notes || '',
      })
    } else {
      setForm({ commissionType: 'percentage', commissionRate: '10', consultationFee: fee, followUpDays: followUp, isActive: true, notes: '' })
    }
    setConfigDialog(true)
  }

  async function saveConfig() {
    if (!selected) return
    setSaving(true)
    const res = await client.post('/doctor-accountability?resource=config', {
      doctorId: selected.id,
      ...form,
      commissionRate: parseFloat(form.commissionRate) || 0,
      consultationFee: form.consultationFee === '' ? null : parseFloat(form.consultationFee) || 0,
      followUpDays: form.followUpDays === '' ? null : parseInt(form.followUpDays) || 0,
    })
    if (res.success) { toast.success('Commission config saved'); setConfigDialog(false); load() }
    else toast.error(res.error || 'Failed to save')
    setSaving(false)
  }

  const filtered = doctors.filter(d =>
    d.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (d.specialization || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search doctors..." className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
      </div>
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading doctors...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No doctors found. Add doctors in Settings → Users first.</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Appointment Fee</TableHead>
                <TableHead>Free Follow-up</TableHead>
                <TableHead>Commission Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const ITEMS_PER_PAGE = 10
                const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
                const startIdx = (setupPage - 1) * ITEMS_PER_PAGE
                const endIdx = startIdx + ITEMS_PER_PAGE
                const paginatedData = filtered.slice(startIdx, endIdx)
                return paginatedData.map(doc => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.fullName}</TableCell>
                    <TableCell className="text-gray-500">{doc.specialization || '—'}</TableCell>
                    <TableCell className="text-gray-500">{doc.department?.name || '—'}</TableCell>
                    <TableCell>
                      {doc.consultationFee != null
                        ? <span className="font-medium text-gray-800">{fmt(doc.consultationFee)}</span>
                        : <span className="text-gray-400 italic">Not set</span>}
                    </TableCell>
                    <TableCell>
                      {doc.followUpDays
                        ? <span className="text-gray-700">{doc.followUpDays} days</span>
                        : <span className="text-gray-400 italic">—</span>}
                    </TableCell>
                    <TableCell>
                      {doc.commissionConfig
                        ? doc.commissionConfig.commissionType === 'percentage'
                          ? `${doc.commissionConfig.commissionRate}%`
                          : fmt(doc.commissionConfig.commissionRate)
                        : <span className="text-gray-400 italic">Not set</span>}
                    </TableCell>
                    <TableCell>
                      {doc.commissionConfig ? (
                        <Badge variant={doc.commissionConfig.isActive ? 'default' : 'secondary'}>
                          {doc.commissionConfig.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      ) : <Badge variant="outline" className="text-gray-400">No Config</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openConfig(doc)}>
                        <Edit2 className="h-3.5 w-3.5 mr-1" />{doc.commissionConfig ? 'Edit' : 'Set Up'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              })()}
            </TableBody>
          </Table>
          {filtered.length > 10 && (() => {
            const ITEMS_PER_PAGE = 10
            const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
            return (
              <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
                <Button variant="outline" size="sm" onClick={() => setSetupPage(p => Math.max(1, p - 1))} disabled={setupPage === 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Previous
                </Button>
                <span className="text-sm text-gray-600">Page {setupPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setSetupPage(p => Math.min(totalPages, p + 1))} disabled={setupPage === totalPages}>
                  Next<ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )
          })()}
        </div>
      )}
      <Dialog open={configDialog} onOpenChange={setConfigDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Commission Config — {selected?.fullName}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Appointment Fee (₹)</Label>
                <Input
                  type="number" min={0} step={50} className="mt-1"
                  value={form.consultationFee}
                  onChange={e => setForm(f => ({ ...f, consultationFee: e.target.value }))}
                  placeholder="e.g. 500"
                />
                <p className="text-xs text-gray-400 mt-1">Default fee when booking this doctor.</p>
              </div>
              <div>
                <Label>Free Follow-up (days)</Label>
                <Input
                  type="number" min={0} step={1} className="mt-1"
                  value={form.followUpDays}
                  onChange={e => setForm(f => ({ ...f, followUpDays: e.target.value }))}
                  placeholder="e.g. 7"
                />
                <p className="text-xs text-gray-400 mt-1">Repeat visit within N days = no charge. Blank = always charge.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Commission Type</Label>
                <Select value={form.commissionType} onValueChange={v => setForm(f => ({ ...f, commissionType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rate {form.commissionType === 'percentage' ? '(%)' : '(₹)'}</Label>
                <Input type="number" className="mt-1" value={form.commissionRate} onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))} min={0} step={form.commissionType === 'percentage' ? 0.5 : 10} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.isActive ? 'active' : 'inactive'} onValueChange={v => setForm(f => ({ ...f, isActive: v === 'active' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input className="mt-1" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this commission arrangement" />
            </div>
            <div className="flex gap-2 pt-2 justify-end">
              <Button variant="outline" onClick={() => setConfigDialog(false)}>Cancel</Button>
              <Button onClick={saveConfig} disabled={saving}>{saving ? 'Saving...' : 'Save Config'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CommissionsTab({ openAddSignal }) {
  const [commissions, setCommissions] = useState([])
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDoctor, setFilterDoctor] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [filterDate, setFilterDate] = useState('all')

  // Add dialog
  const [addDialog, setAddDialog] = useState(false)
  const [form, setForm] = useState({ doctorId: '', invoiceId: '', invoiceAmount: '', period: '' })
  const [saving, setSaving] = useState(false)

  // Edit dialog
  const [editDialog, setEditDialog] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [editForm, setEditForm] = useState({ invoiceAmount: '', period: '', invoiceId: '' })
  const [editSaving, setEditSaving] = useState(false)

  // Quick-settle dialog
  const [settleDialog, setSettleDialog] = useState(false)
  const [settleEntry, setSettleEntry] = useState(null)
  const [settleRef, setSettleRef] = useState('')
  const [settleNote, setSettleNote] = useState('')
  const [settling, setSettling] = useState(false)

  const [commissionsPage, setCommissionsPage] = useState(1)
  const [commissionsMeta, setCommissionsMeta] = useState({ total: 0, limit: 10, offset: 0, page: 1, totalPages: 1, hasMore: false })

  const ITEMS_PER_PAGE = 10

  const load = useCallback(async () => {
    setLoading(true)
    const offset = (commissionsPage - 1) * ITEMS_PER_PAGE
    const params = new URLSearchParams({ resource: 'commissions', limit: String(ITEMS_PER_PAGE), offset: String(offset) })
    if (filterDoctor !== 'all') params.set('doctorId', filterDoctor)
    if (filterStatus !== 'all') params.set('status', filterStatus)
    if (filterPeriod) params.set('period', filterPeriod)
    try {
      const [cRes, dRes] = await Promise.all([
        client.get(`/doctor-accountability?${params}`),
        client.get('/doctor-accountability?resource=doctors'),
      ])
      if (cRes.success) {
        setCommissions(cRes.data)
        if (cRes.meta) setCommissionsMeta(cRes.meta)
      }
      if (dRes.success) setDoctors(dRes.data)
    } catch (err) {
      toast.error(err.message || 'Failed to load commissions')
    } finally {
      setLoading(false)
    }
  }, [filterDoctor, filterStatus, filterPeriod, commissionsPage])

  useEffect(() => { load() }, [load])

  // Open the Add Commission dialog when triggered from the module header button
  useEffect(() => {
    if (openAddSignal) setAddDialog(true)
  }, [openAddSignal])

  useEffect(() => {
    setCommissionsPage(1)
  }, [filterDoctor, filterStatus, filterPeriod, filterDate])

  // ── Client-side date filter ────────────────────────────────────────────────
  const now = new Date()
  const displayed = commissions.filter(c => {
    if (filterDate === 'all') return true
    const d = new Date(c.createdAt)
    if (filterDate === 'today') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    }
    if (filterDate === 'week') {
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
      return d >= weekStart
    }
    if (filterDate === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }
    return true
  })

  // ── Add commission ─────────────────────────────────────────────────────────
  async function addCommission() {
    const doctor = doctors.find(d => d.id === form.doctorId)
    const config = doctor?.commissionConfig
    if (!config) { toast.error('Doctor has no commission config set up'); return }
    const invoiceAmt = parseFloat(form.invoiceAmount)
    if (!form.doctorId || isNaN(invoiceAmt)) { toast.error('Fill in doctor and invoice amount'); return }
    const commAmt = config.commissionType === 'percentage'
      ? (invoiceAmt * config.commissionRate) / 100
      : config.commissionRate
    setSaving(true)
    const res = await client.post('/doctor-accountability?resource=commission', {
      doctorId: form.doctorId, invoiceId: form.invoiceId || null,
      invoiceAmount: invoiceAmt, commissionRate: config.commissionRate,
      commissionType: config.commissionType, commissionAmount: commAmt, period: form.period,
    })
    if (res.success) {
      toast.success('Commission entry added')
      setAddDialog(false)
      setForm({ doctorId: '', invoiceId: '', invoiceAmount: '', period: '' })
      load()
    } else toast.error(res.error || 'Failed to add')
    setSaving(false)
  }

  // ── Edit commission ────────────────────────────────────────────────────────
  function openEdit(c) {
    setEditEntry(c)
    setEditForm({
      invoiceAmount: String(c.invoiceAmount),
      period: c.period || '',
      invoiceId: c.invoiceId || '',
    })
    setEditDialog(true)
  }

  async function saveEdit() {
    if (!editEntry) return
    const invoiceAmt = parseFloat(editForm.invoiceAmount)
    if (isNaN(invoiceAmt) || invoiceAmt <= 0) { toast.error('Enter a valid invoice amount'); return }
    const commAmt = editEntry.commissionType === 'percentage'
      ? (invoiceAmt * editEntry.commissionRate) / 100
      : editEntry.commissionRate
    setEditSaving(true)
    const res = await client.patch(`/doctor-accountability?resource=commission&id=${editEntry.id}`, {
      invoiceAmount: invoiceAmt,
      commissionAmount: commAmt,
      period: editForm.period,
      invoiceId: editForm.invoiceId || null,
    })
    if (res.success) { toast.success('Commission updated'); setEditDialog(false); load() }
    else toast.error(res.error || 'Failed to update')
    setEditSaving(false)
  }

  // ── Quick settle single commission ─────────────────────────────────────────
  function openSettle(c) {
    setSettleEntry(c)
    setSettleRef('')
    setSettleNote('')
    setSettleDialog(true)
  }

  async function quickSettle() {
    if (!settleEntry) return
    setSettling(true)
    const res = await client.patch('/doctor-accountability?resource=settle', {
      commissionIds: [settleEntry.id],
      settlementNote: settleNote,
      settlementRef: settleRef,
    })
    if (res.success) {
      toast.success('Commission settled')
      setSettleDialog(false)
      load()
    } else toast.error(res.error || 'Failed to settle')
    setSettling(false)
  }

  // ── Delete commission ──────────────────────────────────────────────────────
  async function deleteCommission(id) {
    if (!confirm('Delete this commission entry?')) return
    const res = await client.delete(`/doctor-accountability?resource=commission&id=${id}`)
    if (res.success) { toast.success('Deleted'); load() }
    else toast.error(res.error || 'Failed')
  }

  // ── Print receipt for a settled entry ─────────────────────────────────────
  function printReceipt(c) {
    const html = `<!DOCTYPE html><html><head><title>Settlement Receipt</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:24px;font-size:11pt;color:#1e293b}
.hosp{font-size:16pt;font-weight:bold;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:8px;margin-bottom:16px}
.title{font-size:13pt;font-weight:bold;margin-bottom:16px;color:#334155}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9}
.lbl{color:#64748b;font-size:10pt}
.val{font-weight:600}
.total{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;margin-top:16px;display:flex;justify-content:space-between}
.footer{font-size:8pt;color:#94a3b8;text-align:center;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:10px}
@media print{body{padding:12px}}</style></head><body>
<div class="hosp">${orgInfo.name}</div>
<div class="title">Commission Settlement Receipt</div>
<div class="row"><span class="lbl">Doctor</span><span class="val">${c.doctor.fullName}</span></div>
<div class="row"><span class="lbl">Period</span><span class="val">${periodLabel(c.period)}</span></div>
<div class="row"><span class="lbl">Invoice ID</span><span class="val">${c.invoiceId || '—'}</span></div>
<div class="row"><span class="lbl">Invoice Amount</span><span class="val">${fmt(c.invoiceAmount)}</span></div>
<div class="row"><span class="lbl">Commission Rate</span><span class="val">${c.commissionType === 'percentage' ? `${c.commissionRate}%` : fmt(c.commissionRate)}</span></div>
<div class="row"><span class="lbl">Settlement Reference</span><span class="val">${c.settlementRef || '—'}</span></div>
<div class="row"><span class="lbl">Settled On</span><span class="val">${c.settledAt ? format(new Date(c.settledAt), 'dd MMM yyyy HH:mm') : format(new Date(), 'dd MMM yyyy HH:mm')}</span></div>
<div class="total"><span style="font-weight:600;color:#15803d">Commission Settled</span><span style="font-size:14pt;font-weight:bold;color:#15803d">${fmt(c.commissionAmount)}</span></div>
<div class="footer">Printed: ${format(new Date(), 'dd MMM yyyy HH:mm')} | ${orgInfo.name} — Doctor Accountability System</div>
</body></html>`
    printViaIframe(html)
  }

  // ── CSV export ─────────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = [
      ['Date', 'Doctor', 'Invoice ID', 'Invoice Amount (₹)', 'Rate', 'Commission (₹)', 'Period', 'Status', 'Settlement Ref'],
      ...displayed.map(c => [
        format(new Date(c.createdAt), 'dd/MM/yyyy'),
        c.doctor.fullName,
        c.invoiceId || '',
        c.invoiceAmount,
        c.commissionType === 'percentage' ? `${c.commissionRate}%` : `₹${c.commissionRate}`,
        c.commissionAmount,
        periodLabel(c.period),
        c.status,
        c.settlementRef || '',
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `commissions-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const configuredDoctors = doctors.filter(d => d.commissionConfig)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterDoctor} onValueChange={setFilterDoctor}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Doctors" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Doctors</SelectItem>
            {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" min={0} placeholder="Follow-up valid (days)" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="w-40" />
        {/* Date range filter */}
        <Select value={filterDate} onValueChange={setFilterDate}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Created Date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV} title="Export CSV">
            <FileDown className="h-4 w-4 mr-1" />Export CSV
          </Button>
          <Button size="sm" onClick={() => setAddDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />Add Commission
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No commission entries found.</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Doctor</TableHead><TableHead>Invoice ID</TableHead>
                <TableHead>Invoice Amt</TableHead><TableHead>Rate</TableHead><TableHead>Commission</TableHead>
                <TableHead>Follow-up Valid</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{format(new Date(c.createdAt), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="font-medium">{c.doctor.fullName}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{c.invoiceId || '—'}</TableCell>
                    <TableCell>{fmt(c.invoiceAmount)}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{c.commissionType === 'percentage' ? `${c.commissionRate}%` : fmt(c.commissionRate)}</TableCell>
                    <TableCell className="font-semibold text-green-700">{fmt(c.commissionAmount)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{periodLabel(c.period)}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'settled' ? 'default' : 'secondary'} className={c.status === 'settled' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'}>
                        {c.status === 'settled' ? 'Settled' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {c.status === 'pending' && (
                          <>
                            {/* Edit */}
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600" title="Edit" onClick={() => openEdit(c)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            {/* Quick settle */}
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600" title="Settle" onClick={() => openSettle(c)}>
                              <CheckCheck className="h-3.5 w-3.5" />
                            </Button>
                            {/* Delete */}
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500" title="Delete" onClick={() => deleteCommission(c.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {c.status === 'settled' && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-500" title="Print Receipt" onClick={() => printReceipt(c)}>
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
          {commissionsMeta.total > 10 && (() => {
            const totalPages = commissionsMeta.totalPages
            return (
              <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
                <Button variant="outline" size="sm" onClick={() => setCommissionsPage(p => Math.max(1, p - 1))} disabled={commissionsPage === 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Previous
                </Button>
                <span className="text-sm text-gray-600">Page {commissionsPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCommissionsPage(p => Math.min(totalPages, p + 1))} disabled={commissionsPage === totalPages}>
                  Next<ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )
          })()}
        </div>
      )}

      {/* Add Commission Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Commission Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Doctor *</Label>
              <Select value={form.doctorId} onValueChange={v => setForm(f => ({ ...f, doctorId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>
                  {doctors.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.fullName}{d.commissionConfig ? ` (${d.commissionConfig.commissionType === 'percentage' ? `${d.commissionConfig.commissionRate}%` : fmt(d.commissionConfig.commissionRate)})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {doctors.length === 0 && <p className="text-xs text-amber-600 mt-1">No doctors found. Add doctors in Settings → Users first.</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Amount (₹) *</Label>
                <Input className="mt-1" type="number" value={form.invoiceAmount} onChange={e => setForm(f => ({ ...f, invoiceAmount: e.target.value }))} placeholder="e.g. 5000" />
              </div>
              <div>
                <Label>Follow-up Patient Valid (Days)</Label>
                <Input className="mt-1" type="number" min={0} step={1} placeholder="e.g. 30" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />
              </div>
            </div>
            {form.doctorId && form.invoiceAmount && (() => {
              const doc = doctors.find(d => d.id === form.doctorId)
              const cfg = doc?.commissionConfig
              if (!cfg) return null
              const inv = parseFloat(form.invoiceAmount) || 0
              const comm = cfg.commissionType === 'percentage' ? (inv * cfg.commissionRate) / 100 : cfg.commissionRate
              return (
                <div className="bg-green-50 rounded-lg p-3 text-sm">
                  <span className="text-gray-600">Commission to be recorded: </span>
                  <span className="font-bold text-green-700">{fmt(comm)}</span>
                </div>
              )
            })()}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddDialog(false)}>Cancel</Button>
              <Button onClick={addCommission} disabled={saving}>{saving ? 'Adding...' : 'Add Entry'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Commission Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Commission — {editEntry?.doctor?.fullName}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Amount (₹) *</Label>
                <Input className="mt-1" type="number" value={editForm.invoiceAmount} onChange={e => setEditForm(f => ({ ...f, invoiceAmount: e.target.value }))} />
              </div>
              <div>
                <Label>Follow-up Patient Valid (Days)</Label>
                <Input className="mt-1" type="number" min={0} step={1} placeholder="e.g. 30" value={editForm.period} onChange={e => setEditForm(f => ({ ...f, period: e.target.value }))} />
              </div>
            </div>
            {editEntry && editForm.invoiceAmount && (() => {
              const inv = parseFloat(editForm.invoiceAmount) || 0
              const comm = editEntry.commissionType === 'percentage'
                ? (inv * editEntry.commissionRate) / 100
                : editEntry.commissionRate
              return (
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <span className="text-gray-600">Recalculated commission: </span>
                  <span className="font-bold text-blue-700">{fmt(comm)}</span>
                </div>
              )
            })()}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button onClick={saveEdit} disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Settle Dialog */}
      <Dialog open={settleDialog} onOpenChange={setSettleDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Settle Commission</DialogTitle></DialogHeader>
          {settleEntry && (
            <div className="space-y-4 pt-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm space-y-1">
                <div className="font-semibold text-green-800">{settleEntry.doctor?.fullName}</div>
                <div className="text-gray-600">Commission: <span className="font-bold text-green-700">{fmt(settleEntry.commissionAmount)}</span></div>
                <div className="text-gray-500">Period: {periodLabel(settleEntry.period)}</div>
              </div>
              <div>
                <Label>Settlement Reference</Label>
                <Input className="mt-1" value={settleRef} onChange={e => setSettleRef(e.target.value)} placeholder="Cheque / Transfer / UPI ref" />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input className="mt-1" value={settleNote} onChange={e => setSettleNote(e.target.value)} placeholder="Optional note" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setSettleDialog(false)}>Cancel</Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={quickSettle} disabled={settling}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {settling ? 'Settling...' : `Settle ${fmt(settleEntry.commissionAmount)}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SettlementTab() {
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [settling, setSettling] = useState(false)
  const [note, setNote] = useState('')
  const [ref, setRef] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await client.get('/doctor-accountability?resource=commissions&status=pending')
    if (res.success) setCommissions(res.data)
    setLoading(false)
    setSelected(new Set())
  }, [])

  useEffect(() => { load() }, [load])

  function toggle(id) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function toggleAll() {
    if (selected.size === commissions.length) setSelected(new Set())
    else setSelected(new Set(commissions.map(c => c.id)))
  }

  async function settle() {
    if (selected.size === 0) { toast.error('Select at least one commission to settle'); return }
    setSettling(true)
    const res = await client.patch('/doctor-accountability?resource=settle', {
      commissionIds: Array.from(selected), settlementNote: note, settlementRef: ref,
    })
    if (res.success) { toast.success(res.message || 'Settled successfully'); setNote(''); setRef(''); load() }
    else toast.error(res.error || 'Failed to settle')
    setSettling(false)
  }

  const totalSelected = commissions.filter(c => selected.has(c.id)).reduce((s, c) => s + c.commissionAmount, 0)

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : commissions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No pending commissions to settle.</div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{commissions.length} pending commissions</p>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              <CheckSquare className="h-4 w-4 mr-1" />
              {selected.size === commissions.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Doctor</TableHead><TableHead>Invoice Amt</TableHead>
                <TableHead>Commission</TableHead><TableHead>Follow-up Valid</TableHead><TableHead>Invoice ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map(c => (
                <TableRow key={c.id} className={selected.has(c.id) ? 'bg-blue-50' : ''}>
                  <TableCell>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 cursor-pointer" />
                  </TableCell>
                  <TableCell className="font-medium">{c.doctor.fullName}</TableCell>
                  <TableCell>{fmt(c.invoiceAmount)}</TableCell>
                  <TableCell className="font-semibold text-green-700">{fmt(c.commissionAmount)}</TableCell>
                  <TableCell className="text-sm text-gray-500">{periodLabel(c.period)}</TableCell>
                  <TableCell className="text-sm text-gray-500">{c.invoiceId || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {selected.size > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-800">{selected.size} commission(s) selected — Total: {fmt(totalSelected)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Settlement Reference</Label>
                    <Input value={ref} onChange={e => setRef(e.target.value)} placeholder="Cheque / Transfer ref" className="mt-1 h-9 bg-white" />
                  </div>
                  <div>
                    <Label className="text-xs">Settlement Note</Label>
                    <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note" className="mt-1 h-9 bg-white" />
                  </div>
                </div>
                <Button onClick={settle} disabled={settling} className="w-full bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {settling ? 'Settling...' : `Settle ${selected.size} Commission(s) — ${fmt(totalSelected)}`}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function FeeStructureTab() {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [slabs, setSlabs] = useState([])
  const [slabsLoading, setSlabsLoading] = useState(false)
  const [slabDialog, setSlabDialog] = useState(false)
  const [editingSlabId, setEditingSlabId] = useState(null)
  const [slabForm, setSlabForm] = useState({ fromDays: '', toDays: '', feeAmount: '', isActive: true, notes: '' })
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState('')

  const loadDoctors = useCallback(async () => {
    setLoading(true)
    const res = await client.get('/doctor-accountability?resource=doctors')
    if (res.success) setDoctors(res.data)
    setLoading(false)
  }, [])

  const loadSlabs = useCallback(async (doctorId) => {
    setSlabsLoading(true)
    const res = await client.get(`/fee-slabs?doctorId=${doctorId}`)
    if (res.success) setSlabs(res.data)
    else toast.error(res.error || 'Failed to load slabs')
    setSlabsLoading(false)
  }, [])

  useEffect(() => { loadDoctors() }, [loadDoctors])

  function handleSelectDoctor(doctorId) {
    setSelectedDoctor(doctorId)
    loadSlabs(doctorId)
  }

  function openSlabDialog(slab = null) {
    setValidationError('')
    if (slab) {
      setEditingSlabId(slab.id)
      setSlabForm({
        fromDays: String(slab.fromDays),
        toDays: String(slab.toDays),
        feeAmount: String(slab.feeAmount),
        isActive: slab.isActive,
        notes: slab.notes || ''
      })
    } else {
      setEditingSlabId(null)
      setSlabForm({ fromDays: '', toDays: '', feeAmount: '', isActive: true, notes: '' })
    }
    setSlabDialog(true)
  }

  function validateSlab() {
    const from = parseInt(slabForm.fromDays)
    const to = parseInt(slabForm.toDays)
    const fee = parseFloat(slabForm.feeAmount)

    if (isNaN(from) || isNaN(to) || isNaN(fee)) {
      setValidationError('All fields are required')
      return false
    }
    if (from >= to) {
      setValidationError('"From Days" must be less than "To Days"')
      return false
    }
    if (fee < 0) {
      setValidationError('Fee amount cannot be negative')
      return false
    }

    // Check for overlaps
    const overlapping = slabs.filter(s => {
      if (editingSlabId && s.id === editingSlabId) return false
      return (from < s.toDays) && (to > s.fromDays)
    })
    if (overlapping.length > 0) {
      setValidationError(`Overlaps with slab: ${overlapping[0].fromDays}-${overlapping[0].toDays} days`)
      return false
    }

    return true
  }

  async function saveSlab() {
    if (!validateSlab()) return
    setSaving(true)

    const payload = {
      fromDays: parseInt(slabForm.fromDays),
      toDays: parseInt(slabForm.toDays),
      feeAmount: parseFloat(slabForm.feeAmount),
      isActive: slabForm.isActive,
      notes: slabForm.notes || null,
    }

    try {
      let res
      if (editingSlabId) {
        res = await client.patch(`/fee-slabs/${editingSlabId}`, payload)
      } else {
        res = await client.post('/fee-slabs', { doctorId: selectedDoctor, ...payload })
      }

      if (res.success) {
        toast.success(editingSlabId ? 'Slab updated' : 'Slab created')
        setSlabDialog(false)
        loadSlabs(selectedDoctor)
      } else {
        toast.error(res.error || 'Failed to save slab')
      }
    } catch (err) {
      toast.error('Error saving slab')
    }
    setSaving(false)
  }

  async function deleteSlab(slabId) {
    if (!confirm('Delete this fee slab?')) return
    try {
      const res = await client.delete(`/fee-slabs/${slabId}`)
      if (res.success) {
        toast.success('Slab deleted')
        loadSlabs(selectedDoctor)
      } else {
        toast.error(res.error || 'Failed to delete slab')
      }
    } catch (err) {
      toast.error('Error deleting slab')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label className="text-sm text-gray-600">Select Doctor</Label>
          <Select value={selectedDoctor || ''} onValueChange={handleSelectDoctor}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choose doctor to configure slabs..." />
            </SelectTrigger>
            <SelectContent>
              {doctors.map(doc => (
                <SelectItem key={doc.id} value={doc.id}>
                  {doc.fullName} {doc.specialization ? `(${doc.specialization})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedDoctor && (
          <Button onClick={() => openSlabDialog()} className="mt-5">
            <Plus className="h-4 w-4 mr-1" />Add New Slab
          </Button>
        )}
      </div>

      {selectedDoctor && (
        <div className="border rounded-lg p-4 bg-blue-50">
          <h3 className="font-semibold text-sm mb-2">Fee Slab Rules:</h3>
          <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
            <li>Configure day ranges (e.g., 0-3 days, 3-15 days, 15-30 days)</li>
            <li>Each range has a different fee amount</li>
            <li>After 30 days, patient is charged as a new patient (base fee)</li>
            <li>Use day ranges that don't overlap</li>
          </ul>
        </div>
      )}

      {selectedDoctor ? (
        slabsLoading ? (
          <div className="text-center py-8 text-gray-400">Loading slabs...</div>
        ) : slabs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No fee slabs configured yet. Click "Add New Slab" to create one.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From Days</TableHead>
                  <TableHead>To Days</TableHead>
                  <TableHead>Fee Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slabs.map(slab => (
                  <TableRow key={slab.id}>
                    <TableCell className="font-medium">{slab.fromDays}</TableCell>
                    <TableCell className="font-medium">{slab.toDays}</TableCell>
                    <TableCell>{fmt(slab.feeAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={slab.isActive ? 'default' : 'secondary'}>
                        {slab.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">{slab.notes || '—'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openSlabDialog(slab)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => deleteSlab(slab.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : (
        <div className="text-center py-12 text-gray-400">Select a doctor to view their fee slabs.</div>
      )}

      <Dialog open={slabDialog} onOpenChange={setSlabDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSlabId ? 'Edit Fee Slab' : 'Add New Fee Slab'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {validationError && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
                {validationError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Days</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="mt-1"
                  value={slabForm.fromDays}
                  onChange={e => setSlabForm(f => ({ ...f, fromDays: e.target.value }))}
                  placeholder="e.g. 0"
                />
              </div>
              <div>
                <Label>To Days</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="mt-1"
                  value={slabForm.toDays}
                  onChange={e => setSlabForm(f => ({ ...f, toDays: e.target.value }))}
                  placeholder="e.g. 3"
                />
              </div>
            </div>
            <div>
              <Label>Fee Amount (₹)</Label>
              <Input
                type="number"
                min={0}
                step={50}
                className="mt-1"
                value={slabForm.feeAmount}
                onChange={e => setSlabForm(f => ({ ...f, feeAmount: e.target.value }))}
                placeholder="e.g. 500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={slabForm.isActive}
                onChange={e => setSlabForm(f => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                className="mt-1"
                value={slabForm.notes}
                onChange={e => setSlabForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Early bird discount"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setSlabDialog(false)}>Cancel</Button>
              <Button onClick={saveSlab} disabled={saving}>
                {saving ? 'Saving...' : editingSlabId ? 'Update Slab' : 'Add Slab'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReportsTab() {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [reportsPage, setReportsPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await client.get('/doctor-accountability?resource=stats')
    if (res.success) setStats(res.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalPending = stats.reduce((s, d) => s + d.pendingAmount, 0)
  const totalSettled = stats.reduce((s, d) => s + d.settledAmount, 0)
  const totalDoctors = stats.filter(d => d.isActive).length

  function exportReportCSV() {
    const rows = [
      ['Doctor', 'Rate', 'Commission Type', 'Total Invoiced (₹)', 'Total Entries', 'Pending (₹)', 'Pending Count', 'Settled (₹)', 'Settled Count', 'Status'],
      ...stats.map(s => [
        s.doctorName,
        s.isActive ? (s.commissionType === 'percentage' ? `${s.commissionRate}%` : `₹${s.commissionRate}`) : 'Not configured',
        s.commissionType || '',
        s.totalInvoiceAmount,
        s.totalCommissions,
        s.pendingAmount,
        s.pendingCount,
        s.settledAmount,
        s.settledCount,
        s.isActive ? 'Active' : 'Inactive',
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `commission-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Active Doctors" value={String(totalDoctors)} color="bg-blue-500" />
        <StatCard icon={Clock} label="Total Pending" value={fmt(totalPending)} color="bg-amber-500" />
        <StatCard icon={CheckCircle2} label="Total Settled" value={fmt(totalSettled)} color="bg-green-500" />
        <StatCard icon={Wallet} label="Total Earned" value={fmt(totalPending + totalSettled)} color="bg-purple-500" />
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportReportCSV}>
          <FileDown className="h-4 w-4 mr-1" />Export Report CSV
        </Button>
      </div>
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading stats...</div>
      ) : stats.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No data yet. Set up commissions and add entries first.</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead><TableHead>Rate</TableHead><TableHead>Total Invoiced</TableHead>
                <TableHead>Total Commissions</TableHead><TableHead>Pending</TableHead><TableHead>Settled</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const ITEMS_PER_PAGE = 10
                const totalPages = Math.ceil(stats.length / ITEMS_PER_PAGE)
                const startIdx = (reportsPage - 1) * ITEMS_PER_PAGE
                const endIdx = startIdx + ITEMS_PER_PAGE
                const paginatedStats = stats.slice(startIdx, endIdx)
                return paginatedStats.map(s => (
                  <TableRow key={s.doctorId}>
                    <TableCell className="font-medium">{s.doctorName}</TableCell>
                    <TableCell className="text-gray-500">
                      {s.isActive
                        ? s.commissionType === 'percentage' ? `${s.commissionRate}%` : fmt(s.commissionRate)
                        : <span className="text-gray-400 italic">Not configured</span>}
                    </TableCell>
                    <TableCell>{fmt(s.totalInvoiceAmount)}</TableCell>
                    <TableCell>{s.totalCommissions} entries</TableCell>
                    <TableCell><span className="font-semibold text-amber-700">{fmt(s.pendingAmount)}</span><span className="text-xs text-gray-400 ml-1">({s.pendingCount})</span></TableCell>
                    <TableCell><span className="font-semibold text-green-700">{fmt(s.settledAmount)}</span><span className="text-xs text-gray-400 ml-1">({s.settledCount})</span></TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? 'default' : 'outline'} className={s.isActive ? '' : 'text-gray-400'}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              })()}
            </TableBody>
          </Table>
          {stats.length > 10 && (() => {
            const ITEMS_PER_PAGE = 10
            const totalPages = Math.ceil(stats.length / ITEMS_PER_PAGE)
            return (
              <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
                <Button variant="outline" size="sm" onClick={() => setReportsPage(p => Math.max(1, p - 1))} disabled={reportsPage === 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Previous
                </Button>
                <span className="text-sm text-gray-600">Page {reportsPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setReportsPage(p => Math.min(totalPages, p + 1))} disabled={reportsPage === totalPages}>
                  Next<ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

const TABS = [
  { id: 'fee-structure', label: 'Fee Structure', icon: IndianRupee },
  { id: 'setup', label: 'Commission Setup', icon: UserCog },
  { id: 'commissions', label: 'Commissions', icon: IndianRupee },
  { id: 'settlement', label: 'Settlement', icon: CheckCircle2 },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
]

export default function DoctorAccountabilityModule() {
  const [tab, setTab] = useState('setup')
  const [reloadKey, setReloadKey] = useState(0)
  const [addCommissionSignal, setAddCommissionSignal] = useState(0)

  // Add Doctor
  const [addOpen, setAddOpen] = useState(false)
  const [savingDoc, setSavingDoc] = useState(false)
  const [departments, setDepartments] = useState([])
  const [docForm, setDocForm] = useState({ fullName: '', email: '', specialization: '', phone: '', departmentId: '' })

  useEffect(() => {
    client.get('/settings?resource=departments')
      .then(res => { if (res.success) setDepartments(res.data) })
      .catch(() => {})
  }, [])

  async function addDoctor() {
    if (!docForm.fullName.trim() || !docForm.email.trim()) {
      toast.error('Full name and email are required')
      return
    }
    setSavingDoc(true)
    try {
      const res = await client.post('/settings', { resource: 'user', role: 'doctor', ...docForm })
      if (res.success) {
        toast.success(`Doctor ${res.data.fullName} added`)
        setAddOpen(false)
        setDocForm({ fullName: '', email: '', specialization: '', phone: '', departmentId: '' })
        setTab('setup')
        setReloadKey(k => k + 1)   // remount SetupTab so the new doctor appears
      } else toast.error(res.error || 'Failed to add doctor')
    } catch (e) {
      toast.error(e.message || 'Failed to add doctor')
    } finally {
      setSavingDoc(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Doctor Accountability</h2>
          <p className="text-gray-500 mt-1">Track and settle doctor commissions for services rendered.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setTab('commissions'); setAddCommissionSignal(s => s + 1) }}>
            <IndianRupee className="h-4 w-4 mr-2" />Add Commission
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Add Doctor
          </Button>
        </div>
      </div>
      <div className="flex border-b gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>
      <div>
        {tab === 'fee-structure' && <FeeStructureTab key={reloadKey} />}
        {tab === 'setup' && <SetupTab key={reloadKey} />}
        {tab === 'commissions' && <CommissionsTab openAddSignal={addCommissionSignal} />}
        {tab === 'settlement' && <SettlementTab />}
        {tab === 'reports' && <ReportsTab />}
      </div>

      {/* Add Doctor Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Doctor</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full Name *</Label>
                <Input className="mt-1" value={docForm.fullName} onChange={e => setDocForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Dr. John Doe" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input className="mt-1" type="email" value={docForm.email} onChange={e => setDocForm(f => ({ ...f, email: e.target.value }))} placeholder="doctor@hospital.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Specialization</Label>
                <Input className="mt-1" value={docForm.specialization} onChange={e => setDocForm(f => ({ ...f, specialization: e.target.value }))} placeholder="e.g. Cardiology" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input className="mt-1" value={docForm.phone} onChange={e => setDocForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91XXXXXXXXXX" />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Department</Label>
              <SearchableSelect
                className="w-full"
                options={departments.map(d => ({ value: d.id, label: d.name }))}
                value={docForm.departmentId}
                onChange={v => setDocForm(f => ({ ...f, departmentId: v }))}
                placeholder="Select department"
                searchPlaceholder="Search departments..."
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={addDoctor} disabled={savingDoc}>{savingDoc ? 'Adding...' : 'Add Doctor'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
