import { describe, expect, it } from 'vitest'
import { PANDORA_EVENT_COUNT, PANDORA_EVENTS, RARITY_COUNTS, TIER_CODES } from './data'
import { RARITIES } from './types'

describe('pandora 数据接入', () => {
  it('内容完全重复的记录去重后共 21 条', () => {
    expect(PANDORA_EVENT_COUNT).toBe(21)
    expect(PANDORA_EVENTS).toHaveLength(21)
  })

  it('内容字段完全一致的事件至多一条', () => {
    const seen = new Set(
      PANDORA_EVENTS.map((event) =>
        JSON.stringify([
          event.eventCode,
          event.eventName,
          event.eventTitle,
          event.tierCode,
          event.rarity,
          event.rolledValue,
        ]),
      ),
    )
    expect(seen.size).toBe(PANDORA_EVENTS.length)
  })

  it('rarity 均为已知取值', () => {
    expect(PANDORA_EVENTS.every((event) => RARITIES.includes(event.rarity))).toBe(true)
  })

  it('稀有度计数与总数一致', () => {
    expect(RARITY_COUNTS).toEqual({ bronze: 6, silver: 4, gold: 4, purple: 7 })
  })

  it('采集顺序为时间从新到旧', () => {
    for (let i = 1; i < PANDORA_EVENTS.length; i += 1) {
      expect(PANDORA_EVENTS[i - 1].createdAt >= PANDORA_EVENTS[i].createdAt).toBe(true)
    }
  })

  it('tier_code 去重且按字母排序', () => {
    expect(TIER_CODES).toEqual([
      'avatar_shrink_purple',
      'avatar_skew_purple',
      'bronze',
      'bronze_bonus',
      'gold',
      'purple',
      'purple_bonus',
      'silver',
      'silver_penalty',
    ])
  })
})
