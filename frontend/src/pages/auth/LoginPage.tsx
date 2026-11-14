import { AlertCircle, ArrowRight, Eye, EyeOff, Factory, KeyRound, LockKeyhole, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { defaultPathForRole } from '../../config/access'

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
  const location = useLocation()
  const state = location.state as LocationState | null

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
    return <Navigate to={user ? defaultPathForRole(user.role) : '/'} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await login(identifier, password)
      if (!result.ok) {
        setError(result.error ?? 'Login gagal. Coba lagi.')
        return
      }
      if (result.needsWorkArea) return
      navigate(
        state?.from && state.from !== '/login' && state.from !== '/'
          ? state.from
          : result.destination ?? '/',
        { replace: true },
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleWorkAreaSelect = (id: string) => {
    const area = pendingWorkAreas.find((item) => item.id === id)
    if (!selectWorkArea(id)) {
      setError('Area kerja tidak valid. Silakan login kembali.')
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
              placeholder="Masukkan username"
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
              placeholder="Masukkan password"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="input-wrap__action"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
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
            Ingat perangkat ini
          </label>
          <button
            type="button"
            className="auth-link auth-link--button"
            onClick={() => setShowForgot(true)}
          >
            Lupa password?
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
          {submitting ? 'Menghubungkan…' : 'Login'}
        </Button>
      </form>

      <p className="auth-note">WPC · Authorized Personnel Only</p>

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
              <h3 id="work-area-title">Pilih area kerja</h3>
              <p>Pilih area produksi yang akan dikerjakan. Kamu bisa berpindah area dari top bar setelah masuk.</p>
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
                Kembali ke login
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
              <h3 id="forgot-password-title">Lupa password?</h3>
              <p>
                Silakan hubungi Admin untuk melakukan reset password. Sertakan username kamu saat menghubungi Admin.
              </p>
              <Button variant="primary" block onClick={() => setShowForgot(false)}>
                Mengerti
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </AuthLayout>
  )
}
