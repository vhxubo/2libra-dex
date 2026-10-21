import type { AuthConfig } from './types'

export const OAUTH_AUTHORIZE_URL = 'https://2libra.com/oauth/authorize'

const STATE_STORAGE_KEY = 'oauth_state'

/** 构造 2libra 授权页跳转地址。 */
export function buildAuthorizeUrl(config: AuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.client_id,
    redirect_uri: config.redirect_uri,
    response_type: 'code',
    scope: 'profile',
    state,
  })
  return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`
}

/** 生成 64 位十六进制随机 state，用于回调时防 CSRF。 */
export function generateState(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export type OAuthCallbackParams =
  | { status: 'ok'; code: string; state: string }
  | { status: 'error'; error: string; errorDescription: string | null }
  | { status: 'invalid' }

/** 解析回调地址查询参数；授权服务返回 error 时优先识别。 */
export function parseCallbackParams(params: URLSearchParams): OAuthCallbackParams {
  const error = params.get('error')
  if (error !== null) {
    return { status: 'error', error, errorDescription: params.get('error_description') }
  }
  const code = params.get('code')
  const state = params.get('state')
  if (code !== null && code !== '' && state !== null && state !== '') {
    return { status: 'ok', code, state }
  }
  return { status: 'invalid' }
}

/** 记录本次授权的 state，供回跳后一次性校验。 */
export function stashOAuthState(state: string): void {
  try {
    sessionStorage.setItem(STATE_STORAGE_KEY, state)
  } catch {
    // sessionStorage 不可用时回跳校验必然失败，用户重新发起登录即可
  }
}

/** 取出并清除 state；不存在或存储不可用时返回 null。 */
export function consumeOAuthState(): string | null {
  try {
    const state = sessionStorage.getItem(STATE_STORAGE_KEY)
    sessionStorage.removeItem(STATE_STORAGE_KEY)
    return state
  } catch {
    return null
  }
}
