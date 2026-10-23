import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BadgeRecord } from '../types'
import { GifCancelledError } from './gifmaker'
import { GifMakerTool, type GifMakerToolProps } from './GifMakerTool'

const makeGifMock = vi.fn()
const loadImageUrlMock = vi.fn()
vi.mock('./gifmaker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./gifmaker')>()
  return {
    ...actual,
    makeGif: (...args: unknown[]) => makeGifMock(...args),
    loadImageUrl: (...args: unknown[]) => loadImageUrlMock(...args),
  }
})

function makeBadge(id: string, name = id): BadgeRecord {
  return {
    id,
    name,
    icon: `https://r2.2libra.com/badge/svg/${id}.svg`,
    exportIcon: `https://r2.2libra.com/badge/${id}.svg`,
    level: 'T0',
    rate: 1,
    condition: '',
    attrType: '佩戴属性',
    attr: '',
  }
}

const badges = [makeBadge('a', '徽章甲'), makeBadge('b', '徽章乙'), makeBadge('c', '徽章丙')]

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

interface MakeGifCall {
  badges: BadgeRecord[]
  options: {
    delayMs: number
    effect: string
    iconSource: string
    spinStepDeg: number
    size: number
    sizeLimitBytes: number
  }
  onProgress: (progress: unknown) => void
  signal?: AbortSignal
  resolve: (blob: Blob) => void
  reject: (reason?: unknown) => void
}

/** 让 makeGif 可控：每次调用记录参数并返回可手动结算的 Promise，abort 时模拟真实取消。 */
function setupMakeGif(): MakeGifCall[] {
  const calls: MakeGifCall[] = []
  makeGifMock.mockImplementation(
    (badgeList: BadgeRecord[], options: MakeGifCall['options'], onProgress: MakeGifCall['onProgress'], signal?: AbortSignal) => {
      const task = deferred<Blob>()
      const call: MakeGifCall = {
        badges: badgeList,
        options,
        onProgress,
        signal,
        resolve: task.resolve,
        reject: task.reject,
      }
      calls.push(call)
      signal?.addEventListener('abort', () => call.reject(new GifCancelledError()))
      return task.promise
    },
  )
  return calls
}

function renderTool(props: Partial<GifMakerToolProps> = {}) {
  const onRemoveBadge = vi.fn()
  const utils = render(
    <GifMakerTool
      badges={badges}
      defaultIconSource="large"
      onRemoveBadge={onRemoveBadge}
      {...props}
    />,
  )
  return { ...utils, onRemoveBadge }
}

/** 出场顺序与效果预览里当前展示的图标地址。 */
function chipIconSrc(name: string): string | null {
  return screen.getByAltText(name).getAttribute('src')
}

function previewIconSrcs(): (string | null)[] {
  return screen
    .getAllByAltText('')
    .map((img) => img.getAttribute('src'))
}

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
let blobSeq = 0
const createObjectURLMock = vi.fn(() => `blob:gif-${++blobSeq}`)

beforeEach(() => {
  makeGifMock.mockReset()
  // 外链预检默认通过，具体用例按需覆盖为失败
  loadImageUrlMock.mockReset()
  loadImageUrlMock.mockResolvedValue(undefined)
  window.localStorage.clear()
  URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
  createObjectURLMock.mockClear()
  // 计数随用例重置，避免硬编码的 blob:gif-N 因执行顺序变化而漂移
  blobSeq = 0
})

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
  vi.clearAllMocks()
})

describe('GifMakerTool 默认配置与摘要', () => {
  it('默认间隔 200ms、直接切换、高清大图标，并显示预计摘要', () => {
    renderTool()

    expect(screen.getByLabelText('每帧间隔毫秒数')).toHaveValue(200)
    expect(screen.getByRole('button', { name: '直接切换' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '高清大图标' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText(/生成在本地完成/).textContent).toContain(
      '3 帧 · 每帧 0.2 秒 · 直接切换 · 高清大图标 · 总时长约 0.6 秒',
    )
  })

  it('间隔输入低于下限或高于上限时失焦钳位，生成使用钳位后的值', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()
    const delayInput = screen.getByLabelText('每帧间隔毫秒数')

    await user.clear(delayInput)
    await user.type(delayInput, '50')
    await user.tab()
    expect(delayInput).toHaveValue(100)

    await user.clear(delayInput)
    await user.type(delayInput, '5000')
    await user.tab()
    expect(delayInput).toHaveValue(2000)

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(calls[0]?.options.delayMs).toBe(2000)
  })

  it('选择小图标来源后显示提示，并以小图标配置发起生成', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()

    await user.click(screen.getByRole('button', { name: '使用小图标' }))
    expect(screen.getByText(/文件更小、生成更快/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(calls[0]?.options.iconSource).toBe('small')
  })

  it('图标来源默认取外部传入值：小图标时出场顺序与效果预览都用小图标', () => {
    renderTool({ defaultIconSource: 'small' })

    expect(screen.getByRole('button', { name: '使用小图标' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(chipIconSrc('徽章甲')).toContain('/badge/svg/')
    expect(previewIconSrcs().every((src) => src?.includes('/badge/svg/'))).toBe(true)
  })

  it('工具内切换图标来源，出场顺序与效果预览同步换源', async () => {
    const user = userEvent.setup()
    renderTool({ defaultIconSource: 'large' })

    await user.click(screen.getByRole('button', { name: '使用小图标' }))

    expect(chipIconSrc('徽章甲')).toContain('/badge/svg/')
    expect(previewIconSrcs().every((src) => src?.includes('/badge/svg/'))).toBe(true)

    await user.click(screen.getByRole('button', { name: '高清大图标' }))

    expect(chipIconSrc('徽章甲')).toMatch(/\/badge\/[^/]+\.svg$/)
    expect(previewIconSrcs().every((src) => src?.includes('/badge/svg/'))).toBe(false)
  })

  it('切换效果会被记住，下次打开默认使用上次效果', async () => {
    const user = userEvent.setup()
    const { unmount } = renderTool()
    await user.click(screen.getByRole('button', { name: '淡入淡出' }))
    expect(window.localStorage.getItem('gif-maker:effect')).toBe('fade')
    unmount()

    renderTool()
    expect(screen.getByRole('button', { name: '淡入淡出' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

describe('GifMakerTool 输出尺寸与体积上限', () => {
  it('默认边长 512、上限 10MB，摘要与头部说明展示当前配置', () => {
    renderTool()

    expect(screen.getByLabelText('输出边长像素数')).toHaveValue(512)
    expect(screen.getByRole('button', { name: '10 MB' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/生成 512×512 无限循环/)).toBeInTheDocument()
    expect(screen.getByText(/生成在本地完成/).textContent).toContain('512×512px · 体积 ≤ 10 MB')
  })

  it('边长超界失焦钳位到 128–1024，生成使用钳位后的值', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()
    const input = screen.getByLabelText('输出边长像素数')

    await user.clear(input)
    await user.type(input, '40')
    await user.tab()
    expect(input).toHaveValue(128)

    await user.clear(input)
    await user.type(input, '5000')
    await user.tab()
    expect(input).toHaveValue(1024)

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(calls[0]?.options.size).toBe(1024)
  })

  it('选择更小的体积上限后以新上限生成，头部说明跟随边长变化', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()

    await user.click(screen.getByRole('button', { name: '2 MB' }))
    expect(screen.getByRole('button', { name: '2 MB' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '10 MB' })).toHaveAttribute('aria-pressed', 'false')

    const input = screen.getByLabelText('输出边长像素数')
    await user.clear(input)
    await user.type(input, '256')
    await user.tab()
    expect(screen.getByText(/生成 256×256 无限循环/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(calls[0]?.options.size).toBe(256)
    expect(calls[0]?.options.sizeLimitBytes).toBe(2 * 1024 * 1024)
  })

  it('成功后修改边长或体积上限都会使旧预览标记过期', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    await act(async () => {
      calls[0]?.resolve(new Blob(['gif'], { type: 'image/gif' }))
    })
    const firstHref = screen
      .getByRole('link', { name: '下载 GIF' })
      .getAttribute('href')

    const input = screen.getByLabelText('输出边长像素数')
    await user.clear(input)
    await user.type(input, '1024')
    expect(screen.getByText(/配置已变更/)).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '512')
    await user.tab()
    await user.click(screen.getByRole('button', { name: '重新生成' }))
    await act(async () => {
      calls[1]?.resolve(new Blob(['gif'], { type: 'image/gif' }))
    })
    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: '下载 GIF' }).getAttribute('href'),
      ).not.toBe(firstHref)
    })

    await user.click(screen.getByRole('button', { name: '1 MB' }))
    expect(screen.getByText(/配置已变更/)).toBeInTheDocument()
  })

  it('生成期间边长输入与体积上限均禁用', async () => {
    const user = userEvent.setup()
    setupMakeGif()
    renderTool()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(screen.getByLabelText('输出边长像素数')).toBeDisabled()
    expect(screen.getByRole('button', { name: '2 MB' })).toBeDisabled()
  })
})

describe('GifMakerTool 逐帧旋转', () => {
  it('选择逐帧旋转后显示角度输入，默认取 360/帧数，摘要附带步进角并以配置生成', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()

    expect(screen.queryByLabelText('逐帧旋转步进角度')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '逐帧旋转' }))
    const input = screen.getByLabelText('逐帧旋转步进角度')
    // 3 枚徽章：360/3 = 120
    expect(input).toHaveValue(120)
    expect(screen.getByText(/逐帧旋转 \+120°/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(calls[0]?.options.effect).toBe('spin')
    expect(calls[0]?.options.spinStepDeg).toBe(120)
  })

  it('默认步进角随帧数变化（360/帧数），手动调整后不再自动跟随', async () => {
    const user = userEvent.setup()
    const { rerender, onRemoveBadge } = renderTool()
    await user.click(screen.getByRole('button', { name: '逐帧旋转' }))
    expect(screen.getByLabelText('逐帧旋转步进角度')).toHaveValue(120)

    rerender(
      <GifMakerTool
        badges={badges.slice(0, 2)}
        defaultIconSource="large"
        onRemoveBadge={onRemoveBadge}
      />,
    )
    // 2 枚徽章：360/2 = 180
    expect(screen.getByLabelText('逐帧旋转步进角度')).toHaveValue(180)

    const input = screen.getByLabelText('逐帧旋转步进角度')
    await user.clear(input)
    await user.type(input, '90')
    await user.tab()
    expect(input).toHaveValue(90)

    rerender(
      <GifMakerTool
        badges={badges}
        defaultIconSource="large"
        onRemoveBadge={onRemoveBadge}
      />,
    )
    expect(screen.getByLabelText('逐帧旋转步进角度')).toHaveValue(90)
  })

  it('支持负角度：修改步进角后按新角度生成', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()
    await user.click(screen.getByRole('button', { name: '逐帧旋转' }))

    const input = screen.getByLabelText('逐帧旋转步进角度')
    await user.clear(input)
    await user.type(input, '-45')
    await user.tab()
    expect(input).toHaveValue(-45)
    expect(screen.getByText(/逐帧旋转 -45°/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(calls[0]?.options.spinStepDeg).toBe(-45)
  })

  it('步进角超界时失焦钳位到 ±180', async () => {
    const user = userEvent.setup()
    renderTool()
    await user.click(screen.getByRole('button', { name: '逐帧旋转' }))

    const input = screen.getByLabelText('逐帧旋转步进角度')
    await user.clear(input)
    await user.type(input, '999')
    await user.tab()
    expect(input).toHaveValue(180)

    await user.clear(input)
    await user.type(input, '-999')
    await user.tab()
    expect(input).toHaveValue(-180)
  })

  it('切换到其他效果后隐藏角度输入，生成不携带旋转配置变化', async () => {
    const user = userEvent.setup()
    renderTool()
    await user.click(screen.getByRole('button', { name: '逐帧旋转' }))
    expect(screen.getByLabelText('逐帧旋转步进角度')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '淡入淡出' }))
    expect(screen.queryByLabelText('逐帧旋转步进角度')).not.toBeInTheDocument()
    expect(screen.queryByText(/逐帧旋转 [+-]/)).not.toBeInTheDocument()
  })
})

describe('GifMakerTool 帧数校验', () => {
  it('少于 2 枚时禁用生成并说明原因', () => {
    renderTool({ badges: [makeBadge('only')] })

    expect(screen.getByRole('button', { name: '生成 GIF' })).toBeDisabled()
    expect(screen.getByText(/至少选择 2 枚徽章才能生成轮播/)).toBeInTheDocument()
  })

  it('超过 12 枚时仍允许生成', () => {
    renderTool({ badges: Array.from({ length: 13 }, (_, i) => makeBadge(`b${i}`)) })

    expect(screen.getByRole('button', { name: '生成 GIF' })).toBeEnabled()
    expect(screen.queryByText(/最多支持 12 帧/)).not.toBeInTheDocument()
  })

  it('未选择徽章时仍提供图鉴图标大小', () => {
    renderTool({ badges: [] })
    expect(screen.getByRole('region', { name: '图鉴图标大小' })).toBeInTheDocument()
  })
})

describe('GifMakerTool 生成期间锁定与取消', () => {
  it('生成期间排序、删除、间隔、效果和图标来源均禁用，生成按钮变为取消', async () => {
    const user = userEvent.setup()
    setupMakeGif()
    renderTool()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(screen.getByText(/正在生成第 0\/3 帧/)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: '徽章乙 前移' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '徽章乙 后移' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '移除 徽章乙' })).toBeDisabled()
    expect(screen.getByLabelText('每帧间隔毫秒数')).toBeDisabled()
    expect(screen.getByRole('button', { name: '淡入淡出' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '使用小图标' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '生成 GIF' })).not.toBeInTheDocument()

    const cancel = screen.getByRole('button', { name: '取消生成' })
    expect(cancel).toBeEnabled()
  })

  it('取消后停止任务、恢复可编辑状态，且不创建下载 URL', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    await user.click(screen.getByRole('button', { name: '取消生成' }))

    expect(calls[0]?.signal?.aborted).toBe(true)
    await waitFor(() => expect(screen.getByText(/已取消生成/)).toBeInTheDocument())
    expect(createObjectURLMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '徽章乙 前移' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '生成 GIF' })).toBeEnabled()
  })

  it('进度显示重编码轮次，例如“第 2 次编码（128 色）”', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    await act(async () => {
      calls[0]?.onProgress({ done: 2, total: 3, attempt: 2, maxColors: 128 })
    })

    expect(screen.getByText(/正在生成第 2\/3 帧/)).toBeInTheDocument()
    expect(screen.getByText(/第 2 次编码（128 色）/)).toBeInTheDocument()
  })
})

describe('GifMakerTool 成功与失败', () => {
  it('成功后保留预览并提供下载；修改配置后旧预览标记过期且不可下载', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    await act(async () => {
      calls[0]?.resolve(new Blob(['gif'], { type: 'image/gif' }))
    })
    await waitFor(() =>
      expect(screen.getByRole('link', { name: '下载 GIF' })).toHaveAttribute(
        'href',
        'blob:gif-1',
      ),
    )
    expect(screen.getByAltText('徽章轮播 GIF 预览')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新生成' })).toBeEnabled()

    const delayInput = screen.getByLabelText('每帧间隔毫秒数')
    await user.clear(delayInput)
    await user.type(delayInput, '600')
    expect(screen.getByText(/配置已变更/)).toBeInTheDocument()
    // 失效后下载入口保留但不再是可导航链接（无 href，不暴露 link 语义）
    expect(screen.queryByRole('link', { name: '下载 GIF' })).not.toBeInTheDocument()
    const download = screen.getByText('下载 GIF').closest('a')
    expect(download).not.toBeNull()
    expect(download).not.toHaveAttribute('href')
  })

  it('失败后保留原配置并提供重试，重试沿用相同配置', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    await act(async () => {
      calls[0]?.reject(new Error('徽章「徽章甲」图标加载失败，请重试或切换图标来源'))
    })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('徽章「徽章甲」图标加载失败')

    // 配置保持不变：间隔仍是 200ms、效果仍是直接切换
    expect(screen.getByLabelText('每帧间隔毫秒数')).toHaveValue(200)
    expect(screen.getByRole('button', { name: '直接切换' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(makeGifMock).toHaveBeenCalledTimes(2)
    expect(calls[1]?.options).toEqual({
      delayMs: 200,
      effect: 'cut',
      iconSource: 'large',
      spinStepDeg: 120,
      size: 512,
      sizeLimitBytes: 10 * 1024 * 1024,
    })
    expect(screen.getByText(/正在生成/)).toBeInTheDocument()
  })

  it('调整顺序后再生成，按新顺序编码', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()

    await user.click(screen.getByRole('button', { name: '徽章乙 前移' }))
    await user.click(screen.getByRole('button', { name: '生成 GIF' }))

    expect(calls[0]?.badges.map((badge) => badge.id)).toEqual(['b', 'a', 'c'])
  })
})


describe('帧变更与资源释放', () => {
  it('外部追加徽章后旧结果不能下载', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    const { rerender, onRemoveBadge } = renderTool({ badges: badges.slice(0, 2) })
    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    await act(async () => calls[0]?.resolve(new Blob(['gif'])))
    expect(screen.getByRole('link', { name: '下载 GIF' })).toHaveAttribute('href')
    rerender(<GifMakerTool badges={badges} defaultIconSource="large" onRemoveBadge={onRemoveBadge} />)
    expect(screen.getByText(/配置已变更/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '下载 GIF' })).not.toBeInTheDocument()
  })

  it('移除和清空本地帧立即释放 URL，卸载不重复释放', async () => {
    const user = userEvent.setup()
    const { unmount } = renderTool({ badges: [] })
    const input = screen.getByLabelText('上传本地图片')
    await user.upload(input, [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })])
    const urls = createObjectURLMock.mock.results.map((result) => result.value)
    // 单帧移除直接生效，无确认弹窗
    await user.click(screen.getByRole('button', { name: '移除 a.png' }))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(urls[0])
    await user.click(screen.getByRole('button', { name: '一键清空' }))
    await user.click(screen.getByRole('button', { name: '确认清空' }))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(urls[1])
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })
})

describe('拖拽与粘贴添加图片', () => {
  it('拖拽图片文件到上传区直接加帧，非文件拖拽不触发', () => {
    renderTool({ badges: [] })
    const zone = screen.getByLabelText('拖拽或粘贴上传图片区域')
    const file = new File(['x'], 'dropped.png', { type: 'image/png' })
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file] } })
    expect(screen.getByRole('button', { name: '移除 dropped.png' })).toBeInTheDocument()

    // 出场顺序的内部拖拽不带 Files 类型，不应被当作文件上传
    fireEvent.drop(zone, { dataTransfer: { types: [], files: [] } })
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
  })

  it('全局 Ctrl+V 粘贴图片直接加帧并拦截默认行为，纯文本粘贴不受影响', () => {
    renderTool({ badges: [] })
    const file = new File(['x'], 'pasted.png', { type: 'image/png' })
    expect(fireEvent.paste(window, { clipboardData: { files: [file] } })).toBe(false)
    expect(screen.getByRole('button', { name: '移除 pasted.png' })).toBeInTheDocument()

    // 剪贴板没有图片时不 preventDefault，保持文本粘贴的默认行为
    expect(fireEvent.paste(window, { clipboardData: { files: [] } })).toBe(true)
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
  })

  it('剪贴板仅在 items 中暴露图片时（如 Safari）也能粘贴', () => {
    renderTool({ badges: [] })
    const file = new File(['x'], 'safari.png', { type: 'image/png' })
    const items = [
      { kind: 'file', type: 'image/png', getAsFile: () => file },
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
    ]
    fireEvent.paste(window, { clipboardData: { files: [], items } })
    expect(screen.getByRole('button', { name: '移除 safari.png' })).toBeInTheDocument()
  })

  it('生成期间拖拽与粘贴均被忽略', async () => {
    const user = userEvent.setup()
    setupMakeGif()
    renderTool()
    await user.click(screen.getByRole('button', { name: '生成 GIF' }))

    const file = new File(['x'], 'locked.png', { type: 'image/png' })
    fireEvent.paste(window, { clipboardData: { files: [file] } })
    fireEvent.drop(screen.getByLabelText('拖拽或粘贴上传图片区域'), {
      dataTransfer: { types: ['Files'], files: [file] },
    })
    expect(screen.queryByRole('button', { name: '移除 locked.png' })).not.toBeInTheDocument()
  })
})

describe('外链图片预检', () => {
  it('添加外链后立即静默预加载，失败时显示红色警告', async () => {
    const user = userEvent.setup()
    loadImageUrlMock.mockRejectedValueOnce(new Error('load failed'))
    renderTool({ badges: [] })

    await user.type(screen.getByLabelText('图片链接'), 'https://example.com/x.png')
    await user.click(screen.getByRole('button', { name: '添加链接' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('外链图片预加载失败')
    expect(alert.textContent).toContain('x.png')
    expect(loadImageUrlMock).toHaveBeenCalledWith('https://example.com/x.png')
  })

  it('预检通过时不出现警告', async () => {
    const user = userEvent.setup()
    renderTool({ badges: [] })

    await user.type(screen.getByLabelText('图片链接'), 'https://example.com/ok.png')
    await user.click(screen.getByRole('button', { name: '添加链接' }))

    expect(await screen.findByRole('button', { name: '移除 ok.png' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('移除预检失败的外链帧后警告随之消失', async () => {
    const user = userEvent.setup()
    loadImageUrlMock.mockRejectedValueOnce(new Error('load failed'))
    renderTool({ badges: [] })

    await user.type(screen.getByLabelText('图片链接'), 'https://example.com/bad.png')
    await user.click(screen.getByRole('button', { name: '添加链接' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '移除 bad.png' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('本地上传的 blob 帧不做外链预检', async () => {
    const user = userEvent.setup()
    renderTool({ badges: [] })
    await user.upload(screen.getByLabelText('上传本地图片'), [new File(['a'], 'local.png', { type: 'image/png' })])
    expect(loadImageUrlMock).not.toHaveBeenCalled()
  })
})

describe('一键倒序', () => {
  it('倒序出场顺序并按新顺序生成', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderTool()

    await user.click(screen.getByRole('button', { name: '一键倒序出场顺序' }))
    await user.click(screen.getByRole('button', { name: '生成 GIF' }))

    expect(calls[0]?.badges.map((badge) => badge.id)).toEqual(['c', 'b', 'a'])
  })

  it('少于 2 帧或生成期间禁用', async () => {
    const user = userEvent.setup()
    setupMakeGif()
    const { unmount } = renderTool({ badges: [makeBadge('only')] })
    expect(screen.getByRole('button', { name: '一键倒序出场顺序' })).toBeDisabled()
    unmount()

    renderTool()
    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(screen.getByRole('button', { name: '一键倒序出场顺序' })).toBeDisabled()
  })
})
