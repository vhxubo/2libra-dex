import {
  RARITIES,
  RARITY_LABELS,
  type EventGroup,
  type PandoraEvent,
  type SortKey,
} from './types'

/** 稀有度高低序：青铜 < 白银 < 黄金 < 紫色。 */
export const RARITY_ORDER: Record<string, number> = Object.fromEntries(
  RARITIES.map((rarity, index) => [rarity, index]),
)

/** 按事件名称合并为分组；组内事件保持传入顺序（时间从新到旧）。 */
export function groupEvents(events: PandoraEvent[]): EventGroup[] {
  const groups = new Map<string, EventGroup>()
  for (const event of events) {
    let group = groups.get(event.eventName)
    if (!group) {
      group = {
        key: event.eventName,
        eventName: event.eventName,
        eventCode: event.eventCode,
        events: [],
        maxRarity: event.rarity,
        tierCodes: [],
        count: 0,
        newestAt: event.createdAt,
      }
      groups.set(event.eventName, group)
    }
    group.events.push(event)
    group.count += 1
    if (RARITY_ORDER[event.rarity] > RARITY_ORDER[group.maxRarity]) {
      group.maxRarity = event.rarity
    }
    if (event.createdAt > group.newestAt) group.newestAt = event.createdAt
  }
  for (const group of groups.values()) {
    group.tierCodes = [...new Set(group.events.map((event) => event.tierCode))].sort()
  }
  return [...groups.values()]
}

/** 同值回退到自然顺序：组内最新事件从新到旧，再以分组键稳定。 */
function compareGroupNatural(a: EventGroup, b: EventGroup): number {
  return (
    b.newestAt.localeCompare(a.newestAt) ||
    (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  )
}

function compareGroupRarity(a: EventGroup, b: EventGroup): number {
  return RARITY_ORDER[a.maxRarity] - RARITY_ORDER[b.maxRarity]
}

/** 组级 tier 排序键：组内字典序最小的 tier_code。 */
function tierSortKey(group: EventGroup): string {
  return group.tierCodes[0]
}

function compareGroupTier(a: EventGroup, b: EventGroup): number {
  const keyA = tierSortKey(a)
  const keyB = tierSortKey(b)
  return keyA < keyB ? -1 : keyA > keyB ? 1 : 0
}

const GROUP_SORT_COMPARATORS: Record<SortKey, (a: EventGroup, b: EventGroup) => number> = {
  'rarity-asc': (a, b) => compareGroupRarity(a, b) || compareGroupNatural(a, b),
  'rarity-desc': (a, b) => compareGroupRarity(b, a) || compareGroupNatural(a, b),
  'tier-asc': (a, b) => compareGroupTier(a, b) || compareGroupNatural(a, b),
  'tier-desc': (a, b) => compareGroupTier(b, a) || compareGroupNatural(a, b),
}

/** 一级表格排序（按组内最高稀有度 / 最小 tier_code）；不修改原数组。 */
export function sortGroups(groups: EventGroup[], sort: SortKey): EventGroup[] {
  return [...groups].sort(GROUP_SORT_COMPARATORS[sort])
}

/** 表头点击：同一列在升降序间切换；跨列点击时稀有度落降序、tier_code 落升序。 */
export function nextSortKey(current: SortKey, column: 'rarity' | 'tier'): SortKey {
  if (column === 'rarity') return current === 'rarity-desc' ? 'rarity-asc' : 'rarity-desc'
  return current === 'tier-asc' ? 'tier-desc' : 'tier-asc'
}

/** 搜索文本归一化：去除首尾空白、忽略大小写、按空白拆分关键词。 */
export function normalizeQuery(raw: string): string[] {
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

/** 搜索覆盖事件名称、事件代码、效果文本、tier_code 与稀有度（代码或中文标签）；多个关键词须全部命中。 */
export function matchesQuery(event: PandoraEvent, rawQuery: string): boolean {
  const haystack =
    `${event.eventName} ${event.eventCode} ${event.eventTitle} ${event.tierCode} ${event.rarity} ${RARITY_LABELS[event.rarity]}`.toLowerCase()
  return normalizeQuery(rawQuery).every((keyword) => haystack.includes(keyword))
}

/** 事件内容键：除 id 与时间戳外的全部字段。 */
function eventContentKey(event: PandoraEvent): string {
  return JSON.stringify([
    event.eventCode,
    event.eventName,
    event.eventTitle,
    event.tierCode,
    event.rarity,
    event.rolledValue,
  ])
}

/** 内容完全一致的重复事件只保留一条（取传入顺序的首条，即最新一条）；不修改原数组。 */
export function dedupeEvents(events: PandoraEvent[]): PandoraEvent[] {
  const seen = new Set<string>()
  return events.filter((event) => {
    const key = eventContentKey(event)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** 按搜索词过滤事件。 */
export function filterEvents(events: PandoraEvent[], q: string): PandoraEvent[] {
  if (normalizeQuery(q).length === 0) return events
  return events.filter((event) => matchesQuery(event, q))
}
