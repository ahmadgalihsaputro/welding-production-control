import { useId } from 'react'
import { smoothPath, type Point } from './chartUtils'

interface SparklineProps {
  values: number[]
  color?: string
  width?: number
  height?: number
  className?: string
}

export function Sparkline({
  values,
  color = '#f97316',
  width = 88,
  height = 30,
  className,
}: SparklineProps) {
  const gradientId = `spark-${useId().replace(/:/g, '')}`
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const padding = 2

  const points: Point[] = values.map((value, index) => ({
    x: padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2),
    y: height - padding - ((value - min) / range) * (height - padding * 2),
  }))

  const line = smoothPath(points)
  const area = `${line} L ${width - padding} ${height} L ${padding} ${height} Z`

  return (
    <svg
      className={className ? `stat-spark ${className}` : 'stat-spark'}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="2"
          fill={color}
        />
      )}
    </svg>
  )
}
