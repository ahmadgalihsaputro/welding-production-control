import { AlertTriangle, Info, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface CalloutProps {
  children: ReactNode
  tone?: 'info' | 'warning' | 'success' | 'danger'
  title?: string
  className?: string
  style?: CSSProperties
}

const icons = {
  info: Info,
  warning: AlertTriangle,
  success: ShieldCheck,
  danger: ShieldAlert,
}

export function Callout({ children, tone = 'info', title, className, style }: CalloutProps) {
  const Icon = icons[tone]
  return (
    <div className={cn('callout', `callout--${tone}`, className)} style={style} role={tone === 'danger' ? 'alert' : undefined}>
      <div className="callout__icon">
        <Icon size={15} />
      </div>
      <div className="callout__copy">
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  )
}
