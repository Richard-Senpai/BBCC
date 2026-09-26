import Image from 'next/image'

interface BBCCLogoProps {
  /** 'sm' = 32px · 'md' = 40px · 'lg' = 56px · 'xl' = 80px */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: { dim: 32, class: 'w-8 h-8' },
  md: { dim: 40, class: 'w-10 h-10' },
  lg: { dim: 56, class: 'w-14 h-14' },
  xl: { dim: 80, class: 'w-20 h-20' },
}

/**
 * BBCC Logo — Official golden wax seal with concentric rings and BBCC monogram.
 */
export default function BBCCLogo({ size = 'md', className = '' }: BBCCLogoProps) {
  const s = sizeMap[size]
  return (
    <div className={`relative ${s.class} shrink-0 select-none ${className}`}>
      <Image
        src="/logo.png"
        alt="BBCC Logo"
        width={s.dim}
        height={s.dim}
        priority={size === 'lg' || size === 'xl'}
        className="w-full h-full object-contain drop-shadow-xs"
      />
    </div>
  )
}
