const PROFILE_URL_BASE = 'https://2libra.com/user'

/** 用户 about 页 SSR 渲染的徽章小图标引用，路径中的文件名即徽章 id。 */
const BADGE_SVG_PATTERN = /r2\.2libra\.com\/badge\/svg\/([a-z0-9_-]+)\.svg/g

/** 2libra 用户主页不可达或返回异常。 */
export class UserBadgesUnavailableError extends Error {}

/**
 * 抓取用户 about 页并提取已获得徽章 id。
 * 页面会把佩戴徽章和徽章墙（客户端 user-badge-display-modal 弹窗的同一数据源）
 * SSR 成 r2.2libra.com/badge/svg/{id}.svg 的图片引用，无需登录即可读取。
 */
export async function fetchUserBadges(username: string): Promise<string[]> {
  let html: string | null = null
  try {
    const response = await fetch(
      `${PROFILE_URL_BASE}/${encodeURIComponent(username)}/about`,
    )
    if (response.ok) {
      html = await response.text()
    }
  } catch {
    throw new UserBadgesUnavailableError('无法连接 2libra 用户主页')
  }
  if (html === null) {
    throw new UserBadgesUnavailableError('2libra 用户主页获取失败')
  }
  const ids = new Set<string>()
  for (const match of html.matchAll(BADGE_SVG_PATTERN)) {
    ids.add(match[1])
  }
  return [...ids].sort()
}
