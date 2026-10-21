import { useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Database, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EventSearchInput } from './components/EventSearchInput'
import { PandoraTableView } from './components/PandoraTableView'
import { PANDORA_EVENTS, PANDORA_EVENT_COUNT } from './data'
import { filterEvents, groupEvents, sortGroups } from './query'
import {
  pandoraStateToSearchParams,
  parsePandoraSearchParams,
  type PandoraUrlState,
} from './urlState'

function usePandoraUrlState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const state = useMemo(() => parsePandoraSearchParams(searchParams), [searchParams])

  const update = useCallback(
    (patch: Partial<PandoraUrlState>, replace = false) => {
      setSearchParams(
        (prev) =>
          pandoraStateToSearchParams({ ...parsePandoraSearchParams(prev), ...patch }),
        { replace },
      )
    },
    [setSearchParams],
  )

  return [state, update] as const
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <SearchX className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">没有匹配的事件</p>
      <p className="text-sm text-muted-foreground">试试调整搜索关键词。</p>
      <Button variant="outline" onClick={onClear}>
        清空搜索
      </Button>
    </div>
  )
}

export default function PandoraEventsPage() {
  const [state, update] = usePandoraUrlState()

  const filtered = useMemo(() => filterEvents(PANDORA_EVENTS, state.q), [state.q])
  const groups = useMemo(
    () => sortGroups(groupEvents(filtered), state.sort),
    [filtered, state.sort],
  )

  const handleQueryChange = useCallback(
    (q: string) => update({ q }, true),
    [update],
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">潘多拉事件</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
          <span>已收录 {PANDORA_EVENT_COUNT} 条事件，同名事件合并为组，默认按组内最高稀有度从高到低，点击行展开明细。</span>
          <Link
            to="/sources"
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Database className="size-3.5" aria-hidden />
            数据来源
          </Link>
        </p>
      </header>

      <EventSearchInput q={state.q} onQueryChange={handleQueryChange} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <p data-testid="result-count" className="shrink-0 whitespace-nowrap text-sm text-muted-foreground" aria-live="polite">
          共 <span className="font-semibold tabular-nums text-foreground">{groups.length}</span> 组
          <span className="mx-1.5" aria-hidden>·</span>
          <span className="font-semibold tabular-nums text-foreground">{filtered.length}</span> 条事件
        </p>
      </div>

      <div className="mt-4">
        {groups.length === 0 ? (
          <EmptyState onClear={() => update({ q: '' }, true)} />
        ) : (
          <PandoraTableView
            groups={groups}
            sort={state.sort}
            onSortChange={(sort) => update({ sort })}
          />
        )}
      </div>
    </div>
  )
}
