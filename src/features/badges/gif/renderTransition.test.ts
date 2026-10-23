import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderTransition, type FrameLayout, type FrameSource, type GifEffect } from './gifmaker'

/**
 * 记录型 Canvas 2D 桩：jsdom 没有 Canvas 实现，通过录制 drawImage/clip/arc 等调用
 * 验证各切换效果在关键进度处的绘制逻辑（端点干净、中点可辨识）。
 */
interface RecordedCall {
  fn: string
  args: unknown[]
}

class RecordingContext {
  calls: RecordedCall[] = []
  canvas: unknown = {}
  globalAlpha = 1
  globalCompositeOperation = 'source-over'
  fillStyle = ''
  strokeStyle = ''
  lineWidth = 1
  imageSmoothingEnabled = true

  private record(fn: string, ...args: unknown[]): void {
    this.calls.push({ fn, args })
  }

  save(): void {
    this.record('save')
  }

  restore(): void {
    this.record('restore')
  }

  beginPath(): void {
    this.record('beginPath')
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.record('rect', x, y, width, height)
  }

  arc(x: number, y: number, radius: number, start: number, end: number): void {
    this.record('arc', x, y, radius, start, end)
  }

  clip(): void {
    this.record('clip')
  }

  stroke(): void {
    this.record('stroke')
  }

  translate(x: number, y: number): void {
    this.record('translate', x, y)
  }

  rotate(angle: number): void {
    this.record('rotate', angle)
  }

  drawImage(image: unknown, ...rest: number[]): void {
    this.record('drawImage', image, ...rest)
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.record('fillRect', x, y, width, height)
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    this.record('clearRect', x, y, width, height)
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    this.record('createLinearGradient', x0, y0, x1, y1)
    return { addColorStop: () => {} } as CanvasGradient
  }
}

const LAYOUT: FrameLayout = { x: 32, y: 32, width: 448, height: 448 }
const from = { image: { tag: 'from' }, layout: LAYOUT } as unknown as FrameSource
const to = { image: { tag: 'to' }, layout: LAYOUT } as unknown as FrameSource
const SIZE = 512

const originalCreateElement = document.createElement.bind(document)
let createElementSpy: ReturnType<typeof vi.spyOn> | undefined

beforeEach(() => {
  // 故障重影与模糊需要离屏画布：桩掉 createElement('canvas') 即可让效果完整执行
  createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName !== 'canvas') return originalCreateElement(tagName)
    const scratchCtx = new RecordingContext()
    const canvas = { width: 0, height: 0, getContext: () => scratchCtx }
    scratchCtx.canvas = canvas
    return canvas as unknown as HTMLCanvasElement
  })
})

afterEach(() => {
  createElementSpy?.mockRestore()
  createElementSpy = undefined
})

function render(effect: GifEffect, progress: number): RecordingContext {
  const ctx = new RecordingContext()
  ctx.canvas = { tag: 'canvas' }
  renderTransition(ctx as unknown as CanvasRenderingContext2D, from, to, progress, effect, SIZE)
  return ctx
}

/** 按顺序列出被绘制的图像来源：from / to / canvas（离屏中转或画布自身）。 */
function drawnImages(ctx: RecordingContext): string[] {
  return ctx.calls
    .filter((call) => call.fn === 'drawImage')
    .map((call) => String((call.args[0] as { tag?: string }).tag))
}

describe('renderTransition 各效果绘制逻辑', () => {
  it('首版四种效果保持原有绘制行为', () => {
    expect(drawnImages(render('cut', 0.5))).toEqual(['to'])
    expect(drawnImages(render('fade', 0.5))).toEqual(['from', 'to'])
    expect(drawnImages(render('zoom', 0.5))).toEqual(['from', 'to'])
    expect(drawnImages(render('slide', 0.5))).toEqual(['from', 'to'])
  })

  it('上下滑动：当前徽章向上移出，下一枚从下方进入', () => {
    const draws = render('slideUp', 0.5).calls.filter((call) => call.fn === 'drawImage')
    expect(draws[0]?.args[2]).toBe(LAYOUT.y - 0.5 * SIZE)
    expect(draws[1]?.args[2]).toBe(LAYOUT.y + 0.5 * SIZE)
  })

  it('圆形擦除：起点不裁剪，终点圆形半径覆盖到画布对角线一半', () => {
    expect(render('circle', 0).calls.some((call) => call.fn === 'clip')).toBe(false)
    const arcs = render('circle', 1).calls.filter((call) => call.fn === 'arc')
    expect(arcs[0]?.args[2]).toBeCloseTo(SIZE / Math.SQRT2)
  })

  it('翻牌：水平宽度按 |cos| 压缩，前半程当前徽章、后半程下一枚', () => {
    const first = render('flip', 0.4).calls.find((call) => call.fn === 'drawImage')
    expect(first?.args[0]).toBe(from.image)
    expect(first?.args[3]).toBeCloseTo(LAYOUT.width * Math.abs(Math.cos(0.4 * Math.PI)))
    expect(drawnImages(render('flip', 0.6))[0]).toBe('to')
  })

  it('像素溶解：切换格子数随进度线性增长，终点全部切换', () => {
    const switchedCells = (progress: number) =>
      render('pixel', progress).calls.filter((call) => call.fn === 'rect').length
    expect(switchedCells(0)).toBe(0)
    expect(switchedCells(0.5)).toBe(72)
    expect(switchedCells(1)).toBe(144)
  })

  it('故障闪烁：中点带噪点，端点干净且中点前后分别显示 from/to', () => {
    expect(
      render('glitch', 0.5).calls.filter((call) => call.fn === 'fillRect').length,
    ).toBeGreaterThan(0)
    expect(render('glitch', 0).calls.filter((call) => call.fn === 'fillRect')).toHaveLength(0)
    expect(render('glitch', 1).calls.filter((call) => call.fn === 'fillRect')).toHaveLength(0)
    expect(drawnImages(render('glitch', 0.4))[0]).toBe('from')
    expect(drawnImages(render('glitch', 0.6))[0]).toBe('to')
  })

  it('弹跳登场：下一枚在中段过冲到超过正常尺寸', () => {
    const toDraw = render('bounce', 0.7).calls
      .filter((call) => call.fn === 'drawImage')
      .find((call) => call.args[0] === to.image)
    expect(toDraw?.args[3]).toBeGreaterThan(LAYOUT.width)
  })

  it('旋转切换：两枚均带旋转绘制，尺寸一减一增', () => {
    const calls = render('rotate', 0.5).calls
    expect(calls.filter((call) => call.fn === 'rotate')).toHaveLength(2)
    const widths = calls
      .filter((call) => call.fn === 'drawImage')
      .map((call) => call.args[3] as number)
    expect(widths[0]).toBeLessThan(LAYOUT.width)
    expect(widths[1]).toBeGreaterThan(LAYOUT.width * 0.5)
  })

  it('闪光揭示：以扫过位置分割 to/from，并叠加横向高光渐变', () => {
    const calls = render('shine', 0.5).calls
    expect(calls.some((call) => call.fn === 'createLinearGradient')).toBe(true)
    const rects = calls.filter((call) => call.fn === 'rect')
    const sweep = 0.5 * (SIZE + SIZE * 0.3) - SIZE * 0.3
    expect(rects[0]?.args[2]).toBeCloseTo(sweep)
    expect(rects[1]?.args[0]).toBeCloseTo(sweep)
  })

  it('波纹扩散：揭示圆之外还绘制渐淡的水纹环', () => {
    const calls = render('ripple', 0.5).calls
    const arcs = calls.filter((call) => call.fn === 'arc')
    const strokes = calls.filter((call) => call.fn === 'stroke')
    // 1 个揭示圆 + 至少 2 圈水纹
    expect(arcs.length).toBeGreaterThanOrEqual(3)
    expect(strokes.length).toBe(arcs.length - 1)
    expect(render('ripple', 0).calls.some((call) => call.fn === 'stroke')).toBe(false)
  })

  it('模糊聚焦：端点直接清晰绘制，中点两枚都经过缩放模糊中转', () => {
    expect(render('blur', 0).calls.filter((call) => call.fn === 'drawImage')).toHaveLength(1)
    expect(render('blur', 1).calls.filter((call) => call.fn === 'drawImage')).toHaveLength(1)
    const mid = render('blur', 0.5).calls.filter((call) => call.fn === 'drawImage')
    expect(mid).toHaveLength(2)
    expect(
      mid.every((call) => (call.args[0] as { getContext?: unknown }).getContext !== undefined),
    ).toBe(true)
  })
})
