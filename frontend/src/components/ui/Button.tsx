import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'sky' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  loading?: boolean
  block?: boolean
}

export function Button({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading = false,
  block = false,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        block && 'btn-block',
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle size={15} className="spin" /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  )
}
