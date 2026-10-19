import type { BadgeRecord } from '../types'
import { formatRate } from '../query'
import { useOverflowTitle } from '@/lib/useOverflowTitle'
import { BadgeImage } from './BadgeImage'
import { LevelChip } from './LevelChip'

interface BadgeCardProps {
  badge: BadgeRecord
  onOpen: (id: string) => void
}

export function BadgeCard({ badge, onOpen }: BadgeCardProps) {
  const nameRef = useOverflowTitle<HTMLHeadingElement>(badge.name)
  const conditionRef = useOverflowTitle<HTMLParagraphElement>(badge.condition)
  const attrRef = useOverflowTitle<HTMLParagraphElement>(badge.attr)

  return (
    <article
      data-testid="badge-card"
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`查看 ${badge.name} 详情`}
      onClick={() => onOpen(badge.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(badge.id)
        }
      }}
      className="relative flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-3">
        <BadgeImage
          src={badge.icon}
          alt={badge.name}
          className="size-14"
          iconClassName="size-6"
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
