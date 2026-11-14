import { clamp, cn } from '../../lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  tone?: 'gradient' | 'orange' | 'sky' | 'green'
  thin?: boolean
  thick?: boolean
  className?: string
  label?: string
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'gradient',
  thin,
  thick,
  className,
  label,
}: ProgressBarProps) {
  const percent = clamp((value / (max || 1)) * 100)

  return (
    <div
      className={cn(
        'progress',
        tone === 'orange' && 'progress--orange',
        tone === 'sky' && 'progress--sky',
        tone === 'green' && 'progress--green',
        thin && 'progress--thin',
        thick && 'progress--thick',
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span className="progress__fill" style={{ width: `${percent}%` }} />
    </div>
  )
}
