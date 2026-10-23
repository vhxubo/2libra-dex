import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { BADGES } from '../data'
import { ATTR_TYPES, BADGE_LEVELS, type AttrType, type BadgeRecord, type BadgeLevel, type CardIconMode } from '../types'
import { GifMakerTool } from './GifMakerTool'

interface GifNavigationState { badgeIds?: string[]; iconMode?: CardIconMode }

/** 弹窗筛选用的小尺寸切换按钮，与生成页图标来源选择器同一风格。 */
function PickerChip({
  active,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center rounded-[6px] px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/** 独立 GIF 工具页：复用与徽章页弹窗相同的生成器，初始不要求选择徽章。 */
export default function GifMakerPage() {
  const location = useLocation()
  const navState = (location.state ?? {}) as GifNavigationState
  const [selectedBadges, setSelectedBadges] = useState<BadgeRecord[]>(() =>
    (navState.badgeIds ?? []).map((id) => BADGES.find((badge) => badge.id === id)).filter((badge): badge is BadgeRecord => badge !== undefined),
  )
  const [iconSource, setIconSource] = useState<CardIconMode>(navState.iconMode ?? 'large')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerCapacity, setPickerCapacity] = useState(0)
  const [pickerIds, setPickerIds] = useState<string[]>([])
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerLevels, setPickerLevels] = useState<BadgeLevel[]>([])
  const [pickerAttrType, setPickerAttrType] = useState<AttrType | null>(null)
  const selectedIds = useMemo(() => new Set(selectedBadges.map((badge) => badge.id)), [selectedBadges])
  const pickerSelectedSet = useMemo(() => new Set(pickerIds), [pickerIds])
  const pickerBadges = useMemo(() => {
    const query = pickerQuery.trim().toLocaleLowerCase()
    const levels = new Set(pickerLevels)
    return BADGES.filter((badge) =>
      (!query || badge.name.toLocaleLowerCase().includes(query) || badge.id.toLocaleLowerCase().includes(query))
      && (levels.size === 0 || levels.has(badge.level))
      && (pickerAttrType === null || badge.attrType === pickerAttrType),
    )
  }, [pickerQuery, pickerLevels, pickerAttrType])
  // 「全选当前」只收搜索 + 筛选后仍未加入的徽章，且不超过剩余名额
  const remainingCapacity = pickerCapacity - pickerIds.length
  const selectablePickerBadges = pickerBadges.filter((badge) => !selectedIds.has(badge.id) && !pickerSelectedSet.has(badge.id))
  const selectAllDisabled = remainingCapacity <= 0 || selectablePickerBadges.length === 0
  const selectAllCurrent = () => {
    const additions = selectablePickerBadges.slice(0, remainingCapacity).map((badge) => badge.id)
    if (additions.length === 0) return
    setPickerIds((prev) => [...prev, ...additions])
  }
  const togglePickerLevel = (level: BadgeLevel) => {
    setPickerLevels((prev) => prev.includes(level) ? prev.filter((item) => item !== level) : [...prev, level])
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
      <div className="mb-5 flex items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link to="/badges"><ArrowLeft aria-hidden />返回图鉴</Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">GIF 制作工具</h1>
          <p className="mt-1 text-sm text-muted-foreground">上传本地图片、添加外部链接，或从图鉴选择徽章作为 GIF 帧。</p>
        </div>
      </div>
      <GifMakerTool
        badges={selectedBadges}
        defaultIconSource={iconSource}
        iconSourceOverride={iconSource}
        onIconSourceChange={setIconSource}
        onRemoveBadge={(id) => setSelectedBadges((prev) => prev.filter((badge) => badge.id !== id))}
        onRequestAddBadges={(available) => { setPickerCapacity(available); setPickerIds([]); setPickerQuery(''); setPickerLevels([]); setPickerAttrType(null); setPickerOpen(true) }}
        onClearBadges={() => setSelectedBadges([])}
      />
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-3xl gap-0 overflow-hidden p-0 sm:max-h-[min(780px,calc(100vh-3rem))]">
          <DialogHeader className="shrink-0">
            <DialogTitle>从图鉴添加徽章</DialogTitle>
            <DialogDescription>已添加 {selectedBadges.length} 枚 · 本次选择 {pickerIds.length} 枚</DialogDescription>
            <div role="group" aria-label="图鉴徽章图标大小" className="mt-2 flex gap-2">
              {(['large', 'small'] as const).map((mode) => (
                <Button key={mode} type="button" size="sm" variant={iconSource === mode ? 'default' : 'outline'} aria-pressed={iconSource === mode} onClick={() => setIconSource(mode)}>
                  {mode === 'large' ? '高清大图标' : '使用小图标'}
                </Button>
              ))}
            </div>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="搜索徽章名称或 ID" aria-label="搜索图鉴徽章" className="pl-9 pr-9" />
              {pickerQuery && <button type="button" aria-label="清空搜索" onClick={() => setPickerQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"><X className="size-4" aria-hidden /></button>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div role="group" aria-label="按等级筛选" className="inline-flex items-center rounded-md border border-input bg-card p-0.5">
                <PickerChip active={pickerLevels.length === 0} onClick={() => setPickerLevels([])}>全部等级</PickerChip>
                {BADGE_LEVELS.map((level) => (
                  <PickerChip key={level} active={pickerLevels.includes(level)} onClick={() => togglePickerLevel(level)}>{level}</PickerChip>
                ))}
              </div>
              <div role="group" aria-label="按属性类型筛选" className="inline-flex items-center rounded-md border border-input bg-card p-0.5">
                <PickerChip active={pickerAttrType === null} onClick={() => setPickerAttrType(null)}>全部属性</PickerChip>
                {ATTR_TYPES.map((attrType) => (
                  <PickerChip key={attrType} active={pickerAttrType === attrType} onClick={() => setPickerAttrType(pickerAttrType === attrType ? null : attrType)}>{attrType}</PickerChip>
                ))}
              </div>
              <Button type="button" size="sm" variant="outline" className="ms-auto" disabled={selectAllDisabled} onClick={selectAllCurrent}>全选当前</Button>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {pickerBadges.map((badge) => {
              const added = selectedIds.has(badge.id)
              const checked = pickerIds.includes(badge.id)
              return <button key={badge.id} type="button" disabled={added || (!checked && pickerIds.length >= pickerCapacity)} aria-pressed={checked} onClick={() => setPickerIds((prev) => checked ? prev.filter((id) => id !== badge.id) : [...prev, badge.id])} className={`relative flex min-h-16 items-center gap-2 rounded-md border p-2.5 text-left text-xs transition-colors ${added ? 'cursor-not-allowed bg-muted/50 text-muted-foreground' : checked ? 'border-primary bg-accent' : 'border-border hover:bg-muted'}`}>
                <img loading="lazy" decoding="async" src={iconSource === 'large' ? badge.exportIcon : badge.icon} alt="" className={`${iconSource === 'large' ? 'size-10' : 'size-8'} shrink-0 object-contain`} /><span className="line-clamp-2 min-w-0 flex-1">{badge.name}</span>
                <span className={`shrink-0 text-[10px] ${added ? 'text-muted-foreground' : checked ? 'font-medium text-primary' : 'text-muted-foreground'}`}>{added ? '已加入' : checked ? '已选' : ''}</span>
              </button>
            })}
          </div>
          {pickerBadges.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">没有匹配的徽章</p>}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-card px-5 py-3">
            <span className="text-xs text-muted-foreground" aria-live="polite">找到 {pickerBadges.length} 枚徽章 · 还可选 {Math.max(0, remainingCapacity)} 枚</span>
            <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPickerOpen(false)}>取消</Button>
            <Button disabled={pickerIds.length === 0} onClick={() => { setSelectedBadges((prev) => [...prev, ...pickerIds.map((id) => BADGES.find((badge) => badge.id === id)).filter((badge): badge is BadgeRecord => badge !== undefined)]); setPickerOpen(false) }}>添加 {pickerIds.length || ''} 枚</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
