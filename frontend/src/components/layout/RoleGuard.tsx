import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { rolesForPath } from '../../config/access'
import { Button } from '../ui/Button'

export function RoleGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth()
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
          <h1>Akses dibatasi</h1>
          <p>
            Role <strong>{user.roleLabel}</strong> tidak memiliki izin untuk membuka halaman
            ini. Hubungi Leader atau Administrator jika akses memang dibutuhkan.
          </p>
          <Link to="/">
            <Button variant="primary">Kembali ke Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
