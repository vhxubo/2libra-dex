import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import GifMakerPage from './GifMakerPage'

vi.mock('../data', () => ({ BADGES: [
  { id: 'alpha-01', name: '徽章甲', icon: '/a-small.svg', exportIcon: '/a-large.svg' },
  { id: 'beta-02', name: '徽章乙', icon: '/b.svg', exportIcon: '/b.svg' },
] }))

function renderPage() {
  return render(<MemoryRouter><GifMakerPage /></MemoryRouter>)
}

describe('GIF 制作页图鉴添加与删除', () => {
  it('沿用图鉴列表的小图标设置，选择弹窗和生成页双向同步切换', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={[{ pathname: '/gif-maker', state: { badgeIds: ['alpha-01'], iconMode: 'small' } }]}><GifMakerPage /></MemoryRouter>)
    const source = screen.getByRole('group', { name: '选择图鉴图标大小' })
    expect(within(source).getByRole('button', { name: '使用小图标' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByAltText('徽章甲')).toHaveAttribute('src', '/a-small.svg')
    await user.click(screen.getByRole('button', { name: '从图鉴添加' }))
    const pickerSource = screen.getByRole('group', { name: '图鉴徽章图标大小' })
    expect(within(pickerSource).getByRole('button', { name: '使用小图标' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(pickerSource).getByRole('button', { name: '高清大图标' }))
    expect(within(screen.getByRole('button', { name: /徽章甲\s*已加入/ })).getByAltText('')).toHaveAttribute('src', '/a-large.svg')
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.getByAltText('徽章甲')).toHaveAttribute('src', '/a-large.svg')
    expect(within(source).getByRole('button', { name: '高清大图标' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(source).getByRole('button', { name: '使用小图标' }))
    await user.click(screen.getByRole('button', { name: '从图鉴添加' }))
    expect(within(screen.getByRole('group', { name: '图鉴徽章图标大小' })).getByRole('button', { name: '使用小图标' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('未添加徽章时生成页也提供图标大小选择', () => {
    renderPage()
    expect(screen.getByRole('group', { name: '选择图鉴图标大小' })).toBeInTheDocument()
  })

  it('统一入口支持名称和 ID 搜索，跨搜索保留选择，阻止重复添加并重置搜索', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.getAllByRole('button', { name: '从图鉴添加' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '从图鉴添加' }))
    const search = screen.getByRole('textbox', { name: '搜索图鉴徽章' })
    await user.type(search, '徽章甲')
    await user.click(screen.getByRole('button', { name: '徽章甲' }))
    await user.clear(search)
    await user.type(search, 'BETA-02')
    await user.click(screen.getByRole('button', { name: '徽章乙' }))
    await user.click(screen.getByRole('button', { name: '添加 2 枚' }))
    expect(screen.getByRole('button', { name: '移除 徽章甲' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '移除 徽章乙' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '从图鉴添加' }))
    expect(screen.getByRole('textbox', { name: '搜索图鉴徽章' })).toHaveValue('')
    expect(screen.getByRole('button', { name: /徽章甲\s*已加入/ })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: '搜索图鉴徽章' }), '无匹配')
    expect(screen.getByText('没有匹配的徽章')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '清空搜索' }))
    expect(screen.getByRole('button', { name: /徽章乙\s*已加入/ })).toBeDisabled()
  })

  it('单帧移除和全部清空仅在确认后生效，取消保留原帧', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByRole('textbox', { name: '图片链接' }), 'https://example.com/test.png')
    await user.click(screen.getByRole('button', { name: '添加链接' }))
    await user.click(screen.getByRole('button', { name: '移除 test.png' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '取消' }))
    expect(screen.getByRole('button', { name: '移除 test.png' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '移除 test.png' }))
    await user.click(screen.getByRole('button', { name: '确认移除' }))
    expect(screen.queryByRole('button', { name: '移除 test.png' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '从图鉴添加' }))
    await user.click(screen.getByRole('button', { name: '徽章甲' }))
    await user.click(screen.getByRole('button', { name: '添加 1 枚' }))
    await user.click(screen.getByRole('button', { name: '一键清空' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '取消' }))
    expect(screen.getByRole('button', { name: '移除 徽章甲' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '一键清空' }))
    await user.click(screen.getByRole('button', { name: '确认清空' }))
    expect(screen.queryByRole('button', { name: '移除 徽章甲' })).not.toBeInTheDocument()
  })
})
