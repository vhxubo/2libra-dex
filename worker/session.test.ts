// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  clearedSessionCookie,
  createSessionToken,
  readSessionToken,
  SESSION_COOKIE,
  sessionCookie,
  verifySessionToken,
  type SessionUser,
} from './session'

const secret = 'unit-test-secret'
const user: SessionUser = {
  id: 'u1',
  username: 'jimmy',
  user_number: 'u_123',
  avatar_url: null,
  level: 4,
}

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('createSessionToken / verifySessionToken', () => {
  it('签发后可验证并还原用户', async () => {
    const token = await createSessionToken(user, secret)
    expect(await verifySessionToken(token, secret)).toEqual(user)
  })

  it('签名密钥不一致验证失败', async () => {
    const token = await createSessionToken(user, secret)
    expect(await verifySessionToken(token, 'other-secret')).toBeNull()
  })

  it('篡改 payload 验证失败', async () => {
    const token = await createSessionToken(user, secret)
    const [body, signature] = token.split('.')
    expect(body).toBeDefined()
    expect(signature).toBeDefined()
    const tampered = toBase64Url(
      JSON.stringify({ user: { ...user, level: 99 }, iat: Math.floor(Date.now() / 1000) }),
    )
    expect(await verifySessionToken(`${tampered}.${signature}`, secret)).toBeNull()
  })

  it('超过有效期验证失败', async () => {
    const token = await createSessionToken(user, secret)
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000)
    try {
      expect(await verifySessionToken(token, secret)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('格式非法或内容非 JSON 返回 null', async () => {
    expect(await verifySessionToken('', secret)).toBeNull()
    expect(await verifySessionToken('abc', secret)).toBeNull()
    expect(await verifySessionToken('..', secret)).toBeNull()
    expect(await verifySessionToken('!!/??', secret)).toBeNull()
    // 合法 base64url 但内容不是会话 payload
    expect(await verifySessionToken('YQ.YQ', secret)).toBeNull()
  })
})

describe('cookie 辅助函数', () => {
  it('sessionCookie 写入全部安全属性', () => {
    const cookie = sessionCookie('tok')
    expect(cookie).toContain(`${SESSION_COOKIE}=tok`)
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 30}`)
  })

  it('clearedSessionCookie 立即过期', () => {
    expect(clearedSessionCookie()).toContain(`${SESSION_COOKIE}=`)
    expect(clearedSessionCookie()).toContain('Max-Age=0')
  })

  it('readSessionToken 从 Cookie 头取值', () => {
    expect(readSessionToken(null)).toBeNull()
    expect(readSessionToken('other=1')).toBeNull()
    expect(readSessionToken('a=1; session=abc.def; b=2')).toBe('abc.def')
  })
})
