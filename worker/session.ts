/** 会话中的用户资料，字段与 2libra /api/oauth/me 返回保持一致。 */
export interface SessionUser {
  id: string
  username: string
  user_number: string
  avatar_url: string | null
  level: number
}

export const SESSION_COOKIE = 'session'

/** 会话有效期（秒），与 cookie Max-Age 保持一致。 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

interface SessionPayload {
  user: SessionUser
  /** 签发时间（Unix 秒）。 */
  iat: number
}

const encoder = new TextEncoder()
const TOKEN_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function hmacSign(input: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(input)))
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== 'object' || value === null) return false
  const user = value as Record<string, unknown>
  return (
    typeof user.id === 'string' &&
    typeof user.username === 'string' &&
    typeof user.user_number === 'string' &&
    (user.avatar_url === null || typeof user.avatar_url === 'string') &&
    typeof user.level === 'number'
  )
}

/** 为用户签发会话令牌：base64url(payload).base64url(HMAC-SHA256(payload))。 */
export async function createSessionToken(user: SessionUser, secret: string): Promise<string> {
  const payload: SessionPayload = { user, iat: Math.floor(Date.now() / 1000) }
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const signature = await hmacSign(body, secret)
  return `${body}.${toBase64Url(signature)}`
}

/** 校验会话令牌；签名不符、已过期或格式非法时返回 null。 */
export async function verifySessionToken(token: string, secret: string): Promise<SessionUser | null> {
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return null
  const body = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  if (!TOKEN_SEGMENT_PATTERN.test(body) || !TOKEN_SEGMENT_PATTERN.test(signature)) return null
  const expected = await hmacSign(body, secret)
  if (!timingSafeEqual(fromBase64Url(signature), expected)) return null
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body)),
    ) as Partial<SessionPayload>
    if (
      typeof payload.iat !== 'number' ||
      payload.iat + SESSION_MAX_AGE_SECONDS < Math.floor(Date.now() / 1000) ||
      !isSessionUser(payload.user)
    ) {
      return null
    }
    return payload.user
  } catch {
    return null
  }
}

/** 序列化会话写入的 Set-Cookie 值。 */
export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`
}

/** 序列化清除会话的 Set-Cookie 值。 */
export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

/** 从请求的 Cookie 头中取出会话令牌。 */
export function readSessionToken(cookieHeader: string | null): string | null {
  if (cookieHeader === null) return null
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE) return rest.join('=')
  }
  return null
}
