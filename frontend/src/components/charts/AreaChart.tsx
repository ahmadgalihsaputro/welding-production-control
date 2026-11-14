import { useId, useRef, useState, type PointerEvent } from 'react'
import type { ChartSeries } from '../../types'
import { cn, formatNumber } from '../../lib/utils'
import {
  axisTicks,
  clampIndex,
  formatAxisValue,
  niceMax,
  smoothPath,
  type Point,
} from './chartUtils'

interface AreaChartProps {
  labels: string[]
  series: ChartSeries[]
  height?: number
  showLegend?: boolean
  formatValue?: (value: number) => string
  className?: string
  ariaLabel?: string
}

const VIEW_WIDTH = 800

export function AreaChart({
  labels,
  series,
  height = 268,
  showLegend = true,
  formatValue = (value) => formatNumber(value),
  className,
  ariaLabel = 'Grafik tren',
}: AreaChartProps) {
  const gradientKey = useId().replace(/:/g, '')
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const padding = { top: 18, right: 14, bottom: 26, left: 46 }
  const plotWidth = VIEW_WIDTH - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const allValues = series.flatMap((item) => item.values)
  const maxValue = niceMax(Math.max(...allValues, 1))
  const ticks = axisTicks(maxValue, 4)

  const xAt = (index: number) =>
    padding.left + (index / Math.max(labels.length - 1, 1)) * plotWidth
  const yAt = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight

  const labelStep = labels.length > 8 ? Math.ceil(labels.length / 8) : 1

  const handleMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const relativeX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    const ratio = (relativeX - padding.left) / plotWidth
    setHoverIndex(clampIndex(Math.round(ratio * (labels.length - 1)), labels.length))
  }

  const tooltipTop =
    hoverIndex !== null
      ? (Math.min(...series.map((item) => yAt(item.values[hoverIndex] ?? 0))) / height) * 100
      : 0
  const tooltipLeft =
    hoverIndex !== null ? (xAt(hoverIndex) / VIEW_WIDTH) * 100 : 0

  return (
    <div className={cn('chart', className)}>
      <div className="chart-canvas" ref={containerRef}>
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
          onPointerDown={handleMove}
        >
          <defs>
            {series.map((item, index) => (
              <linearGradient
                key={item.name}
                id={`${gradientKey}-${index}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={item.color} stopOpacity="0.3" />
                <stop offset="65%" stopColor={item.color} stopOpacity="0.06" />
                <stop offset="100%" stopColor={item.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((tick) => {
            const y = yAt(tick)
            return (
              <g key={tick}>
                <line
                  className="chart-grid-line"
                  x1={padding.left}
                  x2={VIEW_WIDTH - padding.right}
                  y1={y}
                  y2={y}
                />
                <text x={padding.left - 10} y={y + 3.5} textAnchor="end">
                  {formatAxisValue(tick)}
                </text>
              </g>
            )
          })}

          {labels.map((label, index) =>
            index % labelStep === 0 || index === labels.length - 1 ? (
              <text
                key={`${label}-${index}`}
                x={xAt(index)}
                y={height - 6}
                textAnchor={
                  index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'
                }
              >
                {label}
              </text>
            ) : null,
          )}

          {series.map((item, seriesIndex) => {
            const points: Point[] = item.values.map((value, index) => ({
              x: xAt(index),
              y: yAt(value),
            }))
            const line = smoothPath(points)
            const area = `${line} L ${xAt(labels.length - 1)} ${
              padding.top + plotHeight
            } L ${xAt(0)} ${padding.top + plotHeight} Z`

            return (
              <g key={item.name}>
                {item.area !== false && (
                  <path d={area} fill={`url(#${gradientKey}-${seriesIndex})`} />
                )}
                <path
                  d={line}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={item.dashed ? 1.7 : 2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={item.dashed ? '5 5' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
                {points.length > 0 && item.area !== false && (
                  <circle
                    cx={points[points.length - 1].x}
                    cy={points[points.length - 1].y}
                    r={3}
                    fill={item.color}
                    stroke="var(--glass-bg-strong)"
                    strokeWidth={1.5}
                  />
                )}
              </g>
            )
          })}

          {hoverIndex !== null && (
            <g>
              <line
                x1={xAt(hoverIndex)}
                x2={xAt(hoverIndex)}
                y1={padding.top}
                y2={padding.top + plotHeight}
                stroke="var(--accent)"
                strokeWidth={1}
                strokeDasharray="3 4"
                opacity={0.55}
              />
              {series.map((item) => (
                <circle
                  key={item.name}
                  cx={xAt(hoverIndex)}
                  cy={yAt(item.values[hoverIndex] ?? 0)}
                  r={3.8}
                  fill={item.color}
                  stroke="var(--glass-bg-strong)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>

        {hoverIndex !== null && (
          <div
            className="chart-tooltip"
            style={{
              left: `${Math.min(Math.max(tooltipLeft, 12), 88)}%`,
              top: `${Math.max(tooltipTop, 16)}%`,
            }}
          >
            <div className="chart-tooltip__label">{labels[hoverIndex]}</div>
            {series.map((item) => (
              <div className="chart-tooltip__row" key={item.name}>
                <span className="chart-tooltip__key">
                  <span
                    className="chart-tooltip__dot"
                    style={{ background: item.color }}
                  />
                  {item.name}
                </span>
                <strong>{formatValue(item.values[hoverIndex] ?? 0)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLegend && (
        <div className="chart-legend">
          {series.map((item) => (
            <span className="legend-item" key={item.name}>
              <span className="legend-swatch" style={{ background: item.color }} />
              {item.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
