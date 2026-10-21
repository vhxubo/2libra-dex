export const RARITIES = ['bronze', 'silver', 'gold', 'purple'] as const
export type Rarity = (typeof RARITIES)[number]

export const RARITY_LABELS: Record<Rarity, string> = {
  bronze: '青铜',
  silver: '白银',
  gold: '黄金',
  purple: '紫色',
}

export type SortKey = 'rarity-asc' | 'rarity-desc' | 'tier-asc' | 'tier-desc'

/** 默认排序：稀有度从高到低。 */
export const DEFAULT_SORT_KEY: SortKey = 'rarity-desc'

export interface PandoraEvent {
  id: string
  rarity: Rarity
  tierCode: string
  eventCode: string
  eventName: string
  eventTitle: string
  /** 事件掷出的数值，无数值含义的事件为 null */
  rolledValue: number | null
  /** ISO 8601 时间戳 */
  createdAt: string
}

/** 按事件名称合并后的分组，作为一级表格的行。 */
export interface EventGroup {
  /** 分组键：事件名称 */
  key: string
  eventName: string
  /** 取组内首个事件的代码；当前数据中同名事件代码一致 */
  eventCode: string
  /** 组内事件，保持时间从新到旧 */
  events: PandoraEvent[]
  /** 组内最高稀有度 */
  maxRarity: Rarity
  /** 组内去重且按字母排序的 tier_code */
  tierCodes: string[]
  /** 组内事件数 */
  count: number
  /** 组内最新事件的 ISO 时间戳，作排序回退 */
  newestAt: string
}
