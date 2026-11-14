import { cn } from '../../lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cn('switch', checked && 'is-on')}
      onClick={() => onChange(!checked)}
    />
  )
}
