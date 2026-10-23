import { describe, expect, it, vi } from 'vitest'
import {
  COLOR_LADDER,
  MAX_GIF_BYTES,
  computeFrameLayout,
  encodeWithinLimit,
} from './gifmaker'

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

describe('encodeWithinLimit', () => {
  it('首次编码即符合体积上限时直接采用', async () => {
    const encodeOnce = vi.fn(async () => ({ result: 'gif-256', size: 1024 }))

    const picked = await encodeWithinLimit(COLOR_LADDER, encodeOnce)

    expect(picked).toEqual({ result: 'gif-256', maxColors: 256, size: 1024 })
    expect(encodeOnce).toHaveBeenCalledTimes(1)
    expect(encodeOnce).toHaveBeenCalledWith(256)
  })

  it('超限后沿色阶降级重编码，直到符合上限', async () => {
    const encodeOnce = vi.fn(async (maxColors: number) => ({
      result: `gif-${maxColors}`,
      size: maxColors === 64 ? 1024 : MAX_GIF_BYTES + 1,
    }))

    const picked = await encodeWithinLimit(COLOR_LADDER, encodeOnce)

    expect(picked?.maxColors).toBe(64)
    expect(encodeOnce).toHaveBeenCalledTimes(3)
  })

  it('恰好等于上限也算符合', async () => {
    const encodeOnce = vi.fn(async () => ({ result: 'gif', size: MAX_GIF_BYTES }))

    expect(await encodeWithinLimit(COLOR_LADDER, encodeOnce)).toEqual({
      result: 'gif',
      maxColors: 256,
      size: MAX_GIF_BYTES,
    })
  })

  it('所有色阶都超限时返回 null', async () => {
    const encodeOnce = vi.fn(async () => ({ result: 'gif', size: MAX_GIF_BYTES + 1 }))

    expect(await encodeWithinLimit(COLOR_LADDER, encodeOnce)).toBeNull()
    expect(encodeOnce).toHaveBeenCalledTimes(COLOR_LADDER.length)
  })
})
