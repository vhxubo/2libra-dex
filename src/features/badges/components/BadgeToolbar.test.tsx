import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ATTR_TYPE_OPTIONS } from '../data'
import { BADGE_LEVELS, SORT_OPTIONS } from '../types'
import { BadgeToolbar } from './BadgeToolbar'

import type { ComponentProps } from 'react'

type ToolbarProps = ComponentProps<typeof BadgeToolbar>

function renderToolbar({ q = '' }: { q?: string } = {}) {
  const onQueryChange = vi.fn<ToolbarProps['onQueryChange']>()
  const props: ToolbarProps = {
    q,
    levels: [...BADGE_LEVELS],
    attrType: null,
    earned: 'all',
    earnedAvailable: false,
    ownedCount: 0,
    totalCount: 32,
    sort: SORT_OPTIONS[0].value,
    view: 'card',
    iconMode: 'small',
    levelCounts: Object.fromEntries(
      BADGE_LEVELS.map((level) => [level, 1]),
    ) as ToolbarProps['levelCounts'],
    attrTypeCounts: Object.fromEntries(
      ATTR_TYPE_OPTIONS.map((option) => [option, 1]),
    ) as ToolbarProps['attrTypeCounts'],
    onQueryChange,
    onToggleLevel: vi.fn(),
    onAttrTypeChange: vi.fn(),
    onEarnedChange: vi.fn(),
    onSortChange: vi.fn(),
    onViewChange: vi.fn(),
    onIconModeChange: vi.fn(),
    selectMode: false,
    selectedCount: 0,
    onToggleSelectMode: vi.fn(),
  }
  const { rerender } = render(<BadgeToolbar {...props} />)
  const rerenderWithQ = (nextQ: string) =>
    rerender(<BadgeToolbar {...props} q={nextQ} />)
  return {
    input: screen.getByLabelText('搜索徽章') as HTMLInputElement,
    onQueryChange,
    rerenderWithQ,
  }
}

describe('BadgeToolbar 搜索框输入法适配', () => {
  it('普通输入每次按键都提交查询', async () => {
    const user = userEvent.setup()
    const { input, onQueryChange } = renderToolbar()

    await user.type(input, 'abc')

    expect(onQueryChange.mock.calls.map(([q]) => q)).toEqual(['a', 'ab', 'abc'])
  })

  it('组合输入期间不提交，组合结束后提交最终文字（input 先于 compositionend，Safari 顺序）', () => {
    const { input, onQueryChange } = renderToolbar()

    fireEvent.compositionStart(input)
    fireEvent.input(input, { target: { value: 'ni' } })
    fireEvent.input(input, { target: { value: 'niha' } })
    fireEvent.input(input, { target: { value: '你好' } })

    expect(onQueryChange).not.toHaveBeenCalled()
    expect(input.value).toBe('你好')

    fireEvent.compositionEnd(input)

    expect(onQueryChange).toHaveBeenCalledTimes(1)
    expect(onQueryChange).toHaveBeenCalledWith('你好')
  })

  it('compositionend 先于最终 input 时（Chrome 顺序）只提交一次', () => {
    const { input, onQueryChange } = renderToolbar()

    fireEvent.compositionStart(input)
    fireEvent.input(input, { target: { value: '双拼' } })
    fireEvent.compositionEnd(input)
    // Chrome 在 compositionend 之后补发最终 input 事件
    fireEvent.input(input, { target: { value: '双拼' } })

    expect(onQueryChange).toHaveBeenCalledTimes(1)
    expect(onQueryChange).toHaveBeenCalledWith('双拼')
    expect(input.value).toBe('双拼')
  })

  it('组合结束后可继续普通输入并逐键提交', () => {
    const { input, onQueryChange } = renderToolbar()

    fireEvent.compositionStart(input)
    fireEvent.input(input, { target: { value: '徽章' } })
    fireEvent.compositionEnd(input)
    fireEvent.input(input, { target: { value: '徽章!' } })

    expect(onQueryChange.mock.calls.map(([q]) => q)).toEqual(['徽章', '徽章!'])
  })

  it('外部重置查询时输入框同步清空', () => {
    const { input, rerenderWithQ } = renderToolbar({ q: '金币' })
    expect(input.value).toBe('金币')

    // 模拟父组件清空筛选（如点击筛选 chips）
    rerenderWithQ('')

    expect(input.value).toBe('')
  })
})

describe('BadgeToolbar 获得状态筛选', () => {
  function renderEarnedToolbar(props: Partial<ToolbarProps> = {}) {
    const onEarnedChange = vi.fn<ToolbarProps['onEarnedChange']>()
    render(
      <BadgeToolbar
        q=""
        levels={[]}
        attrType={null}
        earned="all"
        earnedAvailable
        ownedCount={5}
        totalCount={32}
        sort="rate-desc"
        view="card"
        iconMode="small"
        levelCounts={Object.fromEntries(
          BADGE_LEVELS.map((level) => [level, 1]),
        ) as ToolbarProps['levelCounts']}
        attrTypeCounts={Object.fromEntries(
          ATTR_TYPE_OPTIONS.map((option) => [option, 1]),
        ) as ToolbarProps['attrTypeCounts']}
        onQueryChange={vi.fn()}
        onToggleLevel={vi.fn()}
        onAttrTypeChange={vi.fn()}
        onEarnedChange={onEarnedChange}
        onSortChange={vi.fn()}
        onViewChange={vi.fn()}
        onIconModeChange={vi.fn()}
        selectMode={false}
        selectedCount={0}
        onToggleSelectMode={vi.fn()}
        {...props}
      />,
    )
    return { onEarnedChange }
  }

  it('已获得数据可用时展示选项与数量', () => {
    renderEarnedToolbar()
    const group = screen.getByRole('group', { name: '获得状态' })
    expect(within(group).getByRole('button', { name: /全部/ }).textContent).toContain('32')
    expect(within(group).getByRole('button', { name: /已获得/ }).textContent).toContain('5')
    expect(within(group).getByRole('button', { name: /未获得/ }).textContent).toContain('27')
  })

  it('点击选项上报对应筛选值', async () => {
    const user = userEvent.setup()
    const { onEarnedChange } = renderEarnedToolbar({ earned: 'all' })

    await user.click(screen.getByRole('button', { name: /已获得/ }))
    expect(onEarnedChange).toHaveBeenCalledWith('owned')

    await user.click(screen.getByRole('button', { name: /未获得/ }))
    expect(onEarnedChange).toHaveBeenCalledWith('missing')
  })

  it('数据不可用（未登录）时隐藏该筛选组', () => {
    renderEarnedToolbar({ earnedAvailable: false })
    expect(screen.queryByRole('group', { name: '获得状态' })).not.toBeInTheDocument()
  })
})
