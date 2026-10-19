import { cn } from '@/lib/utils'
import type { BadgeLevel } from '../types'

const LEVEL_CHIP_STYLES: Record<BadgeLevel, string> = {
  T0: 'border-transparent bg-foreground text-white dark:bg-foreground dark:text-background',
  T1: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
  T2: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300',
  T3: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
}

export function LevelChip({ level, className }: { level: BadgeLevel; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums',
        LEVEL_CHIP_STYLES[level],
        className,
      )}
    >
      {level}
    </span>
  )
}
