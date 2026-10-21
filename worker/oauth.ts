import type { SessionUser } from './session'

const API_BASE = 'https://2libra.com/api'

/** 2libra 接口统一响应包装，c 为 0 表示成功。 */
interface ApiEnvelope<T> {
  c: number
  m: string
  d?: T
}

interface TokenData {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

export interface OAuthClientConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/** 2libra 返回业务错误（授权码失效、secret 不符等）。 */
export class OAuthError extends Error {}

/** 2libra 服务不可达或响应异常。 */
export class OAuthUnavailableError extends Error {}

export interface OAuthEnv {
  OAUTH_CLIENT_ID?: string
  OAUTH_CLIENT_SECRET?: string
  OAUTH_REDIRECT_URI?: string
}

/** 从环境变量解析 OAuth 客户端配置，任一项缺失返回 null。 */
export function parseOAuthClientConfig(env: OAuthEnv): OAuthClientConfig | null {
  const { OAUTH_CLIENT_ID: clientId, OAUTH_CLIENT_SECRET: clientSecret, OAUTH_REDIRECT_URI: redirectUri } = env
  if (clientId === undefined || clientSecret === undefined || redirectUri === undefined) {
    return null
  }
  return { clientId, clientSecret, redirectUri }
}

/** 用授权码换取 access_token（用后即弃），再拉取用户资料。 */
export async function exchangeCodeForUser(config: OAuthClientConfig, code: string): Promise<SessionUser> {
  const token = await fetchToken(config, code)
  return fetchMe(token.access_token)
}

async function fetchToken(config: OAuthClientConfig, code: string): Promise<TokenData> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      }),
    })
  } catch {
    throw new OAuthUnavailableError('无法连接 2libra 授权服务')
  }
  if (!response.ok) throw new OAuthUnavailableError('2libra 授权服务异常')
  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<TokenData> | null
  if (envelope === null || envelope.c !== 0 || envelope.d?.access_token === undefined) {
    throw new OAuthError(envelope?.m ?? '授权码交换失败')
  }
  return envelope.d
}

async function fetchMe(accessToken: string): Promise<SessionUser> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/oauth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new OAuthUnavailableError('无法连接 2libra 用户服务')
  }
  if (!response.ok) throw new OAuthUnavailableError('2libra 用户服务异常')
  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<Partial<SessionUser>> | null
  const me = envelope?.d
  if (envelope === null || envelope.c !== 0 || me === undefined) {
    throw new OAuthError(envelope?.m ?? '获取用户信息失败')
  }
  if (
    typeof me.id !== 'string' ||
    typeof me.username !== 'string' ||
    typeof me.user_number !== 'string' ||
    typeof me.level !== 'number'
  ) {
    throw new OAuthError('用户信息格式异常')
  }
  return {
    id: me.id,
    username: me.username,
    user_number: me.user_number,
    avatar_url: typeof me.avatar_url === 'string' ? me.avatar_url : null,
    level: me.level,
  }
}
