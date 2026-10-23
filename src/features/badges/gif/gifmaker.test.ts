import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BadgeRecord } from '../types'
import {
  COLOR_LADDER,
  DEFAULT_DELAY_MS,
  DEFAULT_EFFECT,
  DEFAULT_SPIN_STEP_DEG,
  DELAY_STEP_MS,
  GifCancelledError,
  MAX_DELAY_MS,
  MAX_SPIN_STEP_DEG,
  MIN_DELAY_MS,
  MIN_SPIN_STEP_DEG,
  MIN_FRAME_COUNT,
  buildFramePlan,
  computeDefaultSpinStepDeg,
  computeFrameLayout,
  computeHoldMs,
  computeSpinRotationRad,
  computeTransitionPlan,
  encodeWithinLimit,
  estimateDurationMs,
  formatSeconds,
  EFFECT_GROUPS,
  EFFECT_LABELS,
  GIF_EFFECTS,
  makeGif,
  normalizeDelayMs,
  normalizeSpinStepDeg,
  validateFrameCount,
} from './gifmaker'

describe('帧间隔', () => {
  it('默认间隔为 200ms，步长 100ms，范围 100–2000ms', () => {
    expect(DEFAULT_DELAY_MS).toBe(200)
    expect(DELAY_STEP_MS).toBe(100)
    expect(MIN_DELAY_MS).toBe(100)
    expect(MAX_DELAY_MS).toBe(2000)
  })

  it('输入被限制在 100–2000ms 并按 100ms 取整', () => {
    expect(normalizeDelayMs(200)).toBe(200)
    expect(normalizeDelayMs(100)).toBe(100)
    expect(normalizeDelayMs(50)).toBe(MIN_DELAY_MS)
    expect(normalizeDelayMs(1)).toBe(MIN_DELAY_MS)
    expect(normalizeDelayMs(5000)).toBe(MAX_DELAY_MS)
    expect(normalizeDelayMs(2001)).toBe(MAX_DELAY_MS)
    expect(normalizeDelayMs(212)).toBe(200)
    expect(normalizeDelayMs(250)).toBe(300)
    expect(normalizeDelayMs(432)).toBe(400)
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

  it('达到 2 帧后不再受最大帧数限制', () => {
    expect(validateFrameCount(MIN_FRAME_COUNT)).toBeNull()
    expect(validateFrameCount(13)).toBeNull()
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
  it('直接切换与逐帧旋转不生成过渡帧，停留帧独占间隔', () => {
    expect(computeTransitionPlan(400, 'cut')).toEqual({ steps: 0, frameMs: 0 })
    expect(computeHoldMs(400, 'cut')).toBe(400)
    expect(computeTransitionPlan(400, 'spin')).toEqual({ steps: 0, frameMs: 0 })
    expect(computeHoldMs(400, 'spin')).toBe(400)
  })

  it('过渡时长不超过间隔的 25% 或 220ms，采样 4–8 帧', () => {
    for (const delay of [100, 200, 400, 600, 800, 1200, 2000]) {
      for (const effect of GIF_EFFECTS) {
        const { steps, frameMs } = computeTransitionPlan(delay, effect)
        if (effect === 'cut' || effect === 'spin') continue
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

const defaultOptions = {
  delayMs: 400,
  effect: DEFAULT_EFFECT,
  iconSource: 'large',
  spinStepDeg: DEFAULT_SPIN_STEP_DEG,
} as const

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

  it('帧数不足时不进入加载流程', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(makeGif([badge('a')], defaultOptions)).rejects.toThrow('至少选择 2 枚')
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

describe('makeGif 外链图片', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('在请求图片前启用匿名 CORS，不允许污染画布的图片进入编码', async () => {
    const requested: { url: string; crossOrigin: string | null }[] = []
    vi.stubGlobal('Image', class {
      crossOrigin: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(url: string) {
        requested.push({ url, crossOrigin: this.crossOrigin })
        queueMicrotask(() => this.onerror?.())
      }
    })
    const frames = ['a', 'b'].map((id) => ({
      id, name: id, src: `https://example.com/${id}.png`,
    }))

    await expect(makeGif(frames, defaultOptions)).rejects.toThrow('本地上传')
    expect(requested).toEqual(frames.slice(0, 1).map((frame) => ({
      url: frame.src, crossOrigin: 'anonymous',
    })))
  })
})

describe('效果与图标来源常量', () => {
  it('提供 14 种效果，默认仍为直接切换', () => {
    expect([...GIF_EFFECTS]).toEqual([
      'cut',
      'fade',
      'zoom',
      'blur',
      'slide',
      'slideUp',
      'circle',
      'flip',
      'pixel',
      'glitch',
      'bounce',
      'rotate',
      'spin',
      'shine',
    ])
    expect(DEFAULT_EFFECT).toBe('cut')
  })

  it('每种效果都有展示名称', () => {
    for (const effect of GIF_EFFECTS) {
      expect(EFFECT_LABELS[effect].length).toBeGreaterThan(0)
    }
  })

  it('效果分组按「基础、方向、趣味」组织，恰好覆盖全部效果一次', () => {
    expect(EFFECT_GROUPS.map((group) => group.label)).toEqual(['基础', '方向', '趣味'])
    const grouped = EFFECT_GROUPS.flatMap((group) => [...group.effects])
    expect(new Set(grouped).size).toBe(grouped.length)
    expect([...grouped].sort()).toEqual([...GIF_EFFECTS].sort())
  })

  it('所有过渡效果在默认间隔下可辨识（过渡帧数 ≥ 4）', () => {
    for (const effect of GIF_EFFECTS) {
      if (effect === 'cut' || effect === 'spin') continue
      expect(computeTransitionPlan(DEFAULT_DELAY_MS, effect).steps).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('逐帧旋转（spin）', () => {
  it('默认步进角按帧数派生：360/帧数四舍五入，帧数非法回落 20°', () => {
    expect(computeDefaultSpinStepDeg(2)).toBe(180)
    expect(computeDefaultSpinStepDeg(3)).toBe(120)
    expect(computeDefaultSpinStepDeg(12)).toBe(30)
    expect(computeDefaultSpinStepDeg(18)).toBe(20)
    // 不整除时四舍五入到最接近的整数度
    expect(computeDefaultSpinStepDeg(7)).toBe(51)
    expect(computeDefaultSpinStepDeg(1)).toBe(DEFAULT_SPIN_STEP_DEG)
    expect(computeDefaultSpinStepDeg(0)).toBe(DEFAULT_SPIN_STEP_DEG)
    expect(computeDefaultSpinStepDeg(2.5)).toBe(DEFAULT_SPIN_STEP_DEG)
  })

  it('兜底步进 20°（与参考文件一致），规范化钳位 ±180 并取整', () => {
    expect(DEFAULT_SPIN_STEP_DEG).toBe(20)
    expect(MIN_SPIN_STEP_DEG).toBe(-180)
    expect(MAX_SPIN_STEP_DEG).toBe(180)
    expect(normalizeSpinStepDeg(Number.NaN)).toBe(DEFAULT_SPIN_STEP_DEG)
    expect(normalizeSpinStepDeg(12.6)).toBe(13)
    expect(normalizeSpinStepDeg(999)).toBe(180)
    expect(normalizeSpinStepDeg(-999)).toBe(-180)
    expect(normalizeSpinStepDeg(180)).toBe(180)
  })

  it('第 index 枚徽章累计旋转 index × 步进角，正数为逆时针（Canvas 取负）', () => {
    expect(computeSpinRotationRad(0, 20)).toBeCloseTo(0)
    // 20° = π/9
    expect(computeSpinRotationRad(1, 20)).toBeCloseTo(-Math.PI / 9)
    expect(computeSpinRotationRad(3, 20)).toBeCloseTo(-Math.PI / 3)
    // 负步进角反向旋转
    expect(computeSpinRotationRad(1, -20)).toBeCloseTo(Math.PI / 9)
    // 步进角先规范化再计算
    expect(computeSpinRotationRad(1, 999)).toBeCloseTo(-Math.PI)
  })

  it('帧计划与直接切换一致：每枚徽章只有一帧停留帧', () => {
    const plan = buildFramePlan(4, { delayMs: 400, effect: 'spin' })
    expect(plan).toHaveLength(4)
    expect(plan.every((frame) => frame.kind === 'hold' && frame.delayMs === 400)).toBe(true)
  })
})


describe('图片输入资源限制', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('超出帧数限制时在加载图片前拒绝', async () => {
    const image = vi.fn()
    vi.stubGlobal('Image', image)
    const frames = Array.from({ length: 61 }, (_, i) => ({ id: String(i), name: String(i), src: '/a.png' }))
    await expect(makeGif(frames, defaultOptions)).rejects.toThrow('最多支持 60 帧')
    expect(image).not.toHaveBeenCalled()
  })

  it('逐张加载，超大图片在画布分配前拒绝', async () => {
    const requested: string[] = []
    vi.stubGlobal('Image', class {
      naturalWidth = 6000
      naturalHeight = 5000
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(url: string) {
        requested.push(url)
        queueMicrotask(() => this.onload?.())
      }
    })
    const frames = ['a', 'b'].map((id) => ({ id, name: id, src: `/${id}.png` }))
    await expect(makeGif(frames, defaultOptions)).rejects.toThrow('2400 万像素')
    expect(requested).toEqual(['/a.png'])
  })
})
