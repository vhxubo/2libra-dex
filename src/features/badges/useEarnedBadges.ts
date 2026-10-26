import { useCallback, useEffect, useMemo, useState } from 'react'
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

async function loadUserBadges(username: string, force = false): Promise<string[]> {
  const cached = cache.get(username)
  if (!force && cached !== undefined && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.ids
  }
  const pending = inflight.get(username)
  if (pending !== undefined) return pending
  const request = (async () => {
    const response = await fetch('/api/auth/user-badges', force ? { cache: 'no-store' } : undefined)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json().catch(() => null)) as
      | { username?: unknown; badges?: unknown }
      | null
    if (
      data === null ||
      data.username !== username ||
      !Array.isArray(data.badges) ||
      data.badges.some((id) => typeof id !== 'string')
    ) {
      throw new Error('徽章数据格式异常或用户不匹配')
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
  /** 当前是否存在可用会话用户。 */
  enabled: boolean
  /** 初次获取或手动刷新时是否仍在拉取。 */
  loading: boolean
  /** 初次获取或最近一次手动刷新是否失败。 */
  error: boolean
  /** 绕过前端缓存，重新获取徽章状态。 */
  refresh: () => Promise<void>
}

/**
 * 登录后拉取当前用户在 2libra 已获得的徽章。
 * 结果缓存 5 分钟并合并并发请求，路由切换回来不重复请求。
 */
export function useEarnedBadges(): EarnedBadgesState {
  const { status, user } = useAuth()
  const username = user?.username ?? null
  const [outcome, setOutcome] = useState<{ username: string; outcome: LoadOutcome } | null>(null)
  const [refreshingUsername, setRefreshingUsername] = useState<string | null>(null)
  const [refreshErrorUsername, setRefreshErrorUsername] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || username === null) return
    let cancelled = false
    loadUserBadges(username)
      .then((ids) => {
        if (!cancelled) {
          setOutcome({ username, outcome: { status: 'loaded', ids } })
          setRefreshErrorUsername(null)
        }
      })
      .catch(() => {
        // 拉取失败按“无数据”降级，等下次挂载重试
        if (!cancelled) setOutcome({ username, outcome: { status: 'failed' } })
      })
    return () => {
      cancelled = true
    }
  }, [status, username])

  const refresh = useCallback(async () => {
    if (status !== 'authenticated' || username === null) return
    setRefreshingUsername(username)
    setRefreshErrorUsername(null)
    try {
      const ids = await loadUserBadges(username, true)
      setOutcome({ username, outcome: { status: 'loaded', ids } })
    } catch {
      // 保留最近一次成功结果；若还没有成功结果，则留下可重试的失败态
      setRefreshErrorUsername(username)
      setOutcome((previous) =>
        previous?.username === username && previous.outcome.status === 'loaded'
          ? previous
          : { username, outcome: { status: 'failed' } },
      )
    } finally {
      setRefreshingUsername((current) => (current === username ? null : current))
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
  const enabled = status === 'authenticated' && username !== null
  const loading = enabled && (!settled || refreshingUsername === username)
  const error =
    enabled &&
    refreshingUsername !== username &&
    (refreshErrorUsername === username ||
      (outcome?.username === username && outcome.outcome.status === 'failed'))
  return { earnedIds, enabled, loading, error, refresh }
}
