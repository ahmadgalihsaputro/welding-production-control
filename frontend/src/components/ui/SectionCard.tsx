import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface SectionCardProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <section className={cn('card section-card', className)}>
      <div className="section-head">
        <div>
          <h2 className="section-title">
            {Icon && <Icon size={16} strokeWidth={2} />}
            {title}
          </h2>
          {subtitle && <p className="section-sub">{subtitle}</p>}
        </div>
        {action && <div className="section-actions">{action}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
