import type { ReactNode } from 'react'
import { BrandMark } from '../brand/Logo'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-shell auth-shell--simple">
      <section className="auth-panel">
        <div className="auth-card glass glass--strong">
          <div className="auth-card__brand auth-card__brand--stack">
            <BrandMark size="lg" />
            <strong>WPC</strong>
            <span>Welding Production Control</span>
          </div>
          {children}
        </div>
      </section>
    </div>
  )
}
