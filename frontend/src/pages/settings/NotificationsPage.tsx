import {
  BellRing,
  PackageMinus,
  PackageSearch,
  Save,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Toggle } from '../../components/ui/Toggle'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { describeApiError } from '../../lib/api'
import {
  getNotificationSettings,
  getStockAlerts,
  saveNotificationSettings,
  type NotificationSettings,
  type StockAlert,
  type StockAlertSummary,
} from '../../lib/notificationApi'

const emptySummary: StockAlertSummary = { total: 0, low: 0, high: 0, critical: 0 }

const alertIcons = {
  critical: TriangleAlert,
  low: PackageMinus,
  high: PackageSearch,
}

const alertTones = {
  danger: 'danger',
  warning: 'warning',
  info: 'sky',
} as const

function coverage(rules: { low: boolean; high: boolean }) {
  return Number(rules.low) + Number(rules.high)
}

export function NotificationsPage() {
  const { hasRole } = useAuth()
  const { confirm } = useConfirmation()
  const { t } = usePreferences()
  const canEdit = hasRole('admin', 'leader')
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [pending, setPending] = useState<NotificationSettings | null>(null)
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [summary, setSummary] = useState<StockAlertSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [config, result] = await Promise.all([
        getNotificationSettings(),
        getStockAlerts(),
      ])
      setSettings(config)
      setPending(null)
      setAlerts(result.alerts)
      setSummary(result.summary)
    } catch (loadError) {
      setError(describeApiError(loadError, t('Pengaturan notifikasi gagal dimuat.', 'Notification settings failed to load.')))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const current = pending ?? settings

  const updateRule = (group: 'assy' | 'subAssy', field: 'low' | 'high', value: boolean) => {
    if (!current) return
    setPending({ ...current, [group]: { ...current[group], [field]: value } })
  }

  const updateCritical = (value: boolean) => {
    if (!current) return
    setPending({ ...current, criticalSafety: value })
  }

  const handleSave = async () => {
    if (!pending) return
    const confirmed = await confirm({
      title: t('Simpan pengaturan notifikasi?', 'Save notification settings?'),
      message: t(
        'Perubahan berlaku untuk semua pengguna dan langsung tersinkron ke notifikasi aplikasi.',
        'Changes apply to all users and are immediately synced to app notifications.',
      ),
      confirmLabel: t('Simpan perubahan', 'Save changes'),
    })
    if (!confirmed) return

    setSaving(true)
    setError('')
    try {
      const saved = await saveNotificationSettings(pending)
      setSettings(saved)
      setPending(null)
      setMessage(t('Pengaturan notifikasi berhasil disimpan.', 'Notification settings saved.'))
      window.dispatchEvent(new Event('wpc:notifications-updated'))
      window.setTimeout(() => setMessage(''), 3000)
      const result = await getStockAlerts()
      setAlerts(result.alerts)
      setSummary(result.summary)
    } catch (saveError) {
      setError(describeApiError(saveError, t('Pengaturan notifikasi gagal disimpan.', 'Failed to save notification settings.')))
    } finally {
      setSaving(false)
    }
  }

  const activeRules = current ? coverage(current.assy) + coverage(current.subAssy) + Number(current.criticalSafety) : 0

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('Pengaturan', 'Settings')}
        title={t('Notifikasi', 'Notifications')}
        subtitle={t(
          'Notifikasi stok produksi Assy dan Sub Assy hanya muncul di aplikasi. Tidak ada pengiriman email, WhatsApp, atau jam senyap.',
          'Assy and Sub Assy production stock notifications appear only in the app. No email, WhatsApp, or silent-hour dispatching.',
        )}
        meta={
          <>
            <span className="page-meta__item">
              <BellRing size={12} /> {t(`${activeRules} aturan aktif`, `${activeRules} active rules`)}
            </span>
            <span className="page-meta__item">
              <TriangleAlert size={12} /> {t(`${summary.critical} notifikasi kritis`, `${summary.critical} critical alerts`)}
            </span>
          </>
        }
        actions={
          canEdit && (
            <>
              {pending && (
                <Button variant="secondary" onClick={() => setPending(null)}>
                  {t('Batalkan', 'Cancel')}
                </Button>
              )}
              <Button
                variant="primary"
                leftIcon={<Save size={15} />}
                disabled={!pending || saving}
                loading={saving}
                onClick={() => void handleSave()}
              >
                {t('Simpan', 'Save')}
              </Button>
            </>
          )
        }
      />

      {message && <Callout tone="success">{message}</Callout>}
      {error && (
        <Callout tone="danger" title={t('Gagal memuat data', 'Failed to load data')}>
          {error}
        </Callout>
      )}

      <div className="kpi-grid kpi-grid--3">
        <StatCard
          label={t('Stok rendah', 'Low stock')}
          value={String(summary.low)}
          suffix="PN"
          icon={PackageMinus}
          tone="amber"
          note={t('Di bawah safety stock', 'Below safety stock')}
        />
        <StatCard
          label={t('Safety < 1 jam', 'Safety < 1 hour')}
          value={String(summary.critical)}
          suffix="PN"
          icon={TriangleAlert}
          tone="red"
          note={t('Sisa stok kurang dari 1 jam produksi', 'Remaining stock less than 1 hour production')}
        />
        <StatCard
          label={t('Stok penuh', 'Stock full')}
          value={String(summary.high)}
          suffix="PN"
          icon={PackageSearch}
          tone="sky"
          note={t('Mencapai Max Store', 'Reached Max Store')}
        />
      </div>

      <div className="report-split">
        <section className="card settings-card">
          <div className="settings-card__head">
            <h3>{t('Aturan notifikasi stok', 'Stock notification rules')}</h3>
            <p>{t('Pilih kejadian stok yang memunculkan notifikasi di aplikasi.', 'Select stock events that trigger in-app notifications.')}</p>
          </div>

          <div className="switch-row">
            <div className="switch-copy">
              <strong>{t('Stok Assy rendah', 'Low Assy stock')}</strong>
              <span>{t('Notifikasi saat store ≤ safety stock.', 'Notify when store ≤ safety stock.')}</span>
            </div>
            <Toggle
              checked={current?.assy.low ?? false}
              onChange={(value) => updateRule('assy', 'low', value)}
              label={t('Stok Assy rendah', 'Low Assy stock')}
              disabled={!canEdit}
            />
          </div>
          <div className="switch-row">
            <div className="switch-copy">
              <strong>{t('Stok Assy penuh', 'Full Assy stock')}</strong>
              <span>{t('Notifikasi saat store ≥ Max Store.', 'Notify when store ≥ Max Store.')}</span>
            </div>
            <Toggle
              checked={current?.assy.high ?? false}
              onChange={(value) => updateRule('assy', 'high', value)}
              label={t('Stok Assy penuh', 'Full Assy stock')}
              disabled={!canEdit}
            />
          </div>
          <div className="switch-row">
            <div className="switch-copy">
              <strong>{t('Stok Sub Assy rendah', 'Low Sub Assy stock')}</strong>
              <span>{t('Notifikasi saat store ≤ safety stock.', 'Notify when store ≤ safety stock.')}</span>
            </div>
            <Toggle
              checked={current?.subAssy.low ?? false}
              onChange={(value) => updateRule('subAssy', 'low', value)}
              label={t('Stok Sub Assy rendah', 'Low Sub Assy stock')}
              disabled={!canEdit}
            />
          </div>
          <div className="switch-row">
            <div className="switch-copy">
              <strong>{t('Stok Sub Assy penuh', 'Full Sub Assy stock')}</strong>
              <span>{t('Notifikasi saat store ≥ Max Store.', 'Notify when store ≥ Max Store.')}</span>
            </div>
            <Toggle
              checked={current?.subAssy.high ?? false}
              onChange={(value) => updateRule('subAssy', 'high', value)}
              label={t('Stok Sub Assy penuh', 'Full Sub Assy stock')}
              disabled={!canEdit}
            />
          </div>
          <div className="switch-row">
            <div className="switch-copy">
              <strong>{t('Safety stock kurang dari 1 jam', 'Safety stock less than 1 hour')}</strong>
              <span>{t('Notifikasi saat sisa stok tidak cukup untuk 1 jam produksi.', 'Notify when remaining stock is insufficient for 1 hour production.')}</span>
            </div>
            <Toggle
              checked={current?.criticalSafety ?? false}
              onChange={updateCritical}
              label={t('Safety stock kurang dari 1 jam', 'Safety stock less than 1 hour')}
              disabled={!canEdit}
            />
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <Callout tone="info" title={t('Notifikasi dalam aplikasi', 'In-app notifications')}>
            {t(
              'Notifikasi muncul pada ikon lonceng di topbar dan halaman ini. Data dihitung langsung dari stok serta pemakaian material di database, sehingga tersambung dengan menu Inventory Control dan Material.',
              'Notifications appear on the bell icon in the topbar and this page. Data is calculated directly from stock and material consumption in the database, connecting with Inventory Control and Material menus.',
            )}
          </Callout>

          {!canEdit && (
            <Callout tone="warning" title={t('Hanya baca', 'Read-only')}>
              {t('Hanya Admin dan Leader yang dapat mengubah pengaturan notifikasi.', 'Only Admins and Leaders can change notification settings.')}
            </Callout>
          )}

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>{t('Notifikasi aktif', 'Active notifications')}</h3>
              <p>{loading ? t('Memuat data…', 'Loading data...') : t(`${alerts.length} notifikasi saat ini`, `${alerts.length} current notifications`)}</p>
            </div>
            {alerts.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 12px' }}>
                <p>{t('Tidak ada notifikasi stok saat ini.', 'No current stock notifications.')}</p>
              </div>
            ) : (
              <div className="movement-list">
                {alerts.map((alert) => {
                  const Icon = alertIcons[alert.kind]
                  return (
                    <div className="movement" key={alert.id}>
                      <span
                        className={`movement__icon stat-icon--${alert.kind === 'high' ? 'sky' : alert.kind === 'low' ? 'amber' : 'red'}`}
                      >
                        <Icon size={14} />
                      </span>
                      <div className="movement__copy">
                        <strong>{alert.title}</strong>
                        <span>{alert.body}</span>
                      </div>
                      <Badge tone={alertTones[alert.tone]}>{alert.category}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>{t('Dasar perhitungan', 'Calculation basis')}</h3>
              <p>{t('Ambang batas mengikuti Packaging & Policy.', 'Thresholds follow Packaging & Policy.')}</p>
            </div>
            <div className="movement-list">
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                  <ShieldAlert size={14} />
                </span>
                <div className="movement__copy">
                  <strong>{t('Rendah & penuh', 'Low & full')}</strong>
                  <span>{t('Safety stock dan Max Store per part number.', 'Safety stock and Max Store per part number.')}</span>
                </div>
                <Badge tone="neutral">{t('Policy', 'Policy')}</Badge>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
                  <TriangleAlert size={14} />
                </span>
                <div className="movement__copy">
                  <strong>{t('Kurang dari 1 jam', 'Less than 1 hour')}</strong>
                  <span>{t('Pemakaian material 60 menit terakhir dari ledger stok.', 'Material usage from the last 60 minutes from stock ledger.')}</span>
                </div>
                <Badge tone="neutral">{t('Ledger', 'Ledger')}</Badge>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
