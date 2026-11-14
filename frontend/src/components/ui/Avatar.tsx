import { cn } from '../../lib/utils'

interface AvatarProps {
  initials: string
  name?: string
  tone?: 'orange' | 'sky'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Avatar({ initials, name, tone = 'sky', size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'avatar',
        tone === 'orange' && 'avatar--orange',
        size === 'sm' && 'avatar--sm',
        size === 'lg' && 'avatar--lg',
        size === 'xl' && 'avatar--xl',
        className,
      )}
      title={name}
      aria-label={name}
    >
      {initials}
    </span>
  )
}
