import { describe, expect, it } from 'vitest'
import { PANDORA_EVENTS } from './data'
import type { PandoraEvent } from './types'
import {
  dedupeEvents,
  filterEvents,
  groupEvents,
  matchesQuery,
  nextSortKey,
  normalizeQuery,
  RARITY_ORDER,
  sortGroups,
} from './query'

describe('dedupeEvents', () => {
  const base: PandoraEvent = {
    id: 'newest',
    rarity: 'gold',
    tierCode: 'gold',
    eventCode: 'comment_min_length',
    eventName: '多说多写',
    eventTitle: '评论回复只能输入 10 个字以上。',
    rolledValue: 10,
    createdAt: '2026-10-12T00:31:00.008Z',
  }

  it('内容完全一致的重复事件只保留最新一条', () => {
    const result = dedupeEvents([
      base,
      { ...base, id: 'older', createdAt: '2026-10-10T00:33:00.012Z' },
      { ...base, id: 'oldest', createdAt: '2026-10-08T00:25:00.057Z' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('newest')
  })

  it('任一内容字段不同即视为不同事件', () => {
    const result = dedupeEvents([
      base,
      { ...base, id: 'other-value', rolledValue: 20 },
      { ...base, id: 'other-title', eventTitle: '评论回复只能输入 20 个字以上。' },
    ])
    expect(result).toHaveLength(3)
  })

  it('不修改原数组', () => {
    const events = [base, { ...base, id: 'older' }]
    dedupeEvents(events)
    expect(events).toHaveLength(2)
    expect(events[1].id).toBe('older')
  })
})

describe('normalizeQuery', () => {
  it('去除首尾空白并按空白拆分关键词', () => {
    expect(normalizeQuery('  金币雨   purple ')).toEqual(['金币雨', 'purple'])
  })

  it('纯空白返回空数组', () => {
    expect(normalizeQuery('   ')).toEqual([])
  })
})

describe('matchesQuery', () => {
  const byName = (name: string) => {
    const event = PANDORA_EVENTS.find((item) => item.eventName === name)
    if (!event) throw new Error(`缺少测试数据:${name}`)
    return event
  }

  it('按事件名称与效果文本命中', () => {
    expect(matchesQuery(byName('金币雨'), '小小金币雨')).toBe(true)
  })

  it('按 event_code 与 tier_code 命中且忽略英文大小写', () => {
    expect(matchesQuery(byName('多说多写'), 'COMMENT_MIN_LENGTH')).toBe(true)
    expect(matchesQuery(byName('缩小灯'), 'Avatar_Shrink_Purple')).toBe(true)
  })

  it('按稀有度代码或中文标签命中', () => {
    expect(matchesQuery(byName('动起来！'), 'purple')).toBe(true)
    expect(matchesQuery(byName('动起来！'), '紫色')).toBe(true)
  })

  it('多个关键词须全部命中', () => {
    const purpleCoin = PANDORA_EVENTS.find(
      (event) => event.eventName === '金币雨' && event.rarity === 'purple',
    )
    if (!purpleCoin) throw new Error('缺少测试数据:紫色金币雨')
    expect(matchesQuery(purpleCoin, '金币雨 紫色')).toBe(true)
    expect(matchesQuery(purpleCoin, '金币雨 bronze')).toBe(false)
  })

  it('无匹配返回 false', () => {
    expect(matchesQuery(byName('金币雨'), '绝不存在的词xyz')).toBe(false)
  })
})

describe('filterEvents', () => {
  it('空白搜索词返回去重后的全部 21 条', () => {
    expect(filterEvents(PANDORA_EVENTS, '')).toHaveLength(21)
    expect(filterEvents(PANDORA_EVENTS, '   ')).toHaveLength(21)
  })

  it('按名称过滤「金币雨」共 6 条', () => {
    const result = filterEvents(PANDORA_EVENTS, '金币雨')
    expect(result).toHaveLength(6)
    expect(result.every((event) => event.eventName === '金币雨')).toBe(true)
  })

  it('不修改原数组', () => {
    const original = PANDORA_EVENTS.map((event) => event.id)
    filterEvents(PANDORA_EVENTS, '金币雨')
    expect(PANDORA_EVENTS.map((event) => event.id)).toEqual(original)
  })
})

describe('groupEvents', () => {
  it('去重后 21 条事件按名称合并为 13 组，计数与组数一致', () => {
    const groups = groupEvents(PANDORA_EVENTS)
    expect(groups).toHaveLength(13)
    expect(groups.reduce((sum, group) => sum + group.count, 0)).toBe(21)
  })

  it('「金币雨」组：6 条、最高稀有度紫色、tier_code 去重排序', () => {
    const group = groupEvents(PANDORA_EVENTS).find((item) => item.eventName === '金币雨')
    if (!group) throw new Error('缺少测试数据:金币雨')
    expect(group.count).toBe(6)
    expect(group.maxRarity).toBe('purple')
    expect(group.tierCodes).toEqual(['bronze', 'gold', 'purple', 'silver'])
  })

  it('组内事件保持时间从新到旧', () => {
    const group = groupEvents(PANDORA_EVENTS).find((item) => item.eventName === '金币雨')
    if (!group) throw new Error('缺少测试数据:金币雨')
    // 最新一条是 2026-10-18 的 62 金币
    expect(group.events[0].rolledValue).toBe(62)
    expect(group.newestAt).toBe('2026-10-18T00:35:00.047Z')
    for (let i = 1; i < group.events.length; i += 1) {
      expect(group.events[i - 1].createdAt >= group.events[i].createdAt).toBe(true)
    }
  })

  it('过滤后分组反映过滤结果', () => {
    const groups = groupEvents(filterEvents(PANDORA_EVENTS, '金币雨'))
    expect(groups).toHaveLength(1)
    expect(groups[0].count).toBe(6)
  })

  it('不修改原数组', () => {
    const original = PANDORA_EVENTS.map((event) => event.id)
    groupEvents(PANDORA_EVENTS)
    expect(PANDORA_EVENTS.map((event) => event.id)).toEqual(original)
  })
})

describe('sortGroups', () => {
  it('默认稀有度降序：首组为最新的紫色组「动起来！」，末组为唯一青铜组「回归起点」', () => {
    const result = sortGroups(groupEvents(PANDORA_EVENTS), 'rarity-desc')
    expect(result[0].eventName).toBe('动起来！')
    expect(result[0].maxRarity).toBe('purple')
    expect(result[result.length - 1].eventName).toBe('回归起点')
    for (let i = 1; i < result.length; i += 1) {
      expect(
        RARITY_ORDER[result[i - 1].maxRarity] >= RARITY_ORDER[result[i].maxRarity],
      ).toBe(true)
    }
  })

  it('稀有度升序：青铜组在前', () => {
    const result = sortGroups(groupEvents(PANDORA_EVENTS), 'rarity-asc')
    expect(result[0].eventName).toBe('回归起点')
    expect(result[0].maxRarity).toBe('bronze')
  })

  it('同最高稀有度内按组内最新事件从新到旧回退', () => {
    const result = sortGroups(groupEvents(PANDORA_EVENTS), 'rarity-desc')
    for (let i = 1; i < result.length; i += 1) {
      if (result[i - 1].maxRarity === result[i].maxRarity) {
        expect(result[i - 1].newestAt >= result[i].newestAt).toBe(true)
      }
    }
  })

  it('tier_code 升序按组内最小 tier_code 单调，首组为「缩小灯」', () => {
    const result = sortGroups(groupEvents(PANDORA_EVENTS), 'tier-asc')
    expect(result[0].eventName).toBe('缩小灯')
    expect(result[0].tierCodes[0]).toBe('avatar_shrink_purple')
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i - 1].tierCodes[0] <= result[i].tierCodes[0]).toBe(true)
    }
  })

  it('不修改原数组', () => {
    const groups = groupEvents(PANDORA_EVENTS)
    const original = groups.map((group) => group.eventName)
    sortGroups(groups, 'rarity-asc')
    expect(groups.map((group) => group.eventName)).toEqual(original)
  })
})

describe('nextSortKey', () => {
  it('同列升降切换', () => {
    expect(nextSortKey('rarity-desc', 'rarity')).toBe('rarity-asc')
    expect(nextSortKey('rarity-asc', 'rarity')).toBe('rarity-desc')
    expect(nextSortKey('tier-desc', 'tier')).toBe('tier-asc')
    expect(nextSortKey('tier-asc', 'tier')).toBe('tier-desc')
  })

  it('跨列点击：稀有度落降序、tier_code 落升序', () => {
    expect(nextSortKey('tier-desc', 'rarity')).toBe('rarity-desc')
    expect(nextSortKey('rarity-desc', 'tier')).toBe('tier-asc')
  })
})
