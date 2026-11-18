import {
  AlertTriangle,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  LogOut,
  Monitor,
  Save,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Toggle } from '../../components/ui/Toggle'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../lib/api'
import { describeApiError } from '../../lib/api'

export function SecurityPage() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [twoFactor, setTwoFactor] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [changing, setChanging] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const validatePassword = () => {
    if (!current || !next || !confirm) {
      setError('Semua field password wajib diisi.')
      return false
    }
    if (next.length < 8) {
      setError('Password baru minimal 8 karakter.')
      return false
    }
    if (next !== confirm) {
      setError('Konfirmasi password tidak sama.')
      return false
    }
    return true
  }

  const requestChange = () => {
    if (!validatePassword()) return
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setShowConfirm(false)
    setChanging(true)
    setError('')
    try {
      await api.patch('/auth/change-password', {
        currentPassword: current,
        newPassword: next,
      })
      setCurrent('')
      setNext('')
      setConfirm('')
      setMessage('Password berhasil diubah. Sesi lain akan diminta login ulang.')
      setTimeout(() => setMessage(''), 5000)
    } catch (err) {
      setError(describeApiError(err, 'Gagal mengubah password.'))
    } finally {
      setChanging(false)
    }
  }

  const handleCancel = () => {
    setShowConfirm(false)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Settings"
        title="Security"
        subtitle="Kelola password, autentikasi dua faktor, dan sesi perangkat yang memiliki akses ke akun Anda."
        meta={
          <>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> Akun aman
            </span>
            <span className="page-meta__item">
              <LockKeyhole size={12} /> Password policy aktif
            </span>
          </>
        }
      />

      {message && <Callout tone="success">{message}</Callout>}
      {error && (
        <Callout tone="warning" title="Periksa kembali">
          {error}
        </Callout>
      )}

      <div className="kpi-grid kpi-grid--3">
        <StatCard label="Password terakhir diubah" value="15 hari" suffix="lalu" icon={KeyRound} tone="orange" note="28 Okt 2026" />
        <StatCard label="Autentikasi 2FA" value={twoFactor ? 'Aktif' : 'Nonaktif'} icon={Fingerprint} tone={twoFactor ? 'green' : 'amber'} note="Authenticator app" />
        <StatCard label="Sesi aktif" value="2" suffix="sesi" icon={Monitor} tone="sky" note="1 desktop, 1 tablet" />
      </div>

      <div className="report-split">
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Ubah password</h3>
              <p>Gunakan minimal 8 karakter dengan huruf dan angka.</p>
            </div>
            <div className="form-grid">
              <Field label="Password saat ini" htmlFor="sec-current" className="span-2">
                <input
                  id="sec-current"
                  type="password"
                  className="input"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  autoComplete="current-password"
                  disabled={changing}
                />
              </Field>
              <Field label="Password baru" htmlFor="sec-new">
                <input
                  id="sec-new"
                  type="password"
                  className="input"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                  autoComplete="new-password"
                  disabled={changing}
                />
              </Field>
              <Field label="Konfirmasi password" htmlFor="sec-confirm">
                <input
                  id="sec-confirm"
                  type="password"
                  className="input"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  disabled={changing}
                />
              </Field>
            </div>
            <div className="form-actions">
              <Button variant="primary" leftIcon={<Save size={15} />} loading={changing} onClick={requestChange}>
                Ubah password
              </Button>
            </div>
          </section>

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Sesi perangkat</h3>
              <p>Cabut akses perangkat yang tidak dikenal.</p>
            </div>
            <div className="movement-list">
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                  <Monitor size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Chrome · Linux</strong>
                  <span>Sesi ini · 192.168.10.24 · sekarang</span>
                </div>
                <Badge tone="success">Current</Badge>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--sky-soft)', color: 'var(--sky-deep)' }}>
                  <Smartphone size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Tablet Assy Line 01</strong>
                  <span>192.168.10.51 · 2 jam lalu</span>
                </div>
                <Button size="sm" variant="ghost" leftIcon={<LogOut size={12} />}>
                  Revoke
                </Button>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                  <Smartphone size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Chrome · Android</strong>
                  <span>10.20.4.18 · kemarin 16:20</span>
                </div>
                <Button size="sm" variant="ghost" leftIcon={<LogOut size={12} />}>
                  Revoke
                </Button>
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Autentikasi dua faktor</h3>
              <p>Lapisan keamanan tambahan saat login.</p>
            </div>
            <div className="switch-row">
              <div className="switch-copy">
                <strong>Authenticator app</strong>
                <span>Gunakan Google Authenticator / Microsoft Authenticator.</span>
              </div>
              <Toggle checked={twoFactor} onChange={setTwoFactor} label="Autentikasi dua faktor" />
            </div>
            <div className="glass-inset" style={{ padding: 14, marginTop: 12 }}>
              <div className="row row--between">
                <span className="info-label">Status 2FA</span>
                <Badge tone={twoFactor ? 'success' : 'warning'}>{twoFactor ? 'Aktif' : 'Belum aktif'}</Badge>
              </div>
              <p className="muted small" style={{ marginTop: 6 }}>
                {twoFactor
                  ? 'Kode 6 digit diminta setiap login dari perangkat baru.'
                  : 'Aktifkan untuk mengurangi risiko akses tidak sah.'}
              </p>
            </div>
          </section>

          <section className="card settings-card danger-zone">
            <div className="settings-card__head">
              <h3 className="row" style={{ gap: 6 }}>
                <AlertTriangle size={15} /> Danger zone
              </h3>
              <p>Tindakan berikut tidak dapat dibatalkan.</p>
            </div>
            <p className="muted small" style={{ lineHeight: 1.6 }}>
              Logout dari semua perangkat akan mengakhiri seluruh sesi aktif, termasuk tablet
              produksi yang sedang digunakan.
            </p>
            {user && (
              <div className="pickup-line" style={{ marginTop: 10 }}>
                <span>Akun</span>
                <strong>{user.employeeId} · {user.username}</strong>
              </div>
            )}
            <div className="form-actions">
              <Button variant="danger" leftIcon={<LogOut size={14} />}>
                Logout semua perangkat
              </Button>
            </div>
          </section>

          <Callout tone="warning" title="Kebijakan password">
            Password akan kedaluwarsa setiap 90 hari. Sistem menolak 5 password terakhir yang
            pernah digunakan.
          </Callout>
        </div>
      </div>

      {showConfirm && (
        <Callout tone="info" title="Konfirmasi Perubahan" style={{ position: 'fixed', bottom: 24, right: 24, maxWidth: 420, zIndex: 100 }}>
          <p>Yakin ingin mengubah password? Sesi lain akan logout otomatis.</p>
          <div className="form-actions">
            <Button variant="secondary" onClick={handleCancel}>Batalkan</Button>
            <Button variant="primary" onClick={handleConfirm} loading={changing}>Ubah</Button>
          </div>
        </Callout>
      )}
    </div>
  )
}