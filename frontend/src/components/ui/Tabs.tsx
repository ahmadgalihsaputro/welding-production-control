import { cn } from '../../lib/utils'

export interface TabItem {
  value: string
  label: string
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
  ariaLabel?: string
}

export function Tabs({ items, value, onChange, className, ariaLabel = 'Tabs' }: TabsProps) {
  return (
    <div className={cn('tabs', className)} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className={cn('tab', item.value === value && 'is-active')}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
