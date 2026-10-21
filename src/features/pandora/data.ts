import raw from '../../../pandora.json'
import { dedupeEvents } from './query'
import { RARITIES, type PandoraEvent, type Rarity } from './types'

interface RawPandoraEvent {
  id: string
  payload: {
    rarity: string
    tier_code: string
    event_code: string
    event_name: string
    event_title: string
    rolled_value: number | null
  }
  created_at: string
}

/** 单一数据源：根目录 pandora.json（采集自潘多拉事件通知接口），构建时导入。 */
const rawEvents = (raw as { meta: { eventCount: number }; events: RawPandoraEvent[] }).events

function toEvent(raw: RawPandoraEvent): PandoraEvent {
  return {
    id: raw.id,
    rarity: raw.payload.rarity as Rarity,
    tierCode: raw.payload.tier_code,
    eventCode: raw.payload.event_code,
    eventName: raw.payload.event_name,
    eventTitle: raw.payload.event_title,
    rolledValue: raw.payload.rolled_value,
    createdAt: raw.created_at,
  }
}

/** 保持 JSON 内的采集顺序（时间从新到旧）；同一事件重复触发产生的内容完全一致的记录仅保留最新一条。 */
export const PANDORA_EVENTS: PandoraEvent[] = dedupeEvents(rawEvents.map(toEvent))

export const PANDORA_EVENT_COUNT = PANDORA_EVENTS.length

export const RARITY_COUNTS = Object.fromEntries(
  RARITIES.map((rarity) => [
    rarity,
    PANDORA_EVENTS.filter((event) => event.rarity === rarity).length,
  ]),
) as Record<Rarity, number>

/** 数据中实际出现的 tier_code，按字母排序。 */
export const TIER_CODES: readonly string[] = [
  ...new Set(PANDORA_EVENTS.map((event) => event.tierCode)),
].sort()
