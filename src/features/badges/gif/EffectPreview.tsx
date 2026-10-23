import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { BadgeRecord } from '../types'
import { iconUrlFor, type GifEffect, type GifIconSource } from './gifmaker'

interface EffectPreviewProps {
  badges: BadgeRecord[]
  effect: GifEffect
  iconSource: GifIconSource
  className?: string
}

const HOLD_MS = 1000
const TRANSITION_MS = 480

function setStyles(
  from: HTMLImageElement,
  to: HTMLImageElement,
  effect: GifEffect,
  progress: number,
): void {
  const t = Math.min(1, Math.max(0, progress))
  from.style.opacity = '1'
  from.style.transform = 'none'
  to.style.opacity = '0'
  to.style.transform = 'none'
  switch (effect) {
    case 'cut':
      from.style.opacity = t >= 1 ? '0' : '1'
      to.style.opacity = t >= 1 ? '1' : '0'
      break
    case 'fade':
      from.style.opacity = String(1 - t)
      to.style.opacity = String(t)
      break
    case 'zoom':
      from.style.opacity = String(1 - t)
      from.style.transform = `scale(${1 - 0.25 * t})`
      to.style.opacity = String(t)
      to.style.transform = `scale(${0.75 + 0.25 * t})`
      break
    case 'slide':
      from.style.transform = `translateX(${-100 * t}%)`
      to.style.opacity = '1'
      to.style.transform = `translateX(${100 * (1 - t)}%)`
      break
  }
}

/** 切换效果的小型实时预览：在前两枚已选徽章间按所选效果循环切换。 */
export function EffectPreview({ badges, effect, iconSource, className }: EffectPreviewProps) {
  const firstRef = useRef<HTMLImageElement>(null)
  const secondRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (badges.length < 2) return
    const first = firstRef.current
    const second = secondRef.current
    if (first === null || second === null) return
    // jsdom 等环境没有 rAF，直接退化为静态展示
    if (typeof requestAnimationFrame !== 'function') return
    let raf = 0
    let start: number | null = null
    const cycleMs = 2 * (HOLD_MS + TRANSITION_MS)

    const tick = (now: number) => {
      start ??= now
      const pos = (now - start) % cycleMs
      let from = first
      let to = second
      let progress: number
      if (pos < HOLD_MS) {
        progress = 0
      } else if (pos < HOLD_MS + TRANSITION_MS) {
        progress = (pos - HOLD_MS) / TRANSITION_MS
      } else if (pos < 2 * HOLD_MS + TRANSITION_MS) {
        from = second
        to = first
        progress = 0
      } else {
        from = second
        to = first
        progress = (pos - 2 * HOLD_MS - TRANSITION_MS) / TRANSITION_MS
      }
      setStyles(from, to, effect, progress)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [badges, effect])

  return (
    <div
      aria-hidden
      className={cn(
        'relative size-16 shrink-0 overflow-hidden rounded-md border border-border bg-white',
        className,
      )}
    >
      {badges[0] !== undefined && (
        <img
          ref={firstRef}
          src={iconUrlFor(badges[0], iconSource)}
          alt=""
          className="absolute inset-0 size-full object-contain p-1"
        />
      )}
      {badges[1] !== undefined && (
        <img
          ref={secondRef}
          src={iconUrlFor(badges[1], iconSource)}
          alt=""
          className="absolute inset-0 size-full object-contain p-1"
        />
      )}
    </div>
  )
}
