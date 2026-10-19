// 数据顺序与 2Libra 金币排行榜一致，username 取自 top/ 目录下采集的公开用户页
export const GOLD_LEADERBOARD_TOP10 = [
  'bopomofo',
  'Evan',
  'libra2',
  'JoeJoeJoe',
  'wintermute',
  'february2',
  'Altria',
  'cnskis',
  'utags',
  'CxTboceder',
] as const

export const ADMIN_USERNAMES = ['Jimmy'] as const

export function userAboutUrl(username: string): string {
  return `https://2libra.com/user/${encodeURIComponent(username)}/about`
}
