'use client'

import { useState } from 'react'
import Image from 'next/image'

interface UserAvatarProps {
  avatarUrl?: string | null
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
}

export default function UserAvatar({
  avatarUrl,
  name = 'Believer',
  size = 'md',
  className = '',
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const initial = (name.trim().charAt(0) || 'B').toUpperCase()
  const dim = sizeClasses[size]

  if (avatarUrl && !imgError) {
    return (
      <div
        className={`relative ${dim} rounded-full overflow-hidden ring-2 ring-amber-400/50 flex-shrink-0 bg-gray-100 dark:bg-zinc-800 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover rounded-full"
        />
      </div>
    )
  }

  return (
    <div
      className={`
        ${dim} rounded-full flex-shrink-0 flex items-center justify-center font-black
        bg-gradient-to-tr from-amber-500 to-amber-300 text-white shadow-inner
        ring-2 ring-amber-400/40 select-none
        ${className}
      `}
    >
      {initial}
    </div>
  )
}
