import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthContext'
import type { OAuthUser } from '@/features/auth/types'
import BadgeDexPage from './BadgeDexPage'
import { resetEarnedBadgesCache } from './useEarnedBadges'

const testUser: OAuthUser = {
  id: 'u1',
  username: 'jimmy',
  user_number: 'u_123',
  avatar_url: null,
  level: 4,
}

let sessionUser: OAuthUser | null = null
let userBadges: string[] = []

const fetchMock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/api/auth/config')) {
    return Promise.resolve(Response.json({ client_id: 'cid', redirect_uri: 'https://app/cb' }))
  }
  if (url.includes('/api/auth/session')) {
    return Promise.resolve(Response.json({ user: sessionUser }, { status: sessionUser ? 200 : 401 }))
  }
  if (url.includes('/api/auth/user-badges')) {
    return Promise.resolve(Response.json({ username: 'jimmy', badges: userBadges }))
  }
  return Promise.reject(new Error(`unexpected fetch: ${url}`))
})

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  sessionUser = null
  userBadges = []
  resetEarnedBadgesCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderPage(initialEntry = '/badges') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <BadgeDexPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

function getCardNames(): string[] {
  return screen.getAllByTestId('badge-card').map((card) => {
    const heading = within(card).getByRole('heading')
    return heading.textContent ?? ''
  })
}

describe('BadgeDexPage', () => {
  it('默认卡片视图展示全部 32 条数据的计数、更新时间与第一页 12 张卡片', () => {
    renderPage()
    expect(screen.getByTestId('result-count').textContent).toContain('32')
    expect(screen.getByText(/数据更新于 \d{4}-\d{2}-\d{2}/)).toBeInTheDocument()
    expect(screen.getAllByTestId('badge-card')).toHaveLength(12)
    expect(screen.getByTestId('page-status').textContent).toBe('第 1 / 3 页')
  })

  it('切换表格视图，两种视图首页结果一致', () => {
    renderPage()
    const cardNames = getCardNames()

    fireEvent.click(screen.getByRole('button', { name: '表格' }))
    const rows = screen.getAllByTestId('badge-row')
    expect(rows).toHaveLength(12)
    expect(screen.queryAllByTestId('badge-card')).toHaveLength(0)
    expect(screen.queryByTestId('badge-grid')).not.toBeInTheDocument()
    expect(rows[0].textContent).toContain(cardNames[0])
    // 图标大小开关只属于卡片视图，表格视图下隐藏
    expect(screen.queryByRole('group', { name: '卡片图标大小' })).not.toBeInTheDocument()
  })

  it('开关切换卡片大/小图标并写入 URL', async () => {
    const user = userEvent.setup()
    renderPage()

    const firstImg = () =>
      screen.getAllByTestId('badge-card')[0].querySelector('img') as HTMLImageElement
    expect(firstImg().getAttribute('src')).toContain('/badge/svg/')

    await user.click(screen.getByRole('button', { name: '大图标' }))

    expect(firstImg().getAttribute('src')).toMatch(/\/badge\/[^/]+\.svg$/)
    expect(firstImg().className).toContain('size-20')

    await user.click(screen.getByRole('button', { name: '小图标' }))

    expect(firstImg().getAttribute('src')).toContain('/badge/svg/')
  })

  it('URL 带 icon=large 时直接渲染大图标', () => {
    renderPage('/badges?icon=large')
    const img = screen.getAllByTestId('badge-card')[0].querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toMatch(/\/badge\/[^/]+\.svg$/)
    expect(img.className).toContain('size-20')
  })

  it('详情弹窗图标跟随页面大小图标开关', async () => {
    const user = userEvent.setup()
    renderPage('/badges?icon=large')

    await user.click(screen.getByRole('button', { name: '查看 2Libra 一周年！ 详情' }))
    const dialogImg = screen.getByRole('dialog').querySelector('img') as HTMLImageElement
    expect(dialogImg.getAttribute('src')).toMatch(/\/badge\/[^/]+\.svg$/)
    expect(dialogImg.className).toContain('size-24')

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // 切回小图标后重新打开详情，弹窗同步展示小图标
    await user.click(screen.getByRole('button', { name: '小图标' }))
    await user.click(screen.getByRole('button', { name: '查看 2Libra 一周年！ 详情' }))
    const smallImg = screen.getByRole('dialog').querySelector('img') as HTMLImageElement
    expect(smallImg.getAttribute('src')).toContain('/badge/svg/')
    expect(smallImg.className).toContain('size-16')
  })

  it('制作 GIF 入口把所选徽章和图标模式带到独立页面', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '制作动图' }))
    const cards = screen.getAllByTestId('badge-card')
    await user.click(cards[0])
    await user.click(cards[1])
    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '徽章图鉴' })).toBeInTheDocument()
  })

  it('点击卡片打开详情弹窗，展示条件与属性，可关闭', async () => {
    const user = userEvent.setup()
    renderPage()

    // 默认按获得率从高到低排序，首页第一张是「2Libra 一周年！」；卡片本身即按钮
    await user.click(screen.getByRole('button', { name: '查看 2Libra 一周年！ 详情' }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText('2026 年 8 月 26 日（含）发布过一篇帖子或一条评论的用户。'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('29.92%')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '复制详情链接' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: '关闭' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('URL 带 badge 参数时刷新直接打开详情弹窗', () => {
    renderPage('/badges?badge=followers')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('篝火')).toBeInTheDocument()
  })

  it('未知徽章链接给出提示', () => {
    renderPage('/badges?badge=ghost_badge')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('未找到该徽章')).toBeInTheDocument()
    expect(within(dialog).getByText(/ghost_badge/)).toBeInTheDocument()
  })

  it('搜索无结果时提供清空筛选入口', async () => {
    const user = userEvent.setup()
    renderPage()
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索徽章' }), {
      target: { value: '绝不存在的徽章xyz' },
    })

    expect(screen.getByText('没有匹配的徽章')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: '清空筛选' })[0])
    expect(screen.getByTestId('result-count').textContent).toContain('32')
    expect(screen.getAllByTestId('badge-card')).toHaveLength(12)
  })

  it('等级多选筛选并显示已选条件', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /等级 · 全部/ }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: /T0/ }))
    expect(screen.getByTestId('result-count').textContent).toContain('14')
    await user.click(screen.getByRole('menuitemcheckbox', { name: /T3/ }))
    expect(screen.getByTestId('result-count').textContent).toContain('17')

    expect(screen.getByText('等级 T0')).toBeInTheDocument()
    expect(screen.getByText('等级 T3')).toBeInTheDocument()
    await user.keyboard('{Escape}')
  })

  it('分页翻页与 URL 页码超界回正', async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await user.click(screen.getByRole('button', { name: '下一页' }))
    expect(screen.getByTestId('page-status').textContent).toBe('第 2 / 3 页')
    expect(getCardNames()[0]).toBe('寻找平衡')
    first.unmount()

    renderPage('/badges?page=999')
    await waitFor(() =>
      expect(screen.getByTestId('page-status').textContent).toBe('第 3 / 3 页'),
    )
  })

  it('切换每页条数后可一页展示全部 32 条', async () => {
    const user = userEvent.setup()
    renderPage('/badges?view=table')

    await user.click(screen.getByRole('button', { name: /条 \/ 页/ }))
    await user.click(screen.getByRole('menuitemradio', { name: '48 条 / 页' }))
    expect(screen.getAllByTestId('badge-row')).toHaveLength(32)
    expect(screen.getByTestId('page-status').textContent).toBe('第 1 / 1 页')
  })

  it('徽章图片加载失败时显示占位', () => {
    const { container } = renderPage()
    const img = container.querySelector('[data-testid="badge-card"] img')
    expect(img).not.toBeNull()
    fireEvent.error(img!)
    expect(screen.getAllByTitle('图片加载失败').length).toBeGreaterThan(0)
  })

  it('未登录时不展示获得状态筛选与标记', async () => {
    renderPage()
    await waitFor(() => expect(screen.queryByTestId('owned-count')).not.toBeInTheDocument())
    expect(screen.queryByRole('group', { name: '获得状态' })).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('earned-chip')).toHaveLength(0)
  })

  it('登录后展示已获得标记与数量，可按获得状态筛选', async () => {
    const user = userEvent.setup()
    sessionUser = testUser
    // 2libra 一周年！（2libra_1）与篝火（followers）为已获得
    userBadges = ['2libra_1', 'followers']
    renderPage()

    const ownedCount = await screen.findByTestId('owned-count')
    expect(ownedCount.textContent).toContain('2')
    // 默认排序首页第一张「2Libra 一周年！」带已获得标记
    const firstCard = screen.getAllByTestId('badge-card')[0]
    expect(within(firstCard).getByTestId('earned-chip')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /已获得/ }))
    expect(screen.getByTestId('result-count').textContent).toContain('2')
    expect(screen.getAllByTestId('badge-card')).toHaveLength(2)
    // 筛选后列表里每张卡片都带已获得标记
    expect(screen.getAllByTestId('earned-chip')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /未获得/ }))
    expect(screen.getByTestId('result-count').textContent).toContain('30')

    await user.click(screen.getByRole('button', { name: /^全部/ }))
    expect(screen.getByTestId('result-count').textContent).toContain('32')
  })

  it('表格视图登录后增加获得状态列', async () => {
    sessionUser = testUser
    userBadges = ['2libra_1']
    renderPage('/badges?view=table')

    await screen.findByTestId('owned-count')
    expect(screen.getByRole('columnheader', { name: '获得状态' })).toBeInTheDocument()
    const rows = screen.getAllByTestId('badge-row')
    expect(within(rows[0]).getByTestId('earned-chip')).toBeInTheDocument()
    expect(within(rows[1]).queryByTestId('earned-chip')).not.toBeInTheDocument()
  })
})
