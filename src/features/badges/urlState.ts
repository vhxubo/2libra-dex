import {
  ATTR_TYPES,
  BADGE_LEVELS,
  SORT_OPTIONS,
  type AttrType,
  type BadgeLevel,
  type SortKey,
  type ViewMode,
} from './types'

/** 徽章页全部 URL 可恢复状态。 */
export interface BadgeUrlState {
  q: string
  levels: BadgeLevel[]
  attrType: AttrType | null
  sort: SortKey
  view: ViewMode
  page: number
  badgeId: string | null
}

export const DEFAULT_URL_STATE: BadgeUrlState = {
  q: '',
  levels: [],
  attrType: null,
  sort: 'default',
  view: 'card',
  page: 1,
  badgeId: null,
}

const SORT_VALUES: readonly string[] = SORT_OPTIONS.map((option) => option.value)
const PAGE_PATTERN = /^\d+$/

function parseLevelsParam(raw: string | null): BadgeLevel[] {
  if (raw === null) return []
  const picked = new Set(
    raw
      .split(',')
      .map((part) => part.trim())
      .filter((part): part is BadgeLevel =>
        (BADGE_LEVELS as readonly string[]).includes(part as BadgeLevel),
      ),
  )
  return BADGE_LEVELS.filter((level) => picked.has(level))
}

/** 解析 URL 查询参数；任何非法值恢复为默认。 */
export function parseBadgeSearchParams(params: URLSearchParams): BadgeUrlState {
  const sortRaw = params.get('sort')
  const pageRaw = params.get('page')
  const page = pageRaw !== null && PAGE_PATTERN.test(pageRaw) ? Number.parseInt(pageRaw, 10) : NaN

  return {
    q: params.get('q') ?? '',
    levels: parseLevelsParam(params.get('level')),
    attrType: ATTR_TYPES.find((attrType) => params.get('attr') === attrType) ?? null,
    sort: SORT_VALUES.includes(sortRaw as SortKey) ? (sortRaw as SortKey) : 'default',
    view: params.get('view') === 'table' ? 'table' : 'card',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    badgeId: params.get('badge')?.trim() || null,
  }
}

/** 序列化为 URL 查询参数；等于默认值的项不写入，保持 URL 简洁。 */
export function badgeStateToSearchParams(state: BadgeUrlState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.q.trim()) params.set('q', state.q)
  if (state.levels.length > 0) params.set('level', state.levels.join(','))
  if (state.attrType !== null) params.set('attr', state.attrType)
  if (state.sort !== 'default') params.set('sort', state.sort)
  if (state.view !== 'card') params.set('view', state.view)
  if (state.page > 1) params.set('page', String(state.page))
  if (state.badgeId !== null) params.set('badge', state.badgeId)
  return params
}
