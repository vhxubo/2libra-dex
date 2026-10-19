import type { SortingState } from '@tanstack/react-table'
import type { AttrType, BadgeLevel, BadgeRecord, SortKey } from './types'

export interface BadgeFilters {
  /** 原始搜索文本（未去除空白），匹配时统一归一化 */
  q: string
  /** 选中的等级，空数组表示全部 */
  levels: BadgeLevel[]
  /** 属性类型，null 表示全部 */
  attrType: AttrType | null
  /** 获得率最小值（含边界），null 表示不限 */
  rateMin: number | null
  /** 获得率最大值（含边界），null 表示不限 */
  rateMax: number | null
}

export const EMPTY_FILTERS: BadgeFilters = {
  q: '',
  levels: [],
  attrType: null,
  rateMin: null,
  rateMax: null,
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

/** 各筛选条件取交集；获得率区间包含边界。 */
export function filterBadges(badges: BadgeRecord[], filters: BadgeFilters): BadgeRecord[] {
  return badges.filter(
    (badge) =>
      (filters.levels.length === 0 || filters.levels.includes(badge.level)) &&
      (filters.attrType === null || badge.attrType === filters.attrType) &&
      (filters.rateMin === null || badge.rate >= filters.rateMin) &&
      (filters.rateMax === null || badge.rate <= filters.rateMax) &&
      matchesQuery(badge, filters.q),
  )
}

function compareById(a: BadgeRecord, b: BadgeRecord): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

const SORT_COMPARATORS: Record<
  Exclude<SortKey, 'default'>,
  (a: BadgeRecord, b: BadgeRecord) => number
> = {
  'rate-asc': (a, b) => a.rate - b.rate || compareById(a, b),
  'rate-desc': (a, b) => b.rate - a.rate || compareById(a, b),
  'name-asc': (a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN') || compareById(a, b),
  'name-desc': (a, b) => b.name.localeCompare(a.name, 'zh-Hans-CN') || compareById(a, b),
}

/** 排序；default 沿用数据中等级与获得率的顺序，同值以 ID 稳定排序。 */
export function sortBadges(badges: BadgeRecord[], sort: SortKey): BadgeRecord[] {
  if (sort === 'default') return [...badges]
  return [...badges].sort(SORT_COMPARATORS[sort])
}

/** 获得率显示：直接添加 %，例如 0.01 -> 0.01%。 */
export function formatRate(rate: number): string {
  return `${rate}%`
}

export interface ParsedRateInput {
  value: number | null
  error: string | null
}

/** 解析获得率输入：空值合法（表示不限）；须为 0–100 的数字，否则给出提示。 */
export function parseRateInput(raw: string): ParsedRateInput {
  const text = raw.trim()
  if (text === '') return { value: null, error: null }
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return { value: null, error: '请输入 0–100 之间的数字' }
  }
  const value = Number(text)
  if (value > 100) {
    return { value: null, error: '获得率范围是 0–100' }
  }
  return { value, error: null }
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
  if (!first) return 'default'
  const keys = SORT_KEY_BY_COLUMN[first.id]
  if (!keys) return 'default'
  return first.desc ? keys.desc : keys.asc
}
