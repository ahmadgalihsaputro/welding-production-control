import { LayoutDashboard, Monitor, Moon, Palette, Save, Sun } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { Toggle } from '../../components/ui/Toggle'
import { useTheme } from '../../contexts/ThemeContext'

export function PreferencesPage() {
  const { theme, setTheme } = useTheme()
  const [language, setLanguage] = useState('id')
  const [density, setDensity] = useState('comfortable')
  const [startPage, setStartPage] = useState('dashboard')
  const [sidebarDefault, setSidebarDefault] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [message, setMessage] = useState('')

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
              <h3>Bahasa &amp; format</h3>
              <p>Format angka mengikuti locale Indonesia.</p>
            </div>
            <div className="form-grid">
              <Field label="Bahasa" htmlFor="pref-language">
                <select id="pref-language" className="select" value={language} onChange={(event) => setLanguage(event.target.value)}>
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
                <select id="pref-density" className="select" value={density} onChange={(event) => setDensity(event.target.value)}>
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
              <Toggle checked={sidebarDefault} onChange={setSidebarDefault} label="Sidebar terbuka saat login" />
            </div>
            <div className="switch-row">
              <div className="switch-copy">
                <strong>Kurangi animasi</strong>
                <span>Matikan transisi non-esensial pada perangkat lambat.</span>
              </div>
              <Toggle checked={reduceMotion} onChange={setReduceMotion} label="Kurangi animasi" />
            </div>
            <Field label="Halaman awal setelah login" htmlFor="pref-start">
              <select id="pref-start" className="select" value={startPage} onChange={(event) => setStartPage(event.target.value)}>
                <option value="dashboard">Dashboard</option>
                <option value="schedule">Jadwal Produksi</option>
                <option value="queue">Antrian Sub Assy</option>
                <option value="stock">Stock Overview</option>
              </select>
            </Field>
            <div className="form-actions">
              <Button variant="secondary">Reset default</Button>
              <Button
                variant="primary"
                leftIcon={<Save size={15} />}
                onClick={() => setMessage('Preferensi berhasil disimpan pada perangkat ini.')}
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
                <span className="info-value">{language === 'id' ? 'Indonesia' : 'English'}</span>
              </div>
              <div className="row row--between" style={{ marginTop: 10 }}>
                <span className="info-label">Density</span>
                <span className="info-value">{density}</span>
              </div>
              <div className="row row--between" style={{ marginTop: 10 }}>
                <span className="info-label">Start page</span>
                <span className="info-value">{startPage}</span>
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
    </div>
  )
}
