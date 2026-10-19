import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getAppliedTheme, toggleTheme, type Theme } from '@/lib/theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getAppliedTheme)
  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`切换到${nextTheme === 'dark' ? '深色' : '浅色'}模式`}
      title={`切换到${nextTheme === 'dark' ? '深色' : '浅色'}模式`}
      onClick={() => setTheme(toggleTheme())}
    >
      {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  )
}
