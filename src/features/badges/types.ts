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

/** 按登录用户的获得状态筛选；数据未加载时等同于 all。 */
export const EARNED_FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'owned', label: '已获得' },
  { value: 'missing', label: '未获得' },
] as const
export type EarnedFilter = (typeof EARNED_FILTER_OPTIONS)[number]['value']

/** 默认排序：获得率从高到低。 */
export const DEFAULT_SORT_KEY: SortKey = 'rate-desc'

export type ViewMode = 'card' | 'table'

/** 卡片视图使用的图标：小图标（icon）或大图标（exportIcon）。 */
export type CardIconMode = 'small' | 'large'

export const PAGE_SIZE_OPTIONS = [12, 24, 48] as const

export interface BadgeRecord {
  id: string
  name: string
  /** 小图标（badge/svg/），选择列表、排序列表和生成前预览用。 */
  icon: string
  /** 大图标（badge/），仅 Canvas 绘制和 GIF 编码使用。 */
  exportIcon: string
  level: BadgeLevel
  /** 获得率，单位 %，来自采集数据原值 */
  rate: number
  condition: string
  attrType: AttrType
  attr: string
}
