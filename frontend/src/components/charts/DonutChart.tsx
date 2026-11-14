import { cn, formatNumber } from '../../lib/utils'

export interface DonutSegment {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  data: DonutSegment[]
  size?: number
  thickness?: number
  centerValue?: string
  centerLabel?: string
  showLegend?: boolean
  className?: string
}

const RADIUS = 82
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function DonutChart({
  data,
  size = 180,
  thickness = 17,
  centerValue,
  centerLabel,
  showLegend = true,
  className,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1
  const gap = 4
  let accumulated = 0

  return (
    <div className={cn('donut-block', className)}>
      <div className="donut-wrap" style={{ width: size, height: size }}>
        <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            stroke="var(--inset-bg-strong)"
            strokeWidth={thickness}
          />
          {data.map((item) => {
            const fraction = item.value / total
            const segment = Math.max(fraction * CIRCUMFERENCE - gap, 0)
            const dashOffset = -accumulated * CIRCUMFERENCE
            accumulated += fraction
            return (
              <circle
                key={item.label}
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke={item.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${segment} ${CIRCUMFERENCE - segment}`}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 100 100)"
              />
            )
          })}
        </svg>
        <div className="donut-center">
          <strong>{centerValue ?? formatNumber(total)}</strong>
          {centerLabel && <span>{centerLabel}</span>}
        </div>
      </div>

      {showLegend && (
        <div className="donut-legend">
          {data.map((item) => (
            <div className="donut-legend__row" key={item.label}>
              <span className="donut-legend__key">
                <span className="legend-swatch" style={{ background: item.color }} />
                {item.label}
              </span>
              <strong>{formatNumber(item.value)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
