import { useState, useEffect } from 'react'
import { Search, User, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import client from '@/api/client'

export function getPatientFullName(patient) {
  if (!patient) return ''
  return `${patient.firstName || ''} ${patient.middleName || ''} ${patient.lastName || ''}`.replace(/\s+/g, ' ').trim()
}

export function calculatePatientAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const today = new Date()
  const birth = new Date(dateOfBirth)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

/**
 * Search registered patients by UHID, name, or phone and auto-fill downstream forms.
 */
export default function PatientLookup({
  selectedPatient,
  onSelect,
  onClear,
  placeholder = 'Search by UHID, name, or phone...',
  className = '',
  showHint = true,
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!search || search.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await client.get('/patients', {
          params: { search, limit: 8, status: 'active' },
        })
        setResults(res.data ?? [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  if (selectedPatient) {
    const age = calculatePatientAge(selectedPatient.dateOfBirth)
    return (
      <div className={`flex items-center justify-between gap-3 p-3 bg-green-50 border border-green-200 rounded-lg ${className}`}>
        <div className="flex items-center gap-3 min-w-0">
          <User className="h-5 w-5 text-green-700 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-green-900 truncate">{getPatientFullName(selectedPatient)}</p>
            <p className="text-sm text-green-700">
              UHID: {selectedPatient.mrn}
              {age != null && ` • ${age}y`}
              {selectedPatient.gender && ` • ${selectedPatient.gender}`}
              {selectedPatient.phonePrimary && ` • ${selectedPatient.phonePrimary}`}
            </p>
          </div>
        </div>
        {onClear && (
          <Button type="button" variant="ghost" size="icon" onClick={onClear} aria-label="Clear patient">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          className="pl-9"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => search.length >= 2 && setOpen(true)}
        />
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>
      {open && search.length >= 2 && (
        <div className="border rounded-md divide-y max-h-48 overflow-y-auto bg-white shadow-sm">
          {results.length === 0 && !loading ? (
            <p className="p-3 text-sm text-gray-500 text-center">No patients found for &ldquo;{search}&rdquo;</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left p-3 hover:bg-gray-50 flex items-center justify-between gap-2"
                onClick={() => {
                  onSelect(p)
                  setSearch('')
                  setOpen(false)
                }}
              >
                <div>
                  <p className="font-medium">{getPatientFullName(p)}</p>
                  <p className="text-xs text-gray-500">
                    UHID: {p.mrn}
                    {p.dateOfBirth && ` • DOB: ${format(new Date(p.dateOfBirth), 'dd MMM yyyy')}`}
                    {p.phonePrimary && ` • ${p.phonePrimary}`}
                  </p>
                </div>
                <span className="text-xs text-blue-600 font-medium shrink-0">Select</span>
              </button>
            ))
          )}
        </div>
      )}
      {showHint && (
        <p className="text-xs text-gray-500">
          Type at least 2 characters to search registered patients by UHID, name, or phone.
        </p>
      )}
    </div>
  )
}
