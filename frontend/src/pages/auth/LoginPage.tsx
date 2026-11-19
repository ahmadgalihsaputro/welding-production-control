import { AlertCircle, ArrowRight, Eye, EyeOff, Factory, KeyRound, LockKeyhole, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { canAccess, defaultPathForRole } from '../../config/access'

interface LocationState {
  from?: string
}

export function LoginPage() {
  const {
    login,
    isAuthenticated,
    user,
    pendingWorkAreas,
    selectWorkArea,
    cancelWorkAreaSelection,
  } = useAuth()
  const navigate = useNavigate()
  const { preferences, t } = usePreferences()
  const location = useLocation()
  const state = location.state as LocationState | null

  const startPageFor = (role: string) =>
    canAccess(preferences.startPage, role as Parameters<typeof canAccess>[1])
      ? preferences.startPage
      : undefined

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  useEffect(() => {
    if (!showForgot) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowForgot(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showForgot])

  if (isAuthenticated) {
    return (
      <Navigate
        to={(user && startPageFor(user.role)) ?? (user ? defaultPathForRole(user.role) : '/')}
        replace
      />
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await login(identifier, password)
      if (!result.ok) {
        setError(result.error ?? t('Login gagal. Coba lagi.', 'Login failed. Please try again.'))
        return
      }
      if (result.needsWorkArea) return
      navigate(
        state?.from && state.from !== '/login' && state.from !== '/'
          ? state.from
          : startPageFor(user?.role ?? '') ?? result.destination ?? '/',
        { replace: true },
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleWorkAreaSelect = (id: string) => {
    const area = pendingWorkAreas.find((item) => item.id === id)
    if (!selectWorkArea(id)) {
      setError(t('Area kerja tidak valid. Silakan login kembali.', 'Invalid work area. Please log in again.'))
      cancelWorkAreaSelection()
      return
    }
    const requestedPath =
      state?.from && state.from !== '/login' && state.from !== '/'
        ? state.from
        : undefined
    const onAssyProduction = requestedPath?.startsWith('/production/assy')
    const onSubAssyProduction =
      requestedPath === '/production/queue' ||
      requestedPath?.startsWith('/production/sub-assy')
    const areaQueue =
      area?.type === 'Sub Assy' ? '/production/queue' : '/production/assy-queue'
    const target =
      (onAssyProduction && area?.type !== 'Assy') ||
      (onSubAssyProduction && area?.type !== 'Sub Assy')
        ? areaQueue
        : requestedPath ?? areaQueue
    navigate(target, { replace: true })
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && (
          <div className="auth-alert" role="alert">
            <AlertCircle size={15} style={{ flex: 'none', marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="identifier">
            Username
          </label>
          <div className="input-wrap">
            <UserRound size={16} className="input-wrap__icon" />
            <input
              id="identifier"
              className="input"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={t('Masukkan username', 'Enter username')}
              autoComplete="username"
              autoFocus
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <div className="input-wrap">
            <LockKeyhole size={16} className="input-wrap__icon" />
            <input
              id="password"
              className="input has-action"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('Masukkan password', 'Enter password')}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="input-wrap__action"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? t('Sembunyikan password', 'Hide password') : t('Tampilkan password', 'Show password')}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="auth-row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            {t('Ingat perangkat ini', 'Remember this device')}
          </label>
          <button
            type="button"
            className="auth-link auth-link--button"
            onClick={() => setShowForgot(true)}
          >
            {t('Lupa password?', 'Forgot password?')}
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          disabled={submitting}
          rightIcon={<ArrowRight size={16} />}
        >
          {submitting ? t('Menghubungkan…', 'Connecting…') : t('Login', 'Log In')}
        </Button>
      </form>

      <p className="auth-note">PT. Auto Aska Indonesia</p>

      {pendingWorkAreas.length > 0 &&
        createPortal(
          <div className="auth-popup-backdrop" role="presentation">
            <section
              className="auth-popup card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="work-area-title"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="auth-popup__icon">
                <Factory size={22} />
              </span>
              <h3 id="work-area-title">{t('Pilih area kerja', 'Select work area')}</h3>
              <p>{t('Pilih area produksi yang akan dikerjakan. Kamu bisa berpindah area dari top bar setelah masuk.', 'Select the production area to work in. You can switch areas from the top bar after signing in.')}</p>
              <div className="stack-sm">
                {pendingWorkAreas.map((area) => (
                  <Button
                    key={area.id}
                    variant="secondary"
                    block
                    onClick={() => handleWorkAreaSelect(area.id)}
                  >
                    {area.label}
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                block
                style={{ marginTop: 8 }}
                onClick={cancelWorkAreaSelection}
              >
                {t('Kembali ke login', 'Back to login')}
              </Button>
            </section>
          </div>,
          document.body,
        )}

      {showForgot &&
        createPortal(
          <div
            className="auth-popup-backdrop"
            onClick={() => setShowForgot(false)}
            role="presentation"
          >
            <div
              className="auth-popup card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="forgot-password-title"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="auth-popup__icon">
                <KeyRound size={22} />
              </span>
              <h3 id="forgot-password-title">{t('Lupa password?', 'Forgot password?')}</h3>
              <p>
                {t('Silakan hubungi Admin untuk melakukan reset password. Sertakan username kamu saat menghubungi Admin.', 'Please contact the Admin to reset your password. Include your username when contacting the Admin.')}
              </p>
              <Button variant="primary" block onClick={() => setShowForgot(false)}>
                {t('Mengerti', 'Got It')}
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </AuthLayout>
  )
}
