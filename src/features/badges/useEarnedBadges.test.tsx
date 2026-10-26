import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthContext'
import type { OAuthUser } from '@/features/auth/types'
import { resetEarnedBadgesCache, useEarnedBadges } from './useEarnedBadges'

const testUser: OAuthUser = {
  id: 'u1',
  username: 'jimmy',
  user_number: 'u_123',
  avatar_url: null,
  level: 4,
}

let sessionUser: OAuthUser | null = null
let badgesHandler: () => Response = () =>
  Response.json({ username: 'jimmy', badges: ['i_was_here', 'on_time'] })

const fetchMock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/api/auth/config')) {
    return Promise.resolve(Response.json({ client_id: 'cid', redirect_uri: 'https://app/cb' }))
  }
  if (url.includes('/api/auth/session')) {
    return Promise.resolve(Response.json({ user: sessionUser }, { status: sessionUser ? 200 : 401 }))
  }
  if (url.includes('/api/auth/user-badges')) {
    return Promise.resolve(badgesHandler())
  }
  return Promise.reject(new Error(`unexpected fetch: ${url}`))
})

function Probe() {
  const { earnedIds, loading } = useEarnedBadges()
  if (loading) return <div data-testid="probe">loading</div>
  return (
    <div data-testid="probe">
      {earnedIds === null ? 'none' : [...earnedIds].sort().join(',')}
    </div>
  )
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  sessionUser = null
  badgesHandler = () => Response.json({ username: 'jimmy', badges: ['i_was_here', 'on_time'] })
  resetEarnedBadgesCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useEarnedBadges', () => {
  it('登录后拉取已获得徽章 id 集合', async () => {
    sessionUser = testUser
    renderProbe()

    expect(await screen.findByText('i_was_here,on_time')).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/api/auth/user-badges')),
    ).toBe(true)
  })

  it('未登录不发请求，结果为 null', async () => {
    renderProbe()

    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('none'))
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/api/auth/user-badges')),
    ).toBe(false)
  })

  it('接口失败时降级为 null', async () => {
    sessionUser = testUser
    badgesHandler = () => Response.json({ message: '上游不可用' }, { status: 502 })
    renderProbe()

    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('none'))
  })

  it('响应格式异常时降级为 null', async () => {
    sessionUser = testUser
    badgesHandler = () => Response.json({ badges: 'not-a-list' })
    renderProbe()

    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('none'))
  })

  it('5 分钟内重复挂载命中缓存，不重复请求', async () => {
    sessionUser = testUser
    const first = renderProbe()
    expect(await screen.findByText('i_was_here,on_time')).toBeInTheDocument()
    first.unmount()

    const second = renderProbe()
    expect(await screen.findByText('i_was_here,on_time')).toBeInTheDocument()
    second.unmount()

    const badgeCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/api/auth/user-badges'),
    )
    expect(badgeCalls).toHaveLength(1)
  })
})
