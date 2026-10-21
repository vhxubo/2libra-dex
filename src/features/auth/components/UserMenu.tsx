import { useState } from 'react'
import { ExternalLink, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { userAboutUrl } from '@/features/sources/data'
import { useAuth } from '../AuthContext'

/** 导航栏用户菜单：头像 + 用户名（小屏仅头像），含 2libra 主页外链与退出登录。 */
export function UserMenu() {
  const { user, logout } = useAuth()
  const [avatarFailed, setAvatarFailed] = useState(false)

  if (user === null) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex shrink-0 items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`用户菜单（${user.username}）`}
      >
        {avatarFailed || user.avatar_url === null ? (
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold uppercase text-primary-foreground"
          >
            {user.username.slice(0, 1)}
          </span>
        ) : (
          <img
            src={user.avatar_url}
            alt={`${user.username} 的头像`}
            onError={() => setAvatarFailed(true)}
            className="size-8 shrink-0 rounded-full object-cover"
          />
        )}
        <span className="hidden max-w-24 truncate text-sm font-medium sm:inline">{user.username}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {user.user_number} · Lv.{user.level}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={userAboutUrl(user.username)} target="_blank" rel="noreferrer noopener">
            <ExternalLink aria-hidden />
            2libra 主页
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut aria-hidden />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
