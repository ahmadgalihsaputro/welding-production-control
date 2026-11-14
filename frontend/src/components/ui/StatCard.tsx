import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Sparkline } from '../charts/Sparkline'

type StatTone = 'orange' | 'sky' | 'green' | 'red' | 'amber'

interface Trend {
  label: string
  direction: 'up' | 'down' | 'flat'
  positive?: boolean
}

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  tone?: StatTone
  suffix?: string
  trend?: Trend
  note?: string
  spark?: number[]
  sparkColor?: string
  className?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'orange',
  suffix,
  trend,
  note,
  spark,
  sparkColor,
  className,
}: StatCardProps) {
  const TrendIcon =
    trend?.direction === 'down' ? ArrowDownRight : trend?.direction === 'flat' ? Minus : ArrowUpRight

  return (
    <div className={cn('card stat-card', className)}>
      <div className="stat-top">
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">
            {value}
            {suffix && <small>{suffix}</small>}
          </div>
        </div>
        <div className={`stat-icon stat-icon--${tone}`}>
          <Icon size={19} strokeWidth={2} />
        </div>
      </div>

      <div className="stat-foot">
        <div className="row row--wrap" style={{ gap: 6 }}>
          {trend && (
            <span
              className={cn(
                'stat-delta',
                trend.direction === 'flat' && 'is-flat',
                trend.direction !== 'flat' && trend.positive === false && 'is-down',
              )}
            >
              <TrendIcon size={12} />
              {trend.label}
            </span>
          )}
          {note && <span className="stat-note">{note}</span>}
        </div>
        {spark && spark.length > 1 && (
          <Sparkline values={spark} color={sparkColor ?? '#f97316'} />
        )}
      </div>
    </div>
  )
}
