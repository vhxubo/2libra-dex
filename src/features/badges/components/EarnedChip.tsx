import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

/** 已获得状态标记，登录且数据加载完成后展示。 */
export function EarnedChip({ className }: { className?: string }) {
  return (
    <span
      data-testid="earned-chip"
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary',
        className,
      )}
    >
      <BadgeCheck className="size-3.5" aria-hidden />
      已获得
    </span>
  )
}
