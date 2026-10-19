import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import BadgeDexPage from './BadgeDexPage'

function renderPage(initialEntry = '/badges') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <BadgeDexPage />
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
  it('默认卡片视图展示全部 31 条数据的计数与第一页 12 张卡片', () => {
    renderPage()
    expect(screen.getByTestId('result-count').textContent).toContain('31')
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
    expect(screen.getByTestId('result-count').textContent).toContain('31')
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
    expect(getCardNames()[0]).toBe('幸运儿')
    first.unmount()

    renderPage('/badges?page=999')
    await waitFor(() =>
      expect(screen.getByTestId('page-status').textContent).toBe('第 3 / 3 页'),
    )
  })

  it('切换每页条数后可一页展示全部 31 条', async () => {
    const user = userEvent.setup()
    renderPage('/badges?view=table')

    await user.click(screen.getByRole('button', { name: /条 \/ 页/ }))
    await user.click(screen.getByRole('menuitemradio', { name: '48 条 / 页' }))
    expect(screen.getAllByTestId('badge-row')).toHaveLength(31)
    expect(screen.getByTestId('page-status').textContent).toBe('第 1 / 1 页')
  })

  it('徽章图片加载失败时显示占位', () => {
    const { container } = renderPage()
    const img = container.querySelector('[data-testid="badge-card"] img')
    expect(img).not.toBeNull()
    fireEvent.error(img!)
    expect(screen.getAllByTitle('图片加载失败').length).toBeGreaterThan(0)
  })
})
