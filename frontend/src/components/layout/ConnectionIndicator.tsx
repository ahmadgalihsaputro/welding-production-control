import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'

interface ConnectionIndicatorProps {
  className?: string
  showLabel?: boolean
}

/** Status koneksi backend nyata; tampil untuk semua peran yang sudah login. */
export function ConnectionIndicator({ className, showLabel = false }: ConnectionIndicatorProps = {}) {
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
  const classes = [
    'connection-indicator',
    className,
    showLabel && 'connection-indicator--labeled',
    isChecking ? 'is-checking' : isConnected ? 'is-online' : 'is-offline',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} role="status" aria-live="polite" aria-label={label} title={label}>
      <span className="indicator-dot" aria-hidden="true" />
      {showLabel && (
        <span className="connection-indicator__copy">
          <strong>{t('Sistem', 'System')}</strong>
          <span>{label}</span>
        </span>
      )}
    </div>
  )
}
