import { cn } from '@/lib/utils'
import { RARITY_LABELS, type Rarity } from '../types'

const RARITY_CHIP_STYLES: Record<Rarity, string> = {
  bronze:
    'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300',
  silver:
    'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-400/40 dark:bg-zinc-400/10 dark:text-zinc-300',
  gold: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  purple:
    'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300',
}

export function RarityChip({ rarity, className }: { rarity: Rarity; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold',
        RARITY_CHIP_STYLES[rarity],
        className,
      )}
    >
      {RARITY_LABELS[rarity]}
    </span>
  )
}
