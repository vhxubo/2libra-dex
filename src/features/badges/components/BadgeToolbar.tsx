import { useRef, useState } from 'react'
import {
  ArrowUpDown,
  ChevronDown,
  LayoutGrid,
  ListFilter,
  Search,
  Table2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ATTR_TYPE_OPTIONS } from '../data'
import {
  BADGE_LEVELS,
  SORT_OPTIONS,
  type AttrType,
  type BadgeLevel,
  type SortKey,
  type ViewMode,
} from '../types'

interface BadgeToolbarProps {
  q: string
  levels: BadgeLevel[]
  attrType: AttrType | null
  sort: SortKey
  view: ViewMode
  levelCounts: Record<BadgeLevel, number>
  attrTypeCounts: Record<AttrType, number>
  onQueryChange: (q: string) => void
  onToggleLevel: (level: BadgeLevel) => void
  onAttrTypeChange: (attrType: AttrType | null) => void
  onSortChange: (sort: SortKey) => void
  onViewChange: (view: ViewMode) => void
}

export function BadgeToolbar({
  q,
  levels,
  attrType,
  sort,
  view,
  levelCounts,
  attrTypeCounts,
  onQueryChange,
  onToggleLevel,
  onAttrTypeChange,
  onSortChange,
  onViewChange,
}: BadgeToolbarProps) {
  const activeLevelSummary =
    levels.length === 0
      ? '全部'
      : levels.length === 1
        ? levels[0]
        : `${levels[0]} 等 ${levels.length} 项`
  const currentSortLabel =
    SORT_OPTIONS.find((option) => option.value === sort)?.label ?? '获得率从高到低'

  // 输入框用本地草稿值，避免每次按键都走 URL 往返打断输入法组合；
  // 组合期间（双拼/全拼的拼音过程）不上报，组合结束后才提交最终文字
  const [queryDraft, setQueryDraft] = useState(q)
  const [syncedQ, setSyncedQ] = useState(q)
  const isComposingRef = useRef(false)
  const lastCommittedRef = useRef(q)

  // 外部 q 变化（如清空筛选）时回同步到输入框
  if (q !== syncedQ) {
    setSyncedQ(q)
    setQueryDraft(q)
  }

  const commitQuery = (value: string) => {
    if (value !== lastCommittedRef.current) {
      lastCommittedRef.current = value
      onQueryChange(value)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 basis-56">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={queryDraft}
            onChange={(event) => {
              setQueryDraft(event.target.value)
              if (!isComposingRef.current) {
                commitQuery(event.target.value)
              }
            }}
            onCompositionStart={() => {
              isComposingRef.current = true
            }}
            onCompositionEnd={(event) => {
              isComposingRef.current = false
              commitQuery(event.currentTarget.value)
            }}
            placeholder="搜索名称、ID、获取条件或属性"
            aria-label="搜索徽章"
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ListFilter className="text-muted-foreground" aria-hidden />
              等级 · {activeLevelSummary}
              <ChevronDown className="opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel>徽章级别</DropdownMenuLabel>
            {BADGE_LEVELS.map((level) => (
              <DropdownMenuCheckboxItem
                key={level}
                checked={levels.includes(level)}
                onCheckedChange={() => onToggleLevel(level)}
                onSelect={(event) => event.preventDefault()}
              >
                <span className="flex-1 tabular-nums">{level}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {levelCounts[level]}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              属性 · {attrType ?? '全部'}
              <ChevronDown className="opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuRadioGroup
              value={attrType ?? 'all'}
              onValueChange={(value) =>
                onAttrTypeChange(value === 'all' ? null : (value as AttrType))
              }
            >
              <DropdownMenuRadioItem value="all">全部类型</DropdownMenuRadioItem>
              {ATTR_TYPE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option} value={option}>
                  <span className="flex-1">{option}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {attrTypeCounts[option]}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowUpDown className="text-muted-foreground" aria-hidden />
                {currentSortLabel}
                <ChevronDown className="opacity-60" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => onSortChange(value as SortKey)}
              >
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div
            role="group"
            aria-label="视图切换"
            className="inline-flex items-center rounded-md border border-input bg-card p-0.5"
          >
            {(
              [
                { value: 'card', label: '卡片', Icon: LayoutGrid },
                { value: 'table', label: '表格', Icon: Table2 },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => onViewChange(value)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  view === value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
