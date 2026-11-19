import { LayoutDashboard, Monitor, Moon, Palette, Save, Sun } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { Toggle } from '../../components/ui/Toggle'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { useTheme } from '../../contexts/ThemeContext'
import {
  DEFAULT_PREFERENCES,
  usePreferences,
  type DateFormat,
  type Density,
  type Language,
  type Preferences,
  type Timezone,
} from '../../contexts/PreferencesContext'
import { canAccess } from '../../config/access'
import { describeApiError } from '../../lib/api'

const startPages: Array<{ path: string; id: string; en: string }> = [
  { path: '/', id: 'Dashboard', en: 'Dashboard' },
  { path: '/production/schedule', id: 'Jadwal Produksi', en: 'Production Schedule' },
  { path: '/production/assy-queue', id: 'Antrian Assy', en: 'Assy Queue' },
  { path: '/production/queue', id: 'Antrian Sub Assy', en: 'Sub Assy Queue' },
  { path: '/inventory/overview', id: 'Stock Overview', en: 'Stock Overview' },
  { path: '/settings/profile', id: 'Profil Saya', en: 'My Profile' },
]

export function PreferencesPage() {
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const { preferences, setPreferences, t, formatDate } = usePreferences()
  const [draft, setDraft] = useState<Preferences>(preferences)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const dirty = JSON.stringify(draft) !== JSON.stringify(preferences)
  const allowedStartPages = startPages.filter(
    (page) => !user || canAccess(page.path, user.role),
  )

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setMessage('')
  }

  const handleSave = async () => {
    const confirmed = await confirm({
      title: t('Simpan preferensi?', 'Save preferences?'),
      message: t(
        'Bahasa, format tanggal, zona waktu, density, dan perilaku aplikasi akan diterapkan sekarang.',
        'Language, date format, time zone, density, and app behaviour will be applied now.',
      ),
      confirmLabel: t('Simpan preferensi', 'Save preferences'),
    })
    if (!confirmed) return
    setSaving(true)
    setError('')
    try {
      const saved = await setPreferences(draft)
      setDraft(saved)
      setMessage(t('Preferensi berhasil disimpan.', 'Preferences saved.'))
    } catch (saveError) {
      setError(describeApiError(saveError, t('Preferensi gagal disimpan.', 'Failed to save preferences.')))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    const confirmed = await confirm({
      title: t('Reset preferensi?', 'Reset preferences?'),
      message: t(
        'Semua preferensi akan dikembalikan ke pengaturan awal.',
        'All preferences will be restored to their defaults.',
      ),
      confirmLabel: t('Reset default', 'Reset to default'),
      tone: 'danger',
    })
    if (!confirmed) return
    setSaving(true)
    setError('')
    try {
      const saved = await setPreferences(DEFAULT_PREFERENCES)
      setDraft(saved)
      setMessage(t('Preferensi direset ke default.', 'Preferences reset to default.'))
    } catch (resetError) {
      setError(describeApiError(resetError, t('Preferensi gagal direset.', 'Failed to reset preferences.')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('Pengaturan', 'Settings')}
        title={t('Application Preferences', 'Application Preferences')}
        subtitle={t(
          'Sesuaikan tampilan, bahasa, format tanggal, dan perilaku aplikasi. Preferensi tersimpan pada akun Anda.',
          'Adjust the look, language, date format, and behaviour of the app. Preferences are saved to your account.',
        )}
        meta={
          <span className="page-meta__item">
            <Palette size={12} />{' '}
            {t('Tema', 'Theme')} {theme === 'dark' ? t('gelap', 'dark') : t('terang', 'light')}
          </span>
        }
      />

      {message && <Callout tone="success">{message}</Callout>}
      {error && <Callout tone="danger" title={t('Aksi gagal', 'Action failed')}>{error}</Callout>}

      <div className="report-split">
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>{t('Tema tampilan', 'Appearance theme')}</h3>
              <p>{t('Pilih mode terang atau gelap untuk seluruh aplikasi.', 'Choose light or dark mode for the whole app.')}</p>
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
                  {theme === 'light' && <Badge tone="orange">{t('Aktif', 'Active')}</Badge>}
                </div>
                <h3>{t('Light mode', 'Light mode')}</h3>
                <p>{t('Terang, bersih, cocok untuk area produksi.', 'Bright and clean, suited to the production floor.')}</p>
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
                  {theme === 'dark' && <Badge tone="orange">{t('Aktif', 'Active')}</Badge>}
                </div>
                <h3>{t('Dark mode', 'Dark mode')}</h3>
                <p>{t('Nyaman untuk shift malam dan ruang redup.', 'Comfortable for night shifts and dim rooms.')}</p>
              </button>
            </div>
          </section>

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>{t('Bahasa & format', 'Language & format')}</h3>
              <p>{t('Bahasa berlaku untuk seluruh aplikasi.', 'Language applies to the entire app.')}</p>
            </div>
            <div className="form-grid">
              <Field label={t('Bahasa', 'Language')} htmlFor="pref-language">
                <select
                  id="pref-language"
                  className="select"
                  value={draft.language}
                  onChange={(event) => update('language', event.target.value as Language)}
                >
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label={t('Format tanggal', 'Date format')} htmlFor="pref-date">
                <select
                  id="pref-date"
                  className="select"
                  value={draft.dateFormat}
                  onChange={(event) => update('dateFormat', event.target.value as DateFormat)}
                >
                  <option value="long">12 November 2026</option>
                  <option value="numeric">12/11/2026</option>
                  <option value="iso">2026-11-12</option>
                </select>
              </Field>
              <Field label={t('Zona waktu', 'Time zone')} htmlFor="pref-timezone">
                <select
                  id="pref-timezone"
                  className="select"
                  value={draft.timezone}
                  onChange={(event) => update('timezone', event.target.value as Timezone)}
                >
                  <option value="wib">WIB (GMT+7)</option>
                  <option value="wita">WITA (GMT+8)</option>
                  <option value="wit">WIT (GMT+9)</option>
                </select>
              </Field>
              <Field label={t('Density tabel', 'Table density')} htmlFor="pref-density">
                <select
                  id="pref-density"
                  className="select"
                  value={draft.density}
                  onChange={(event) => update('density', event.target.value as Density)}
                >
                  <option value="comfortable">{t('Comfortable', 'Comfortable')}</option>
                  <option value="compact">{t('Compact', 'Compact')}</option>
                  <option value="spacious">{t('Spacious', 'Spacious')}</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>{t('Perilaku aplikasi', 'App behaviour')}</h3>
              <p>{t('Preferensi navigasi dan animasi.', 'Navigation and animation preferences.')}</p>
            </div>
            <div className="switch-row">
              <div className="switch-copy">
                <strong>{t('Sidebar terbuka saat login', 'Sidebar expanded at login')}</strong>
                <span>{t('Tampilkan sidebar dalam kondisi expanded.', 'Show the sidebar expanded.')}</span>
              </div>
              <Toggle
                checked={draft.sidebarDefault}
                onChange={(value) => update('sidebarDefault', value)}
                label={t('Sidebar terbuka saat login', 'Sidebar expanded at login')}
              />
            </div>
            <div className="switch-row">
              <div className="switch-copy">
                <strong>{t('Kurangi animasi', 'Reduce motion')}</strong>
                <span>{t('Matikan transisi non-esensial pada perangkat lambat.', 'Disable non-essential transitions on slow devices.')}</span>
              </div>
              <Toggle
                checked={draft.reduceMotion}
                onChange={(value) => update('reduceMotion', value)}
                label={t('Kurangi animasi', 'Reduce motion')}
              />
            </div>
            <Field label={t('Halaman awal setelah login', 'Start page after login')} htmlFor="pref-start">
              <select
                id="pref-start"
                className="select"
                value={draft.startPage}
                onChange={(event) => update('startPage', event.target.value)}
              >
                {allowedStartPages.map((page) => (
                  <option key={page.path} value={page.path}>
                    {t(page.id, page.en)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => void handleReset()} disabled={saving}>
                {t('Reset default', 'Reset to default')}
              </Button>
              <Button
                variant="primary"
                leftIcon={<Save size={15} />}
                disabled={!dirty || saving}
                loading={saving}
                onClick={() => void handleSave()}
              >
                {t('Simpan preferensi', 'Save preferences')}
              </Button>
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>{t('Preview', 'Preview')}</h3>
              <p>{t('Ringkasan preferensi aktif', 'Active preference summary')}</p>
            </div>
            <div className="glass-inset" style={{ padding: 16 }}>
              <div className="row row--between">
                <span className="info-label">{t('Tema', 'Theme')}</span>
                <Badge tone="orange">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</Badge>
              </div>
              <div className="row row--between" style={{ marginTop: 10 }}>
                <span className="info-label">{t('Bahasa', 'Language')}</span>
                <span className="info-value">{preferences.language === 'id' ? 'Indonesia' : 'English'}</span>
              </div>
              <div className="row row--between" style={{ marginTop: 10 }}>
                <span className="info-label">{t('Format tanggal', 'Date format')}</span>
                <span className="info-value">{formatDate(new Date())}</span>
              </div>
              <div className="row row--between" style={{ marginTop: 10 }}>
                <span className="info-label">{t('Density', 'Density')}</span>
                <span className="info-value">{preferences.density}</span>
              </div>
              <div className="row row--between" style={{ marginTop: 10 }}>
                <span className="info-label">{t('Halaman awal', 'Start page')}</span>
                <span className="info-value">
                  {t(
                    startPages.find((page) => page.path === preferences.startPage)?.id ?? preferences.startPage,
                    startPages.find((page) => page.path === preferences.startPage)?.en ?? preferences.startPage,
                  )}
                </span>
              </div>
            </div>
            <Callout tone="info" className="callout" style={{ marginTop: 14 }}>
              <span className="row" style={{ gap: 6 }}>
                <Monitor size={13} />{' '}
                {t('Preferensi tersimpan pada akun Anda.', 'Preferences are saved to your account.')}
              </span>
            </Callout>
          </section>

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>{t('Shortcut', 'Shortcuts')}</h3>
              <p>{t('Navigasi cepat', 'Quick navigation')}</p>
            </div>
            <div className="movement-list">
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)' }}>
                  <LayoutDashboard size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Dashboard</strong>
                  <span>{t('Ringkasan produksi hari ini', "Today's production summary")}</span>
                </div>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--sky-soft)', color: 'var(--sky-deep)' }}>
                  <Palette size={14} />
                </span>
                <div className="movement__copy">
                  <strong>{t('Toggle tema', 'Toggle theme')}</strong>
                  <span>{t('Gunakan tombol matahari/bulan di topbar', 'Use the sun/moon button in the top bar')}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
