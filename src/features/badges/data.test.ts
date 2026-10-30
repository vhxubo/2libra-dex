import { describe, expect, it } from 'vitest'
import raw from '../../../badges.json'
import { ATTR_TYPES, BADGES, BADGE_COUNT, BADGE_LEVELS, BADGE_UPDATED_AT, toBadgeAssets } from './data'

describe('徽章数据', () => {
  it('与 badges.json 的 meta 记录一致，共 34 条', () => {
    expect(BADGE_COUNT).toBe(34)
    expect(raw.meta.badgeCount).toBe(BADGES.length)
  })

  it('数据更新日期为 YYYY-MM-DD 且与导出一致', () => {
    expect(raw.meta.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(BADGE_UPDATED_AT).toBe(raw.meta.updatedAt)
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

  it('每条记录同时具备小图标（列表用）与大图标（导出用）', () => {
    for (const badge of BADGES) {
      expect(badge.icon).toBe(`https://r2.2libra.com/badge/svg/${badge.id}.svg`)
      expect(badge.exportIcon).toBe(`https://r2.2libra.com/badge/${badge.id}.svg`)
    }
  })

  it('toBadgeAssets 对 id 做 encodeURIComponent，且两套地址互不混用', () => {
    const assets = toBadgeAssets('listen_to_me')
    expect(assets.icon).toBe('https://r2.2libra.com/badge/svg/listen_to_me.svg')
    expect(assets.exportIcon).toBe('https://r2.2libra.com/badge/listen_to_me.svg')
    expect(assets.icon).not.toBe(assets.exportIcon)

    const encoded = toBadgeAssets('a b/c')
    expect(encoded.icon).toBe('https://r2.2libra.com/badge/svg/a%20b%2Fc.svg')
    expect(encoded.exportIcon).toBe('https://r2.2libra.com/badge/a%20b%2Fc.svg')
  })

  it('数据按等级与获得率排序（采集顺序约定）', () => {
    const order = { T0: 0, T1: 1, T2: 2, T3: 3 } as const
    for (let i = 1; i < BADGES.length; i += 1) {
      const prev = BADGES[i - 1]
      const curr = BADGES[i]
      const byLevel = order[curr.level] - order[prev.level]
      expect(byLevel || curr.rate - prev.rate || (curr.id < prev.id ? -1 : 1)).toBeGreaterThanOrEqual(0)
    }
  })
})
