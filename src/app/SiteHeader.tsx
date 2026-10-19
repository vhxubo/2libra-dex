import { NavLink } from 'react-router-dom'
import { Scale } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <NavLink
          to="/badges"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Scale className="size-4" aria-hidden />
          </span>
          2Libra 图鉴
        </NavLink>
        <nav aria-label="站点导航" className="flex items-center gap-1 text-sm">
          <NavLink
            to="/badges"
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            徽章图鉴
          </NavLink>
          <span
            aria-disabled="true"
            title="即将开放"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground/70"
          >
            潘多拉事件
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
              待开放
            </span>
          </span>
        </nav>
      </div>
    </header>
  )
}
