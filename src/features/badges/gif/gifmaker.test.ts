import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BadgeRecord } from '../types'
import {
  COLOR_LADDER,
  DEFAULT_DELAY_MS,
  DEFAULT_EFFECT,
  DELAY_OPTIONS,
  GifCancelledError,
  MAX_DELAY_MS,
  MIN_DELAY_MS,
  MAX_FRAME_COUNT,
  MIN_FRAME_COUNT,
  buildFramePlan,
  computeFrameLayout,
  computeHoldMs,
  computeTransitionPlan,
  encodeWithinLimit,
  estimateDurationMs,
  formatSeconds,
  GIF_EFFECTS,
  makeGif,
  normalizeDelayMs,
  validateFrameCount,
  type GifEffect,
} from './gifmaker'

describe('帧间隔', () => {
  it('默认间隔为 400ms，档位值正确', () => {
    expect(DEFAULT_DELAY_MS).toBe(400)
    expect([...DELAY_OPTIONS]).toEqual([100, 200, 400, 600, 800, 1200, 2000])
  })

  it('输入被限制在 100–2000ms 并按 10ms 取整', () => {
    expect(normalizeDelayMs(400)).toBe(400)
    expect(normalizeDelayMs(100)).toBe(100)
    expect(normalizeDelayMs(50)).toBe(MIN_DELAY_MS)
    expect(normalizeDelayMs(1)).toBe(MIN_DELAY_MS)
    expect(normalizeDelayMs(5000)).toBe(MAX_DELAY_MS)
    expect(normalizeDelayMs(2001)).toBe(MAX_DELAY_MS)
    expect(normalizeDelayMs(212)).toBe(210)
    expect(normalizeDelayMs(215)).toBe(220)
    expect(normalizeDelayMs(432)).toBe(430)
    expect(normalizeDelayMs(Number.NaN)).toBe(DEFAULT_DELAY_MS)
    expect(normalizeDelayMs(Number.POSITIVE_INFINITY)).toBe(MAX_DELAY_MS)
  })

  it('预计总时长 = 帧数 × 间隔，格式化为 X.X 秒', () => {
    expect(estimateDurationMs(2, 400)).toBe(800)
    expect(estimateDurationMs(8, 400)).toBe(3200)
    expect(estimateDurationMs(12, 400)).toBe(4800)
    expect(formatSeconds(800)).toBe('0.8 秒')
    expect(formatSeconds(3200)).toBe('3.2 秒')
    expect(formatSeconds(4800)).toBe('4.8 秒')
    expect(formatSeconds(2000)).toBe('2 秒')
  })
})

describe('validateFrameCount', () => {
  it('少于 2 帧时阻止并给出原因', () => {
    expect(validateFrameCount(0)).toContain('至少选择 2 枚')
    expect(validateFrameCount(1)).not.toBeNull()
  })

  it('超过 12 帧时阻止并给出原因', () => {
    expect(validateFrameCount(13)).toContain('最多支持 12 帧')
    expect(validateFrameCount(13)).toContain('当前 13 帧')
    expect(validateFrameCount(MIN_FRAME_COUNT)).toBeNull()
    expect(validateFrameCount(MAX_FRAME_COUNT)).toBeNull()
  })
})

describe('computeFrameLayout', () => {
  it('正方形徽章按内容占比缩放并居中', () => {
    expect(computeFrameLayout(256, 256)).toEqual({
      x: 32,
      y: 32,
      width: 448,
      height: 448,
    })
  })

  it('非正方形徽章保持原比例，以较短边为约束', () => {
    expect(computeFrameLayout(200, 100)).toEqual({
      x: 32,
      y: 144,
      width: 448,
      height: 224,
    })
  })

  it('内在尺寸缺失（如无固有尺寸的 SVG）按 256 方图兜底', () => {
    expect(computeFrameLayout(0, 0)).toEqual({ x: 32, y: 32, width: 448, height: 448 })
  })

  it('支持自定义画布边长与内容占比', () => {
    expect(computeFrameLayout(100, 100, 100, 0.5)).toEqual({
      x: 25,
      y: 25,
      width: 50,
      height: 50,
    })
  })
})

describe('computeTransitionPlan', () => {
  it('直接切换不生成过渡帧', () => {
    expect(computeTransitionPlan(400, 'cut')).toEqual({ steps: 0, frameMs: 0 })
    expect(computeHoldMs(400, 'cut')).toBe(400)
  })

  it('过渡时长不超过间隔的 25% 或 220ms，采样 4–8 帧', () => {
    for (const delay of DELAY_OPTIONS) {
      for (const effect of GIF_EFFECTS) {
        const { steps, frameMs } = computeTransitionPlan(delay, effect)
        if (effect === 'cut') continue
        expect(steps).toBeGreaterThanOrEqual(4)
        expect(steps).toBeLessThanOrEqual(8)
        expect(frameMs).toBeGreaterThanOrEqual(20)
        expect(frameMs % 10).toBe(0)
        const transitionMs = steps * frameMs
        expect(transitionMs).toBeLessThanOrEqual(Math.max(220, delay * 0.4 + 20))
      }
    }
  })

  it('间隔不足 800ms 时过渡不超过间隔的 40%', () => {
    const { steps, frameMs } = computeTransitionPlan(400, 'fade')
    expect(steps * frameMs).toBeLessThanOrEqual(400 * 0.4)
  })

  it('每枚徽章总展示时间等于间隔（停留 + 过渡 = 间隔，误差 0）', () => {
    for (const delay of [MIN_DELAY_MS, 210, 400, 600, 800, 1200, 2000, MAX_DELAY_MS]) {
      for (const effect of GIF_EFFECTS) {
        expect(computeHoldMs(delay, effect) + computeTransitionPlan(delay, effect).steps *
          computeTransitionPlan(delay, effect).frameMs).toBe(normalizeDelayMs(delay))
      }
    }
  })
})

describe('buildFramePlan', () => {
  it('直接切换时每枚徽章只有一帧停留帧', () => {
    const plan = buildFramePlan(8, { delayMs: 400, effect: 'cut' })
    expect(plan).toHaveLength(8)
    expect(plan.every((frame) => frame.kind === 'hold' && frame.delayMs === 400)).toBe(true)
  })

  it('带过渡时每枚徽章 = 1 停留帧 + steps 过渡帧，最后一枚过渡回第一枚', () => {
    const plan = buildFramePlan(3, { delayMs: 400, effect: 'fade' })
    const { steps } = computeTransitionPlan(400, 'fade')
    expect(plan).toHaveLength(3 * (1 + steps))
    const last = plan[plan.length - 1]
    expect(last.kind).toBe('transition')
    expect(last.badgeIndex).toBe(2)
    expect(last.progress).toBe(1)
    // 每枚徽章的停留 + 过渡时长之和等于间隔
    for (let badge = 0; badge < 3; badge++) {
      const total = plan
        .filter((frame) => frame.badgeIndex === badge)
        .reduce((sum, frame) => sum + frame.delayMs, 0)
      expect(total).toBe(400)
    }
  })

  it('过渡帧的时长均为 10ms 的整数倍', () => {
    const plan = buildFramePlan(2, { delayMs: 1200, effect: 'slide' })
    for (const frame of plan) {
      expect(frame.delayMs % 10).toBe(0)
    }
  })
})

describe('encodeWithinLimit', () => {
  it('首次编码即符合体积上限时直接采用', async () => {
    const encodeOnce = vi.fn(async () => ({ result: 'gif-256', size: 1024 }))

    const picked = await encodeWithinLimit(COLOR_LADDER, encodeOnce)

    expect(picked).toEqual({ result: 'gif-256', maxColors: 256, size: 1024 })
    expect(encodeOnce).toHaveBeenCalledTimes(1)
    expect(encodeOnce).toHaveBeenCalledWith(256, 1)
  })

  it('超限后沿色阶降级重编码，直到符合上限', async () => {
    const encodeOnce = vi.fn(async (maxColors: number) => ({
      result: `gif-${maxColors}`,
      size: maxColors === 64 ? 1024 : 10 * 1024 * 1024 + 1,
    }))

    const picked = await encodeWithinLimit(COLOR_LADDER, encodeOnce)

    expect(picked?.maxColors).toBe(64)
    expect(encodeOnce).toHaveBeenCalledTimes(3)
    expect(encodeOnce).toHaveBeenLastCalledWith(64, 3)
  })

  it('恰好等于上限也算符合', async () => {
    const encodeOnce = vi.fn(async () => ({ result: 'gif', size: 10 * 1024 * 1024 }))

    expect(await encodeWithinLimit(COLOR_LADDER, encodeOnce)).toEqual({
      result: 'gif',
      maxColors: 256,
      size: 10 * 1024 * 1024,
    })
  })

  it('所有色阶都超限时返回 null', async () => {
    const encodeOnce = vi.fn(async () => ({ result: 'gif', size: 10 * 1024 * 1024 + 1 }))

    expect(await encodeWithinLimit(COLOR_LADDER, encodeOnce)).toBeNull()
    expect(encodeOnce).toHaveBeenCalledTimes(COLOR_LADDER.length)
  })
})

const badge = (id: string): BadgeRecord => ({
  id,
  name: id,
  icon: `https://r2.2libra.com/badge/svg/${id}.svg`,
  exportIcon: `https://r2.2libra.com/badge/${id}.svg`,
  level: 'T0',
  rate: 1,
  condition: '',
  attrType: '佩戴属性',
  attr: '',
})

const defaultOptions = { delayMs: 400, effect: DEFAULT_EFFECT, iconSource: 'large' } as const

describe('makeGif 取消', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('开始前已取消：直接抛 GifCancelledError，不发起请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    controller.abort()

    await expect(
      makeGif([badge('a'), badge('b')], defaultOptions, undefined, controller.signal),
    ).rejects.toThrow(GifCancelledError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('帧数不满足条件时不进入加载流程', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(makeGif([badge('a')], defaultOptions)).rejects.toThrow('至少选择 2 枚')
    await expect(
      makeGif(Array.from({ length: 13 }, (_, i) => badge(`b${i}`)), defaultOptions),
    ).rejects.toThrow('最多支持 12 帧')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('加载中的取消（fetch AbortError）收敛为 GifCancelledError', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new DOMException('Aborted', 'AbortError')))
    const controller = new AbortController()

    const pending = makeGif(
      [badge('a'), badge('b')],
      defaultOptions,
      undefined,
      controller.signal,
    )
    controller.abort()
    await expect(pending).rejects.toThrow(GifCancelledError)
  })
})

describe('效果与图标来源常量', () => {
  it('首版仅提供四种效果，默认直接切换', () => {
    expect([...GIF_EFFECTS]).toEqual(['cut', 'fade', 'zoom', 'slide'])
    expect(DEFAULT_EFFECT).toBe('cut')
  })

  it('常用过渡效果在默认间隔下可辨识（过渡帧数 ≥ 4）', () => {
    for (const effect of ['fade', 'zoom', 'slide'] as GifEffect[]) {
      expect(computeTransitionPlan(DEFAULT_DELAY_MS, effect).steps).toBeGreaterThanOrEqual(4)
    }
  })
})
