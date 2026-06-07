import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, total, limit = 20, onPageChange }) {
  const totalPages = Math.ceil(total / limit)
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex items-center justify-between p-4 border-t bg-gray-50">
      <div className="text-sm text-gray-600">
        Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
        <span className="text-gray-400 ml-2">({total} total)</span>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className="gap-1"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
