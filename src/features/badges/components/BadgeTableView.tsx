import { useMemo } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatRate, sortingStateFromKey, sortKeyFromSortingState } from '../query'
import type { BadgeRecord, SortKey } from '../types'
import { BadgeImage } from './BadgeImage'
import { LevelChip } from './LevelChip'

interface BadgeTableViewProps {
  items: BadgeRecord[]
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  onOpen: (id: string) => void
}

export function BadgeTableView({ items, sort, onSortChange, onOpen }: BadgeTableViewProps) {
  const columns = useMemo<ColumnDef<BadgeRecord>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: '徽章',
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex min-w-40 items-center gap-2.5">
            <BadgeImage
              src={row.original.icon}
              alt={row.original.name}
              className="size-8"
              iconClassName="size-4"
            />
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">{row.original.name}</div>
              <div className="truncate text-xs text-muted-foreground">{row.original.id}</div>
            </div>
          </div>
        ),
      },
      {
        id: 'level',
        accessorKey: 'level',
        header: '等级',
        enableSorting: false,
        cell: ({ row }) => <LevelChip level={row.original.level} />,
      },
      {
        id: 'rate',
        accessorKey: 'rate',
        header: '获得率',
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-medium tabular-nums">{formatRate(getValue<number>())}</span>
        ),
      },
      {
        id: 'attrType',
        accessorKey: 'attrType',
        header: '属性类型',
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>()}</span>
        ),
      },
      {
        id: 'condition',
        accessorKey: 'condition',
        header: '获取条件',
        enableSorting: false,
        cell: ({ row }) => (
          <p
            className="line-clamp-2 max-w-72 min-w-52 text-muted-foreground"
            title={row.original.condition}
          >
            {row.original.condition}
          </p>
        ),
      },
      {
        id: 'attr',
        accessorKey: 'attr',
        header: '属性 / 描述',
        enableSorting: false,
        cell: ({ row }) => (
          <p
            className="line-clamp-2 max-w-72 min-w-52 text-muted-foreground"
            title={row.original.attr}
          >
            {row.original.attr}
          </p>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`查看 ${row.original.name} 详情`}
            onClick={() => onOpen(row.original.id)}
          >
            <ChevronRight aria-hidden />
          </Button>
        ),
      },
    ],
    [onOpen],
  )

  const sorting: SortingState = sortingStateFromKey(sort)

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      onSortChange(sortKeyFromSortingState(next))
    },
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table className="min-w-[960px]">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                    }
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          'inline-flex items-center gap-1 rounded text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          sorted ? 'font-semibold text-foreground' : 'hover:text-foreground',
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' ? (
                          <ArrowUp className="size-3.5" aria-hidden />
                        ) : sorted === 'desc' ? (
                          <ArrowDown className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-60" aria-hidden />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} data-testid="badge-row">
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
