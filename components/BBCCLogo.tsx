interface BBCCLogoProps {
  /** 'sm' = 32px · 'md' = 44px · 'lg' = 64px */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: { outer: 'w-8 h-8',  text: 'text-[8px]',  ring: 'ring-[1.5px]' },
  md: { outer: 'w-10 h-10', text: 'text-[10px]', ring: 'ring-[2px]' },
  lg: { outer: 'w-14 h-14', text: 'text-sm',    ring: 'ring-[2.5px]' },
}

/**
 * BBCC Logo — clean black disc with warm ochre flame ring and stacked "BB / CC" text.
 */
export default function BBCCLogo({ size = 'md', className = '' }: BBCCLogoProps) {
  const s = sizeMap[size]
  return (
    <div
      className={`
        ${s.outer} rounded-full bg-[#151618]
        ring-[var(--flame-accent)] ${s.ring}
        flex items-center justify-center shrink-0
        shadow-xs
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
