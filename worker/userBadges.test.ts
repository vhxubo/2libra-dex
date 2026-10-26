// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchUserBadges, UserBadgesUnavailableError } from './userBadges'

/** 模拟 about 页：佩戴徽章与徽章墙都会 SSR 成小图标引用，可能有重复。 */
const aboutHtml = `
<html><body>
<img src="https://r2.2libra.com/badge/svg/on_time.svg"/>
<img src="https://r2.2libra.com/badge/svg/i_was_here.svg"/>
<img src="https://r2.2libra.com/badge/svg/on_time.svg"/>
<img src="https://r2.2libra.com/badge/svg/listen_to_me.svg"/>
</body></html>
`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchUserBadges', () => {
  it('从 about 页小图标引用提取徽章 id，去重并排序', async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => new Response(aboutHtml))
    vi.stubGlobal('fetch', fetchMock)

    const ids = await fetchUserBadges('vhxubo')
    expect(ids).toEqual(['i_was_here', 'listen_to_me', 'on_time'])
    expect(fetchMock).toHaveBeenCalledWith('https://2libra.com/user/vhxubo/about')
  })

  it('用户名做 URL 编码，避免路径注入', async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => new Response(aboutHtml))
    vi.stubGlobal('fetch', fetchMock)

    await fetchUserBadges('a/b?c=d')
    expect(fetchMock).toHaveBeenCalledWith('https://2libra.com/user/a%2Fb%3Fc%3Dd/about')
  })

  it('页面无徽章时返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn(async (): Promise<Response> => new Response('<html></html>')))
    await expect(fetchUserBadges('nobody')).resolves.toEqual([])
  })

  it('非 200 响应抛 UserBadgesUnavailableError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> => new Response(null, { status: 404 })),
    )
    await expect(fetchUserBadges('ghost')).rejects.toThrow(UserBadgesUnavailableError)
  })

  it('网络异常抛 UserBadgesUnavailableError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> => {
        throw new TypeError('fetch failed')
      }),
    )
    await expect(fetchUserBadges('vhxubo')).rejects.toThrow(UserBadgesUnavailableError)
  })
})
