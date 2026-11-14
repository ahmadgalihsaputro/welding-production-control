import { useId } from 'react'
import { clamp, cn } from '../../lib/utils'

interface RadialGaugeProps {
  value: number
  size?: number
  thickness?: number
  label?: string
  valueLabel?: string
  className?: string
}

const RADIUS = 82
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function RadialGauge({
  value,
  size = 160,
  thickness = 13,
  label = 'Achievement',
  valueLabel,
  className,
}: RadialGaugeProps) {
  const gradientId = `gauge-${useId().replace(/:/g, '')}`
  const percent = clamp(value)
  const dash = (percent / 100) * CIRCUMFERENCE

  return (
    <div className={cn('gauge-wrap', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="55%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        </defs>
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke="var(--inset-bg-strong)"
          strokeWidth={thickness}
        />
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
          transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="gauge-center">
        <strong>{valueLabel ?? `${percent.toFixed(1).replace('.', ',')}%`}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}
