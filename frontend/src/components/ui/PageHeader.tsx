import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  meta?: ReactNode
}

export function PageHeader({ eyebrow, title, subtitle, actions, meta }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
        {meta && <div className="page-meta">{meta}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
