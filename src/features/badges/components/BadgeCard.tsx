import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BadgeRecord, CardIconMode } from '../types'
import { formatRate } from '../query'
import { useOverflowTitle } from '@/lib/useOverflowTitle'
import { BadgeImage } from './BadgeImage'
import { LevelChip } from './LevelChip'

interface BadgeCardProps {
  badge: BadgeRecord
  onOpen: (id: string) => void
  /** 制作动图的多选模式：点击卡片改为切换选中，不再打开详情。 */
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  /** 展示小图标（icon）还是大图标（exportIcon），默认小图标。 */
  iconMode?: CardIconMode
}

export function BadgeCard({
  badge,
  onOpen,
  selectMode = false,
  selected = false,
  onToggleSelect,
  iconMode = 'small',
}: BadgeCardProps) {
  const nameRef = useOverflowTitle<HTMLHeadingElement>(badge.name)
  const conditionRef = useOverflowTitle<HTMLParagraphElement>(badge.condition)
  const attrRef = useOverflowTitle<HTMLParagraphElement>(badge.attr)

  const handleClick = () => {
    if (selectMode) {
      onToggleSelect?.(badge.id)
    } else {
      onOpen(badge.id)
    }
  }

  return (
    <article
      data-testid="badge-card"
      data-selected={selectMode ? selected : undefined}
      role="button"
      tabIndex={0}
      aria-pressed={selectMode ? selected : undefined}
      aria-label={`${selectMode ? '选择' : '查看'} ${badge.name} 详情`}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleClick()
        }
      }}
      className={cn(
        'relative flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selectMode && selected && 'border-primary ring-2 ring-primary/30 hover:border-primary',
      )}
    >
      {selectMode && (
        <span
          aria-hidden
          className={cn(
            'absolute right-3 top-3 flex size-5 items-center justify-center rounded-md border transition-colors',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-transparent',
          )}
        >
          <Check className="size-3.5" />
        </span>
      )}
      <div className="flex items-start gap-3">
        <BadgeImage
          src={iconMode === 'large' ? badge.exportIcon : badge.icon}
          alt={badge.name}
          className={iconMode === 'large' ? 'size-20' : 'size-14'}
          iconClassName={iconMode === 'large' ? 'size-8' : 'size-6'}
        />
        <div className="min-w-0 flex-1">
          <h3 ref={nameRef} className="truncate text-base font-semibold">
            {badge.name}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <LevelChip level={badge.level} className="shrink-0" />
            <span className="whitespace-nowrap">
              获得率{' '}
              <span className="font-semibold tabular-nums text-foreground">
                {formatRate(badge.rate)}
              </span>
            </span>
          </div>
        </div>
      </div>
      <p
        ref={conditionRef}
        className="line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground"
      >
        {badge.condition}
      </p>
      <p
        ref={attrRef}
        className="mt-auto line-clamp-1 border-t border-border/70 pt-2.5 text-xs leading-relaxed text-muted-foreground"
      >
        <span className="mr-1.5 rounded bg-muted px-1 py-0.5 font-medium text-foreground/80">
          {badge.attrType}
        </span>
        {badge.attr}
      </p>
    </article>
  )
}
