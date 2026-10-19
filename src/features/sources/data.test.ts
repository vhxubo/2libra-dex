import { describe, expect, it } from 'vitest'
import { ADMIN_USERNAMES, GOLD_LEADERBOARD_TOP10, userAboutUrl } from './data'

describe('数据来源', () => {
  it('金币排行榜 Top10 共 10 人且无重复', () => {
    expect(GOLD_LEADERBOARD_TOP10).toHaveLength(10)
    expect(new Set(GOLD_LEADERBOARD_TOP10).size).toBe(GOLD_LEADERBOARD_TOP10.length)
  })

  it('排行榜顺序与采集记录一致', () => {
    expect([...GOLD_LEADERBOARD_TOP10]).toEqual([
      'bopomofo',
      'Evan',
      'libra2',
      'JoeJoeJoe',
      'wintermute',
      'february2',
      'Altria',
      'cnskis',
      'utags',
      'CxTboceder',
    ])
  })

  it('管理员为 Jimmy 且不在排行榜内', () => {
    expect([...ADMIN_USERNAMES]).toEqual(['Jimmy'])
    const top10: readonly string[] = GOLD_LEADERBOARD_TOP10
    expect(top10).not.toContain('Jimmy')
  })

  it('用户主页链接指向 2libra.com 的 about 页面', () => {
    expect(userAboutUrl('bopomofo')).toBe('https://2libra.com/user/bopomofo/about')
    expect(userAboutUrl('Jimmy')).toBe('https://2libra.com/user/Jimmy/about')
  })
})
