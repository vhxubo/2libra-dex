import { Link } from 'react-router-dom'
import { ExternalLink, ShieldCheck, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOverflowTitle } from '@/lib/useOverflowTitle'
import { ADMIN_USERNAMES, GOLD_LEADERBOARD_TOP10, userAboutUrl } from './data'

function UserLink({ username, className }: { username: string; className?: string }) {
  const ref = useOverflowTitle<HTMLSpanElement>(username)

  return (
    <a
      href={userAboutUrl(username)}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        'inline-flex min-w-0 items-center gap-1 font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <span ref={ref} className="min-w-0 truncate">
        {username}
      </span>
      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
    </a>
  )
}

function AdminChip() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
      <ShieldCheck className="size-3.5" aria-hidden />
      2Libra 管理员
    </span>
  )
}

export default function DataSourcesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">数据来源</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          本站徽章数据来自对 2Libra 公开页面的采集，以下为参考页面。
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ShieldCheck className="size-4 shrink-0 text-amber-500" aria-hidden />
          <h2 className="text-sm font-semibold">2Libra 管理员</h2>
        </div>
        <ul aria-label="2Libra 管理员" className="divide-y divide-border">
          {ADMIN_USERNAMES.map((username) => (
            <li
              key={username}
              className="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span className="w-6 shrink-0" aria-hidden>
                <ShieldCheck className="size-4 text-amber-500" />
              </span>
              <UserLink username={username} />
              <AdminChip />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Trophy className="size-4 shrink-0 text-amber-500" aria-hidden />
          <h2 className="text-sm font-semibold">2Libra 金币排行榜 Top 10</h2>
        </div>
        <ol
          aria-label="2Libra 金币排行榜 Top 10"
          className="divide-y divide-border"
        >
          {GOLD_LEADERBOARD_TOP10.map((username, index) => (
            <li
              key={username}
              className="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
                {String(index + 1).padStart(2, '0')}
              </span>
              <UserLink username={username} />
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-4 text-xs text-muted-foreground">
        返回
        <Link
          to="/badges"
          className="mx-1 font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          徽章图鉴
        </Link>
        查看全部徽章。
      </p>
    </div>
  )
}
