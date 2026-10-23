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

// ===== 帧间隔 =====

/** 间隔下限：过渡效果最少占用 80ms（4 帧 × 20ms），100ms 保证停留帧仍大于 0。 */
export const MIN_DELAY_MS = 100
/** 间隔上限：更慢的轮播更适合逐帧查看，但 GIF 显得停滞。 */
export const MAX_DELAY_MS = 2000
/** GIF 时间精度为百分之一秒，输入统一取整到 10ms。 */
export const DELAY_STEP_MS = 10
/** 默认间隔 400ms，对应“快速”档。 */
export const DEFAULT_DELAY_MS = 400

/** 常用间隔档位（ms）。 */
export const DELAY_OPTIONS = [100, 200, 400, 600, 800, 1200, 2000] as const

// ===== 帧数限制 =====

export const MIN_FRAME_COUNT = 2
export const MAX_FRAME_COUNT = 12

// ===== 切换效果 =====

export const GIF_EFFECTS = ['cut', 'fade', 'zoom', 'slide'] as const
export type GifEffect = (typeof GIF_EFFECTS)[number]

export const EFFECT_LABELS: Record<GifEffect, string> = {
  cut: '直接切换',
  fade: '淡入淡出',
  zoom: '缩放切换',
  slide: '左右滑动',
}

/** 首版默认直接切换，避免突然增加编码耗时。 */
export const DEFAULT_EFFECT: GifEffect = 'cut'

export function isGifEffect(value: unknown): value is GifEffect {
  return typeof value === 'string' && (GIF_EFFECTS as readonly string[]).includes(value)
}

// ===== 图标来源 =====

export type GifIconSource = 'large' | 'small'

export const ICON_SOURCE_LABELS: Record<GifIconSource, string> = {
  large: '高清大图标',
  small: '使用小图标',
}

export const DEFAULT_ICON_SOURCE: GifIconSource = 'large'

export interface GifMakerOptions {
  delayMs: number
  effect: GifEffect
  iconSource: GifIconSource
}

export interface GifMakerProgress {
  /** 已完成编码的徽章数。 */
  done: number
  total: number
  /** 体积超限后的重编码轮次，从 1 开始。 */
  attempt: number
  /** 当前轮次的调色板色数。 */
  maxColors: number
}

/** 用户主动取消时抛出，调用方据此恢复可编辑状态而不是报错。 */
export class GifCancelledError extends Error {
  constructor() {
    super('已取消生成')
    this.name = 'GifCancelledError'
  }
}

// ===== 纯工具函数 =====

/** 限制到 100–2000ms 并取整到 10ms，匹配 GIF 时间精度。 */
export function normalizeDelayMs(value: number): number {
  // NaN 无从钳位，回落默认；±Infinity 交给钳位处理
  if (Number.isNaN(value)) return DEFAULT_DELAY_MS
  const clamped = Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, value))
  return roundToStep(clamped)
}

/** 纯 10ms 取整，不做范围钳位；过渡帧时长可以低于 200ms。 */
function roundToStep(value: number): number {
  return Math.round(value / DELAY_STEP_MS) * DELAY_STEP_MS
}

/** 帧数不满足生成条件时返回原因，否则返回 null。 */
export function validateFrameCount(count: number): string | null {
  if (count < MIN_FRAME_COUNT) {
    return `至少选择 ${MIN_FRAME_COUNT} 枚徽章才能生成轮播`
  }
  if (count > MAX_FRAME_COUNT) {
    return `最多支持 ${MAX_FRAME_COUNT} 帧（当前 ${count} 帧），请先移除部分徽章`
  }
  return null
}

/** 毫秒转“X.X 秒”，用于摘要和预计时长。 */
export function formatSeconds(ms: number): string {
  return `${Number((ms / 1000).toFixed(1))} 秒`
}

/** 预计总时长 = 帧数 × 间隔；过渡时间从间隔内扣除，不额外增加总时长。 */
export function estimateDurationMs(frameCount: number, delayMs: number): number {
  return frameCount * normalizeDelayMs(delayMs)
}

// ===== 切换过渡 =====

export interface TransitionPlan {
  /** 每次过渡的采样帧数；直接切换为 0。 */
  steps: number
  /** 过渡采样帧每帧的停留时长（ms）。 */
  frameMs: number
}

const MAX_TRANSITION_MS = 220
const MIN_TRANSITION_FRAME_MS = 20
const MAX_TRANSITION_STEPS = 8
const MIN_TRANSITION_STEPS = 4

/**
 * 过渡时长取间隔的 25% 且不超过 220ms；间隔不足 800ms 时收紧到间隔的 40% 以内，
 * 避免快速轮播被过渡动画占满。每个过渡采样 4–8 帧。
 */
export function computeTransitionPlan(delayMs: number, effect: GifEffect): TransitionPlan {
  if (effect === 'cut') return { steps: 0, frameMs: 0 }
  const delay = normalizeDelayMs(delayMs)
  const cap = delay < 800 ? delay * 0.4 : MAX_TRANSITION_MS
  const duration = Math.min(delay * 0.25, cap)
  const steps = Math.min(MAX_TRANSITION_STEPS, Math.max(MIN_TRANSITION_STEPS, Math.round(duration / 40)))
  const frameMs = Math.max(MIN_TRANSITION_FRAME_MS, roundToStep(duration / steps))
  return { steps, frameMs }
}

/** 每枚徽章的停留帧时长：间隔扣除过渡占用的部分，保证每枚总展示时间等于间隔。 */
export function computeHoldMs(delayMs: number, effect: GifEffect): number {
  const { steps, frameMs } = computeTransitionPlan(delayMs, effect)
  return normalizeDelayMs(delayMs) - steps * frameMs
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

// ===== 图标加载 =====

const BADGE_ICON_PROXY = '/api/badge-icon'

/** 展示用图标地址：按来源返回大图标（exportIcon）或小图标（icon）。 */
export function iconUrlFor(badge: BadgeRecord, source: GifIconSource): string {
  return source === 'large' ? badge.exportIcon : badge.icon
}

async function fetchIconBlob(
  badge: BadgeRecord,
  source: GifIconSource,
  signal?: AbortSignal,
): Promise<Blob> {
  try {
    const direct = await fetch(iconUrlFor(badge, source), { signal })
    if (direct.ok) return await direct.blob()
  } catch (error) {
    if (signal?.aborted) throw error
    // R2 直连被 CORS 拦截或网络失败时，走同源 worker 代理
  }
  const proxied = await fetch(
    `${BADGE_ICON_PROXY}?id=${encodeURIComponent(badge.id)}&size=${source}`,
    { signal },
  )
  if (!proxied.ok) {
    throw new Error(`徽章「${badge.name}」图标加载失败，请重试或切换图标来源`)
  }
  return proxied.blob()
}

/** 图片缓存上限：同一来源去重复用，超限淘汰最早条目；大小图标按 URL 自然隔离。 */
const MAX_IMAGE_CACHE_ENTRIES = 64
const imageCache = new Map<string, Promise<HTMLImageElement>>()

function cacheImage(url: string, promise: Promise<HTMLImageElement>): void {
  imageCache.set(url, promise)
  while (imageCache.size > MAX_IMAGE_CACHE_ENTRIES) {
    const oldest = imageCache.keys().next().value
    if (oldest === undefined) break
    imageCache.delete(oldest)
  }
}

export function loadBadgeImage(
  badge: BadgeRecord,
  source: GifIconSource,
  signal?: AbortSignal,
): Promise<HTMLImageElement> {
  throwIfAborted(signal)
  const url = iconUrlFor(badge, source)
  const cached = imageCache.get(url)
  if (cached !== undefined) return cached
  const promise = (async () => {
    const blob = await fetchIconBlob(badge, source, signal)
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()
    image.src = objectUrl
    try {
      await image.decode()
      return image
    } finally {
      // decode 完成后位图已在内存，及时释放 Blob URL
      URL.revokeObjectURL(objectUrl)
    }
  })()
  cacheImage(url, promise)
  // 失败不缓存，允许用户重试
  promise.catch(() => {
    if (imageCache.get(url) === promise) imageCache.delete(url)
  })
  return promise
}

// ===== 帧渲染 =====

interface FrameSource {
  image: HTMLImageElement
  layout: FrameLayout
}

function createCanvasContext(size: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (ctx === null) throw new Error('当前环境不支持 Canvas 2D，无法生成 GIF')
  return ctx
}

function drawFrameSource(
  ctx: CanvasRenderingContext2D,
  source: FrameSource,
  scale = 1,
  offsetX = 0,
): void {
  const { layout, image } = source
  if (scale === 1) {
    ctx.drawImage(image, layout.x + offsetX, layout.y, layout.width, layout.height)
    return
  }
  const centerX = layout.x + layout.width / 2 + offsetX
  const centerY = layout.y + layout.height / 2
  const width = layout.width * scale
  const height = layout.height * scale
  ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height)
}

/** 把 from → to 在 progress（0..1）处的中间帧画到已清白底的 ctx 上。 */
export function renderTransition(
  ctx: CanvasRenderingContext2D,
  from: FrameSource,
  to: FrameSource,
  progress: number,
  effect: GifEffect,
  size: number,
): void {
  const t = Math.min(1, Math.max(0, progress))
  switch (effect) {
    case 'cut':
      drawFrameSource(ctx, to)
      break
    case 'fade':
      ctx.globalAlpha = 1 - t
      drawFrameSource(ctx, from)
      ctx.globalAlpha = t
      drawFrameSource(ctx, to)
      ctx.globalAlpha = 1
      break
    case 'zoom':
      // 当前徽章轻微缩小退场，下一枚放大到正常尺寸进场
      ctx.globalAlpha = 1 - t
      drawFrameSource(ctx, from, 1 - 0.25 * t)
      ctx.globalAlpha = t
      drawFrameSource(ctx, to, 0.75 + 0.25 * t)
      ctx.globalAlpha = 1
      break
    case 'slide':
      drawFrameSource(ctx, from, 1, -t * size)
      drawFrameSource(ctx, to, 1, (1 - t) * size)
      break
  }
}

interface FrameSpec {
  kind: 'hold' | 'transition'
  badgeIndex: number
  /** 过渡帧在 from → to 上的进度。 */
  progress: number
  delayMs: number
}

/** 展开每枚徽章的停留帧与过渡帧；最后一枚到第一枚也使用同一过渡，保证循环衔接。 */
export function buildFramePlan(
  frameCount: number,
  options: { delayMs: number; effect: GifEffect },
): FrameSpec[] {
  const delay = normalizeDelayMs(options.delayMs)
  const { steps, frameMs } = computeTransitionPlan(delay, options.effect)
  const holdMs = delay - steps * frameMs
  const plan: FrameSpec[] = []
  for (let badgeIndex = 0; badgeIndex < frameCount; badgeIndex++) {
    plan.push({ kind: 'hold', badgeIndex, progress: 0, delayMs: holdMs })
    for (let step = 1; step <= steps; step++) {
      plan.push({
        kind: 'transition',
        badgeIndex,
        progress: step / steps,
        delayMs: frameMs,
      })
    }
  }
  return plan
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new GifCancelledError()
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function encodeGif(
  specs: FrameSpec[],
  sources: FrameSource[],
  options: GifMakerOptions & { maxColors: number; attempt: number },
  onProgress?: (progress: GifMakerProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const gif = GIFEncoder()
  const ctx = createCanvasContext(GIF_SIZE)
  const total = sources.length
  let done = 0
  for (const [index, spec] of specs.entries()) {
    throwIfAborted(signal)
    const from = sources[spec.badgeIndex]
    ctx.fillStyle = FRAME_BACKGROUND
    ctx.fillRect(0, 0, GIF_SIZE, GIF_SIZE)
    if (spec.kind === 'hold') {
      drawFrameSource(ctx, from)
    } else {
      const to = sources[(spec.badgeIndex + 1) % total]
      renderTransition(ctx, from, to, spec.progress, options.effect, GIF_SIZE)
    }
    const frame = ctx.getImageData(0, 0, GIF_SIZE, GIF_SIZE)
    const palette = quantize(frame.data, options.maxColors)
    const indexed = applyPalette(frame.data, palette)
    gif.writeFrame(indexed, GIF_SIZE, GIF_SIZE, {
      palette,
      delay: spec.delayMs,
    })
    // 一枚徽章的停留帧 + 过渡帧全部写完才算完成一帧
    const next = specs[index + 1]
    if (next === undefined || next.kind === 'hold') {
      done += 1
      onProgress?.({ done, total, attempt: options.attempt, maxColors: options.maxColors })
    }
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
  encodeOnce: (maxColors: number, attempt: number) => Promise<{ result: T; size: number }>,
): Promise<{ result: T; maxColors: number; size: number } | null> {
  for (const [index, maxColors] of ladder.entries()) {
    const attempt = await encodeOnce(maxColors, index + 1)
    if (attempt.size <= MAX_GIF_BYTES) return { maxColors, ...attempt }
  }
  return null
}

/** 将多枚徽章编码为 512x512 无限循环的轮播 GIF，体积保证不超过 10MB。 */
export async function makeGif(
  badges: BadgeRecord[],
  options: GifMakerOptions,
  onProgress?: (progress: GifMakerProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const frameError = validateFrameCount(badges.length)
  if (frameError !== null) throw new Error(frameError)
  try {
    const images = await Promise.all(
      badges.map((badge) => loadBadgeImage(badge, options.iconSource, signal)),
    )
    throwIfAborted(signal)
    const sources: FrameSource[] = images.map((image) => ({
      image,
      layout: computeFrameLayout(image.naturalWidth, image.naturalHeight),
    }))
    const specs = buildFramePlan(badges.length, options)
    const picked = await encodeWithinLimit(COLOR_LADDER, async (maxColors, attempt) => {
      const blob = await encodeGif(
        specs,
        sources,
        { ...options, maxColors, attempt },
        onProgress,
        signal,
      )
      return { result: blob, size: blob.size }
    })
    if (picked === null) {
      throw new Error('生成结果超过 10MB 限制，请减少徽章数量后重试')
    }
    return picked.result
  } catch (error) {
    // 取消引发的 AbortError / GifCancelledError 统一收敛为取消
    if (signal?.aborted) throw new GifCancelledError()
    throw error
  }
}
