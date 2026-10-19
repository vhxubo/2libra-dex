import { describe, expect, it } from 'vitest'
import raw from '../../../badges.json'
import { ATTR_TYPES, BADGES, BADGE_COUNT, BADGE_LEVELS } from './data'

describe('徽章数据', () => {
  it('与 badges.json 的 meta 记录一致，共 31 条', () => {
    expect(BADGE_COUNT).toBe(31)
    expect(raw.meta.badgeCount).toBe(BADGES.length)
  })

  it('ID 唯一', () => {
    const ids = new Set(BADGES.map((badge) => badge.id))
    expect(ids.size).toBe(BADGES.length)
  })

  it('每条记录字段完整且取值合法', () => {
    for (const badge of BADGES) {
      expect(BADGE_LEVELS).toContain(badge.level)
      expect(ATTR_TYPES).toContain(badge.attrType)
      expect(badge.name.length).toBeGreaterThan(0)
      expect(badge.icon.startsWith('https://')).toBe(true)
      expect(badge.condition.length).toBeGreaterThan(0)
      expect(badge.attr.length).toBeGreaterThan(0)
      expect(badge.rate).toBeGreaterThanOrEqual(0)
      expect(badge.rate).toBeLessThanOrEqual(100)
    }
  })

  it('数据按等级与获得率排序（默认排序的依据）', () => {
    const order = { T0: 0, T1: 1, T2: 2, T3: 3 } as const
    for (let i = 1; i < BADGES.length; i += 1) {
      const prev = BADGES[i - 1]
      const curr = BADGES[i]
      const byLevel = order[curr.level] - order[prev.level]
      expect(byLevel || curr.rate - prev.rate || (curr.id < prev.id ? -1 : 1)).toBeGreaterThanOrEqual(0)
    }
  })
})
