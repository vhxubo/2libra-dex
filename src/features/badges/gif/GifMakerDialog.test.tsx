import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BadgeRecord } from '../types'
import { GifCancelledError } from './gifmaker'
import { GifMakerDialog, type GifMakerDialogProps } from './GifMakerDialog'

const makeGifMock = vi.fn()
vi.mock('./gifmaker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./gifmaker')>()
  return { ...actual, makeGif: (...args: unknown[]) => makeGifMock(...args) }
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
  options: { delayMs: number; effect: string; iconSource: string; spinStepDeg: number }
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

function renderDialog(props: Partial<GifMakerDialogProps> = {}) {
  const onOpenChange = vi.fn()
  const onRemoveBadge = vi.fn()
  const utils = render(
    <GifMakerDialog
      badges={badges}
      defaultIconSource="large"
      onOpenChange={onOpenChange}
      onRemoveBadge={onRemoveBadge}
      {...props}
    />,
  )
  return { ...utils, onOpenChange, onRemoveBadge }
}

/** 出场顺序与效果预览里当前展示的图标地址。 */
function chipIconSrc(name: string): string | null {
  const dialog = screen.getByRole('dialog')
  return within(dialog).getByAltText(name).getAttribute('src')
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
  window.localStorage.clear()
  URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
  createObjectURLMock.mockClear()
})

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
  vi.clearAllMocks()
})

describe('GifMakerDialog 默认配置与摘要', () => {
  it('默认间隔 200ms、直接切换、高清大图标，并显示预计摘要', () => {
    renderDialog()

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
    renderDialog()
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
    renderDialog()

    await user.click(screen.getByRole('button', { name: '使用小图标' }))
    expect(screen.getByText(/文件更小、生成更快/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(calls[0]?.options.iconSource).toBe('small')
  })

  it('图标来源默认取外部传入值：小图标时出场顺序与效果预览都用小图标', () => {
    renderDialog({ defaultIconSource: 'small' })

    expect(screen.getByRole('button', { name: '使用小图标' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(chipIconSrc('徽章甲')).toContain('/badge/svg/')
    expect(previewIconSrcs().every((src) => src?.includes('/badge/svg/'))).toBe(true)
  })

  it('弹窗内切换图标来源，出场顺序与效果预览同步换源', async () => {
    const user = userEvent.setup()
    renderDialog({ defaultIconSource: 'large' })

    await user.click(screen.getByRole('button', { name: '使用小图标' }))

    expect(chipIconSrc('徽章甲')).toContain('/badge/svg/')
    expect(previewIconSrcs().every((src) => src?.includes('/badge/svg/'))).toBe(true)

    await user.click(screen.getByRole('button', { name: '高清大图标' }))

    expect(chipIconSrc('徽章甲')).toMatch(/\/badge\/[^/]+\.svg$/)
    expect(previewIconSrcs().every((src) => src?.includes('/badge/svg/'))).toBe(false)
  })

  it('切换效果会被记住，下次打开默认使用上次效果', async () => {
    const user = userEvent.setup()
    const { unmount } = renderDialog()
    await user.click(screen.getByRole('button', { name: '淡入淡出' }))
    expect(window.localStorage.getItem('gif-maker:effect')).toBe('fade')
    unmount()

    renderDialog()
    expect(screen.getByRole('button', { name: '淡入淡出' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

describe('GifMakerDialog 逐帧旋转', () => {
  it('选择逐帧旋转后显示角度输入，默认 20°，摘要附带步进角并以配置生成', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderDialog()

    expect(screen.queryByLabelText('逐帧旋转步进角度')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '逐帧旋转' }))
    const input = screen.getByLabelText('逐帧旋转步进角度')
    expect(input).toHaveValue(20)
    expect(screen.getByText(/逐帧旋转 \+20°/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(calls[0]?.options.effect).toBe('spin')
    expect(calls[0]?.options.spinStepDeg).toBe(20)
  })

  it('支持负角度：修改步进角后按新角度生成并记忆偏好', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderDialog()
    await user.click(screen.getByRole('button', { name: '逐帧旋转' }))

    const input = screen.getByLabelText('逐帧旋转步进角度')
    await user.clear(input)
    await user.type(input, '-45')
    await user.tab()
    expect(input).toHaveValue(-45)
    expect(screen.getByText(/逐帧旋转 -45°/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    expect(calls[0]?.options.spinStepDeg).toBe(-45)
    expect(window.localStorage.getItem('gif-maker:spin-step')).toBe('-45')
  })

  it('步进角超界时失焦钳位到 ±180', async () => {
    const user = userEvent.setup()
    renderDialog()
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
    renderDialog()
    await user.click(screen.getByRole('button', { name: '逐帧旋转' }))
    expect(screen.getByLabelText('逐帧旋转步进角度')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '淡入淡出' }))
    expect(screen.queryByLabelText('逐帧旋转步进角度')).not.toBeInTheDocument()
    expect(screen.queryByText(/逐帧旋转 [+-]/)).not.toBeInTheDocument()
  })
})

describe('GifMakerDialog 帧数校验', () => {
  it('少于 2 枚时禁用生成并说明原因', () => {
    renderDialog({ badges: [makeBadge('only')] })

    expect(screen.getByRole('button', { name: '生成 GIF' })).toBeDisabled()
    expect(screen.getByText(/至少选择 2 枚徽章才能生成轮播/)).toBeInTheDocument()
  })

  it('超过 12 枚时禁用生成并说明原因', () => {
    renderDialog({ badges: Array.from({ length: 13 }, (_, i) => makeBadge(`b${i}`)) })

    expect(screen.getByRole('button', { name: '生成 GIF' })).toBeDisabled()
    expect(screen.getByText(/最多支持 12 帧（当前 13 帧）/)).toBeInTheDocument()
  })
})

describe('GifMakerDialog 生成期间锁定与取消', () => {
  it('生成期间排序、删除、间隔、效果和图标来源均禁用，生成按钮变为取消', async () => {
    const user = userEvent.setup()
    setupMakeGif()
    renderDialog()

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
    renderDialog()

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
    renderDialog()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    await act(async () => {
      calls[0]?.onProgress({ done: 2, total: 3, attempt: 2, maxColors: 128 })
    })

    expect(screen.getByText(/正在生成第 2\/3 帧/)).toBeInTheDocument()
    expect(screen.getByText(/第 2 次编码（128 色）/)).toBeInTheDocument()
  })
})

describe('GifMakerDialog 关闭确认', () => {
  it('生成期间关闭需确认：继续生成保持任务，取消并关闭释放任务', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    const { onOpenChange } = renderDialog()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    await user.click(screen.getByRole('button', { name: '关闭弹窗' }))
    expect(onOpenChange).not.toHaveBeenCalled()

    const confirmBox = screen.getByRole('alertdialog', { name: '确认关闭' })
    await user.click(within(confirmBox).getByRole('button', { name: '继续生成' }))
    expect(screen.getByText(/正在生成/)).toBeInTheDocument()
    expect(calls[0]?.signal?.aborted).toBe(false)

    await user.click(screen.getByRole('button', { name: '关闭弹窗' }))
    await user.click(within(screen.getByRole('alertdialog', { name: '确认关闭' })).getByRole('button', { name: '取消并关闭' }))
    expect(calls[0]?.signal?.aborted).toBe(true)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('被丢弃的旧任务完成时不会更新状态，也不会创建下载 URL', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    const { onOpenChange } = renderDialog()

    await user.click(screen.getByRole('button', { name: '生成 GIF' }))
    // 确认取消并关闭会递增请求号但不卸载组件（测试里由调用方决定是否卸载）
    await user.click(screen.getByRole('button', { name: '关闭弹窗' }))
    await user.click(
      within(screen.getByRole('alertdialog', { name: '确认关闭' })).getByRole('button', {
        name: '取消并关闭',
      }),
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)

    await act(async () => {
      calls[0]?.resolve(new Blob(['gif'], { type: 'image/gif' }))
    })
    await waitFor(() => expect(screen.getByText(/正在生成/)).toBeInTheDocument())
    expect(createObjectURLMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: '下载 GIF' })).not.toBeInTheDocument()
  })
})

describe('GifMakerDialog 成功与失败', () => {
  it('成功后保留预览并提供下载；修改配置后旧预览标记过期且不可下载', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderDialog()

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
    renderDialog()

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
      spinStepDeg: 20,
    })
    expect(screen.getByText(/正在生成/)).toBeInTheDocument()
  })

  it('调整顺序后再生成，按新顺序编码', async () => {
    const user = userEvent.setup()
    const calls = setupMakeGif()
    renderDialog()

    await user.click(screen.getByRole('button', { name: '徽章乙 前移' }))
    await user.click(screen.getByRole('button', { name: '生成 GIF' }))

    expect(calls[0]?.badges.map((badge) => badge.id)).toEqual(['b', 'a', 'c'])
  })
})
