import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/Pagination'
import { BadgeCard } from './components/BadgeCard'
import { BadgeDetailDialog } from './components/BadgeDetailDialog'
import { BadgeTableView } from './components/BadgeTableView'
import { BadgeToolbar } from './components/BadgeToolbar'
import {
  ATTR_TYPE_COUNTS,
  BADGES,
  BADGE_COUNT,
  LEVEL_COUNTS,
} from './data'
import { filterBadges, formatRate, sortBadges } from './query'
import {
  badgeStateToSearchParams,
  DEFAULT_URL_STATE,
  parseBadgeSearchParams,
  type BadgeUrlState,
} from './urlState'
import type { AttrType, BadgeLevel, SortKey, ViewMode } from './types'
import { PAGE_SIZE_OPTIONS } from './types'

const DEFAULT_PAGE_SIZE: number = PAGE_SIZE_OPTIONS[0]

function useBadgeUrlState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const state = useMemo(() => parseBadgeSearchParams(searchParams), [searchParams])

  const update = useCallback(
    (patch: Partial<BadgeUrlState>, replace = false) => {
      setSearchParams(
        (prev) =>
          badgeStateToSearchParams({ ...parseBadgeSearchParams(prev), ...patch }),
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
      <p className="font-medium">没有匹配的徽章</p>
      <p className="text-sm text-muted-foreground">试试调整搜索关键词或筛选条件。</p>
      <Button variant="outline" onClick={onClear}>
        清空筛选
      </Button>
    </div>
  )
}

interface FilterChipsProps {
  state: BadgeUrlState
  onRemove: (patch: Partial<BadgeUrlState>) => void
  onClearAll: () => void
}

function FilterChips({ state, onRemove, onClearAll }: FilterChipsProps) {
  const chips: { key: string; label: string; remove: () => void }[] = []

  if (state.q.trim()) {
    chips.push({
      key: 'q',
      label: `搜索:${state.q.trim()}`,
      remove: () => onRemove({ q: '' }),
    })
  }
  state.levels.forEach((level) => {
    chips.push({
      key: `level-${level}`,
      label: `等级 ${level}`,
      remove: () =>
        onRemove({ levels: state.levels.filter((item) => item !== level) }),
    })
  })
  if (state.attrType !== null) {
    chips.push({
      key: 'attr',
      label: `属性类型 ${state.attrType}`,
      remove: () => onRemove({ attrType: null }),
    })
  }
  if (state.rateMin !== null) {
    chips.push({
      key: 'min',
      label: `获得率 ≥ ${formatRate(state.rateMin)}`,
      remove: () => onRemove({ rateMin: null }),
    })
  }
  if (state.rateMax !== null) {
    chips.push({
      key: 'max',
      label: `获得率 ≤ ${formatRate(state.rateMax)}`,
      remove: () => onRemove({ rateMax: null }),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card py-1 pl-2.5 pr-1 text-xs text-muted-foreground"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.remove}
            aria-label={`移除筛选条件:${chip.label}`}
            className="rounded-full p-0.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <Button variant="ghost" size="sm" onClick={onClearAll}>
        清空筛选
      </Button>
    </div>
  )
}

export default function BadgeDexPage() {
  const [state, update] = useBadgeUrlState()
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)

  const filtered = useMemo(
    () =>
      filterBadges(BADGES, {
        q: state.q,
        levels: state.levels,
        attrType: state.attrType,
        rateMin: state.rateMin,
        rateMax: state.rateMax,
      }),
    [state.q, state.levels, state.attrType, state.rateMin, state.rateMax],
  )
  const sorted = useMemo(
    () => sortBadges(filtered, state.sort),
    [filtered, state.sort],
  )

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(state.page, totalPages)

  // URL 页码超出范围时（例如分享的链接带了过大的 page）回正到最后一页
  useEffect(() => {
    if (currentPage !== state.page) {
      update({ page: currentPage })
    }
  }, [currentPage, state.page, update])

  const pageItems = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  )

  const activeBadge = state.badgeId ? BADGES.find((badge) => badge.id === state.badgeId) : undefined
  const handleQueryChange = useCallback(
    (q: string) => update({ q, page: 1 }, true),
    [update],
  )
  const handleToggleLevel = useCallback(
    (level: BadgeLevel) =>
      update({
        levels: state.levels.includes(level)
          ? state.levels.filter((item) => item !== level)
          : [...state.levels, level],
        page: 1,
      }),
    [update, state.levels],
  )
  const handleAttrTypeChange = useCallback(
    (attrType: AttrType | null) => update({ attrType, page: 1 }),
    [update],
  )
  const handleRateRangeChange = useCallback(
    (rateMin: number | null, rateMax: number | null) =>
      update({ rateMin, rateMax, page: 1 }, true),
    [update],
  )
  const handleSortChange = useCallback(
    (sort: SortKey) => update({ sort, page: 1 }),
    [update],
  )
  const handleViewChange = useCallback(
    (view: ViewMode) => update({ view }),
    [update],
  )
  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      update({ page: 1 })
    },
    [update],
  )
  const handleClearFilters = useCallback(
    () => update({ ...DEFAULT_URL_STATE, view: state.view, sort: state.sort }),
    [update, state.view, state.sort],
  )
  const handleRemoveFilter = useCallback(
    (patch: Partial<BadgeUrlState>) => update({ ...patch, page: 1 }),
    [update],
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">徽章图鉴</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          已收录 {BADGE_COUNT} 枚徽章，数据来自已采集记录，不构成完整官方图鉴。
        </p>
      </header>

      <BadgeToolbar
        q={state.q}
        levels={state.levels}
        attrType={state.attrType}
        rateMin={state.rateMin}
        rateMax={state.rateMax}
        sort={state.sort}
        view={state.view}
        pageSize={pageSize}
        levelCounts={LEVEL_COUNTS}
        attrTypeCounts={ATTR_TYPE_COUNTS}
        onQueryChange={handleQueryChange}
        onToggleLevel={handleToggleLevel}
        onAttrTypeChange={handleAttrTypeChange}
        onRateRangeChange={handleRateRangeChange}
        onSortChange={handleSortChange}
        onViewChange={handleViewChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <p data-testid="result-count" className="text-sm text-muted-foreground" aria-live="polite">
          共 <span className="font-semibold tabular-nums text-foreground">{sorted.length}</span> 枚徽章
        </p>
        <FilterChips
          state={state}
          onRemove={handleRemoveFilter}
          onClearAll={handleClearFilters}
        />
      </div>

      <div className="mt-4">
        {sorted.length === 0 ? (
          <EmptyState onClear={handleClearFilters} />
        ) : state.view === 'card' ? (
          <div
            data-testid="badge-grid"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {pageItems.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} onOpen={(id) => update({ badgeId: id })} />
            ))}
          </div>
        ) : (
          <BadgeTableView
            items={pageItems}
            sort={state.sort}
            onSortChange={handleSortChange}
            onOpen={(id) => update({ badgeId: id })}
          />
        )}
      </div>

      {sorted.length > 0 && (
        <div className="mt-6">
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => update({ page })}
          />
        </div>
      )}

      <BadgeDetailDialog
        open={state.badgeId !== null}
        badge={activeBadge}
        badgeId={state.badgeId}
        onOpenChange={(open) => {
          if (!open) update({ badgeId: null })
        }}
      />
    </div>
  )
}
