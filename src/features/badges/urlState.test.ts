import { describe, expect, it } from 'vitest'
import {
  badgeStateToSearchParams,
  DEFAULT_URL_STATE,
  parseBadgeSearchParams,
  type BadgeUrlState,
} from './urlState'

function parse(queryString: string) {
  return parseBadgeSearchParams(new URLSearchParams(queryString))
}

describe('parseBadgeSearchParams', () => {
  it('空参数恢复默认状态', () => {
    expect(parse('')).toEqual(DEFAULT_URL_STATE)
  })

  it('解析全部合法参数', () => {
    const state = parse(
      '?q=篝火&level=T0,T2&attr=佩戴属性&min=5&max=20&sort=rate-desc&view=table&page=3&badge=followers',
    )
    expect(state).toEqual({
      q: '篝火',
      levels: ['T0', 'T2'],
      attrType: '佩戴属性',
      rateMin: 5,
      rateMax: 20,
      sort: 'rate-desc',
      view: 'table',
      page: 3,
      badgeId: 'followers',
    })
  })

  it('非法等级被过滤，合法等级按固定顺序排列', () => {
    expect(parse('?level=T9,T1')).toEqual({ ...DEFAULT_URL_STATE, levels: ['T1'] })
    expect(parse('?level=T2,,T0')).toEqual({ ...DEFAULT_URL_STATE, levels: ['T0', 'T2'] })
  })

  it('非法排序、视图、页码恢复默认', () => {
    expect(parse('?sort=bogus').sort).toBe('default')
    expect(parse('?view=grid').view).toBe('card')
    expect(parse('?page=0').page).toBe(1)
    expect(parse('?page=abc').page).toBe(1)
    expect(parse('?page=-3').page).toBe(1)
  })

  it('获得率限制在 0–100，非法恢复默认', () => {
    expect(parse('?min=0').rateMin).toBe(0)
    expect(parse('?max=100').rateMax).toBe(100)
    expect(parse('?min=abc').rateMin).toBeNull()
    expect(parse('?min=-5').rateMin).toBeNull()
    expect(parse('?max=200').rateMax).toBeNull()
  })

  it('非法属性类型恢复默认', () => {
    expect(parse('?attr=不存在的类型').attrType).toBeNull()
    expect(parse('?attr=描述').attrType).toBe('描述')
  })

  it('详情徽章 ID 保留并去除首尾空白', () => {
    expect(parse('?badge= followers ').badgeId).toBe('followers')
    expect(parse('?badge=').badgeId).toBeNull()
  })

  it('搜索关键词原样保留，不做裁剪', () => {
    expect(parse('?q= abc ').q).toBe(' abc ')
  })
})

describe('badgeStateToSearchParams', () => {
  it('默认状态序列化为空参数', () => {
    expect(badgeStateToSearchParams(DEFAULT_URL_STATE).toString()).toBe('')
  })

  it('解析-序列化-再解析保持一致', () => {
    const query =
      '?q=篝火&level=T0,T2&attr=佩戴属性&min=5&max=20&sort=rate-desc&view=table&page=3&badge=followers'
    const once = parse(query)
    const params = badgeStateToSearchParams(once)
    expect(parse(`?${params.toString()}`)).toEqual(once)
  })

  it('多关键词搜索原样写入', () => {
    const state: BadgeUrlState = { ...DEFAULT_URL_STATE, q: '篝火 金币' }
    expect(badgeStateToSearchParams(state).get('q')).toBe('篝火 金币')
  })
})
