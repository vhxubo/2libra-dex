import { describe, expect, it } from 'vitest'
import {
  DEFAULT_URL_STATE,
  pandoraStateToSearchParams,
  parsePandoraSearchParams,
} from './urlState'

describe('pandora URL 状态', () => {
  it('无参数恢复默认排序（稀有度从高到低）', () => {
    expect(parsePandoraSearchParams(new URLSearchParams())).toEqual(DEFAULT_URL_STATE)
    expect(DEFAULT_URL_STATE.sort).toBe('rarity-desc')
  })

  it('非法 sort 值恢复默认', () => {
    expect(
      parsePandoraSearchParams(new URLSearchParams('sort=hack-asc')).sort,
    ).toBe('rarity-desc')
  })

  it('非默认 sort 值原样保留，默认值不写入序列化结果', () => {
    for (const sort of ['rarity-asc', 'tier-asc', 'tier-desc'] as const) {
      const parsed = parsePandoraSearchParams(new URLSearchParams(`sort=${sort}`))
      expect(parsed.sort).toBe(sort)
      expect(pandoraStateToSearchParams(parsed).get('sort')).toBe(sort)
    }
    expect(pandoraStateToSearchParams(DEFAULT_URL_STATE).toString()).toBe('')
  })

  it('搜索词原样保留，空白搜索词不写入序列化结果', () => {
    const parsed = parsePandoraSearchParams(new URLSearchParams('q=金币雨 purple'))
    expect(parsed.q).toBe('金币雨 purple')
    expect(pandoraStateToSearchParams(parsed).get('q')).toBe('金币雨 purple')
    expect(pandoraStateToSearchParams({ ...DEFAULT_URL_STATE, q: '   ' }).get('q')).toBeNull()
  })
})
