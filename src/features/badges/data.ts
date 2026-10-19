import raw from '../../../badges.json'
import { ATTR_TYPES, BADGE_LEVELS, type AttrType, type BadgeLevel, type BadgeRecord } from './types'

/** 单一数据源：根目录 badges.json（由 extract_badges.py 采集生成），构建时导入。 */
export const BADGES = raw.badges as BadgeRecord[]

export const BADGE_COUNT = BADGES.length

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
