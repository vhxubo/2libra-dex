import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthCallbackPage from './AuthCallbackPage'
import { AuthProvider } from './AuthContext'

const testUser = {
  id: 'u1',
  username: 'jimmy',
  user_number: 'u_123',
  avatar_url: null,
  level: 4,
}

let sessionUser: typeof testUser | null = null
let exchangeHandler: () => Response = () => Response.json({ user: testUser })

const fetchMock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/api/auth/config')) {
    return Promise.resolve(Response.json({ client_id: 'cid', redirect_uri: 'https://app/cb' }))
  }
  if (url.includes('/api/auth/session')) {
    return Promise.resolve(Response.json({ user: sessionUser }, { status: sessionUser ? 200 : 401 }))
  }
  if (url.includes('/api/auth/exchange')) {
    return Promise.resolve(exchangeHandler())
  }
  return Promise.reject(new Error(`unexpected fetch: ${url}`))
})

function renderPage(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${query}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/badges" element={<div data-testid="badges-page" />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  sessionUser = null
  exchangeHandler = () => {
    sessionUser = testUser
    return Response.json({ user: testUser })
  }
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AuthCallbackPage', () => {
  it('state 校验通过后交换会话并跳回图鉴', async () => {
    sessionStorage.setItem('oauth_state', 'state-1')
    renderPage('?code=abc&state=state-1')

    expect(await screen.findByTestId('badges-page')).toBeInTheDocument()
    const exchangeCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/api/auth/exchange'),
    )
    expect(exchangeCalls).toHaveLength(1)
    expect(sessionStorage.getItem('oauth_state')).toBeNull()
  })

  it('state 不匹配时提示重新登录，不发起交换', async () => {
    sessionStorage.setItem('oauth_state', 'other')
    renderPage('?code=abc&state=state-1')

    expect(await screen.findByText('登录状态校验失败，请重新登录')).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/api/auth/exchange')),
    ).toBe(false)
  })

  it('授权服务返回 error 时展示拒绝原因', async () => {
    renderPage('?error=access_denied&error_description=用户拒绝授权')

    expect(await screen.findByText('授权失败：用户拒绝授权')).toBeInTheDocument()
  })

  it('缺少 code / state 时提示参数非法', async () => {
    renderPage('')

    expect(await screen.findByText('回调参数缺失或非法，请重新发起登录')).toBeInTheDocument()
  })

  it('交换失败时展示服务端错误信息', async () => {
    sessionStorage.setItem('oauth_state', 'state-1')
    exchangeHandler = () => Response.json({ message: '授权码已过期' }, { status: 400 })
    renderPage('?code=abc&state=state-1')

    expect(await screen.findByText('授权码已过期')).toBeInTheDocument()
    expect(screen.queryByTestId('badges-page')).not.toBeInTheDocument()
  })
})
