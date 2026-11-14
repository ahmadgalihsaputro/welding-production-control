import { useId, useState, type PointerEvent } from 'react'
import type { ChartSeries } from '../../types'
import { cn, formatNumber } from '../../lib/utils'
import { axisTicks, clampIndex, formatAxisValue, niceMax } from './chartUtils'

interface BarChartProps {
  labels: string[]
  series: ChartSeries[]
  height?: number
  showLegend?: boolean
  formatValue?: (value: number) => string
  className?: string
  ariaLabel?: string
}

const VIEW_WIDTH = 800

export function BarChart({
  labels,
  series,
  height = 260,
  showLegend = true,
  formatValue = (value) => formatNumber(value),
  className,
  ariaLabel = 'Grafik batang',
}: BarChartProps) {
  const gradientKey = useId().replace(/:/g, '')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const padding = { top: 16, right: 12, bottom: 26, left: 46 }
  const plotWidth = VIEW_WIDTH - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const allValues = series.flatMap((item) => item.values)
  const maxValue = niceMax(Math.max(...allValues, 1))
  const ticks = axisTicks(maxValue, 4)

  const groupWidth = plotWidth / Math.max(labels.length, 1)
  const gap = 4
  const barWidth = Math.max(
    5,
    Math.min(22, (groupWidth * 0.62 - gap * (series.length - 1)) / series.length),
  )
  const groupBarsWidth = barWidth * series.length + gap * (series.length - 1)
  const centerAt = (index: number) => padding.left + groupWidth * (index + 0.5)
  const yAt = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight
  const labelStep = labels.length > 8 ? Math.ceil(labels.length / 8) : 1

  const handleMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const relativeX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    const ratio = (relativeX - padding.left) / groupWidth
    setHoverIndex(clampIndex(Math.floor(ratio), labels.length))
  }

  const tooltipTop =
    hoverIndex !== null
      ? (Math.min(...series.map((item) => yAt(item.values[hoverIndex] ?? 0))) / height) * 100
      : 0
  const tooltipLeft = hoverIndex !== null ? (centerAt(hoverIndex) / VIEW_WIDTH) * 100 : 0

  return (
    <div className={cn('chart', className)}>
      <div className="chart-canvas">
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
                <stop offset="0%" stopColor={item.color} stopOpacity="0.95" />
                <stop offset="100%" stopColor={item.color} stopOpacity="0.55" />
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

          {labels.map((label, index) => {
            const center = centerAt(index)
            const isHovered = hoverIndex === index
            return (
              <g key={`${label}-${index}`}>
                {isHovered && (
                  <rect
                    x={center - groupWidth / 2 + 2}
                    y={padding.top}
                    width={groupWidth - 4}
                    height={plotHeight}
                    rx={8}
                    fill="var(--inset-bg)"
                  />
                )}
                {series.map((item, seriesIndex) => {
                  const value = item.values[index] ?? 0
                  const barHeight = Math.max((value / maxValue) * plotHeight, value > 0 ? 2 : 0)
                  const x =
                    center - groupBarsWidth / 2 + seriesIndex * (barWidth + gap)
                  const y = padding.top + plotHeight - barHeight
                  return (
                    <rect
                      key={item.name}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={Math.min(4, barWidth / 2)}
                      fill={`url(#${gradientKey}-${seriesIndex})`}
                      opacity={hoverIndex === null || isHovered ? 1 : 0.55}
                    />
                  )
                })}
                {(index % labelStep === 0 || index === labels.length - 1) && (
                  <text x={center} y={height - 6} textAnchor="middle">
                    {label}
                  </text>
                )}
              </g>
            )
          })}
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
