// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index'

const env = {
  ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
}

function makeRequest(path: string): Request {
  return new Request(`https://example.com${path}`)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GET /api/badge-icon', () => {
  it('合法 id 时代理 R2 上的 SVG 并附缓存头', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('<svg></svg>', {
          headers: { 'content-type': 'image/svg+xml' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await worker.fetch(makeRequest('/api/badge-icon?id=followers'), env)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/svg+xml')
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400')
    expect(await res.text()).toBe('<svg></svg>')
    expect(fetchMock).toHaveBeenCalledWith('https://r2.2libra.com/badge/followers.svg')
  })

  it('id 缺失或含非法字符返回 400', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const missing = await worker.fetch(makeRequest('/api/badge-icon'), env)
    expect(missing.status).toBe(400)

    const illegal = await worker.fetch(makeRequest('/api/badge-icon?id=../secret'), env)
    expect(illegal.status).toBe(400)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('上游返回非 200 或非 SVG 时返回 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not found', { status: 404 })),
    )
    expect((await worker.fetch(makeRequest('/api/badge-icon?id=ghost'), env)).status).toBe(502)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })),
    )
    expect((await worker.fetch(makeRequest('/api/badge-icon?id=followers'), env)).status).toBe(502)
  })

  it('上游请求抛错时返回 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    const res = await worker.fetch(makeRequest('/api/badge-icon?id=followers'), env)

    expect(res.status).toBe(502)
  })
})
