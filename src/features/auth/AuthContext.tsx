import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { buildAuthorizeUrl, generateState, stashOAuthState } from './oauth'
import type { AuthConfig, OAuthUser } from './types'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  status: AuthStatus
  user: OAuthUser | null
  /** OAuth 是否已配置（决定登录入口是否可用）。 */
  loginAvailable: boolean
  /** 跳转到 2libra 授权页；配置不可用时抛错。 */
  login: () => Promise<void>
  /** 退出登录并清除服务端会话。 */
  logout: () => Promise<void>
  /** 重新拉取会话，授权回调页用它同步登录态。 */
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** 会话与登录态的顶层 Provider，挂在 BrowserRouter 内。 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<OAuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [loginAvailable, setLoginAvailable] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session')
      const data = (await response.json().catch(() => null)) as { user?: OAuthUser | null } | null
      const nextUser = response.ok && data?.user ? data.user : null
      setUser(nextUser)
      setStatus(nextUser !== null ? 'authenticated' : 'anonymous')
    } catch {
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  useEffect(() => {
    // 挂载时拉取会话与登录配置；setState 均发生在 await 之后，不属于同步级联渲染
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    void fetch('/api/auth/config')
      .then((response) => setLoginAvailable(response.ok))
      .catch(() => setLoginAvailable(false))
  }, [refresh])

  const login = useCallback(async () => {
    const response = await fetch('/api/auth/config')
    if (!response.ok) {
      throw new Error('登录暂未开放，请稍后再试')
    }
    const config = (await response.json()) as AuthConfig
    const state = generateState()
    stashOAuthState(state)
    window.location.href = buildAuthorizeUrl(config, state)
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // 会话 cookie 以服务端清除为准，失败时本地状态照样复位
    }
    setUser(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo(
    () => ({ status, user, loginAvailable, login, logout, refresh }),
    [status, user, loginAvailable, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook 与 Provider 同文件导出是 Context 惯例
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth 必须在 <AuthProvider> 内使用')
  }
  return context
}
