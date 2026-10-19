import { BADGE_COUNT } from '@/features/badges/data'

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          本图鉴数据来自对 2Libra 徽章卡片的公开页面采集（当前 {BADGE_COUNT}{' '}
          条记录），仅供参考，不构成完整官方图鉴。
        </p>
        <p className="shrink-0">2Libra 图鉴</p>
      </div>
    </footer>
  )
}
