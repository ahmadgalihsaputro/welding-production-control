import { Bell, BellRing, Mail, MessageSquare, Save, Smartphone, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { Toggle } from '../../components/ui/Toggle'

interface NotificationRule {
  id: string
  title: string
  detail: string
  app: boolean
  email: boolean
  whatsapp: boolean
  critical: boolean
}

const initialRules: NotificationRule[] = [
  { id: 'nr-1', title: 'Low stock material', detail: 'Saat qty berada di bawah safety stock.', app: true, email: true, whatsapp: true, critical: true },
  { id: 'nr-2', title: 'Permintaan material baru', detail: 'Ketika operator membuat kanban belanja.', app: true, email: false, whatsapp: false, critical: false },
  { id: 'nr-3', title: 'Antrian sub assy > 30 menit', detail: 'Indikasi bottleneck pada proses sub assy.', app: true, email: true, whatsapp: false, critical: true },
  { id: 'nr-4', title: 'Hasil produksi di bawah target', detail: 'Achievement shift di bawah 95%.', app: true, email: true, whatsapp: false, critical: false },
  { id: 'nr-5', title: 'NG melewati batas', detail: 'NG rate shift melewati 1,5%.', app: true, email: true, whatsapp: true, critical: true },
  { id: 'nr-6', title: 'Sinkronisasi FSS gagal', detail: 'Jadwal produksi tidak berhasil ditarik.', app: true, email: true, whatsapp: false, critical: true },
  { id: 'nr-7', title: 'Backup selesai', detail: 'Backup harian berhasil dijalankan.', app: false, email: true, whatsapp: false, critical: false },
]

export function NotificationsPage() {
  const [rules, setRules] = useState(initialRules)
  const [quietHours, setQuietHours] = useState(true)
  const [digest, setDigest] = useState(true)
  const [message, setMessage] = useState('')

  const updateRule = (id: string, key: 'app' | 'email' | 'whatsapp', value: boolean) => {
    setRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, [key]: value } : rule)),
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Settings"
        title="Notifications"
        subtitle="Atur notifikasi yang ingin diterima dan melalui kanal apa. Notifikasi kritis tetap dikirim meskipun mode senyap aktif."
        meta={
          <>
            <span className="page-meta__item">
              <BellRing size={12} /> {rules.filter((rule) => rule.critical).length} notifikasi kritis
            </span>
            <span className="page-meta__item">
              <Bell size={12} /> 3 kanal
            </span>
          </>
        }
        actions={
          <Button
            variant="primary"
            leftIcon={<Save size={15} />}
            onClick={() => setMessage('Preferensi notifikasi berhasil disimpan.')}
          >
            Simpan
          </Button>
        }
      />

      {message && <Callout tone="success">{message}</Callout>}

      <div className="kpi-grid kpi-grid--3">
        <StatCardChannel icon={Smartphone} label="In-app" detail={`${rules.filter((rule) => rule.app).length} aturan aktif`} tone="orange" />
        <StatCardChannel icon={Mail} label="Email" detail={`${rules.filter((rule) => rule.email).length} aturan aktif`} tone="sky" />
        <StatCardChannel icon={MessageSquare} label="WhatsApp" detail={`${rules.filter((rule) => rule.whatsapp).length} aturan aktif`} tone="green" />
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Aturan notifikasi</h2>
            <p className="section-sub">Pilih kanal pengiriman per kejadian</p>
          </div>
          <div className="row row--wrap" style={{ gap: 12 }}>
            <span className="row" style={{ gap: 5 }}>
              <Smartphone size={12} /> <span className="muted small">App</span>
            </span>
            <span className="row" style={{ gap: 5 }}>
              <Mail size={12} /> <span className="muted small">Email</span>
            </span>
            <span className="row" style={{ gap: 5 }}>
              <MessageSquare size={12} /> <span className="muted small">WA</span>
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 2 }}>
          {rules.map((rule) => (
            <div className="switch-row" key={rule.id} style={{ alignItems: 'center' }}>
              <div className="switch-copy" style={{ flex: 1 }}>
                <strong>
                  {rule.title}{' '}
                  {rule.critical && (
                    <Badge tone="danger" size="sm">
                      Kritis
                    </Badge>
                  )}
                </strong>
                <span>{rule.detail}</span>
              </div>
              <div className="row" style={{ gap: 16 }}>
                <label className="row" style={{ gap: 6 }}>
                  <span className="muted small">App</span>
                  <Toggle checked={rule.app} onChange={(value) => updateRule(rule.id, 'app', value)} label={`${rule.title} in-app`} />
                </label>
                <label className="row" style={{ gap: 6 }}>
                  <span className="muted small">Email</span>
                  <Toggle checked={rule.email} onChange={(value) => updateRule(rule.id, 'email', value)} label={`${rule.title} email`} />
                </label>
                <label className="row" style={{ gap: 6 }}>
                  <span className="muted small">WA</span>
                  <Toggle checked={rule.whatsapp} onChange={(value) => updateRule(rule.id, 'whatsapp', value)} label={`${rule.title} whatsapp`} />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="report-split">
        <section className="card settings-card">
          <div className="settings-card__head">
            <h3>Jam senyap &amp; ringkasan</h3>
            <p>Kurangi gangguan di luar jam kerja.</p>
          </div>
          <div className="switch-row">
            <div className="switch-copy">
              <strong>Mode senyap 22:00–06:00</strong>
              <span>Notifikasi non-kritis ditahan sampai pagi.</span>
            </div>
            <Toggle checked={quietHours} onChange={setQuietHours} label="Mode senyap" />
          </div>
          <div className="switch-row">
            <div className="switch-copy">
              <strong>Ringkasan harian</strong>
              <span>Kirim rekap produksi dan stok setiap pukul 07:00.</span>
            </div>
            <Toggle checked={digest} onChange={setDigest} label="Ringkasan harian" />
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <div className="field-label">
                <label htmlFor="quiet-start">Mulai senyap</label>
              </div>
              <input id="quiet-start" type="time" className="input" defaultValue="22:00" />
            </div>
            <div className="field">
              <div className="field-label">
                <label htmlFor="quiet-end">Selesai senyap</label>
              </div>
              <input id="quiet-end" type="time" className="input" defaultValue="06:00" />
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <Callout tone="warning" title="Notifikasi kritis">
            Low stock, NG melewati batas, antrian bottleneck, dan kegagalan sinkronisasi FSS selalu
            dikirim ke in-app dan email, termasuk saat mode senyap.
          </Callout>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Kanal terhubung</h3>
              <p>Status integrasi notifikasi</p>
            </div>
            <div className="movement-list">
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                  <Mail size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Email gateway</strong>
                  <span>Terhubung · SMTP internal</span>
                </div>
                <Badge tone="success">Online</Badge>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                  <TriangleAlert size={14} />
                </span>
                <div className="movement__copy">
                  <strong>WhatsApp Business</strong>
                  <span>Token perlu diperbarui</span>
                </div>
                <Badge tone="warning">Warning</Badge>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function StatCardChannel({
  icon: Icon,
  label,
  detail,
  tone,
}: {
  icon: typeof Mail
  label: string
  detail: string
  tone: 'orange' | 'sky' | 'green'
}) {
  return (
    <div className="card stat-card">
      <div className="stat-top">
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ fontSize: 15 }}>
            {detail}
          </div>
        </div>
        <div className={`stat-icon stat-icon--${tone}`}>
          <Icon size={19} />
        </div>
      </div>
    </div>
  )
}
