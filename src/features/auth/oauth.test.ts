import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildAuthorizeUrl,
  consumeOAuthState,
  generateState,
  OAUTH_AUTHORIZE_URL,
  parseCallbackParams,
  stashOAuthState,
} from './oauth'

beforeEach(() => {
  sessionStorage.clear()
})

describe('buildAuthorizeUrl', () => {
  it('包含全部授权参数', () => {
    const url = new URL(
      buildAuthorizeUrl({ client_id: 'cid', redirect_uri: 'https://app/cb' }, 'st-1'),
    )
    expect(`${url.origin}${url.pathname}`).toBe(OAUTH_AUTHORIZE_URL)
    expect(url.searchParams.get('client_id')).toBe('cid')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app/cb')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('profile')
    expect(url.searchParams.get('state')).toBe('st-1')
  })
})

describe('generateState', () => {
  it('生成 64 位十六进制且不重复', () => {
    const first = generateState()
    const second = generateState()
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(second).toMatch(/^[0-9a-f]{64}$/)
    expect(first).not.toBe(second)
  })
})

describe('parseCallbackParams', () => {
  it('code 与 state 齐全时判定成功并原样保留', () => {
    expect(parseCallbackParams(new URLSearchParams('code=abc&state=xyz'))).toEqual({
      status: 'ok',
      code: 'abc',
      state: 'xyz',
    })
  })

  it('error 参数优先于其他参数', () => {
    expect(
      parseCallbackParams(new URLSearchParams('error=access_denied&error_description=用户拒绝&code=x')),
    ).toEqual({ status: 'error', error: 'access_denied', errorDescription: '用户拒绝' })
  })

  it('errorDescription 缺省为 null', () => {
    expect(parseCallbackParams(new URLSearchParams('error=server_error'))).toEqual({
      status: 'error',
      error: 'server_error',
      errorDescription: null,
    })
  })

  it('缺少或为空的 code / state 判定非法', () => {
    expect(parseCallbackParams(new URLSearchParams('')).status).toBe('invalid')
    expect(parseCallbackParams(new URLSearchParams('code=x')).status).toBe('invalid')
    expect(parseCallbackParams(new URLSearchParams('state=y')).status).toBe('invalid')
    expect(parseCallbackParams(new URLSearchParams('code=&state=y')).status).toBe('invalid')
    expect(parseCallbackParams(new URLSearchParams('code=x&state=')).status).toBe('invalid')
  })
})

describe('state 存取', () => {
  it('stash 后 consume 取回并清除', () => {
    stashOAuthState('s1')
    expect(consumeOAuthState()).toBe('s1')
    expect(consumeOAuthState()).toBeNull()
  })

  it('未存过时返回 null', () => {
    expect(consumeOAuthState()).toBeNull()
  })
})
