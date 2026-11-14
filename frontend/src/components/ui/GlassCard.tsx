import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: 'default' | 'soft' | 'strong'
  interactive?: boolean
}

export function GlassCard({
  children,
  className,
  variant = 'default',
  interactive = false,
  ...rest
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'card',
        variant === 'soft' && 'glass--soft',
        variant === 'strong' && 'glass--strong',
        interactive && 'card--interactive',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
