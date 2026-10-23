import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import type { BadgeRecord } from '../types'

/** GIF 画布边长（px）。 */
export const GIF_SIZE = 512
/** GIF 体积上限（字节），超出后沿色阶降级重编码。 */
export const MAX_GIF_BYTES = 10 * 1024 * 1024
/** 编码超过体积上限时依次尝试的调色板色数。 */
export const COLOR_LADDER = [256, 128, 64] as const
/** 徽章内容在画布中的最大占比，四周留白避免贴边。 */
const CONTENT_SCALE = 0.875
const FRAME_BACKGROUND = '#ffffff'

export interface GifMakerOptions {
  /** 每帧停留时长（ms）。 */
  delayMs: number
}

export interface GifMakerProgress {
  done: number
  total: number
}

export interface FrameLayout {
  x: number
  y: number
  width: number
  height: number
}

/** 计算徽章在 GIF 帧中的绘制区域：按原比例缩放至最大占比后居中。 */
export function computeFrameLayout(
  naturalWidth: number,
  naturalHeight: number,
  canvasSize = GIF_SIZE,
  contentScale = CONTENT_SCALE,
): FrameLayout {
  // 个别浏览器对缺内在尺寸的 SVG 会给出 0，按徽章源文件的实际尺寸兜底
  const sourceWidth = naturalWidth > 0 ? naturalWidth : 256
  const sourceHeight = naturalHeight > 0 ? naturalHeight : 256
  const maxSize = canvasSize * contentScale
  const scale = Math.min(maxSize / sourceWidth, maxSize / sourceHeight)
  const width = Math.round(sourceWidth * scale)
  const height = Math.round(sourceHeight * scale)
  return {
    x: Math.round((canvasSize - width) / 2),
    y: Math.round((canvasSize - height) / 2),
    width,
    height,
  }
}

async function fetchBadgeBlob(badge: BadgeRecord): Promise<Blob> {
  try {
    const direct = await fetch(badge.icon)
    if (direct.ok) return await direct.blob()
  } catch {
    // R2 直连被 CORS 拦截或网络失败时，走同源 worker 代理
  }
  const proxied = await fetch(`/api/badge-icon?id=${encodeURIComponent(badge.id)}`)
  if (!proxied.ok) {
    throw new Error(`徽章「${badge.name}」图标加载失败，请稍后重试`)
  }
  return proxied.blob()
}

const imageCache = new Map<string, Promise<HTMLImageElement>>()

function loadImage(badge: BadgeRecord): Promise<HTMLImageElement> {
  let cached = imageCache.get(badge.icon)
  if (cached === undefined) {
    cached = (async () => {
      const blob = await fetchBadgeBlob(badge)
      const url = URL.createObjectURL(blob)
      const image = new Image()
      image.src = url
      await image.decode()
      return image
    })()
    imageCache.set(badge.icon, cached)
    // 失败不缓存，允许用户重试
    cached.catch(() => imageCache.delete(badge.icon))
  }
  return cached
}

function renderFrame(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = GIF_SIZE
  canvas.height = GIF_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (ctx === null) throw new Error('当前环境不支持 Canvas 2D，无法生成 GIF')
  ctx.fillStyle = FRAME_BACKGROUND
  ctx.fillRect(0, 0, GIF_SIZE, GIF_SIZE)
  const layout = computeFrameLayout(image.naturalWidth, image.naturalHeight)
  ctx.drawImage(image, layout.x, layout.y, layout.width, layout.height)
  return ctx.getImageData(0, 0, GIF_SIZE, GIF_SIZE)
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function encodeGif(
  frames: ImageData[],
  options: GifMakerOptions & { maxColors: number },
  onProgress?: (progress: GifMakerProgress) => void,
): Promise<Blob> {
  const gif = GIFEncoder()
  for (const [index, frame] of frames.entries()) {
    const palette = quantize(frame.data, options.maxColors)
    const indexed = applyPalette(frame.data, palette)
    gif.writeFrame(indexed, GIF_SIZE, GIF_SIZE, {
      palette,
      delay: options.delayMs,
    })
    onProgress?.({ done: index + 1, total: frames.length })
    // 逐帧让出主线程，编码期间保持界面可响应
    await yieldToUi()
  }
  gif.finish()
  // slice() 同时把内部缓冲区复制为独立 ArrayBuffer，满足 BlobPart 的类型约束
  return new Blob([gif.bytes().slice()], { type: 'image/gif' })
}

/** 依次按色阶编码，返回第一个不超过体积上限的结果；全部超限返回 null。 */
export async function encodeWithinLimit<T>(
  ladder: readonly number[],
  encodeOnce: (maxColors: number) => Promise<{ result: T; size: number }>,
): Promise<{ result: T; maxColors: number; size: number } | null> {
  for (const maxColors of ladder) {
    const attempt = await encodeOnce(maxColors)
    if (attempt.size <= MAX_GIF_BYTES) return { maxColors, ...attempt }
  }
  return null
}

/** 将多枚徽章编码为 512x512 无限循环的轮播 GIF，体积保证不超过 10MB。 */
export async function makeGif(
  badges: BadgeRecord[],
  options: GifMakerOptions,
  onProgress?: (progress: GifMakerProgress) => void,
): Promise<Blob> {
  if (badges.length === 0) throw new Error('请先选择徽章')
  const images = await Promise.all(badges.map(loadImage))
  const frames = images.map(renderFrame)
  const picked = await encodeWithinLimit(COLOR_LADDER, async (maxColors) => {
    const blob = await encodeGif(frames, { ...options, maxColors }, onProgress)
    return { result: blob, size: blob.size }
  })
  if (picked === null) {
    throw new Error('生成结果超过 10MB 限制，请减少徽章数量后重试')
  }
  return picked.result
}
