import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'

/** Status koneksi backend nyata; tampil sekali di topbar untuk semua peran yang login. */
export function ConnectionIndicator() {
  const { user } = useAuth()
  const { t } = usePreferences()
  const [isConnected, setIsConnected] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!user) {
      setIsChecking(false)
      return
    }

    let mounted = true
    let timer: number | undefined

    const checkConnection = async () => {
      try {
        const response = await fetch('/api/health', { credentials: 'include' })
        if (mounted) setIsConnected(response.ok)
      } catch {
        if (mounted) setIsConnected(false)
      } finally {
        if (mounted) {
          setIsChecking(false)
          timer = window.setTimeout(() => void checkConnection(), 30_000)
        }
      }
    }

    void checkConnection()
    return () => {
      mounted = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [user])

  const label = isChecking
    ? t('Memeriksa koneksi', 'Checking connection')
    : isConnected
      ? t('Backend Terhubung', 'Backend connected')
      : t('Backend Tidak Tersedia', 'Backend unavailable')
  const status = isChecking ? 'is-checking' : isConnected ? 'is-online' : 'is-offline'

  return (
    <div className={`connection-indicator ${status}`} role="status" aria-live="polite" aria-label={label} title={label}>
      <span className="indicator-dot" aria-hidden="true" />
    </div>
  )
}
