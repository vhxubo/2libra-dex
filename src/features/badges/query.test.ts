import { describe, expect, it } from 'vitest'
import { BADGES } from './data'
import {
  EMPTY_FILTERS,
  filterBadges,
  formatRate,
  matchesQuery,
  normalizeQuery,
  sortBadges,
  sortKeyFromSortingState,
  sortingStateFromKey,
} from './query'

const byId = (id: string) => {
  const badge = BADGES.find((badge) => badge.id === id)
  if (!badge) throw new Error(`缺少测试数据:${id}`)
  return badge
}

describe('normalizeQuery', () => {
  it('去除首尾空白并按空白拆分关键词', () => {
    expect(normalizeQuery('  篝火   T0 ')).toEqual(['篝火', 't0'])
  })

  it('纯空白返回空数组', () => {
    expect(normalizeQuery('   ')).toEqual([])
  })
})

describe('matchesQuery', () => {
  it('按名称命中', () => {
    expect(matchesQuery(byId('followers'), '篝火')).toBe(true)
  })

  it('按 ID 命中且忽略英文大小写', () => {
    expect(matchesQuery(byId('followers'), 'FOLLOWERS')).toBe(true)
    expect(matchesQuery(byId('year_streak'), 'Year_Streak')).toBe(true)
  })

  it('按获取条件文本命中', () => {
    expect(matchesQuery(byId('year_streak'), '补签')).toBe(true)
  })

  it('多个关键词须全部命中', () => {
    expect(matchesQuery(byId('followers'), '篝火 金币')).toBe(true)
    expect(matchesQuery(byId('followers'), '篝火 不存在的词')).toBe(false)
  })

  it('去除首尾空白后匹配', () => {
    expect(matchesQuery(byId('followers'), '  篝火  ')).toBe(true)
  })

  it('无匹配返回 false', () => {
    expect(matchesQuery(byId('followers'), '不存在徽章xyz')).toBe(false)
  })
})

describe('filterBadges', () => {
  it('无条件筛选返回全部 32 条', () => {
    expect(filterBadges(BADGES, EMPTY_FILTERS)).toHaveLength(32)
  })

  it('等级多选取交集', () => {
    expect(filterBadges(BADGES, { ...EMPTY_FILTERS, levels: ['T0'] })).toHaveLength(14)
    expect(filterBadges(BADGES, { ...EMPTY_FILTERS, levels: ['T0', 'T3'] })).toHaveLength(17)
  })

  it('属性类型筛选', () => {
    const attr = filterBadges(BADGES, { ...EMPTY_FILTERS, attrType: '佩戴属性' })
    expect(attr).toHaveLength(23)
    expect(attr.every((badge) => badge.attrType === '佩戴属性')).toBe(true)
  })

  it('多条件组合取交集', () => {
    const result = filterBadges(BADGES, {
      q: '签到',
      levels: ['T0'],
      attrType: '佩戴属性',
    })
    expect(result.every((badge) => badge.level === 'T0' && badge.attrType === '佩戴属性')).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('sortBadges', () => {
  it('获得率升序，同获得率以 ID 稳定排序', () => {
    const result = sortBadges(BADGES, 'rate-asc')
    expect(result[0].id).toBe('followers')
    // year_streak 与 rich 同为 0.06，'rich' < 'year_streak'
    expect(result[1].id).toBe('rich')
    expect(result[2].id).toBe('year_streak')
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i].rate).toBeGreaterThanOrEqual(result[i - 1].rate)
    }
  })

  it('获得率降序', () => {
    const result = sortBadges(BADGES, 'rate-desc')
    expect(result[0].id).toBe('2libra_1')
    expect(result[0].rate).toBe(29.92)
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i].rate).toBeLessThanOrEqual(result[i - 1].rate)
    }
  })

  it('名称升降序，同值以 ID 稳定排序', () => {
    for (const key of ['name-asc', 'name-desc'] as const) {
      const result = sortBadges(BADGES, key)
      for (let i = 1; i < result.length; i += 1) {
        const prev = result[i - 1]
        const curr = result[i]
        if (prev.name === curr.name) {
          expect(prev.id <= curr.id).toBe(true)
        } else if (key === 'name-asc') {
          expect(prev.name.localeCompare(curr.name, 'zh-Hans-CN')).toBeLessThanOrEqual(0)
        } else {
          expect(curr.name.localeCompare(prev.name, 'zh-Hans-CN')).toBeLessThanOrEqual(0)
        }
      }
    }
  })

  it('不修改原数组', () => {
    const original = [...BADGES.map((badge) => badge.id)]
    sortBadges(BADGES, 'rate-desc')
    expect(BADGES.map((badge) => badge.id)).toEqual(original)
  })
})

describe('formatRate', () => {
  it('直接添加 %，保留原始数值写法', () => {
    expect(formatRate(0.01)).toBe('0.01%')
    expect(formatRate(3.36)).toBe('3.36%')
    expect(formatRate(29.92)).toBe('29.92%')
    expect(formatRate(100)).toBe('100%')
  })
})

describe('表格排序状态映射', () => {
  it('SortKey 与 TanStack SortingState 双向转换', () => {
    for (const key of ['rate-desc', 'rate-asc', 'name-asc', 'name-desc'] as const) {
      expect(sortKeyFromSortingState(sortingStateFromKey(key))).toBe(key)
    }
  })

  it('空排序状态映射回默认排序（获得率从高到低）', () => {
    expect(sortKeyFromSortingState([])).toBe('rate-desc')
    expect(sortKeyFromSortingState([{ id: 'unknown', desc: true }])).toBe('rate-desc')
  })
})
