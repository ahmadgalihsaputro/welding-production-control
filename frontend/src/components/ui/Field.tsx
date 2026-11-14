import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, hint, action, children, className }: FieldProps) {
  return (
    <div className={className ? `field ${className}` : 'field'}>
      <div className="field-label">
        <label htmlFor={htmlFor}>{label}</label>
        {action}
      </div>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}
