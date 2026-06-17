import { useState, useEffect } from 'react'
import { ClipboardList, FlaskConical } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ProgressNotesPanel from '@/components/inpatient/ProgressNotesPanel'
import ClinicalOrdersTab from '@/components/inpatient/ClinicalOrdersTab'

// Combined doctor workspace: one patient picker → write notes on top, place orders
// (Pharmacy / Lab / Radiology / Procedure) below. Both sections are controlled by
// the shared `selectedId`, so they stay on the same patient.
export default function NotesAndOrders({ admitted = [] }) {
  const [selectedId, setSelectedId] = useState('')
  useEffect(() => { if (!selectedId && admitted.length) setSelectedId(admitted[0].id) }, [admitted, selectedId])

  if (!admitted.length) {
    return <Card><CardContent className="py-14 text-center text-gray-400">No admitted patients. Admit a patient to write notes and place orders.</CardContent></Card>
  }

  return (
    <div className="space-y-6">
      {/* Shared patient picker */}
      <div className="flex items-center gap-3">
        <Label className="text-sm text-gray-600">Patient</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-80"><SelectValue placeholder="Select admitted patient" /></SelectTrigger>
          <SelectContent>
            {admitted.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {(a.patient?.firstName || '') + ' ' + (a.patient?.lastName || '')} · Bed {a.bed?.bedNumber || '—'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes (top) */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <ClipboardList className="h-4 w-4 text-cyan-600" /> Doctor / Progress Notes
        </h3>
        <ProgressNotesPanel admitted={admitted} admissionId={selectedId} />
      </section>

      {/* Orders (below) */}
      <section className="border-t pt-5">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <FlaskConical className="h-4 w-4 text-blue-600" /> Orders — Pharmacy · Lab · Radiology · Procedure
        </h3>
        <ClinicalOrdersTab admitted={admitted} admissionId={selectedId} />
      </section>
    </div>
  )
}
