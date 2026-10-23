import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  GripVertical,
  Loader2,
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
import { makeGif, type GifMakerProgress } from './gifmaker'

const DELAY_OPTIONS = [
  { value: 400, label: '0.4s' },
  { value: 600, label: '0.6s' },
  { value: 800, label: '0.8s' },
  { value: 1200, label: '1.2s' },
  { value: 2000, label: '2s' },
] as const

const DEFAULT_DELAY_MS = 800

export interface GifMakerDialogProps {
  /** 已选徽章，按页面选择顺序传入。 */
  badges: BadgeRecord[]
  onOpenChange: (open: boolean) => void
  /** 移除徽章后同步回页面选择状态。 */
  onRemoveBadge: (id: string) => void
}

type GenerateState =
  | { phase: 'idle' }
  | { phase: 'generating'; progress: GifMakerProgress }
  | { phase: 'done'; url: string; size: number }
  | { phase: 'error'; message: string }

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function GifMakerDialog({ badges, onOpenChange, onRemoveBadge }: GifMakerDialogProps) {
  // 出场顺序为弹窗内本地状态，每次打开随挂载重建
  const [order, setOrder] = useState<string[]>(() => badges.map((badge) => badge.id))
  const [delayMs, setDelayMs] = useState<number>(DEFAULT_DELAY_MS)
  const [generation, setGeneration] = useState<GenerateState>({ phase: 'idle' })
  const requestRef = useRef(0)
  const resultUrlRef = useRef<string | null>(null)
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

  // 卸载时释放预览 URL
  useEffect(() => {
    return () => {
      if (resultUrlRef.current !== null) URL.revokeObjectURL(resultUrlRef.current)
    }
  }, [])

  const revokeResult = () => {
    if (resultUrlRef.current !== null) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
  }

  // 任何参数变更（排序/时长/移除）都会使已有结果失效；进行中的生成结果也会被请求号丢弃
  const markStale = () => {
    requestRef.current += 1
    revokeResult()
    setGeneration({ phase: 'idle' })
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return
    markStale()
    setOrder((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const handleRemove = (id: string) => {
    markStale()
    onRemoveBadge(id)
  }

  const handleGenerate = async () => {
    if (orderedBadges.length < 2 || generation.phase === 'generating') return
    revokeResult()
    const requestId = ++requestRef.current
    setGeneration({ phase: 'generating', progress: { done: 0, total: orderedBadges.length } })
    try {
      const blob = await makeGif(orderedBadges, { delayMs }, (progress) => {
        if (requestRef.current === requestId) {
          setGeneration({ phase: 'generating', progress })
        }
      })
      if (requestRef.current !== requestId) return
      const url = URL.createObjectURL(blob)
      resultUrlRef.current = url
      setGeneration({ phase: 'done', url, size: blob.size })
    } catch (error) {
      if (requestRef.current !== requestId) return
      setGeneration({
        phase: 'error',
        message: error instanceof Error ? error.message : '生成失败，请稍后重试',
      })
    }
  }

  const canGenerate = orderedBadges.length >= 2 && generation.phase !== 'generating'

  return (
    <Dialog open onOpenChange={onOpenChange}>
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
                    draggable
                    onDragStart={(event) => {
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
                    <BadgeImage src={badge.icon} alt={badge.name} className="size-6" />
                    <span className="max-w-28 truncate text-xs font-medium" title={badge.name}>
                      {badge.name}
                    </span>
                    <span className="flex items-center">
                      <button
                        type="button"
                        aria-label={`${badge.name} 前移`}
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronLeft className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`${badge.name} 后移`}
                        disabled={index === orderedBadges.length - 1}
                        onClick={() => move(index, index + 1)}
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronRight className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`移除 ${badge.name}`}
                        disabled={orderedBadges.length <= 1}
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

          <section aria-label="帧时长">
            <h3 className="mb-2 text-sm font-medium">每帧停留</h3>
            <div
              role="group"
              aria-label="选择每帧停留时长"
              className="inline-flex items-center rounded-md border border-input bg-card p-0.5"
            >
              {DELAY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={delayMs === option.value}
                  onClick={() => {
                    if (delayMs !== option.value) {
                      markStale()
                      setDelayMs(option.value)
                    }
                  }}
                  className={cn(
                    'inline-flex h-8 items-center rounded-[6px] px-2.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    delayMs === option.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section aria-label="生成结果">
            {generation.phase === 'generating' && (
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                正在生成第 {generation.progress.done}/{generation.progress.total} 帧…
              </div>
            )}
            {generation.phase === 'error' && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {generation.message}
              </div>
            )}
            {generation.phase === 'done' && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-4">
                <img
                  src={generation.url}
                  alt="徽章轮播 GIF 预览"
                  width={512}
                  height={512}
                  className="size-44 rounded-lg bg-white shadow-sm"
                />
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {orderedBadges.length} 帧 · 每帧 {delayMs}ms ·{' '}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatBytes(generation.size)}
                    </span>
                  </span>
                  <Button asChild size="sm">
                    <a href={generation.url} download="2libra-badges.gif">
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
            {orderedBadges.length < 2
              ? '至少选择 2 枚徽章才能生成轮播。'
              : '生成在本地完成，图片不会上传。'}
          </p>
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="gap-2 sm:self-auto"
          >
            {generation.phase === 'generating' && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {generation.phase === 'done' ? '重新生成' : '生成 GIF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
