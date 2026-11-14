import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Cari…',
  className,
  id,
}: SearchInputProps) {
  return (
    <div className={cn('input-wrap', className)}>
      <Search size={15} className="input-wrap__icon" />
      <input
        id={id}
        type="search"
        className={cn('input', value && 'has-action')}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className="input-wrap__action"
          onClick={() => onChange('')}
          aria-label="Hapus pencarian"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
