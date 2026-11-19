import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'

interface ConnectionIndicatorProps {
  /** Optional className override */
  className?: string
}

/**
 * Connection indicator that shows backend connectivity status.
 * Green = connected, Red = disconnected/no response.
 * Only visible to admin role.
 */
export function ConnectionIndicator({ className }: ConnectionIndicatorProps = {}) {
  const { user } = useAuth()
  const { t } = usePreferences()
  const [isConnected, setIsConnected] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Only admin can see this indicator
    if (user?.role !== 'admin') {
      setIsChecking(false)
      return
    }

    let mounted = true
    let abortCtrl: AbortController | null = null

    const checkConnection = async () => {
      if (!mounted) return

      const abort = new AbortController()
      abortCtrl = abort

      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          signal: abort.signal,
        })

        if (mounted) {
          if (response.ok) {
            setIsConnected(true)
          } else {
            setIsConnected(false)
          }
        }
      } catch (error) {
        if (mounted) {
          // Backend not reachable or request aborted
          setIsConnected(false)
        }
      } finally {
        if (mounted) {
          // Schedule next check in 30 seconds
          const timer = setTimeout(checkConnection, 30000)
          // Cleanup on unmount
          return () => {
            mounted = false
            clearTimeout(timer)
          }
        }
      }
    }

    // Initial check
    checkConnection()

    // Cleanup on component unmount
    return () => {
      mounted = false
      if (abortCtrl) {
        abortCtrl.abort()
      }
    }
  }, [user?.role])

  // Show only for admin; for other roles, hide completely
  if (user?.role !== 'admin') {
    return null
  }

  const label = isConnected
    ? t('Backend Terhubung', 'Backend connected')
    : t('Backend Tidak Tersedia', 'Backend unavailable')
  const classes = [
    'connection-indicator',
    className,
    isConnected ? 'is-online' : 'is-offline',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      role="status"
      aria-live="polite"
      aria-label={label}
      title={label}
    >
      <span className="indicator-dot" aria-hidden="true" />
    </div>
  )
}
