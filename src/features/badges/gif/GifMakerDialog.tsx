import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  GripVertical,
  Info,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { BadgeImage } from '../components/BadgeImage'
import type { BadgeRecord } from '../types'
import { EffectPreview } from './EffectPreview'
import {
  COLOR_LADDER,
  DEFAULT_DELAY_MS,
  DEFAULT_EFFECT,
  DELAY_OPTIONS,
  EFFECT_GROUPS,
  EFFECT_LABELS,
  GifCancelledError,
  ICON_SOURCE_LABELS,
  formatSeconds,
  iconUrlFor,
  isGifEffect,
  makeGif,
  normalizeDelayMs,
  validateFrameCount,
  type GifEffect,
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

export interface GifMakerDialogProps {
  /** 已选徽章，按页面选择顺序传入。 */
  badges: BadgeRecord[]
  /** 初始图标来源，与页面卡片图标开关联动；弹窗内切换只影响弹窗内的预览与生成。 */
  defaultIconSource: GifIconSource
  onOpenChange: (open: boolean) => void
  /** 移除徽章后同步回页面选择状态。 */
  onRemoveBadge: (id: string) => void
}

/** 生成成功时的配置快照，用于展示结果信息与判断预览是否已过期。 */
interface ConfigSnapshot {
  frameCount: number
  delayMs: number
  effect: GifEffect
  iconSource: GifIconSource
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

export function GifMakerDialog({
  badges,
  defaultIconSource,
  onOpenChange,
  onRemoveBadge,
}: GifMakerDialogProps) {
  // 出场顺序为弹窗内本地状态，每次打开随挂载重建
  const [order, setOrder] = useState<string[]>(() => badges.map((badge) => badge.id))
  const [delayMs, setDelayMs] = useState<number>(DEFAULT_DELAY_MS)
  const [effect, setEffect] = useState<GifEffect>(readStoredEffect)
  const [iconSource, setIconSource] = useState<GifIconSource>(defaultIconSource)
  const [generation, setGeneration] = useState<GenerateState>({ phase: 'idle' })
  /** 成功后修改配置时保留旧预览，仅标记过期，避免误下载旧结果。 */
  const [stale, setStale] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const requestRef = useRef(0)
  const resultUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const dragIndexRef = useRef<number | null>(null)

  const orderedBadges = useMemo(() => {
    const byId = new Map(badges.map((badge) => [badge.id, badge]))
    return order
      .map((id) => byId.get(id))
      .filter((badge): badge is BadgeRecord => badge !== undefined)
  }, [badges, order])

  // 页面侧移除徽章后同步清掉顺序里的悬空 id；沿用 render 期间对齐外部值的模式
  const badgeIdsKey = badges.map((badge) => badge.id).join('\n')
  const [syncedBadgeIds, setSyncedBadgeIds] = useState(badgeIdsKey)
  if (badgeIdsKey !== syncedBadgeIds) {
    setSyncedBadgeIds(badgeIdsKey)
    const idSet = new Set(badges.map((badge) => badge.id))
    setOrder((prev) => prev.filter((id) => idSet.has(id)))
  }

  const generating = generation.phase === 'generating'
  const frameError = validateFrameCount(orderedBadges.length)
  const normalizedDelay = normalizeDelayMs(delayMs)

  // 卸载时取消在途任务并释放预览 URL
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (resultUrlRef.current !== null) URL.revokeObjectURL(resultUrlRef.current)
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

  const handleRemove = (id: string) => {
    if (generating) return
    markConfigChanged()
    onRemoveBadge(id)
  }

  const handleGenerate = async () => {
    if (frameError !== null || generating) return
    const snapshot: ConfigSnapshot = {
      frameCount: orderedBadges.length,
      delayMs: normalizedDelay,
      effect,
      iconSource,
    }
    revokeResult()
    setStale(false)
    setConfirmingClose(false)
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestRef.current
    setGeneration({
      phase: 'generating',
      progress: { done: 0, total: snapshot.frameCount, attempt: 1, maxColors: COLOR_LADDER[0] },
    })
    try {
      const blob = await makeGif(
        orderedBadges,
        { delayMs: normalizedDelay, effect, iconSource },
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

  // 生成期间关闭弹窗需二次确认；确认取消后释放任务资源再关闭
  const requestClose = (open: boolean) => {
    if (!open && generating) {
      setConfirmingClose(true)
      return
    }
    if (!open) {
      requestRef.current += 1
      abortRef.current?.abort()
      revokeResult()
    }
    onOpenChange(open)
  }

  const confirmCloseAndCancel = () => {
    requestRef.current += 1
    abortRef.current?.abort()
    revokeResult()
    setConfirmingClose(false)
    onOpenChange(false)
  }

  const canGenerate = frameError === null && !generating
  const summary = `${orderedBadges.length} 帧 · 每帧 ${formatSeconds(normalizedDelay)} · ${
    EFFECT_LABELS[effect]
  } · ${ICON_SOURCE_LABELS[iconSource]} · 总时长约 ${formatSeconds(
    orderedBadges.length * normalizedDelay,
  )}`

  const generateButtonLabel =
    generation.phase === 'error'
      ? '重试'
      : generation.phase === 'success'
        ? '重新生成'
        : '生成 GIF'

  return (
    <Dialog open onOpenChange={requestClose}>
      <DialogContent className="max-h-[calc(100vh-4rem)] w-full max-w-[calc(100%-2rem)] overflow-y-auto rounded-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">制作徽章动图</DialogTitle>
          <DialogDescription>
            拖动或用箭头调整出场顺序，生成 512×512 无限循环的轮播 GIF。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-5 pt-4">
          <section aria-label="已选徽章">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">
                出场顺序
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  共 {orderedBadges.length} 帧
                </span>
              </h3>
            </div>
            {orderedBadges.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                已全部移除，请关闭弹窗后重新选择徽章。
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
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-2 pr-1 shadow-sm"
                  >
                    <GripVertical
                      className="size-3.5 shrink-0 cursor-grab text-muted-foreground"
                      aria-hidden
                    />
                    <BadgeImage
                      src={iconUrlFor(badge, iconSource)}
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
                        disabled={generating || orderedBadges.length <= 1}
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
          </section>

          <section aria-label="每帧停留时长">
            <h3 className="mb-2 text-sm font-medium">每帧停留</h3>
            <div
              role="group"
              aria-label="选择每帧停留时长"
              className="inline-flex flex-wrap items-center rounded-md border border-input bg-card p-0.5"
            >
              {DELAY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={delayMs === option}
                  disabled={generating}
                  onClick={() => {
                    if (delayMs !== option) {
                      markConfigChanged()
                      setDelayMs(option)
                    }
                  }}
                  className={cn(
                    'inline-flex h-8 items-center rounded-[6px] px-2.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
                    delayMs === option
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {formatSeconds(option)}
                </button>
              ))}
            </div>
          </section>

          <section aria-label="切换效果">
            <div className="mb-2 flex items-center gap-3">
              <h3 className="text-sm font-medium">切换效果</h3>
              <EffectPreview badges={orderedBadges} effect={effect} iconSource={iconSource} />
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
          </section>

          <section aria-label="生成图标">
            <h3 className="mb-2 text-sm font-medium">生成图标</h3>
            <div
              role="group"
              aria-label="选择生成图标来源"
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
                      setIconSource(option)
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
                  width={512}
                  height={512}
                  className="size-44 rounded-lg bg-white shadow-sm"
                />
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {generation.snapshot.frameCount} 帧 · 每帧{' '}
                    {formatSeconds(generation.snapshot.delayMs)} ·{' '}
                    {EFFECT_LABELS[generation.snapshot.effect]} ·{' '}
                    {ICON_SOURCE_LABELS[generation.snapshot.iconSource]} ·{' '}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatBytes(generation.size)}
                    </span>
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
          {confirmingClose ? (
            <div
              role="alertdialog"
              aria-label="确认关闭"
              className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm text-muted-foreground">正在生成 GIF，关闭将取消本次生成。</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setConfirmingClose(false)}>
                  继续生成
                </Button>
                <Button size="sm" variant="destructive" onClick={confirmCloseAndCancel}>
                  取消并关闭
                </Button>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
