import type { ReactNode } from 'react'
import type { Tone } from '../../types'
import { cn } from '../../lib/utils'

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  dot?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function Badge({ children, tone = 'neutral', dot = false, size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'badge',
        `badge--${tone}`,
        dot && 'badge-dot',
        size === 'md' && 'badge--lg',
        className,
      )}
    >
      {children}
    </span>
  )
}
