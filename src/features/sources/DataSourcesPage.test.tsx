import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { GOLD_LEADERBOARD_TOP10 } from './data'
import DataSourcesPage from './DataSourcesPage'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/sources']}>
      <DataSourcesPage />
    </MemoryRouter>,
  )
}

describe('DataSourcesPage', () => {
  it('展示金币排行榜 Top10，名称与顺序一致且均链接到 about 页面', () => {
    renderPage()
    const list = screen.getByRole('list', { name: /金币排行榜/ })
    const links = within(list).getAllByRole('link')

    expect(links).toHaveLength(GOLD_LEADERBOARD_TOP10.length)
    GOLD_LEADERBOARD_TOP10.forEach((username, index) => {
      expect(links[index].textContent).toContain(username)
      expect(links[index]).toHaveAttribute(
        'href',
        `https://2libra.com/user/${username}/about`,
      )
      expect(links[index]).toHaveAttribute('target', '_blank')
    })
  })

  it('单独展示管理员 Jimmy 并带有特殊标识', () => {
    renderPage()
    const adminList = screen.getByRole('list', { name: '2Libra 管理员' })
    const links = within(adminList).getAllByRole('link')

    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://2libra.com/user/Jimmy/about')
    expect(within(adminList).getByText('2Libra 管理员')).toBeInTheDocument()
  })

  it('提供返回徽章图鉴的站内链接', () => {
    renderPage()
    const back = screen.getByRole('link', { name: '徽章图鉴' })
    expect(back).toHaveAttribute('href', '/badges')
  })
})
