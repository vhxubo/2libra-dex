import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'

/** 命中缓存的时长；徽章获得情况变化低频，路由切换间复用一次结果即可。 */
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  ids: string[]
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<string[]>>()

/** 测试专用：清空模块级缓存与在途请求。 */
export function resetEarnedBadgesCache(): void {
  cache.clear()
  inflight.clear()
}

async function loadUserBadges(username: string): Promise<string[]> {
  const cached = cache.get(username)
  if (cached !== undefined && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.ids
  }
  const pending = inflight.get(username)
  if (pending !== undefined) return pending
  const request = (async () => {
    const response = await fetch('/api/auth/user-badges')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json().catch(() => null)) as { badges?: unknown } | null
    if (
      data === null ||
      !Array.isArray(data.badges) ||
      data.badges.some((id) => typeof id !== 'string')
    ) {
      throw new Error('徽章数据格式异常')
    }
    cache.set(username, { ids: data.badges, fetchedAt: Date.now() })
    return data.badges
  })()
  inflight.set(username, request)
  try {
    return await request
  } finally {
    inflight.delete(username)
  }
}

interface LoadOutcome {
  status: 'loaded' | 'failed'
  ids?: string[]
}

export interface EarnedBadgesState {
  /** 已获得徽章 id 集合；未登录、加载中或加载失败时为 null。 */
  earnedIds: ReadonlySet<string> | null
  /** 登录后是否仍在拉取。 */
  loading: boolean
}

/**
 * 登录后拉取当前用户在 2libra 已获得的徽章。
 * 结果缓存 5 分钟并合并并发请求，路由切换回来不重复请求。
 */
export function useEarnedBadges(): EarnedBadgesState {
  const { status, user } = useAuth()
  const username = user?.username ?? null
  const [outcome, setOutcome] = useState<{ username: string; outcome: LoadOutcome } | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || username === null) return
    let cancelled = false
    loadUserBadges(username)
      .then((ids) => {
        if (!cancelled) setOutcome({ username, outcome: { status: 'loaded', ids } })
      })
      .catch(() => {
        // 拉取失败按“无数据”降级，等下次挂载重试
        if (!cancelled) setOutcome({ username, outcome: { status: 'failed' } })
      })
    return () => {
      cancelled = true
    }
  }, [status, username])

  const earnedIds = useMemo(() => {
    if (outcome === null || outcome.username !== username) return null
    return outcome.outcome.status === 'loaded'
      ? new Set<string>(outcome.outcome.ids)
      : null
  }, [outcome, username])

  // 已拉取完成（无论成败）即不再视为加载中，失败态与未登录同样以 null 降级
  const settled = outcome !== null && outcome.username === username
  const loading = status === 'authenticated' && username !== null && !settled
  return { earnedIds, loading }
}
