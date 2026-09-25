interface BBCCLogoProps {
  /** 'sm' = 32px · 'md' = 44px · 'lg' = 64px */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: { outer: 'w-8 h-8',  text: 'text-[8px]',  ring: 'ring-[2px]' },
  md: { outer: 'w-11 h-11', text: 'text-[11px]', ring: 'ring-[2.5px]' },
  lg: { outer: 'w-16 h-16', text: 'text-base',   ring: 'ring-[3px]' },
}

/**
 * BBCC Logo — black circle with amber ring and stacked "BB / CC" text.
 * Matches the official branding shown in the design assets.
 */
export default function BBCCLogo({ size = 'md', className = '' }: BBCCLogoProps) {
  const s = sizeMap[size]
  return (
    <div
      className={`
        ${s.outer} rounded-full bg-gray-950
        ring-amber-500 ${s.ring}
        flex items-center justify-center flex-shrink-0
        ${className}
      `}
    >
      <span
        className={`
          ${s.text} font-black text-white leading-none
          tracking-tight text-center
        `}
        style={{ fontFamily: 'inherit' }}
      >
        BB
        <br />
        CC
      </span>
    </div>
  )
}
