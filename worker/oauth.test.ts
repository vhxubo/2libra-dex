// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  exchangeCodeForUser,
  OAuthError,
  OAuthUnavailableError,
  parseOAuthClientConfig,
} from './oauth'

const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://2libra-dex.vhxubo.com/auth/callback',
}

const meData = {
  id: 'u1',
  username: 'jimmy',
  user_number: 'u_123',
  avatar_url: 'https://r2.2libra.com/a.png',
  level: 4,
}

function ok<T>(data: T): Response {
  return Response.json({ c: 0, m: '请求成功', d: data })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseOAuthClientConfig', () => {
  it('配置齐全时返回驼峰配置对象', () => {
    expect(
      parseOAuthClientConfig({
        OAUTH_CLIENT_ID: 'a',
        OAUTH_CLIENT_SECRET: 'b',
        OAUTH_REDIRECT_URI: 'c',
      }),
    ).toEqual({ clientId: 'a', clientSecret: 'b', redirectUri: 'c' })
  })

  it('任一项缺失返回 null', () => {
    expect(parseOAuthClientConfig({})).toBeNull()
    expect(parseOAuthClientConfig({ OAUTH_CLIENT_ID: 'a' })).toBeNull()
    expect(
      parseOAuthClientConfig({ OAUTH_CLIENT_ID: 'a', OAUTH_CLIENT_SECRET: 'b' }),
    ).toBeNull()
  })
})

describe('exchangeCodeForUser', () => {
  it('先换 token 再拉资料，请求参数完整', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/oauth/token')) {
          return ok({ access_token: 'at-1', token_type: 'Bearer', expires_in: 7200, scope: 'profile' })
        }
        if (url.endsWith('/oauth/me')) return ok(meData)
        throw new Error(`unexpected url: ${url}`)
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const user = await exchangeCodeForUser(config, 'auth-code-1')
    expect(user).toEqual(meData)

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(tokenUrl).toBe('https://2libra.com/api/oauth/token')
    expect(tokenInit.method).toBe('POST')
    const form = new URLSearchParams(tokenInit.body as string)
    expect(form.get('grant_type')).toBe('authorization_code')
    expect(form.get('code')).toBe('auth-code-1')
    expect(form.get('client_id')).toBe('client-id')
    expect(form.get('client_secret')).toBe('client-secret')
    expect(form.get('redirect_uri')).toBe(config.redirectUri)

    const [meUrl, meInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    expect(meUrl).toBe('https://2libra.com/api/oauth/me')
    expect((meInit.headers as Record<string, string>).Authorization).toBe('Bearer at-1')
  })

  it('2libra 返回业务错误时抛 OAuthError 并带原始 message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ c: 1, m: '授权码已失效' })),
    )
    await expect(exchangeCodeForUser(config, 'stale')).rejects.toThrow(OAuthError)
    await expect(exchangeCodeForUser(config, 'stale')).rejects.toThrow('授权码已失效')
  })

  it('token 接口非 200 抛 OAuthUnavailableError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
    await expect(exchangeCodeForUser(config, 'c1')).rejects.toThrow(OAuthUnavailableError)
  })

  it('网络异常抛 OAuthUnavailableError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    await expect(exchangeCodeForUser(config, 'c1')).rejects.toThrow(OAuthUnavailableError)
  })

  it('avatar_url 缺失时映射为 null，其余字段校验后返回', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/oauth/token')) {
          return ok({ access_token: 'at', token_type: 'Bearer', expires_in: 7200, scope: 'profile' })
        }
        return ok({ id: 'u1', username: 'jimmy', user_number: 'u_123', level: 4 })
      }),
    )
    const user = await exchangeCodeForUser(config, 'c2')
    expect(user).toEqual({ id: 'u1', username: 'jimmy', user_number: 'u_123', avatar_url: null, level: 4 })
  })

  it('用户资料关键字段缺失时抛 OAuthError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/oauth/token')) {
          return ok({ access_token: 'at', token_type: 'Bearer', expires_in: 7200, scope: 'profile' })
        }
        return ok({ id: 'u1', username: 'jimmy', level: 4 })
      }),
    )
    await expect(exchangeCodeForUser(config, 'c3')).rejects.toThrow('用户信息格式异常')
  })
})
