import { useEffect, useRef, useState } from 'react'
import { Check, CircleAlert, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatRate } from '../query'
import type { BadgeRecord, CardIconMode } from '../types'
import { useOverflowTitle } from '@/lib/useOverflowTitle'
import { BadgeImage } from './BadgeImage'
import { EarnedChip } from './EarnedChip'
import { LevelChip } from './LevelChip'

interface BadgeDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  badge?: BadgeRecord
  badgeId: string | null
  /** 展示小图标（icon）还是大图标（exportIcon），与页面卡片图标开关联动。 */
  iconMode?: CardIconMode
  /** 登录用户已获得该徽章时传入 true，展示状态标记。 */
  earned?: boolean
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 继续尝试降级方案
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    textarea.remove()
    return ok
  } catch {
    return false
  }
}

export function BadgeDetailDialog({
  open,
  onOpenChange,
  badge,
  badgeId,
  iconMode = 'small',
  earned = false,
}: BadgeDetailDialogProps) {
  // 复制结果按徽章 ID 记录，切换徽章时自然失效，无需在 effect 中重置
  const [copyResult, setCopyResult] = useState<{ id: string; state: 'done' | 'fail' } | null>(null)
  const resetTimer = useRef<number | null>(null)
  const nameRef = useOverflowTitle<HTMLHeadingElement>(badge?.name ?? '')
  const idRef = useOverflowTitle<HTMLSpanElement>(badge?.id ?? '')

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    }
  }, [])

  const copyState = copyResult && copyResult.id === badgeId ? copyResult.state : 'idle'

  if (!badge) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">未找到该徽章</DialogTitle>
            <DialogDescription className="sr-only">链接指向的徽章不存在</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
            <CircleAlert className="size-10 text-muted-foreground" aria-hidden />
            <p className="text-sm leading-relaxed text-muted-foreground">
              链接中的徽章 ID「{badgeId}」不在已采集的数据中，
              <br className="hidden sm:block" />
              可能已失效或输入有误。
            </p>
            <DialogClose asChild>
              <Button>返回图鉴</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const handleCopy = async () => {
    const ok = await copyText(window.location.href)
    setCopyResult({ id: badge.id, state: ok ? 'done' : 'fail' })
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setCopyResult(null), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] w-full max-w-[calc(100%-2rem)] gap-0 rounded-xl p-0 sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-8">
            <BadgeImage
              src={iconMode === 'large' ? badge.exportIcon : badge.icon}
              alt={badge.name}
              className={iconMode === 'large' ? 'size-24' : 'size-16'}
              iconClassName={iconMode === 'large' ? 'size-10' : 'size-7'}
            />
            <div className="min-w-0">
              <DialogTitle asChild>
                <h2 ref={nameRef} className="truncate text-lg">
                  {badge.name}
                </h2>
              </DialogTitle>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <LevelChip level={badge.level} />
                {earned && <EarnedChip />}
                <span ref={idRef} className="truncate font-mono text-xs">
                  {badge.id}
                </span>
              </div>
            </div>
          </div>
          <DialogDescription className="sr-only">{badge.name} 的详细信息</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">获得率</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{formatRate(badge.rate)}</dd>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">属性类型</dt>
              <dd className="mt-1.5 text-sm font-medium">{badge.attrType}</dd>
            </div>
          </dl>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold">获取条件</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{badge.condition}</p>
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold">属性说明 · {badge.attrType}</h3>
            <p
              className={
                badge.attrType === '佩戴属性'
                  ? 'rounded-lg border border-blue-200 bg-accent p-3 text-sm leading-relaxed text-accent-foreground'
                  : 'rounded-lg border border-border bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground'
              }
            >
              {badge.attr}
            </p>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" className="flex-1" onClick={handleCopy}>
            {copyState === 'done' ? <Check aria-hidden /> : <Link2 aria-hidden />}
            {copyState === 'done' ? '已复制链接' : copyState === 'fail' ? '复制失败' : '复制详情链接'}
          </Button>
          <DialogClose asChild>
            <Button variant="ghost">关闭</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
