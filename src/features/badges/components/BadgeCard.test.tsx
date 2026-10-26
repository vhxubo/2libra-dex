import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { BadgeRecord } from '../types'
import { BadgeCard } from './BadgeCard'

const badge: BadgeRecord = {
  id: 'followers',
  name: '篝火',
  icon: 'https://r2.2libra.com/badge/svg/followers.svg',
  exportIcon: 'https://r2.2libra.com/badge/followers.svg',
  level: 'T0',
  rate: 0.01,
  condition: '关注达成条件',
  attrType: '佩戴属性',
  attr: '火属性',
}

describe('BadgeCard', () => {
  it('默认模式点击卡片打开详情', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<BadgeCard badge={badge} onOpen={onOpen} />)

    await user.click(screen.getByRole('button', { name: '查看 篝火 详情' }))

    expect(onOpen).toHaveBeenCalledWith('followers')
  })

  it('选择模式点击卡片切换选中而不是打开详情', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const onToggleSelect = vi.fn()
    const { rerender } = render(
      <BadgeCard
        badge={badge}
        onOpen={onOpen}
        selectMode
        selected={false}
        onToggleSelect={onToggleSelect}
      />,
    )

    const card = screen.getByRole('button', { name: '选择 篝火 详情' })
    await user.click(card)

    expect(onOpen).not.toHaveBeenCalled()
    expect(onToggleSelect).toHaveBeenCalledWith('followers')

    rerender(
      <BadgeCard
        badge={badge}
        onOpen={onOpen}
        selectMode
        selected
        onToggleSelect={onToggleSelect}
      />,
    )

    expect(screen.getByTestId('badge-card')).toHaveAttribute('data-selected', 'true')
    expect(screen.getByTestId('badge-card')).toHaveAttribute('aria-pressed', 'true')
  })

  it('选择模式下键盘 Enter 也能切换选中', async () => {
    const user = userEvent.setup()
    const onToggleSelect = vi.fn()
    render(
      <BadgeCard badge={badge} onOpen={vi.fn()} selectMode onToggleSelect={onToggleSelect} />,
    )

    screen.getByRole('button', { name: '选择 篝火 详情' }).focus()
    await user.keyboard('{Enter}')

    expect(onToggleSelect).toHaveBeenCalledWith('followers')
  })

  it('默认展示小图标，大图标模式展示 exportIcon 并放大', () => {
    const { rerender, container } = render(<BadgeCard badge={badge} onOpen={vi.fn()} />)

    const smallImg = container.querySelector('[data-testid="badge-card"] img')!
    expect(smallImg.getAttribute('src')).toBe(badge.icon)
    expect(smallImg.className).toContain('size-14')

    rerender(<BadgeCard badge={badge} onOpen={vi.fn()} iconMode="large" />)

    const largeImg = container.querySelector('[data-testid="badge-card"] img')!
    expect(largeImg.getAttribute('src')).toBe(badge.exportIcon)
    expect(largeImg.className).toContain('size-20')
  })

  it('earned 时展示已获得标记，默认不展示', () => {
    const { rerender } = render(<BadgeCard badge={badge} onOpen={vi.fn()} />)
    expect(screen.queryByTestId('earned-chip')).not.toBeInTheDocument()

    rerender(<BadgeCard badge={badge} onOpen={vi.fn()} earned />)
    expect(screen.getByTestId('earned-chip')).toBeInTheDocument()
  })
})
