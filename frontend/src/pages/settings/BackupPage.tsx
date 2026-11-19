import { Database, Download, HardDrive, History, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Toggle } from '../../components/ui/Toggle'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { describeApiError } from '../../lib/api'
import {
  cleanupBackups,
  downloadBackup,
  getBackupSettings,
  listBackups,
  runBackup,
  saveBackupSettings,
  type BackupFile,
  type BackupSettings,
} from '../../lib/settingsApi'

function formatSize(bytes: number, language: 'id' | 'en'): string {
  const separator = language === 'id' ? ',' : '.'
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1).replace('.', separator)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function formatDate(value: string | null, locale: string, never: string): string {
  if (!value) return never
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function BackupPage() {
  const { confirm } = useConfirmation()
  const { t, locale, language } = usePreferences()
  const [settings, setSettings] = useState<BackupSettings | null>(null)
  const [pending, setPending] = useState<BackupSettings | null>(null)
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [busyFile, setBusyFile] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextSettings, nextBackups] = await Promise.all([getBackupSettings(), listBackups()])
      setSettings(nextSettings)
      setPending(null)
      setBackups(nextBackups)
    } catch (loadError) {
      setError(describeApiError(loadError, t('Data backup gagal dimuat.', 'Backup data failed to load.')))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const current = pending ?? settings
  const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0)
  const latest = backups[0]
  const never = t('Belum pernah', 'Never')

  const handleSave = async () => {
    if (!pending) return
    const confirmed = await confirm({
      title: t('Simpan konfigurasi backup?', 'Save backup configuration?'),
      message: t(
        `Backup ${pending.automatic ? t('otomatis aktif setiap ', 'automatic enabled at ') + pending.schedule : t('otomatis dimatikan', 'automatic disabled')} dengan retensi ${pending.retentionDays} hari.`,
        `Backup ${pending.automatic ? t('automatic enabled at ', 'automatic enabled at ') + pending.schedule : t('automatic disabled', 'automatic disabled')} with ${pending.retentionDays} day retention.`,
      ),
      confirmLabel: t('Simpan konfigurasi', 'Save configuration'),
    })
    if (!confirmed) return
    try {
      const saved = await saveBackupSettings({
        automatic: pending.automatic,
        schedule: pending.schedule,
        retentionDays: pending.retentionDays,
      })
      setSettings(saved)
      setPending(null)
      setNotice(t('Konfigurasi backup berhasil disimpan.', 'Backup configuration saved.'))
      window.setTimeout(() => setNotice(''), 3000)
    } catch (saveError) {
      setError(describeApiError(saveError, t('Konfigurasi backup gagal disimpan.', 'Failed to save backup configuration.')))
    }
  }

  const handleRunBackup = async () => {
    const confirmed = await confirm({
      title: t('Jalankan backup sekarang?', 'Run backup now?'),
      message: t('pg_dump akan membuat file backup database baru di folder backup server.', 'pg_dump will create a new database backup file in the server backup folder.'),
      confirmLabel: t('Jalankan backup', 'Run backup'),
    })
    if (!confirmed) return
    setRunning(true)
    setError('')
    setNotice('')
    try {
      const backup = await runBackup()
      setNotice(t(`Backup ${backup.file} berhasil dibuat (${formatSize(backup.size, language)}).`, `Backup ${backup.file} created (${formatSize(backup.size, language)}).`))
      await loadData()
    } catch (runError) {
      setError(describeApiError(runError, t('Backup gagal dijalankan.', 'Failed to run backup.')))
    } finally {
      setRunning(false)
    }
  }

  const handleDownload = async (backup: BackupFile) => {
    setBusyFile(backup.file)
    setError('')
    try {
      await downloadBackup(backup.file)
    } catch (downloadError) {
      setError(describeApiError(downloadError, t('File backup gagal diunduh.', 'Failed to download backup file.')))
    } finally {
      setBusyFile(null)
    }
  }

  const handleCleanup = async () => {
    if (!current) return
    const confirmed = await confirm({
      title: t('Bersihkan backup lama?', 'Clean up old backups?'),
      message: t(`File backup lebih lama dari ${current.retentionDays} hari akan dihapus permanen dari server.`, `Backup files older than ${current.retentionDays} days will be permanently deleted from the server.`),
      confirmLabel: t('Hapus backup lama', 'Delete old backups'),
      tone: 'danger',
    })
    if (!confirmed) return
    setCleaning(true)
    setError('')
    setNotice('')
    try {
      const result = await cleanupBackups()
      setNotice(
        result.deleted > 0
          ? t(`${result.deleted} file backup lama dihapus (${formatSize(result.freedBytes, language)}).`, `${result.deleted} old backup files deleted (${formatSize(result.freedBytes, language)}).`)
          : t('Tidak ada backup yang melewati masa retensi.', 'No backups have exceeded the retention period.'),
      )
      await loadData()
    } catch (cleanupError) {
      setError(describeApiError(cleanupError, t('Pembersihan backup gagal.', 'Backup cleanup failed.')))
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('Pengaturan', 'Settings')}
        title={t('Backup & Maintenance', 'Backup & Maintenance')}
        subtitle={t('Backup database PostgreSQL nyata dari server. Jadwal, retensi, dan riwayat file tersimpan di database aplikasi.', 'Real PostgreSQL database backup from the server. Schedule, retention, and file history are stored in the application database.')}
        meta={
          <>
            <span className="page-meta__item">
              <Database size={12} /> {backups.length} {t('file backup', 'backup files')}
            </span>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> pg_dump
            </span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<Download size={15} />}
              disabled={!latest || busyFile !== null}
              loading={latest ? busyFile === latest.file : false}
              onClick={() => latest && void handleDownload(latest)}
            >
              {t('Unduh terakhir', 'Download latest')}
            </Button>
            <Button
              variant="primary"
              leftIcon={<RefreshCw size={15} />}
              loading={running}
              onClick={() => void handleRunBackup()}
            >
              {t('Backup sekarang', 'Back up now')}
            </Button>
          </>
        }
      />

      {error && <Callout tone="danger" title={t('Aksi gagal', 'Action failed')}>{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && <Callout tone="info">{t('Memuat data backup dari server…', 'Loading backup data from the server...')}</Callout>}

      <div className="kpi-grid">
        <StatCard
          label={t('Backup terakhir', 'Last backup')}
          value={settings?.lastBackupAt ? formatDate(settings.lastBackupAt, locale, never) : '—'}
          icon={History}
          tone="orange"
          note={latest ? `${latest.file} · ${formatSize(latest.size, language)}` : t('Belum ada file backup', 'No backup file yet')}
        />
        <StatCard
          label={t('Retensi', 'Retention')}
          value={String(current?.retentionDays ?? 30)}
          suffix={t('hari', 'days')}
          icon={Database}
          tone="sky"
          note={current?.automatic ? `${t('Otomatis', 'Automatic')} · ${current.schedule}` : t('Otomatis nonaktif', 'Automatic disabled')}
        />
        <StatCard
          label={t('Total file', 'Total files')}
          value={String(backups.length)}
          suffix={t('file', 'files')}
          icon={HardDrive}
          tone="green"
          note={formatSize(totalSize, language)}
        />
        <StatCard
          label={t('Jadwal', 'Schedule')}
          value={current?.automatic ? current.schedule : t('Manual', 'Manual')}
          icon={ShieldCheck}
          tone="amber"
          note={current?.automatic ? t('Backup otomatis aktif', 'Automatic backup enabled') : t('Hanya backup manual', 'Manual backups only')}
        />
      </div>

      <div className="report-split">
        <section className="card settings-card">
          <div className="settings-card__head">
            <h3>{t('Jadwal & retensi', 'Schedule & retention')}</h3>
            <p>{t('Tersimpan pada AppSetting database', 'Stored in the AppSetting database')}</p>
          </div>
          <div className="switch-row">
            <div className="switch-copy">
              <strong>{t('Backup otomatis', 'Automatic backup')}</strong>
              <span>{t('Jalankan backup sesuai jadwal di bawah.', 'Run backups according to the schedule below.')}</span>
            </div>
            <Toggle
              checked={current?.automatic ?? false}
              onChange={(value) =>
                setPending({ ...(current ?? { automatic: value, schedule: '02:00', retentionDays: 30, lastBackupAt: null }), automatic: value })
              }
              label={t('Backup otomatis', 'Automatic backup')}
            />
          </div>
          <div className="form-grid">
            <Field label={t('Jam backup', 'Backup time')} htmlFor="backup-schedule" hint={t('Waktu server lokal (HH:MM).', 'Server local time (HH:MM).')}>
              <input
                id="backup-schedule"
                type="time"
                className="input"
                value={current?.schedule ?? '02:00'}
                onChange={(event) =>
                  setPending({ ...(current ?? { automatic: true, schedule: '02:00', retentionDays: 30, lastBackupAt: null }), schedule: event.target.value })
                }
              />
            </Field>
            <Field label={t('Retensi', 'Retention')} htmlFor="backup-retention" hint={t('Backup lebih lama dari ini dihapus saat pembersihan.', 'Backups older than this are deleted during cleanup.')}>
              <select
                id="backup-retention"
                className="select"
                value={String(current?.retentionDays ?? 30)}
                onChange={(event) =>
                  setPending({ ...(current ?? { automatic: true, schedule: '02:00', retentionDays: 30, lastBackupAt: null }), retentionDays: Number(event.target.value) })
                }
              >
                <option value="7">{t('7 hari', '7 days')}</option>
                <option value="14">{t('14 hari', '14 days')}</option>
                <option value="30">{t('30 hari', '30 days')}</option>
                <option value="90">{t('90 hari', '90 days')}</option>
                <option value="180">{t('180 hari', '180 days')}</option>
              </select>
            </Field>
          </div>
          <div className="form-actions">
            {pending && (
              <Button variant="secondary" onClick={() => setPending(null)}>
                {t('Batalkan', 'Cancel')}
              </Button>
            )}
            <Button
              variant="primary"
              leftIcon={<Save size={15} />}
              disabled={!pending}
              onClick={() => void handleSave()}
            >
              {t('Simpan konfigurasi', 'Save configuration')}
            </Button>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Maintenance</h3>
              <p>{t('Tindakan nyata pada file backup server', 'Real actions on server backup files')}</p>
            </div>
            <div className="movement-list">
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                  <Trash2 size={14} />
                </span>
                <div className="movement__copy">
                  <strong>{t('Bersihkan backup lama', 'Clean up old backups')}</strong>
                  <span>{t(`Hapus file lebih dari ${current?.retentionDays ?? 30} hari`, `Delete files older than ${current?.retentionDays ?? 30} days`)}</span>
                </div>
                <Button size="sm" variant="ghost" loading={cleaning} onClick={() => void handleCleanup()}>
                  {t('Jalankan', 'Run')}
                </Button>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--sky-soft)', color: 'var(--sky-deep)' }}>
                  <RefreshCw size={14} />
                </span>
                <div className="movement__copy">
                  <strong>{t('Backup manual', 'Manual backup')}</strong>
                  <span>{t('Jalankan pg_dump saat dibutuhkan', 'Run pg_dump when needed')}</span>
                </div>
                <Button size="sm" variant="ghost" loading={running} onClick={() => void handleRunBackup()}>
                  Backup
                </Button>
              </div>
            </div>
          </section>

          <Callout tone="info" title={t('Uji restore', 'Test restore')}>
            {t('File .sql dapat diunduh dari daftar di bawah. Uji restore ke environment staging secara berkala untuk memastikan backup dapat dipulihkan.', '.sql files can be downloaded from the list below. Test restores to a staging environment regularly to ensure backups can be recovered.')}
          </Callout>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">{t('Riwayat backup', 'Backup history')}</h2>
            <p className="section-sub">{t(`${backups.length} file .sql di folder backup server`, `${backups.length} .sql files in the server backup folder`)}</p>
          </div>
          <Badge tone="neutral">pg_dump</Badge>
        </div>
        {backups.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <p>{t('Belum ada file backup. Jalankan backup untuk membuat file pertama.', 'No backup files yet. Run a backup to create the first file.')}</p>
          </div>
        ) : (
          <div className="log-list">
            {backups.map((backup) => (
              <div className="log-row" key={backup.file}>
                <div className="log-row__main">
                  <strong>{backup.file}</strong>
                  <span>{formatDate(backup.createdAt, locale, never)}</span>
                </div>
                <div className="log-row__meta">{formatSize(backup.size, language)}</div>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<Download size={14} />}
                  loading={busyFile === backup.file}
                  onClick={() => void handleDownload(backup)}
                >
                  {t('Unduh', 'Download')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
