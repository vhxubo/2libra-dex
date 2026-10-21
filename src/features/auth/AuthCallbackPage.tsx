import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from './AuthContext'
import { consumeOAuthState, parseCallbackParams } from './oauth'
import type { OAuthUser } from './types'

type CallbackUiState = { kind: 'working' } | { kind: 'error'; message: string }

/** OAuth 授权回跳处理页：校验 state、交换会话后跳回图鉴。 */
export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login, refresh } = useAuth()
  const [ui, setUi] = useState<CallbackUiState>({ kind: 'working' })
  // 授权码单次使用，整段流程必须只跑一次（含开发态 StrictMode 双执行）
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void (async () => {
      const parsed = parseCallbackParams(searchParams)
      if (parsed.status === 'error') {
        setUi({
          kind: 'error',
          message: `授权失败：${parsed.errorDescription ?? parsed.error}`,
        })
        return
      }
      if (parsed.status === 'invalid') {
        setUi({ kind: 'error', message: '回调参数缺失或非法，请重新发起登录' })
        return
      }
      const expectedState = consumeOAuthState()
      if (expectedState === null || expectedState !== parsed.state) {
        setUi({ kind: 'error', message: '登录状态校验失败，请重新登录' })
        return
      }
      try {
        const response = await fetch('/api/auth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: parsed.code }),
        })
        const data = (await response.json().catch(() => null)) as {
          user?: OAuthUser
          message?: string
        } | null
        if (!response.ok || !data?.user) {
          setUi({ kind: 'error', message: data?.message ?? '登录失败，请重试' })
          return
        }
        await refresh()
        navigate('/badges', { replace: true })
      } catch {
        setUi({ kind: 'error', message: '网络异常，登录失败，请重试' })
      }
    })()
  }, [searchParams, navigate, refresh])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      {ui.kind === 'working' ? (
        <>
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">正在完成 2libra 登录…</p>
        </>
      ) : (
        <>
          <ShieldAlert className="size-8 text-destructive" aria-hidden />
          <h1 className="text-base font-semibold">登录未完成</h1>
          <p className="text-sm text-muted-foreground">{ui.message}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/badges')}>
              返回图鉴
            </Button>
            <Button
              size="sm"
              onClick={() => void login().catch(() => setUi({ kind: 'error', message: '登录暂未开放，请稍后再试' }))}
            >
              重新登录
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
