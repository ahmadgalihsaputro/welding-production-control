import { Database, Download, HardDrive, History, RefreshCw, Save, Server, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { backupLogs as initialLogs } from '../../data/mock'
import type { BackupLog } from '../../types'

interface BackupConfig {
  frequency: string
  retention: string
  target: string
}

const STORAGE_KEY = 'wpc.backup.v1'
const DEFAULT_CONFIG: BackupConfig = {
  frequency: 'daily',
  retention: '30',
  target: 's3',
}

function loadConfig(): BackupConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function BackupPage() {
  const [logs, setLogs] = useState<BackupLog[]>(initialLogs)
  const [config, setConfig] = useState<BackupConfig>(DEFAULT_CONFIG)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingConfig, setPendingConfig] = useState<BackupConfig | null>(null)

  useEffect(() => {
    setConfig(loadConfig())
  }, [])

  const requestSave = (nextConfig: BackupConfig) => {
    setPendingConfig(nextConfig)
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    if (!pendingConfig) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingConfig))
    setConfig(pendingConfig)
    setPendingConfig(null)
    setShowConfirm(false)
    setMessage('Konfigurasi backup berhasil disimpan.')
    setTimeout(() => setMessage(''), 3000)
  }

  const handleCancel = () => {
    setPendingConfig(null)
    setShowConfirm(false)
  }

  const runBackup = () => {
    setRunning(true)
    setMessage('')
    window.setTimeout(() => {
      setLogs((current) => [
        {
          id: `bl-${Date.now()}`,
          time: new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          type: 'Manual',
          size: '1,8 GB',
          duration: '4m 06s',
          status: 'success',
        },
        ...current,
      ])
      setRunning(false)
      setMessage('Backup manual berhasil dibuat dan disimpan di object storage.')
      setTimeout(() => setMessage(''), 3000)
    }, 1000)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Settings"
        title="Backup & Maintenance"
        subtitle="Pantau backup database, konfigurasi retensi, dan status penyimpanan. Backup otomatis berjalan setiap pukul 02:00."
        meta={
          <>
            <span className="page-meta__item">
              <Database size={12} /> PostgreSQL 16
            </span>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> Enkripsi AES-256
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" leftIcon={<Download size={15} />}>
              Unduh terakhir
            </Button>
            <Button
              variant="primary"
              leftIcon={<RefreshCw size={15} className={running ? 'spin' : undefined} />}
              loading={running}
              onClick={runBackup}
            >
              Backup sekarang
            </Button>
          </>
        }
      />

      {message && <Callout tone="success">{message}</Callout>}

      <div className="kpi-grid">
        <StatCard label="Backup terakhir" value="02:00" icon={History} tone="orange" note="Hari ini · 1,8 GB" />
        <StatCard label="Retensi" value="30" suffix="hari" icon={Database} tone="sky" note="Backup harian" />
        <StatCard label="Storage terpakai" value="63%" icon={HardDrive} tone="green" note="320 GB dari 512 GB" />
        <StatCard label="Status sistem" value="Healthy" icon={Server} tone="amber" note="Uptime 99,98%" />
      </div>

      <div className="report-split">
        <section className="card settings-card">
          <div className="settings-card__head">
            <h3>Jadwal & retensi</h3>
            <p>Konfigurasi backup otomatis</p>
          </div>
          <div className="form-grid">
            <Field label="Frekuensi backup" htmlFor="backup-frequency">
              <select
                id="backup-frequency"
                className="select"
                value={config.frequency}
                onChange={(event) => requestSave({ ...config, frequency: event.target.value })}
              >
                <option value="daily">Harian · 02:00</option>
                <option value="12h">Setiap 12 jam</option>
                <option value="weekly">Mingguan</option>
              </select>
            </Field>
            <Field label="Retensi" htmlFor="backup-retention">
              <select
                id="backup-retention"
                className="select"
                value={config.retention}
                onChange={(event) => requestSave({ ...config, retention: event.target.value })}
              >
                <option value="7">7 hari</option>
                <option value="14">14 hari</option>
                <option value="30">30 hari</option>
                <option value="90">90 hari</option>
              </select>
            </Field>
            <Field label="Lokasi penyimpanan" htmlFor="backup-target">
              <select
                id="backup-target"
                className="select"
                value={config.target}
                onChange={(event) => requestSave({ ...config, target: event.target.value })}
              >
                <option value="s3">Object storage (S3)</option>
                <option value="nas">NAS lokal</option>
                <option value="both">S3 + NAS</option>
              </select>
            </Field>
            <Field label="Enkripsi" htmlFor="backup-encrypt">
              <input id="backup-encrypt" className="input" value="AES-256" readOnly />
            </Field>
          </div>

          <div className="backup-metric" style={{ marginTop: 14 }}>
            <div className="backup-metric__item">
              <span>Backup sukses</span>
              <strong>29 / 30</strong>
            </div>
            <div className="backup-metric__item">
              <span>Rata-rata durasi</span>
              <strong>4m 08s</strong>
            </div>
            <div className="backup-metric__item">
              <span>Ukuran rata-rata</span>
              <strong>1,75 GB</strong>
            </div>
          </div>

          <div className="storage-bar">
            <div className="stock-level__top">
              <span>Penggunaan storage</span>
              <strong>320 GB / 512 GB</strong>
            </div>
            <ProgressBar value={63} thick tone="sky" />
            <div className="storage-bar__labels">
              <span>Backup 280 GB</span>
              <span>Log & arsip 40 GB</span>
            </div>
          </div>

          <div className="form-actions">
            <Button variant="secondary">Reset jadwal</Button>
            <Button variant="primary" leftIcon={<Save size={15} />} disabled={!pendingConfig} onClick={() => requestSave(config)}>
              Simpan konfigurasi
            </Button>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Maintenance</h3>
              <p>Tindakan pemeliharaan rutin</p>
            </div>
            <div className="movement-list">
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                  <Database size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Database vacuum</strong>
                  <span>Terakhir 10 Nov 2026</span>
                </div>
                <Badge tone="success">Selesai</Badge>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--sky-soft)', color: 'var(--sky-deep)' }}>
                  <RefreshCw size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Archive transaksi</strong>
                  <span>Data {'>'} 12 bulan</span>
                </div>
                <Badge tone="sky">Terjadwal</Badge>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                  <HardDrive size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Bersihkan log</strong>
                  <span>Log lebih dari 90 hari</span>
                </div>
                <Button size="sm" variant="ghost">
                  Jalankan
                </Button>
              </div>
            </div>
          </section>

          <Callout tone="info" title="Uji restore">
            Lakukan uji restore ke environment staging setiap bulan. Backup yang tidak pernah diuji
            belum tentu dapat dipulihkan.
          </Callout>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Riwayat backup</h2>
            <p className="section-sub">3 eksekusi terakhir</p>
          </div>
          <Badge tone="neutral">Log</Badge>
        </div>
        <div className="log-list">
          {logs.map((log) => (
            <div className="log-row" key={log.id}>
              <div className="log-row__main">
                <strong>Backup {log.type.toLowerCase()}</strong>
                <span>{log.time}</span>
              </div>
              <div className="log-row__meta">
                {log.size} · {log.duration}
              </div>
              <StatusBadge status={log.status} label={log.status === 'success' ? 'Success' : 'Failed'} />
            </div>
          ))}
        </div>
      </section>

      {showConfirm && pendingConfig && (
        <Callout tone="info" title="Konfirmasi Perubahan" style={{ position: 'fixed', bottom: 24, right: 24, maxWidth: 420, zIndex: 100 }}>
          <p>Simpan konfigurasi backup dan retensi?</p>
          <div className="form-actions">
            <Button variant="secondary" onClick={handleCancel}>Batalkan</Button>
            <Button variant="primary" onClick={handleConfirm}>Simpan</Button>
          </div>
        </Callout>
      )}
    </div>
  )
}
