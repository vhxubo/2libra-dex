export const BADGE_LEVELS = ['T0', 'T1', 'T2', 'T3'] as const
export type BadgeLevel = (typeof BADGE_LEVELS)[number]

export const ATTR_TYPES = ['佩戴属性', '描述'] as const
export type AttrType = (typeof ATTR_TYPES)[number]

export const SORT_OPTIONS = [
  { value: 'rate-desc', label: '获得率从高到低' },
  { value: 'rate-asc', label: '获得率从低到高' },
  { value: 'name-asc', label: '名称升序' },
  { value: 'name-desc', label: '名称降序' },
] as const
export type SortKey = (typeof SORT_OPTIONS)[number]['value']

/** 默认排序：获得率从高到低。 */
export const DEFAULT_SORT_KEY: SortKey = 'rate-desc'

export type ViewMode = 'card' | 'table'

export const PAGE_SIZE_OPTIONS = [12, 24, 48] as const

export interface BadgeRecord {
  id: string
  name: string
  icon: string
  level: BadgeLevel
  /** 获得率，单位 %，来自采集数据原值 */
  rate: number
  condition: string
  attrType: AttrType
  attr: string
}
