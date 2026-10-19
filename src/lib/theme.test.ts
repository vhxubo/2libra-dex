import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, getAppliedTheme, toggleTheme } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    // 模拟 index.html 中的静态 meta
    document.head.innerHTML = '<meta name="theme-color" content="#f6f8fc" />'
  })

  it('默认返回浅色', () => {
    expect(getAppliedTheme()).toBe('light')
  })

  it('applyTheme 切换 .dark 类并持久化选择', () => {
    applyTheme('dark')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getAppliedTheme()).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')

    applyTheme('light')

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('applyTheme 同步 theme-color meta', () => {
    applyTheme('dark')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#0b1220',
    )

    applyTheme('light')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#f6f8fc',
    )
  })

  it('toggleTheme 在两种主题间往返', () => {
    expect(toggleTheme()).toBe('dark')
    expect(getAppliedTheme()).toBe('dark')

    expect(toggleTheme()).toBe('light')
    expect(getAppliedTheme()).toBe('light')
  })

  it('localStorage 不可用时仍切换主题', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })

    expect(() => applyTheme('dark')).not.toThrow()
    expect(getAppliedTheme()).toBe('dark')

    vi.restoreAllMocks()
  })
})
