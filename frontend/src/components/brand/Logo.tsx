import weldingSvg from '../../assets/w_icon_white.svg?raw'

interface IconProps {
  size?: number
  className?: string
}

/**
 * Renders the original white welding icon asset inline.
 */
export function WeldingIcon({ size = 40, className }: IconProps) {
  return (
    <span
      className={className ? `welding-icon ${className}` : 'welding-icon'}
      style={{ width: size, height: size, display: 'inline-flex' }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: weldingSvg }}
    />
  )
}

interface BrandMarkProps {
  size?: 'md' | 'lg'
}

export function BrandMark({ size = 'md' }: BrandMarkProps) {
  return (
    <div className={`brand-mark${size === 'lg' ? ' brand-mark--lg' : ''}`}>
      <WeldingIcon size={size === 'lg' ? 46 : 30} />
    </div>
  )
}

interface BrandLockupProps {
  compact?: boolean
}

export function BrandLockup({ compact = false }: BrandLockupProps) {
  return (
    <div className="brand">
      <BrandMark />
      {!compact && (
        <div className="brand-copy">
          <strong>WPC</strong>
          <span>Welding Production Control</span>
        </div>
      )}
    </div>
  )
}
