/** 2libra OAuth 用户资料，字段与 /api/oauth/me 返回保持一致。 */
export interface OAuthUser {
  id: string
  username: string
  user_number: string
  avatar_url: string | null
  level: number
}

/** GET /api/auth/config 响应，供前端拼接授权页跳转地址。 */
export interface AuthConfig {
  client_id: string
  redirect_uri: string
}
