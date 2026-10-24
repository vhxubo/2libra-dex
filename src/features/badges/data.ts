import raw from '../../../badges.json'
import { ATTR_TYPES, BADGE_LEVELS, type AttrType, type BadgeLevel, type BadgeRecord } from './types'

const BADGE_ASSET_BASE = 'https://r2.2libra.com/badge'
const BADGE_SMALL_ASSET_BASE = `${BADGE_ASSET_BASE}/svg`

/** 由徽章 id 补齐两套图标地址：icon 用于列表展示，exportIcon 用于 GIF 导出。 */
export function toBadgeAssets(id: string) {
  return {
    icon: `${BADGE_SMALL_ASSET_BASE}/${encodeURIComponent(id)}.svg`,
    exportIcon: `${BADGE_ASSET_BASE}/${encodeURIComponent(id)}.svg`,
  }
}

/** 单一数据源：根目录 badges.json（由 extract_badges.py 采集生成），构建时导入。 */
type RawBadge = Omit<BadgeRecord, 'icon' | 'exportIcon'>

export const BADGES: BadgeRecord[] = (raw.badges as RawBadge[]).map((badge) => ({
  ...badge,
  ...toBadgeAssets(badge.id),
}))

export const BADGE_COUNT = BADGES.length

/** 数据更新日期（YYYY-MM-DD），由 extract_badges.py 生成 badges.json 时打点。 */
export const BADGE_UPDATED_AT: string = raw.meta.updatedAt

export { ATTR_TYPES, BADGE_LEVELS }

/** 数据中实际出现的属性类型，保持出现顺序。 */
export const ATTR_TYPE_OPTIONS: readonly AttrType[] = [
  ...new Set<AttrType>(BADGES.map((badge) => badge.attrType)),
]

export const LEVEL_COUNTS = Object.fromEntries(
  BADGE_LEVELS.map((level) => [level, BADGES.filter((badge) => badge.level === level).length]),
) as Record<BadgeLevel, number>

export const ATTR_TYPE_COUNTS = Object.fromEntries(
  ATTR_TYPE_OPTIONS.map((attrType) => [
    attrType,
    BADGES.filter((badge) => badge.attrType === attrType).length,
  ]),
) as Record<AttrType, number>
