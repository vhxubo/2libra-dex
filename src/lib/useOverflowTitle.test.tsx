import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useOverflowTitle } from './useOverflowTitle'

function Stub({ title }: { title: string }) {
  const ref = useOverflowTitle<HTMLDivElement>(title)
  return (
    <div ref={ref} data-testid="stub">
      文本
    </div>
  )
}

function setMetrics(el: Element, scrollWidth: number, clientWidth: number) {
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true })
}

describe('useOverflowTitle', () => {
  it('文本未溢出时不设置 title', () => {
    render(<Stub title="完整文本" />)
    expect(screen.getByTestId('stub')).not.toHaveAttribute('title')
  })

  it('文本溢出时设置 title，恢复后移除', () => {
    const { rerender } = render(<Stub title="第一次" />)
    const el = screen.getByTestId('stub')

    setMetrics(el, 200, 100)
    // 依赖的 title 文本变化会触发重新判定
    rerender(<Stub title="第二次" />)
    expect(el).toHaveAttribute('title', '第二次')

    setMetrics(el, 100, 100)
    rerender(<Stub title="第三次" />)
    expect(el).not.toHaveAttribute('title')
  })
})
