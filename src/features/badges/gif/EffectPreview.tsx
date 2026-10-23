import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { BadgeRecord } from '../types'
import {
  FRAME_BACKGROUND,
  computeFrameLayout,
  drawFrameSource,
  iconUrlFor,
  renderTransition,
  type FrameSource,
  type GifEffect,
  type GifIconSource,
} from './gifmaker'

interface EffectPreviewProps {
  badges: BadgeRecord[]
  effect: GifEffect
  iconSource: GifIconSource
  className?: string
}

const HOLD_MS = 1000
const TRANSITION_MS = 480
/** 预览画布的内部分辨率：2 倍于展示尺寸，保证小方块、波纹等细节清晰。 */
const PREVIEW_SIZE = 128

/** 切换效果的小型实时预览：在前两枚已选徽章间按所选效果循环切换。 */
export function EffectPreview({ badges, effect, iconSource, className }: EffectPreviewProps) {
  const firstRef = useRef<HTMLImageElement>(null)
  const secondRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (badges.length < 2) return
    const first = firstRef.current
    const second = secondRef.current
    const canvas = canvasRef.current
    if (first === null || second === null || canvas === null) return
    // jsdom 等环境没有 rAF，直接退化为静态展示
    if (typeof requestAnimationFrame !== 'function') return
    let raf = 0
    let start: number | null = null
    let disposed = false
    const cycleMs = 2 * (HOLD_MS + TRANSITION_MS)

    const sourceOf = (image: HTMLImageElement): FrameSource | null => {
      if (!image.complete || image.naturalWidth <= 0) return null
      return {
        image,
        layout: computeFrameLayout(image.naturalWidth, image.naturalHeight, PREVIEW_SIZE),
      }
    }

    const tick = (now: number) => {
      start ??= now
      const pos = (now - start) % cycleMs
      let fromImage = first
      let toImage = second
      let progress: number
      if (pos < HOLD_MS) {
        progress = 0
      } else if (pos < HOLD_MS + TRANSITION_MS) {
        progress = (pos - HOLD_MS) / TRANSITION_MS
      } else if (pos < 2 * HOLD_MS + TRANSITION_MS) {
        fromImage = second
        toImage = first
        progress = 0
      } else {
        fromImage = second
        toImage = first
        progress = (pos - 2 * HOLD_MS - TRANSITION_MS) / TRANSITION_MS
      }
      const ctx = canvas.getContext('2d')
      const from = sourceOf(fromImage)
      const to = sourceOf(toImage)
      if (ctx !== null) {
        ctx.fillStyle = FRAME_BACKGROUND
        ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
        if (from !== null && to !== null) {
          if (effect === 'cut') {
            // 直接切换没有过渡帧：停留阶段始终显示当前徽章
            drawFrameSource(ctx, from)
          } else {
            // 复用编码侧的逐帧绘制，保证预览与最终 GIF 的视觉逻辑一致
            renderTransition(ctx, from, to, progress, effect, PREVIEW_SIZE)
          }
        } else if (from !== null) {
          drawFrameSource(ctx, from)
        }
      }
      raf = requestAnimationFrame(tick)
    }

    // 两枚图标都解码完成后再启动循环；图片不加载的环境保持静态展示
    const bothLoaded = () =>
      first.complete &&
      first.naturalWidth > 0 &&
      second.complete &&
      second.naturalWidth > 0

    const tryBegin = () => {
      if (disposed || raf !== 0 || !bothLoaded()) return
      if (canvas.getContext('2d') === null) return
      raf = requestAnimationFrame(tick)
    }

    if (bothLoaded()) {
      tryBegin()
    } else {
      first.addEventListener('load', tryBegin)
      second.addEventListener('load', tryBegin)
    }

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      first.removeEventListener('load', tryBegin)
      second.removeEventListener('load', tryBegin)
    }
  }, [badges, effect])

  return (
    <div
      aria-hidden
      className={cn(
        'relative size-16 shrink-0 overflow-hidden rounded-md border border-border bg-white',
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        width={PREVIEW_SIZE}
        height={PREVIEW_SIZE}
        className="absolute inset-0 size-full"
      />
      {badges[0] !== undefined && (
        <img
          ref={firstRef}
          src={iconUrlFor(badges[0], iconSource)}
          alt=""
          className="absolute size-0 opacity-0"
        />
      )}
      {badges[1] !== undefined && (
        <img
          ref={secondRef}
          src={iconUrlFor(badges[1], iconSource)}
          alt=""
          className="absolute size-0 opacity-0"
        />
      )}
    </div>
  )
}
