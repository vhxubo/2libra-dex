import { Fragment, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from 'lucide-react'
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
import { useOverflowTitle } from '@/lib/useOverflowTitle'
import { nextSortKey } from '../query'
import type { EventGroup, SortKey } from '../types'
import { RarityChip } from './RarityChip'

interface PandoraTableViewProps {
  groups: EventGroup[]
  sort: SortKey
  onSortChange: (sort: SortKey) => void
}

type SortableColumn = 'rarity' | 'tier'

function EventNameCell({ group }: { group: EventGroup }) {
  const nameRef = useOverflowTitle<HTMLDivElement>(group.eventName)
  const codeRef = useOverflowTitle<HTMLDivElement>(group.eventCode)

  return (
    <div className="min-w-32">
      <div ref={nameRef} className="truncate font-medium text-foreground">
        {group.eventName}
      </div>
      <div ref={codeRef} className="truncate font-mono text-xs text-muted-foreground">
        {group.eventCode}
      </div>
    </div>
  )
}

function ClampedTextCell({ text }: { text: string }) {
  const ref = useOverflowTitle<HTMLParagraphElement>(text)

  return (
    <p ref={ref} className="line-clamp-2 max-w-72 min-w-52 text-muted-foreground">
      {text}
    </p>
  )
}

function SortableHeadButton({
  label,
  column,
  sort,
  onSortChange,
}: {
  label: string
  column: SortableColumn
  sort: SortKey
  onSortChange: (sort: SortKey) => void
}) {
  const active = sort.startsWith(column)
  const desc = sort.endsWith('desc')

  return (
    <button
      type="button"
      onClick={() => onSortChange(nextSortKey(sort, column))}
      className={cn(
        'inline-flex items-center gap-1 rounded text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'font-semibold text-foreground' : 'hover:text-foreground',
      )}
    >
      {label}
      {active ? (
        desc ? (
          <ArrowDown className="size-3.5" aria-hidden />
        ) : (
          <ArrowUp className="size-3.5" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="size-3.5 opacity-60" aria-hidden />
      )}
    </button>
  )
}

function SubEventsTable({ group }: { group: EventGroup }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="w-24 py-1.5 pr-3 font-medium">稀有度</th>
          <th className="w-48 py-1.5 pr-3 font-medium">tier_code</th>
          <th className="py-1.5 font-medium">事件效果</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {group.events.map((event) => (
          <tr key={event.id} data-testid="pandora-event-row">
            <td className="py-2 pr-3 align-middle">
              <RarityChip rarity={event.rarity} />
            </td>
            <td className="py-2 pr-3 align-middle font-mono text-xs text-muted-foreground">
              {event.tierCode}
            </td>
            <td className="py-2 align-middle">
              <ClampedTextCell text={event.eventTitle} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function PandoraTableView({ groups, sort, onSortChange }: PandoraTableViewProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  const toggleGroup = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <span className="sr-only">展开</span>
            </TableHead>
            <TableHead>事件</TableHead>
            <TableHead
              aria-sort={
                sort.startsWith('rarity')
                  ? sort === 'rarity-desc'
                    ? 'descending'
                    : 'ascending'
                  : undefined
              }
            >
              <SortableHeadButton label="最高稀有度" column="rarity" sort={sort} onSortChange={onSortChange} />
            </TableHead>
            <TableHead
              aria-sort={
                sort.startsWith('tier')
                  ? sort === 'tier-desc'
                    ? 'descending'
                    : 'ascending'
                  : undefined
              }
            >
              <SortableHeadButton label="tier_code" column="tier" sort={sort} onSortChange={onSortChange} />
            </TableHead>
            <TableHead>事件效果</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const expanded = expandedKeys.has(group.key)
            // 单事件组没有二级展示的必要，效果直接展示在一级行
            const expandable = group.count > 1
            return (
              <Fragment key={group.key}>
                <TableRow
                  data-testid="pandora-group-row"
                  className={expandable ? 'cursor-pointer' : undefined}
                  onClick={expandable ? () => toggleGroup(group.key) : undefined}
                >
                  <TableCell className="w-12">
                    {expandable ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-expanded={expanded}
                        aria-label={expanded ? `收起 ${group.eventName}` : `展开 ${group.eventName}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleGroup(group.key)
                        }}
                      >
                        <ChevronDown
                          className={cn('transition-transform', expanded ? '' : '-rotate-90')}
                          aria-hidden
                        />
                      </Button>
                    ) : (
                      <span className="sr-only">单条记录</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <EventNameCell group={group} />
                  </TableCell>
                  <TableCell>
                    <RarityChip rarity={group.maxRarity} />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {group.tierCodes.join(' · ')}
                    </span>
                  </TableCell>
                  <TableCell>
                    {expandable ? null : (
                      <ClampedTextCell text={group.events[0].eventTitle} />
                    )}
                  </TableCell>
                </TableRow>
                {expandable && expanded && (
                  <TableRow data-testid="pandora-subtable-row">
                    <TableCell colSpan={5} className="bg-muted/30 px-4 py-3">
                      <SubEventsTable group={group} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
