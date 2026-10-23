import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  GripVertical,
  BookOpen,
  Upload,
  Link as LinkIcon,
  Info,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { BadgeImage } from '../components/BadgeImage'
import type { BadgeRecord } from '../types'
import { EffectPreview } from './EffectPreview'
import {
  COLOR_LADDER,
  DEFAULT_DELAY_MS,
  DEFAULT_EFFECT,
  DEFAULT_GIF_SIZE,
  DELAY_STEP_MS,
  EFFECT_GROUPS,
  EFFECT_LABELS,
  GIF_SIZE_CAPS,
  GIF_SIZE_INPUT_STEP,
  GifCancelledError,
  ICON_SOURCE_LABELS,
  MAX_DELAY_MS,
  MAX_FRAME_COUNT,
  MAX_GIF_SIZE,
  MAX_GIF_BYTES,
  MAX_SPIN_STEP_DEG,
  MIN_DELAY_MS,
  MIN_GIF_SIZE,
  MIN_SPIN_STEP_DEG,
  SPIN_STEP_DEG_INPUT_STEP,
  computeDefaultSpinStepDeg,
  formatSeconds,
  formatSizeLimit,
  iconUrlFor,
  isGifEffect,
  loadImageUrl,
  makeGif,
  normalizeDelayMs,
  normalizeGifSize,
  normalizeSpinStepDeg,
  validateFrameCount,
  type GifEffect,
  type GifFrameInput,
  type GifIconSource,
  type GifMakerProgress,
} from './gifmaker'

const EFFECT_STORAGE_KEY = 'gif-maker:effect'

function readStoredEffect(): GifEffect {
  try {
    const value = window.localStorage.getItem(EFFECT_STORAGE_KEY)
    return isGifEffect(value) ? value : DEFAULT_EFFECT
  } catch {
    return DEFAULT_EFFECT
  }
}

function writeStoredEffect(effect: GifEffect): void {
  try {
    window.localStorage.setItem(EFFECT_STORAGE_KEY, effect)
  } catch {
    // 隐私模式等场景写入失败时静默降级，仅影响记忆偏好
  }
}

/** 效果在摘要中的展示名：逐帧旋转附带步进角（如「逐帧旋转 +30°」）。 */
function effectSummaryLabel(effect: GifEffect, spinStepDeg: number): string {
  if (effect !== 'spin') return EFFECT_LABELS[effect]
  const step = normalizeSpinStepDeg(spinStepDeg)
  return `${EFFECT_LABELS.spin} ${step >= 0 ? '+' : ''}${step}°`
}

/** 判断拖拽内容是否携带文件：出场顺序的内部拖拽不带 Files 类型，不应触发上传区。 */
function hasFilePayload(dataTransfer: DataTransfer | null): boolean {
  return dataTransfer?.types.includes('Files') ?? false
}

/** 从剪贴板事件提取图片文件：优先 files 列表，Safari 等环境仅把图片暴露在 items 里。 */
function clipboardImageFiles(data: DataTransfer | null): File[] {
  if (data === null) return []
  const fromFiles = Array.from(data.files ?? []).filter((file) => file.type.startsWith('image/'))
  if (fromFiles.length > 0) return fromFiles
  return Array.from(data.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)
}

export interface GifMakerToolProps {
  /** 已选徽章，按页面选择顺序传入。 */
  badges: BadgeRecord[]
  /** 初始图标来源，可通过受控属性与页面选择器同步。 */
  defaultIconSource: GifIconSource
  /** 移除徽章后同步回页面选择状态。 */
  onRemoveBadge: (id: string) => void
  onRequestAddBadges?: (available: number) => void
  onClearBadges?: () => void
  iconSourceOverride?: GifIconSource
  onIconSourceChange?: (source: GifIconSource) => void
}

/** 生成成功时的配置快照，用于展示结果信息与判断预览是否已过期。 */
interface ConfigSnapshot {
  frameCount: number
  frameKey: string
  delayMs: number
  effect: GifEffect
  iconSource: GifIconSource
  spinStepDeg: number
  size: number
  sizeLimitBytes: number
}

type GenerateState =
  | { phase: 'idle' }
  | { phase: 'generating'; progress: GifMakerProgress }
  | { phase: 'success'; url: string; size: number; snapshot: ConfigSnapshot }
  | { phase: 'error'; message: string }
  | { phase: 'cancelled' }

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function GifMakerTool({
  badges,
  defaultIconSource,
  onRemoveBadge,
  onRequestAddBadges,
  onClearBadges,
  iconSourceOverride,
  onIconSourceChange,
}: GifMakerToolProps) {
  // 出场顺序由工具维护，新增帧追加到末尾
  const [extraFrames, setExtraFrames] = useState<GifFrameInput[]>([])
  const localUrlsRef = useRef<string[]>([])
  const [internalIconSource, setInternalIconSource] = useState<GifIconSource>(defaultIconSource)
  const iconSource = iconSourceOverride ?? internalIconSource
  const allFrames = useMemo<GifFrameInput[]>(() => [
    ...badges.map((badge) => ({ id: badge.id, name: badge.name, src: iconUrlFor(badge, iconSource) })),
    ...extraFrames,
  ], [badges, iconSource, extraFrames])
  const [order, setOrder] = useState<string[]>(() => allFrames.map((frame) => frame.id))
  // 间隔以文本态保存，容忍输入过程中的临时值（空串、未敲完的数字），失焦时钳位回写
  const [delayInput, setDelayInput] = useState<string>(String(DEFAULT_DELAY_MS))
  const [effect, setEffect] = useState<GifEffect>(readStoredEffect)
  // 输出边长同样以文本态保存，失焦钳位回写；体积上限只在预设档位中选择
  const [sizeInput, setSizeInput] = useState<string>(String(DEFAULT_GIF_SIZE))
  const [sizeLimitBytes, setSizeLimitBytes] = useState<number>(MAX_GIF_BYTES)
  // 逐帧旋转的步进角：null 表示未手动调整，跟随 360/帧数 的派生默认值
  const [spinStepInput, setSpinStepInput] = useState<string | null>(null)
  const [generation, setGeneration] = useState<GenerateState>({ phase: 'idle' })
  const [imageInputMessage, setImageInputMessage] = useState('')
  /** 外链帧的预检结果：值为失败外链的名称；预检通过或本地帧不进入该表。 */
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({})
  /** 拖拽文件悬停上传区时的高亮反馈。 */
  const [dropActive, setDropActive] = useState(false)
  /** 成功后修改配置时保留旧预览，仅标记过期，避免误下载旧结果。 */
  const [configStale, setStale] = useState(false)
  const frameKey = JSON.stringify(allFrames.map(({ id, src }) => [id, src]))
  const stale = configStale || (generation.phase === 'success' && generation.snapshot.frameKey !== frameKey)
  /** 仅「一键清空」需要二次确认；单帧移除直接生效。 */
  const [pendingClearAll, setPendingClearAll] = useState(false)
  const requestRef = useRef(0)
  const resultUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const dragIndexRef = useRef<number | null>(null)

  const orderedBadges = useMemo(() => {
    const byId = new Map(allFrames.map((frame) => [frame.id, frame]))
    return order
      .map((id) => byId.get(id))
      .filter((frame): frame is GifFrameInput => frame !== undefined)
  }, [allFrames, order])

  // 页面侧移除徽章后同步清掉顺序里的悬空 id；沿用 render 期间对齐外部值的模式
  const badgeIdsKey = allFrames.map((frame) => frame.id).join('\n')
  const [syncedBadgeIds, setSyncedBadgeIds] = useState(badgeIdsKey)
  if (badgeIdsKey !== syncedBadgeIds) {
    setSyncedBadgeIds(badgeIdsKey)
    const idSet = new Set(allFrames.map((frame) => frame.id))
    setOrder((prev) => {
      const retained = prev.filter((id) => idSet.has(id))
      const orderedSet = new Set(retained)
      return [...retained, ...allFrames.map((frame) => frame.id).filter((id) => !orderedSet.has(id))]
    })
  }

  const generating = generation.phase === 'generating'
  const frameError = validateFrameCount(orderedBadges.length)
  const normalizedDelay = normalizeDelayMs(Number(delayInput))
  const normalizedSize = normalizeGifSize(Number(sizeInput))
  // 未手动调整时默认步进角随帧数变化，保证循环累计旋转恰好一整圈
  const spinStepDisplay = spinStepInput ?? String(computeDefaultSpinStepDeg(orderedBadges.length))
  const normalizedSpinStep = normalizeSpinStepDeg(Number(spinStepDisplay))

  // 卸载时取消在途任务并释放预览 URL
  useEffect(() => {
    return () => {
      requestRef.current += 1
      abortRef.current?.abort()
      if (resultUrlRef.current !== null) URL.revokeObjectURL(resultUrlRef.current)
      const urls = localUrlsRef.current
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [])

  const revokeResult = () => {
    if (resultUrlRef.current !== null) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
  }

  // 排序、删除或修改参数不直接执行生成：使在途任务结果失效，成功预览标记过期
  const markConfigChanged = () => {
    requestRef.current += 1
    if (generation.phase === 'success') setStale(true)
  }

  const move = (from: number, to: number) => {
    if (generating) return
    if (to < 0 || to >= order.length || from === to) return
    markConfigChanged()
    setOrder((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const releaseLocalUrl = (src: string) => {
    if (!localUrlsRef.current.includes(src)) return
    URL.revokeObjectURL(src)
    localUrlsRef.current = localUrlsRef.current.filter((url) => url !== src)
  }

  const handleRemove = (id: string) => {
    if (generating) return
    markConfigChanged()
    const frame = extraFrames.find((frame) => frame.id === id)
    if (frame) {
      releaseLocalUrl(frame.src)
      setExtraFrames((prev) => prev.filter((frame) => frame.id !== id))
    }
    else onRemoveBadge(id)
  }

  const confirmClearAll = () => {
    if (generating || !pendingClearAll) return
    markConfigChanged()
    extraFrames.forEach((frame) => releaseLocalUrl(frame.src))
    setExtraFrames([])
    if (onClearBadges) onClearBadges()
    else badges.forEach((badge) => onRemoveBadge(badge.id))
    setOrder([])
    setPendingClearAll(false)
  }

  const addImage = (src: string, name: string) => {
    if (src.startsWith('blob:')) localUrlsRef.current.push(src)
    const frame = { id: `image-${crypto.randomUUID()}`, name, src }
    markConfigChanged()
    setExtraFrames((prev) => [...prev, frame])
    setOrder((prev) => [...prev, frame.id])
    if (/^https?:/i.test(src)) probeLink(frame)
  }

  // 外链帧添加后立即静默预加载：加载成功说明可跨域读取，失败时标红提醒（生成必失败）
  const probeLink = (frame: GifFrameInput) => {
    loadImageUrl(frame.src).then(
      () => {
        setLinkErrors((prev) => {
          if (!(frame.id in prev)) return prev
          const next = { ...prev }
          delete next[frame.id]
          return next
        })
      },
      () => {
        setLinkErrors((prev) => ({ ...prev, [frame.id]: frame.name }))
      },
    )
  }

  // 上传 / 拖拽 / 粘贴共用：过滤图片、按剩余容量截断并追加为帧，返回实际添加数量
  const acceptImageFiles = (files: File[]): number => {
    if (generating || files.length === 0) return 0
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) {
      setImageInputMessage('仅接受图片文件。')
      return 0
    }
    const available = Math.max(0, MAX_FRAME_COUNT - allFrames.length)
    const accepted = images.slice(0, available)
    setImageInputMessage(accepted.length < images.length ? `最多支持 ${MAX_FRAME_COUNT} 帧。` : '')
    for (const file of accepted) {
      addImage(URL.createObjectURL(file), file.name)
    }
    return accepted.length
  }

  // 粘贴监听绑定一次，处理器经 ref 始终取到最新闭包（容量、生成状态随时变化）
  const acceptImageFilesRef = useRef(acceptImageFiles)
  useEffect(() => {
    acceptImageFilesRef.current = acceptImageFiles
  })

  // 全局 Ctrl+V：焦点在页面任意位置（含本工具内输入框）粘贴图片都直接加帧；
  // 剪贴板没有图片时不拦截，保持文本粘贴的默认行为
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const files = clipboardImageFiles(event.clipboardData)
      if (files.length === 0) return
      event.preventDefault()
      acceptImageFilesRef.current(files)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  const reverseOrder = () => {
    if (generating || orderedBadges.length < 2) return
    markConfigChanged()
    setOrder((prev) => [...prev].reverse())
  }

  // 仅在有效间隔变化时使旧结果失效；临时文本编辑（如删空重输）不打扰预览
  const handleDelayChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    if (normalizeDelayMs(Number(next)) !== normalizedDelay) markConfigChanged()
    setDelayInput(next)
  }

  // 失焦时把临时值钳位回写到合法间隔，摘要与生成始终使用 normalizedDelay
  const handleDelayBlur = () => {
    setDelayInput(String(normalizedDelay))
  }

  // 输出边长与间隔同套路：临时编辑不打扰预览，失焦钳位回写
  const handleSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    if (normalizeGifSize(Number(next)) !== normalizedSize) markConfigChanged()
    setSizeInput(next)
  }

  const handleSizeBlur = () => {
    setSizeInput(String(normalizedSize))
  }

  // 步进角与间隔同套路：临时编辑不打扰预览，失焦钳位回写并锁定为手动值
  const handleSpinStepChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    const parsed = Number(next)
    if (Number.isFinite(parsed) && normalizeSpinStepDeg(parsed) !== normalizedSpinStep) {
      markConfigChanged()
    }
    setSpinStepInput(next)
  }

  const handleSpinStepBlur = () => {
    setSpinStepInput(String(normalizedSpinStep))
  }

  const handleGenerate = async () => {
    if (frameError !== null || generating) return
    const snapshot: ConfigSnapshot = {
      frameCount: orderedBadges.length,
      frameKey,
      delayMs: normalizedDelay,
      effect,
      iconSource,
      spinStepDeg: normalizedSpinStep,
      size: normalizedSize,
      sizeLimitBytes,
    }
    revokeResult()
    setStale(false)
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestRef.current
    setGeneration({
      phase: 'generating',
      progress: { done: 0, total: snapshot.frameCount, attempt: 1, maxColors: COLOR_LADDER[0] },
    })
    try {
      const blob = await makeGif(
        orderedBadges.map((frame) => badges.find((badge) => badge.id === frame.id) ?? frame),
        {
          delayMs: normalizedDelay,
          effect,
          iconSource,
          spinStepDeg: normalizedSpinStep,
          size: normalizedSize,
          sizeLimitBytes,
        },
        (progress) => {
          if (requestRef.current === requestId) {
            setGeneration({ phase: 'generating', progress })
          }
        },
        controller.signal,
      )
      // 仅当任务 ID 与当前任务一致时接受结果，防止旧任务覆盖新任务
      if (requestRef.current !== requestId) return
      const url = URL.createObjectURL(blob)
      resultUrlRef.current = url
      setGeneration({ phase: 'success', url, size: blob.size, snapshot })
    } catch (error) {
      if (requestRef.current !== requestId) return
      if (error instanceof GifCancelledError || controller.signal.aborted) {
        setGeneration({ phase: 'cancelled' })
        return
      }
      setGeneration({
        phase: 'error',
        message: error instanceof Error ? error.message : '生成失败，请稍后重试',
      })
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const canGenerate = frameError === null && !generating
  // 预检失败的外链帧按当前出场顺序列出，提示语与列表项保持同一顺序
  const failedLinks = orderedBadges
    .filter((frame) => linkErrors[frame.id] !== undefined)
    .map((frame) => frame.name)
  const summary = `${orderedBadges.length} 帧 · 每帧 ${formatSeconds(normalizedDelay)} · ${effectSummaryLabel(
    effect,
    normalizedSpinStep,
  )} · ${ICON_SOURCE_LABELS[iconSource]} · 总时长约 ${formatSeconds(
    orderedBadges.length * normalizedDelay,
  )} · ${normalizedSize}×${normalizedSize}px · 体积 ≤ ${formatSizeLimit(sizeLimitBytes)}`

  const generateButtonLabel =
    generation.phase === 'error'
      ? '重试'
      : generation.phase === 'success'
        ? '重新生成'
        : '生成 GIF'

  const content = (
    <>
        <Dialog open={pendingClearAll} onOpenChange={(open) => { if (!open) setPendingClearAll(false) }}>
          <DialogContent role="alertdialog" className="w-[calc(100%-2rem)] max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle>确认清空所有帧？</DialogTitle>
              <DialogDescription>
                将移除全部 {orderedBadges.length} 帧，清空后需要重新添加。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" autoFocus onClick={() => setPendingClearAll(false)}>取消</Button>
              <Button variant="destructive" onClick={confirmClearAll}>确认清空</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <header className="px-5 pt-5">
          <h2 className="text-base font-semibold">制作 GIF</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            拖动或用箭头调整出场顺序，生成 {normalizedSize}×{normalizedSize} 无限循环的轮播 GIF。
          </p>
        </header>

        <div className="flex flex-col gap-4 p-5 pt-4">
          <section aria-label="添加图片">
            <h3 className="mb-2 text-sm font-medium">添加图片帧</h3>
            <div className="flex flex-col gap-3">
            {onRequestAddBadges && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium"><BookOpen className="size-4 text-primary" aria-hidden />图鉴徽章</div>
              <Button type="button" size="sm" disabled={generating || allFrames.length >= MAX_FRAME_COUNT} onClick={() => onRequestAddBadges(MAX_FRAME_COUNT - allFrames.length)}>从图鉴添加</Button>
            </div>}
            <div
              aria-label="拖拽或粘贴上传图片区域"
              onDragOver={(event) => {
                if (generating || !hasFilePayload(event.dataTransfer)) return
                event.preventDefault()
                setDropActive(true)
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                setDropActive(false)
              }}
              onDrop={(event) => {
                if (!hasFilePayload(event.dataTransfer)) return
                event.preventDefault()
                setDropActive(false)
                acceptImageFiles(Array.from(event.dataTransfer.files))
              }}
              className={cn(
                'flex flex-col gap-3 rounded-lg border border-dashed bg-muted/30 p-3 transition-colors',
                dropActive ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">自定义图片</p>
                <p className="text-xs text-muted-foreground">拖拽图片到此区域，或在页面任意位置 Ctrl+V 粘贴</p>
              </div>
              <label className={`inline-flex h-8 w-fit items-center gap-2 rounded-md border border-input bg-card px-3 text-xs transition-colors focus-within:ring-2 focus-within:ring-ring ${generating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-accent'}`}>
                <Upload className="size-3.5" aria-hidden />上传本地图片
                <input
                  aria-label="上传本地图片"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={generating}
                  className="sr-only"
                  onChange={(event) => {
                    acceptImageFiles(Array.from(event.target.files ?? []))
                    event.target.value = ''
                  }}
                />
              </label>
              <form className="flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-3" onSubmit={(event) => {
                event.preventDefault()
                const form = event.currentTarget
                const input = form.elements.namedItem('image-url') as HTMLInputElement
                const value = input.value.trim()
                if (allFrames.length >= MAX_FRAME_COUNT) {
                  setImageInputMessage(`最多支持 ${MAX_FRAME_COUNT} 帧。`)
                  return
                }
                if (value) {
                  try {
                    const url = new URL(value)
                    if (url.protocol === 'http:' || url.protocol === 'https:') {
                      addImage(url.href, url.pathname.split('/').pop() || url.hostname)
                      setImageInputMessage('')
                      input.value = ''
                    }
                  } catch { /* 留给输入框校验提示 */ }
                }
              }}>
                <Input name="image-url" type="url" placeholder="粘贴图片链接 (https://…)" aria-label="图片链接" disabled={generating} className="h-8 min-w-0 flex-1 basis-40" />
                <Button type="submit" size="sm" variant="outline" disabled={generating}><LinkIcon aria-hidden />添加链接</Button>
              </form>
            </div>
            </div>
            {imageInputMessage && <p role="alert" className="mt-1.5 text-xs text-destructive">{imageInputMessage}</p>}
            <p className="mt-1.5 text-xs text-muted-foreground">可与本地徽章混合使用；2–{MAX_FRAME_COUNT} 帧，单图不超过 2400 万像素。外链图片需允许浏览器跨域读取。</p>
          </section>
          { <section aria-label="图鉴图标大小">
            <h3 className="mb-2 text-sm font-medium">图鉴图标大小</h3>
            <div
              role="group"
              aria-label="选择图鉴图标大小"
              className="inline-flex flex-wrap items-center rounded-md border border-input bg-card p-0.5"
            >
              {(Object.keys(ICON_SOURCE_LABELS) as GifIconSource[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={iconSource === option}
                  disabled={generating}
                  onClick={() => {
                    if (iconSource !== option) {
                      markConfigChanged()
                      if (onIconSourceChange) onIconSourceChange(option)
                      else setInternalIconSource(option)
                    }
                  }}
                  className={cn(
                    'inline-flex h-8 items-center rounded-[6px] px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
                    iconSource === option
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {ICON_SOURCE_LABELS[option]}
                </button>
              ))}
            </div>
            {iconSource === 'small' && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                文件更小、生成更快，但清晰度取决于小图标尺寸。
              </p>
            )}
          </section>}

          <section aria-label="已选徽章">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">
                出场顺序
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  共 {orderedBadges.length} 帧
                </span>
                    {orderedBadges.length > 0 && (
                  <span className="ml-1 inline-flex items-center gap-1 align-middle">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={generating || orderedBadges.length < 2}
                      onClick={reverseOrder}
                      aria-label="一键倒序出场顺序"
                    >
                      <ArrowDownUp className="size-3.5" aria-hidden />
                      一键倒序
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={generating} onClick={() => setPendingClearAll(true)}>一键清空</Button>
                  </span>
                )}
              </h3>
            </div>
            {orderedBadges.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                尚未添加图片；可从图鉴添加、上传本地图片或粘贴外部图片链接。
              </p>
            ) : (
              <ul
                className="flex max-h-56 flex-wrap content-start gap-2 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2.5"
              >
                {orderedBadges.map((badge, index) => (
                  <li
                    key={badge.id}
                    draggable={!generating}
                    onDragStart={(event) => {
                      if (generating) return
                      dragIndexRef.current = index
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      const from = dragIndexRef.current
                      if (from !== null) move(from, index)
                      dragIndexRef.current = null
                    }}
                    onDragEnd={() => {
                      dragIndexRef.current = null
                    }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border bg-card py-1 pl-2 pr-1 shadow-sm',
                      linkErrors[badge.id] !== undefined ? 'border-destructive/60' : 'border-border',
                    )}
                    title={linkErrors[badge.id] !== undefined ? '外链图片预加载失败，可能不支持跨域读取' : undefined}
                  >
                    <GripVertical
                      className="size-3.5 shrink-0 cursor-grab text-muted-foreground"
                      aria-hidden
                    />
                    <BadgeImage
                      src={badge.src}
                      alt={badge.name}
                      className={iconSource === 'large' ? 'size-8' : 'size-6'}
                    />
                    <span className="max-w-28 truncate text-xs font-medium" title={badge.name}>
                      {badge.name}
                    </span>
                    <span className="flex items-center">
                      <button
                        type="button"
                        aria-label={`${badge.name} 前移`}
                        disabled={generating || index === 0}
                        onClick={() => move(index, index - 1)}
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronLeft className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`${badge.name} 后移`}
                        disabled={generating || index === orderedBadges.length - 1}
                        onClick={() => move(index, index + 1)}
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronRight className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`移除 ${badge.name}`}
                        disabled={generating}
                        onClick={() => handleRemove(badge.id)}
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {failedLinks.length > 0 && (
              <div
                role="alert"
                className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  外链图片预加载失败（可能不支持跨域读取），生成时将无法读取，请移除后改用本地上传：
                  {failedLinks.join('、')}
                </span>
              </div>
            )}
          </section>

          <section aria-label="每帧间隔">
            <h3 className="mb-2 text-sm font-medium">每帧间隔</h3>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                aria-label="每帧间隔毫秒数"
                value={delayInput}
                min={MIN_DELAY_MS}
                max={MAX_DELAY_MS}
                step={DELAY_STEP_MS}
                disabled={generating}
                onChange={handleDelayChange}
                onBlur={handleDelayBlur}
                className="h-8 w-24 rounded-[6px] tabular-nums"
              />
              <span className="text-xs text-muted-foreground">
                毫秒（{MIN_DELAY_MS}–{MAX_DELAY_MS}，步长 {DELAY_STEP_MS}）
              </span>
            </div>
          </section>

          <section aria-label="输出与压缩">
            <h3 className="mb-2 text-sm font-medium">输出与压缩</h3>
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  aria-label="输出边长像素数"
                  value={sizeInput}
                  min={MIN_GIF_SIZE}
                  max={MAX_GIF_SIZE}
                  step={GIF_SIZE_INPUT_STEP}
                  disabled={generating}
                  onChange={handleSizeChange}
                  onBlur={handleSizeBlur}
                  className="h-8 w-24 rounded-[6px] tabular-nums"
                />
                <span className="text-xs text-muted-foreground">
                  像素边长（{MIN_GIF_SIZE}–{MAX_GIF_SIZE}，步长 {GIF_SIZE_INPUT_STEP}）：尺寸越大越清晰，体积与耗时随之增加
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">体积上限</span>
                <div
                  role="group"
                  aria-label="选择体积上限"
                  className="inline-flex flex-wrap items-center rounded-md border border-input bg-card p-0.5"
                >
                  {GIF_SIZE_CAPS.map((cap) => (
                    <button
                      key={cap.label}
                      type="button"
                      aria-pressed={sizeLimitBytes === cap.bytes}
                      disabled={generating}
                      onClick={() => {
                        if (sizeLimitBytes !== cap.bytes) {
                          markConfigChanged()
                          setSizeLimitBytes(cap.bytes)
                        }
                      }}
                      className={cn(
                        'inline-flex h-8 items-center rounded-[6px] px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
                        sizeLimitBytes === cap.bytes
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {cap.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                超出体积上限时自动按 256→128→64→32→16 色逐级压缩重编码；仍超限会提示降低输出尺寸或减少帧数。
              </p>
            </div>
          </section>

          <section aria-label="切换效果">
            <div className="mb-2 flex items-center gap-3">
              <h3 className="text-sm font-medium">切换效果</h3>
              <EffectPreview
                badges={orderedBadges}
                effect={effect}
                spinStepDeg={normalizedSpinStep}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              {EFFECT_GROUPS.map((group) => (
                <div key={group.label} className="flex flex-wrap items-center gap-2">
                  <span className="w-7 shrink-0 text-xs text-muted-foreground">{group.label}</span>
                  <div
                    role="group"
                    aria-label={`${group.label}切换效果`}
                    className="inline-flex flex-wrap items-center rounded-md border border-input bg-card p-0.5"
                  >
                    {group.effects.map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={effect === option}
                        disabled={generating}
                        onClick={() => {
                          if (effect !== option) {
                            markConfigChanged()
                            setEffect(option)
                            writeStoredEffect(option)
                          }
                        }}
                        className={cn(
                          'inline-flex h-8 items-center rounded-[6px] px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
                          effect === option
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {EFFECT_LABELS[option]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {effect === 'spin' && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  aria-label="逐帧旋转步进角度"
                  value={spinStepDisplay}
                  min={MIN_SPIN_STEP_DEG}
                  max={MAX_SPIN_STEP_DEG}
                  step={SPIN_STEP_DEG_INPUT_STEP}
                  disabled={generating}
                  onChange={handleSpinStepChange}
                  onBlur={handleSpinStepBlur}
                  className="h-8 w-24 rounded-[6px] tabular-nums"
                />
                <span className="text-xs text-muted-foreground">
                  度/枚（{MIN_SPIN_STEP_DEG}–{MAX_SPIN_STEP_DEG}）：正数逆时针、负数顺时针；
                  默认 360÷帧数，循环无缝
                </span>
              </div>
            )}
          </section>

          <section aria-label="生成结果">
            {generation.phase === 'generating' && (
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                <span>
                  正在生成第 {generation.progress.done}/{generation.progress.total} 帧…
                  {generation.progress.attempt > 1 && (
                    <span className="ml-1">
                      体积超限，第 {generation.progress.attempt} 次编码（
                      {generation.progress.maxColors} 色）…
                    </span>
                  )}
                </span>
              </div>
            )}
            {generation.phase === 'cancelled' && (
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <Info className="size-4 shrink-0" aria-hidden />
                已取消生成，可调整配置后重新生成。
              </div>
            )}
            {generation.phase === 'error' && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{generation.message}</span>
              </div>
            )}
            {generation.phase === 'success' && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-4">
                {stale ? (
                  <p className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                    <CircleAlert className="size-3.5 shrink-0" aria-hidden />
                    配置已变更，当前预览为旧配置结果，重新生成后可下载。
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CircleCheck className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                    生成完成，可直接下载或调整参数后重新生成。
                  </p>
                )}
                <img
                  src={generation.url}
                  alt="徽章轮播 GIF 预览"
                  width={generation.snapshot.size}
                  height={generation.snapshot.size}
                  className="size-44 rounded-lg bg-white shadow-sm"
                />
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {generation.snapshot.frameCount} 帧 · 每帧{' '}
                    {formatSeconds(generation.snapshot.delayMs)} ·{' '}
                    {effectSummaryLabel(
                      generation.snapshot.effect,
                      generation.snapshot.spinStepDeg,
                    )}{' '}
                    · {ICON_SOURCE_LABELS[generation.snapshot.iconSource]} ·{' '}
                    {generation.snapshot.size}×{generation.snapshot.size}px ·{' '}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatBytes(generation.size)}
                    </span>
                    （上限 {formatSizeLimit(generation.snapshot.sizeLimitBytes)}）
                  </span>
                  <Button asChild size="sm" disabled={stale}>
                    <a href={stale ? undefined : generation.url} download="2libra-badges.gif">
                      <Download aria-hidden />
                      下载 GIF
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col items-stretch gap-2 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {frameError !== null
                  ? `${frameError}。`
                  : `${summary}。生成在本地完成，图片不会上传。`}
              </p>
              {generating ? (
                <Button variant="outline" onClick={handleCancel} className="gap-2 sm:self-auto">
                  <X className="size-4" aria-hidden />
                  取消生成
                </Button>
              ) : (
                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  aria-label={generateButtonLabel}
                  className="gap-2 sm:self-auto"
                >
                  {generation.phase === 'idle' && <Sparkles aria-hidden />}
                  {generateButtonLabel}
                </Button>
              )}
        </div>
      </>
  )
  return <div className="overflow-hidden rounded-xl border border-border bg-card">{content}</div>
}
