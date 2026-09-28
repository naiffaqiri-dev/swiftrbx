'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type ProfileAvatarProps = {
  src?: string | null
  name: string
  alt?: string
  className?: string
}

export function ProfileAvatar({ src, name, alt = '', className }: ProfileAvatarProps) {
  const imageUrl = src?.trim() || undefined
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-bold text-primary',
        className,
      )}
    >
      {imageUrl && failedUrl !== imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <span aria-hidden="true">{name.trim().slice(0, 2).toUpperCase() || '??'}</span>
      )}
    </span>
  )
}
