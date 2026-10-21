import { DEFAULT_SORT_KEY, type SortKey } from './types'

/** 潘多拉事件页全部 URL 可恢复状态。 */
export interface PandoraUrlState {
  q: string
  sort: SortKey
}

export const DEFAULT_URL_STATE: PandoraUrlState = {
  q: '',
  sort: DEFAULT_SORT_KEY,
}

const SORT_VALUES: readonly string[] = [
  'rarity-asc',
  'rarity-desc',
  'tier-asc',
  'tier-desc',
]

/** 解析 URL 查询参数；非法值恢复为默认。 */
export function parsePandoraSearchParams(params: URLSearchParams): PandoraUrlState {
  const sortRaw = params.get('sort')
  return {
    q: params.get('q') ?? '',
    sort: SORT_VALUES.includes(sortRaw as SortKey) ? (sortRaw as SortKey) : DEFAULT_SORT_KEY,
  }
}

/** 序列化为 URL 查询参数；等于默认值的项不写入，保持 URL 简洁。 */
export function pandoraStateToSearchParams(state: PandoraUrlState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.q.trim()) params.set('q', state.q)
  if (state.sort !== DEFAULT_SORT_KEY) params.set('sort', state.sort)
  return params
}
