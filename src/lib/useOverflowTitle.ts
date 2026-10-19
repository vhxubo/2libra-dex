import { useEffect, useRef } from 'react'

/**
 * 仅当元素内容真实溢出（被 truncate / line-clamp 截断）时才设置 title，
 * 未溢出时移除，避免完整文本可见时弹出多余的悬浮提示。
 * 元素尺寸或文本变化时自动重新判定。
 * @param title 溢出时展示的完整文本
 */
export function useOverflowTitle<T extends HTMLElement>(title: string) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const overflowed =
        el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
      if (overflowed) {
        el.setAttribute('title', title)
      } else {
        el.removeAttribute('title')
      }
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    // 字体加载完成后文本宽度可能变化，需要重新判定
    void document.fonts?.ready.then(update)

    return () => observer.disconnect()
  }, [title])

  return ref
}
