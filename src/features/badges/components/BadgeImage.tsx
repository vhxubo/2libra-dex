import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BadgeImageProps {
  src: string
  alt: string
  className?: string
  iconClassName?: string
}

/** 徽章图片；加载失败时显示稳定尺寸的占位。 */
export function BadgeImage({ src, alt, className, iconClassName }: BadgeImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        role="img"
        aria-label={`${alt}（图片加载失败）`}
        title="图片加载失败"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-muted-foreground',
          className,
        )}
      >
        <ImageOff className={cn('size-1/2', iconClassName)} aria-hidden />
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('shrink-0 object-contain', className)}
    />
  )
}
