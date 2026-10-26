import type { SortingState } from '@tanstack/react-table'
import type { AttrType, BadgeLevel, BadgeRecord, EarnedFilter, SortKey } from './types'
import { DEFAULT_SORT_KEY } from './types'

export interface BadgeFilters {
  /** 原始搜索文本（未去除空白），匹配时统一归一化 */
  q: string
  /** 选中的等级，空数组表示全部 */
  levels: BadgeLevel[]
  /** 属性类型，null 表示全部 */
  attrType: AttrType | null
  /** 登录用户的获得状态筛选；earnedIds 为 null 时忽略 */
  earned: EarnedFilter
  /** 已获得徽章 id 集合，null 表示数据不可用（未登录/加载失败） */
  earnedIds: ReadonlySet<string> | null
}

export const EMPTY_FILTERS: BadgeFilters = {
  q: '',
  levels: [],
  attrType: null,
  earned: 'all',
  earnedIds: null,
}

/** 搜索文本归一化：去除首尾空白、忽略大小写、按空白拆分关键词。 */
export function normalizeQuery(raw: string): string[] {
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

/** 搜索覆盖名称、ID、获取条件、属性文本；多个关键词须全部命中。 */
export function matchesQuery(badge: BadgeRecord, rawQuery: string): boolean {
  const haystack =
    `${badge.name} ${badge.id} ${badge.condition} ${badge.attr}`.toLowerCase()
  return normalizeQuery(rawQuery).every((keyword) => haystack.includes(keyword))
}

/** 获得状态筛选；数据不可用时不过滤，避免误伤成空列表。 */
function matchesEarned(id: string, filters: BadgeFilters): boolean {
  if (filters.earned === 'all' || filters.earnedIds === null) return true
  const owned = filters.earnedIds.has(id)
  return filters.earned === 'owned' ? owned : !owned
}

/** 各筛选条件取交集。 */
export function filterBadges(badges: BadgeRecord[], filters: BadgeFilters): BadgeRecord[] {
  return badges.filter(
    (badge) =>
      (filters.levels.length === 0 || filters.levels.includes(badge.level)) &&
      (filters.attrType === null || badge.attrType === filters.attrType) &&
      matchesEarned(badge.id, filters) &&
      matchesQuery(badge, filters.q),
  )
}

function compareById(a: BadgeRecord, b: BadgeRecord): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

const SORT_COMPARATORS: Record<
  SortKey,
  (a: BadgeRecord, b: BadgeRecord) => number
> = {
  'rate-asc': (a, b) => a.rate - b.rate || compareById(a, b),
  'rate-desc': (a, b) => b.rate - a.rate || compareById(a, b),
  'name-asc': (a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN') || compareById(a, b),
  'name-desc': (a, b) => b.name.localeCompare(a.name, 'zh-Hans-CN') || compareById(a, b),
}

/** 排序；同值以 ID 稳定排序。 */
export function sortBadges(badges: BadgeRecord[], sort: SortKey): BadgeRecord[] {
  return [...badges].sort(SORT_COMPARATORS[sort])
}

/** 获得率显示：直接添加 %，例如 0.01 -> 0.01%。 */
export function formatRate(rate: number): string {
  return `${rate}%`
}

const SORT_KEY_BY_COLUMN: Record<string, { asc: SortKey; desc: SortKey }> = {
  name: { asc: 'name-asc', desc: 'name-desc' },
  rate: { asc: 'rate-asc', desc: 'rate-desc' },
}

/** 表格视图：把全局排序键映射为 TanStack Table 受控排序状态。 */
export function sortingStateFromKey(sort: SortKey): SortingState {
  for (const [columnId, keys] of Object.entries(SORT_KEY_BY_COLUMN)) {
    if (sort === keys.asc) return [{ id: columnId, desc: false }]
    if (sort === keys.desc) return [{ id: columnId, desc: true }]
  }
  return []
}

/** 表格视图：把表头排序状态映射回全局排序键（清除排序回到默认）。 */
export function sortKeyFromSortingState(sorting: SortingState): SortKey {
  const first = sorting[0]
  if (!first) return DEFAULT_SORT_KEY
  const keys = SORT_KEY_BY_COLUMN[first.id]
  if (!keys) return DEFAULT_SORT_KEY
  return first.desc ? keys.desc : keys.asc
}
