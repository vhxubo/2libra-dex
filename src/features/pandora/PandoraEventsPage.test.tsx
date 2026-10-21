import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PANDORA_EVENT_COUNT } from './data'
import PandoraEventsPage from './PandoraEventsPage'

function renderPage(initialEntry = '/pandora') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PandoraEventsPage />
    </MemoryRouter>,
  )
}

function getGroupRows() {
  return screen.getAllByTestId('pandora-group-row')
}

function getEventRows() {
  return screen.queryAllByTestId('pandora-event-row')
}

describe('PandoraEventsPage', () => {
  it('默认按名称合并为 14 组，按组内最高稀有度从高到低排列', () => {
    renderPage()
    expect(screen.getByTestId('result-count').textContent).toContain('14')
    expect(screen.getByTestId('result-count').textContent).toContain(String(PANDORA_EVENT_COUNT))
    const rows = getGroupRows()
    expect(rows).toHaveLength(14)
    // 最新且最高为紫色的「关键输出」组排首位，唯一青铜组「回归起点」排末位
    expect(rows[0].textContent).toContain('关键输出')
    expect(within(rows[0]).getByText('紫色')).toBeInTheDocument()
    expect(rows[rows.length - 1].textContent).toContain('回归起点')
  })

  it('单事件组不提供二级展开，效果直接展示在一级行', () => {
    renderPage()
    // 「动起来！」仅 1 条，行内直接可见效果文本，也没有展开按钮
    expect(screen.queryByRole('button', { name: '展开 动起来！' })).not.toBeInTheDocument()
    const row = getGroupRows().find((element) => element.textContent?.includes('动起来！'))
    if (!row) throw new Error('缺少分组:动起来！')
    expect(row.textContent).toContain('你的GIF头像会直接动起来')

    // 「金币雨」6 条，仍提供展开按钮
    expect(screen.getByRole('button', { name: '展开 金币雨' })).toBeInTheDocument()
  })

  it('默认收起全部二级表格，展开后显示组内事件并可再收起', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(getEventRows()).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: '展开 金币雨' }))
    const eventRows = getEventRows()
    expect(eventRows).toHaveLength(6)
    expect(eventRows[0].textContent).toContain('小小金币雨，获得 62 金币')

    await user.click(screen.getByRole('button', { name: '收起 金币雨' }))
    expect(getEventRows()).toHaveLength(0)
  })

  it('点击行同样可展开二级表格', async () => {
    renderPage()
    const target = getGroupRows().find((row) => row.textContent?.includes('金币雨'))
    if (!target) throw new Error('缺少分组:金币雨')
    fireEvent.click(target)
    expect(getEventRows()).toHaveLength(6)
  })

  it('点击「最高稀有度」表头切换为升序，青铜组在前', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /最高稀有度/ }))
    const rows = getGroupRows()
    expect(rows[0].textContent).toContain('回归起点')
    expect(within(rows[0]).getByText('青铜')).toBeInTheDocument()
  })

  it('点击「tier_code」表头按组内最小 tier_code 升序', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /tier_code/ }))
    expect(getGroupRows()[0].textContent).toContain('缩小灯')
  })

  it('搜索后仅显示匹配分组，单条结果直接展示效果', () => {
    renderPage()
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索事件' }), {
      target: { value: '金币雨 紫色' },
    })

    const rows = getGroupRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('金币雨')
    expect(screen.getByTestId('result-count').textContent).toContain('1')

    // 过滤后组内只剩 1 条，退化为单事件行：无展开按钮，效果直接可见
    expect(screen.queryByRole('button', { name: '展开 金币雨' })).not.toBeInTheDocument()
    expect(getEventRows()).toHaveLength(0)
    expect(rows[0].textContent).toContain('获得 642 金币')
  })

  it('URL 参数恢复搜索与排序视图', () => {
    const search = renderPage('/pandora?q=金币雨')
    expect(getGroupRows()).toHaveLength(1)
    search.unmount()

    renderPage('/pandora?sort=rarity-asc')
    expect(getGroupRows()[0].textContent).toContain('回归起点')
  })

  it('搜索无结果展示空状态，可一键清空恢复', async () => {
    const user = userEvent.setup()
    renderPage()
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索事件' }), {
      target: { value: '绝不存在的词xyz' },
    })

    expect(screen.getByText('没有匹配的事件')).toBeInTheDocument()
    expect(screen.queryAllByTestId('pandora-group-row')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: '清空搜索' }))
    expect(getGroupRows()).toHaveLength(14)
    expect(screen.getByTestId('result-count').textContent).toContain(
      String(PANDORA_EVENT_COUNT),
    )
  })
})
