import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { usePreferences } from '../contexts/PreferencesContext'

export function NotFoundPage() {
  const { t } = usePreferences()
  return (
    <div className="state-page">
      <div className="state-card card">
        <div className="state-card__icon">
          <Compass size={26} />
        </div>
        <h1>{t('Halaman tidak ditemukan', 'Page not found')}</h1>
        <p>
          {t(
            'Alamat yang kamu buka tidak tersedia di WPC. Periksa kembali menu atau kembali ke dashboard untuk melanjutkan pekerjaan.',
            'The address you opened is not available in WPC. Check the menu again or return to the dashboard to continue working.',
          )}
        </p>
        <Link to="/">
          <Button variant="primary">{t('Kembali ke Dashboard', 'Back to Dashboard')}</Button>
        </Link>
      </div>
    </div>
  )
}
