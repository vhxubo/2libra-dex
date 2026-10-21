import {
  exchangeCodeForUser,
  OAuthError,
  OAuthUnavailableError,
  parseOAuthClientConfig,
} from './oauth'
import {
  clearedSessionCookie,
  createSessionToken,
  readSessionToken,
  sessionCookie,
  verifySessionToken,
} from './session'

interface Env {
  /** Cloudflare 静态资产绑定。 */
  ASSETS: { fetch(input: Request | URL, init?: RequestInit): Promise<Response> }
  OAUTH_CLIENT_ID?: string
  OAUTH_CLIENT_SECRET?: string
  OAUTH_REDIRECT_URI?: string
  AUTH_SESSION_KEY?: string
}

const AUTH_PATH_PREFIX = '/api/auth/'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith(AUTH_PATH_PREFIX)) {
      return handleAuthRequest(request, env)
    }
    return serveAsset(request, env, url)
  },
}

/** 非 /api/auth 路径交给静态资产；未命中且接受 HTML 时回退 index.html，保留 SPA 路由。 */
async function serveAsset(request: Request, env: Env, url: URL): Promise<Response> {
  const asset = await env.ASSETS.fetch(request)
  if (
    asset.status !== 404 ||
    request.method !== 'GET' ||
    !request.headers.get('accept')?.includes('text/html')
  ) {
    return asset
  }
  return env.ASSETS.fetch(new Request(new URL('/index.html', url)))
}

async function handleAuthRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  switch (`${request.method} ${url.pathname}`) {
    case 'GET /api/auth/config':
      return handleConfig(env)
    case 'POST /api/auth/exchange':
      return handleExchange(request, env)
    case 'GET /api/auth/session':
      return handleSession(request, env)
    case 'POST /api/auth/logout':
      return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearedSessionCookie() } })
    default:
      return Response.json({ message: '接口不存在' }, { status: 404 })
  }
}

/** OAuth 客户端配置；client_id 非机密，供前端拼授权跳转。未配置时 503，前端据此降级登录入口。 */
function handleConfig(env: Env): Response {
  const config = parseOAuthClientConfig(env)
  if (config === null || env.AUTH_SESSION_KEY === undefined) {
    return Response.json({ message: '登录功能尚未配置' }, { status: 503 })
  }
  return Response.json({ client_id: config.clientId, redirect_uri: config.redirectUri })
}

/** 授权码换会话：code 由前端提供，redirect_uri 只信 Worker 自己的配置。 */
async function handleExchange(request: Request, env: Env): Promise<Response> {
  const config = parseOAuthClientConfig(env)
  if (config === null || env.AUTH_SESSION_KEY === undefined) {
    return Response.json({ message: '登录功能尚未配置' }, { status: 503 })
  }
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null
  if (typeof body?.code !== 'string' || body.code.length === 0 || body.code.length > 512) {
    return Response.json({ message: '授权码缺失或格式非法' }, { status: 400 })
  }
  let user
  try {
    user = await exchangeCodeForUser(config, body.code)
  } catch (error) {
    if (error instanceof OAuthError) {
      return Response.json({ message: error.message }, { status: 400 })
    }
    if (error instanceof OAuthUnavailableError) {
      return Response.json({ message: error.message }, { status: 502 })
    }
    return Response.json({ message: '登录失败，请稍后重试' }, { status: 500 })
  }
  const token = await createSessionToken(user, env.AUTH_SESSION_KEY)
  return Response.json({ user }, { headers: { 'Set-Cookie': sessionCookie(token) } })
}

/** 依据会话 cookie 返回当前用户；无有效会话返回 401。 */
async function handleSession(request: Request, env: Env): Promise<Response> {
  if (env.AUTH_SESSION_KEY === undefined) {
    return Response.json({ user: null }, { status: 503 })
  }
  const token = readSessionToken(request.headers.get('cookie'))
  const user = token === null ? null : await verifySessionToken(token, env.AUTH_SESSION_KEY)
  if (user === null) {
    return Response.json({ user: null }, { status: 401 })
  }
  return Response.json({ user })
}
