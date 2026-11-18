import { LayoutDashboard, Monitor, Moon, Palette, Save, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { Toggle } from '../../components/ui/Toggle'
import { useTheme } from '../../contexts/ThemeContext'

interface Preferences {
  language: string
  density: string
  startPage: string
  sidebarDefault: boolean
  reduceMotion: boolean
}

const STORAGE_KEY = 'wpc.preferences.v1'
const DEFAULT_PREFERENCES: Preferences = {
  language: 'id',
  density: 'comfortable',
  startPage: 'dashboard',
  sidebarDefault: false,
  reduceMotion: false,
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function PreferencesPage() {
  const { theme, setTheme } = useTheme()
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [message, setMessage] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingPrefs, setPendingPrefs] = useState<Preferences | null>(null)

  useEffect(() => {
    setPrefs(loadPreferences())
  }, [])

  const requestSave = (nextPrefs: Preferences) => {
    setPendingPrefs(nextPrefs)
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    if (!pendingPrefs) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingPrefs))
    setPrefs(pendingPrefs)
    setPendingPrefs(null)
    setShowConfirm(false)
    setMessage('Preferensi berhasil disimpan pada perangkat ini.')
    setTimeout(() => setMessage(''), 3000)
  }

  const handleCancel = () => {
    setPendingPrefs(null)
    setShowConfirm(false)
  }

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY)
    setPrefs(DEFAULT_PREFERENCES)
    setMessage('Preferensi direset ke default.')
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Settings"
        title="Application Preferences"
        subtitle="Sesuaikan tampilan dan perilaku aplikasi. Preferensi disimpan pada browser perangkat ini."
        meta={
          <span className="page-meta__item">
            <Palette size={12} /> Tema {theme === 'dark' ? 'gelap' : 'terang'}
          </span>
        }
      />

      {message && <Callout tone="success">{message}</Callout>}

      <div className="report-split">
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Tema tampilan</h3>
              <p>Pilih mode terang atau gelap untuk seluruh aplikasi.</p>
            </div>
            <div className="device-grid">
              <button
                type="button"
                className="device-card"
                style={{
                  textAlign: 'left',
                  border: theme === 'light' ? '1px solid rgba(249, 115, 22, 0.45)' : '1px solid transparent',
                }}
                onClick={() => setTheme('light')}
              >
                <div className="device-card__top">
                  <span className="device-card__icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                    <Sun size={16} />
                  </span>
                  {theme === 'light' && <Badge tone="orange">Aktif</Badge>}
                </div>
                <h3>Light mode</h3>
                <p>Terang, bersih, cocok untuk area produksi.</p>
              </button>
              <button
                type="button"
                className="device-card"
                style={{
                  textAlign: 'left',
                  border: theme === 'dark' ? '1px solid rgba(249, 115, 22, 0.45)' : '1px solid transparent',
                }}
                onClick={() => setTheme('dark')}
              >
                <div className="device-card__top">
                  <span className="device-card__icon">
                    <Moon size={16} />
                  </span>
                  {theme === 'dark' && <Badge tone="orange">Aktif</Badge>}
                </div>
                <h3>Dark mode</h3>
                <p>Nyaman untuk shift malam dan ruang redup.</p>
              </button>
            </div>
          </section>

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Bahasa & format</h3>
              <p>Format angka mengikuti locale Indonesia.</p>
            </div>
            <div className="form-grid">
              <Field label="Bahasa" htmlFor="pref-language">
                <select
                  id="pref-language"
                  className="select"
                  value={prefs.language}
                  onChange={(event) => requestSave({ ...prefs, language: event.target.value })}
                >
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label="Format tanggal" htmlFor="pref-date">
                <select id="pref-date" className="select" defaultValue="ddmmyyyy">
                  <option value="ddmmyyyy">12 November 2026</option>
                  <option value="numeric">12/11/2026</option>
                  <option value="iso">2026-11-12</option>
                </select>
              </Field>
              <Field label="Zona waktu" htmlFor="pref-timezone">
                <select id="pref-timezone" className="select" defaultValue="wib">
                  <option value="wib">WIB (GMT+7)</option>
                  <option value="wita">WITA (GMT+8)</option>
                  <option value="wit">WIT (GMT+9)</option>
                </select>
              </Field>
              <Field label="Density tabel" htmlFor="pref-density">
                <select
                  id="pref-density"
                  className="select"
                  value={prefs.density}
                  onChange={(event) => requestSave({ ...prefs, density: event.target.value })}
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                  <option value="spacious">Spacious</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Perilaku aplikasi</h3>
              <p>Preferensi navigasi dan animasi.</p>
            </div>
            <div className="switch-row">
              <div className="switch-copy">
                <strong>Sidebar terbuka saat login</strong>
                <span>Tampilkan sidebar dalam kondisi expanded.</span>
              </div>
              <Toggle
                checked={prefs.sidebarDefault}
                onChange={(value) => requestSave({ ...prefs, sidebarDefault: value })}
                label="Sidebar terbuka saat login"
              />
            </div>
            <div className="switch-row">
              <div className="switch-copy">
                <strong>Kurangi animasi</strong>
                <span>Matikan transisi non-esensial pada perangkat lambat.</span>
              </div>
              <Toggle
                checked={prefs.reduceMotion}
                onChange={(value) => requestSave({ ...prefs, reduceMotion: value })}
                label="Kurangi animasi"
              />
            </div>
            <Field label="Halaman awal setelah login" htmlFor="pref-start">
              <select
                id="pref-start"
                className="select"
                value={prefs.startPage}
                onChange={(event) => requestSave({ ...prefs, startPage: event.target.value })}
              >
                <option value="dashboard">Dashboard</option>
                <option value="schedule">Jadwal Produksi</option>
                <option value="queue">Antrian Sub Assy</option>
                <option value="stock">Stock Overview</option>
              </select>
            </Field>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={handleReset}>Reset default</Button>
              <Button
                variant="primary"
                leftIcon={<Save size={15} />}
                disabled={!pendingPrefs}
                onClick={() => requestSave(prefs)}
              >
                Simpan preferensi
              </Button>
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Preview</h3>
              <p>Ringkasan preferensi aktif</p>
            </div>
            <div className="glass-inset" style={{ padding: 16 }}>
              <div className="row row--between">
                <span className="info-label">Tema</span>
                <Badge tone="orange">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</Badge>
              </div>
              <div className="row row--between" style={{ marginTop: 10 }}>
                <span className="info-label">Bahasa</span>
                <span className="info-value">{prefs.language === 'id' ? 'Indonesia' : 'English'}</span>
              </div>
              <div className="row row--between" style={{ marginTop: 10 }}>
                <span className="info-label">Density</span>
                <span className="info-value">{prefs.density}</span>
              </div>
              <div className="row row--between" style={{ marginTop: 10 }}>
                <span className="info-label">Start page</span>
                <span className="info-value">{prefs.startPage}</span>
              </div>
            </div>
            <Callout tone="info" className="callout" style={{ marginTop: 14 }}>
              <span className="row" style={{ gap: 6 }}>
                <Monitor size={13} /> Preferensi hanya berlaku di browser ini.
              </span>
            </Callout>
          </section>

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Shortcut</h3>
              <p>Navigasi cepat</p>
            </div>
            <div className="movement-list">
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)' }}>
                  <LayoutDashboard size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Dashboard</strong>
                  <span>Ringkasan produksi hari ini</span>
                </div>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--sky-soft)', color: 'var(--sky-deep)' }}>
                  <Palette size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Toggle tema</strong>
                  <span>Gunakan tombol matahari/bulan di topbar</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {showConfirm && pendingPrefs && (
        <Callout tone="info" title="Konfirmasi Perubahan" style={{ position: 'fixed', bottom: 24, right: 24, maxWidth: 420, zIndex: 100 }}>
          <p>Simpan perubahan preferensi ini?</p>
          <div className="form-actions">
            <Button variant="secondary" onClick={handleCancel}>Batalkan</Button>
            <Button variant="primary" onClick={handleConfirm}>Simpan</Button>
          </div>
        </Callout>
      )}
    </div>
  )
}