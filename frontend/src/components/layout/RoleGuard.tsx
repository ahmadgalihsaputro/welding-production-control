import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { rolesForPath } from '../../config/access'
import { Button } from '../ui/Button'

export function RoleGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { t } = usePreferences()
  const location = useLocation()

  if (!user) return null

  const allowed = rolesForPath(location.pathname)
  if (!allowed.includes(user.role)) {
    return (
      <div className="state-page">
        <div className="state-card card">
          <div className="state-card__icon">
            <ShieldAlert size={26} />
          </div>
          <h1>{t('Akses dibatasi', 'Access restricted')}</h1>
          <p>
            {t('Role', 'Role')} <strong>{user.roleLabel}</strong>{' '}
            {t(
              'tidak memiliki izin untuk membuka halaman ini. Hubungi Leader atau Administrator jika akses memang dibutuhkan.',
              'does not have permission to open this page. Contact a Leader or Administrator if access is required.',
            )}
          </p>
          <Link to="/">
            <Button variant="primary">{t('Kembali ke Dashboard', 'Back to Dashboard')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
