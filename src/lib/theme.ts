export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

/** 当前已应用到 <html> 的主题（读取 .dark 类，而非存储值）。 */
export function getAppliedTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** 应用主题：切换 .dark 类、同步移动端地址栏颜色并持久化。 */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0b1220' : '#f6f8fc')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // localStorage 不可用（隐私模式等）时仅切换当前会话主题
  }
}

/** 在浅色 / 深色间切换，返回切换后的主题。 */
export function toggleTheme(): Theme {
  const next: Theme = getAppliedTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
