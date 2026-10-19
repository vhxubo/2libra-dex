import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

function getPageItems(page: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const items: (number | '…')[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(total - 1, page + 1)
  if (start > 2) items.push('…')
  for (let i = start; i <= end; i += 1) items.push(i)
  if (end < total - 1) items.push('…')
  items.push(total)
  return items
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      <p data-testid="page-status" className="text-sm tabular-nums text-muted-foreground">
        第 <span className="font-medium text-foreground">{page}</span> / {totalPages} 页
      </p>
      <nav aria-label="分页" className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="上一页"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        {getPageItems(page, totalPages).map((item, index) =>
          item === '…' ? (
            <span key={`ellipsis-${index}`} aria-hidden className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? 'default' : 'outline'}
              size="icon"
              className="tabular-nums"
              aria-label={`第 ${item} 页`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label="下一页"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden />
        </Button>
      </nav>
    </div>
  )
}
