import {
  ArrowDownUp,
  CheckCircle2,
  Cloud,
  Database,
  Link2,
  RefreshCw,
  Save,
  Server,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Toggle } from '../../components/ui/Toggle'
import { integrationLogs as initialLogs } from '../../data/mock'
import type { IntegrationLog } from '../../types'

interface FSSConfig {
  baseUrl: string
  clientId: string
  clientSecret: string
  schedule: string
  timeout: number
  autoSync: boolean
}

const STORAGE_KEY = 'wpc.integration.fss.v1'
const DEFAULT_CONFIG: FSSConfig = {
  baseUrl: 'https://fss.internal.wpc/plant-g/api/v2',
  clientId: 'wpc-robot-g',
  clientSecret: '',
  schedule: '2x',
  timeout: 30,
  autoSync: true,
}

function loadConfig(): FSSConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function IntegrationPage() {
  const [logs, setLogs] = useState<IntegrationLog[]>(initialLogs)
  const [config, setConfig] = useState<FSSConfig>(DEFAULT_CONFIG)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingConfig, setPendingConfig] = useState<FSSConfig | null>(null)

  useEffect(() => {
    setConfig(loadConfig())
  }, [])

  const requestSave = (nextConfig: FSSConfig) => {
    setPendingConfig(nextConfig)
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    if (!pendingConfig) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingConfig))
    setConfig(pendingConfig)
    setPendingConfig(null)
    setShowConfirm(false)
    setMessage('Konfigurasi FSS berhasil disimpan.')
    setTimeout(() => setMessage(''), 3000)
  }

  const handleCancel = () => {
    setPendingConfig(null)
    setShowConfirm(false)
  }

  const runSync = () => {
    setSyncing(true)
    setMessage('')
    window.setTimeout(() => {
      setLogs((current) => [
        {
          id: `il-${Date.now()}`,
          time: new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          event: 'Manual sync — production schedule',
          records: 128,
          duration: '2,2 s',
          status: 'success',
        },
        ...current,
      ])
      setSyncing(false)
      setMessage('Sinkronisasi manual berhasil. 128 record jadwal diperbarui.')
      setTimeout(() => setMessage(''), 3000)
    }, 900)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Settings"
        title="FSS Integration"
        subtitle="Koneksi ke Factory Scheduling System untuk menarik jadwal produksi dan mengirim hasil produksi secara otomatis."
        meta={
          <>
            <span className="page-meta__item">
              <Cloud size={12} /> FSS Production
            </span>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> TLS 1.3
            </span>
          </>
        }
        actions={
          <>
            <Button
              variant="primary"
              leftIcon={<RefreshCw size={15} className={syncing ? 'spin' : undefined} />}
              loading={syncing}
              onClick={runSync}
            >
              Sync sekarang
            </Button>
          </>
        }
      />

      {message && <Callout tone="success">{message}</Callout>}

      <div className="kpi-grid">
        <StatCard label="Status koneksi" value="Connected" icon={Link2} tone="green" note="Terakhir sync 07:00" />
        <StatCard label="Record hari ini" value="128" suffix="record" icon={ArrowDownUp} tone="orange" note="Jadwal produksi" />
        <StatCard label="Rata-rata durasi" value="2,2" suffix="detik" icon={RefreshCw} tone="sky" note="7 hari terakhir" />
        <StatCard label="Sync otomatis" value={config.autoSync ? 'Aktif' : 'Nonaktif'} icon={Settings2} tone="amber" note="Setiap 07:00 & 19:00" />
      </div>

      <section className="card settings-card">
        <div className="integration-status">
          <span className="integration-status__icon">
            <CheckCircle2 size={22} />
          </span>
          <div className="integration-status__copy">
            <strong>FSS Production API terhubung</strong>
            <span>Endpoint aktif · sertifikat valid sampai 31 Des 2026</span>
          </div>
          <Badge tone="success" dot>
            Healthy
          </Badge>
          <Button variant="secondary" size="sm" leftIcon={<Server size={13} />}>
            Test koneksi
          </Button>
        </div>
      </section>

      <div className="report-split">
        <section className="card settings-card">
          <div className="settings-card__head">
            <h3>Konfigurasi koneksi</h3>
            <p>Kredensial disimpan terenkripsi pada browser (demo).</p>
          </div>
          <div className="form-grid">
            <Field label="Base URL" htmlFor="fss-url" className="span-2">
              <input
                id="fss-url"
                className="input mono"
                value={config.baseUrl}
                onChange={(event) => requestSave({ ...config, baseUrl: event.target.value })}
              />
            </Field>
            <Field label="Client ID" htmlFor="fss-client">
              <input
                id="fss-client"
                className="input mono"
                value={config.clientId}
                onChange={(event) => requestSave({ ...config, clientId: event.target.value })}
              />
            </Field>
            <Field label="Client secret" htmlFor="fss-secret" hint="Kosongkan jika tidak ingin mengubah.">
              <input
                id="fss-secret"
                type="password"
                className="input"
                value={config.clientSecret}
                onChange={(event) => requestSave({ ...config, clientSecret: event.target.value })}
              />
            </Field>
            <Field label="Jadwal sync" htmlFor="fss-schedule">
              <select
                id="fss-schedule"
                className="select"
                value={config.schedule}
                onChange={(event) => requestSave({ ...config, schedule: event.target.value })}
              >
                <option value="2x">2× sehari (07:00 & 19:00)</option>
                <option value="hourly">Setiap jam</option>
                <option value="manual">Manual</option>
              </select>
            </Field>
            <Field label="Timeout (detik)" htmlFor="fss-timeout">
              <input
                id="fss-timeout"
                className="input"
                type="number"
                value={config.timeout}
                onChange={(event) => requestSave({ ...config, timeout: Number(event.target.value) })}
              />
            </Field>
          </div>
          <div className="switch-row">
            <div className="switch-copy">
              <strong>Sinkronisasi otomatis</strong>
              <span>Tarik jadwal dan kirim hasil produksi sesuai jadwal.</span>
            </div>
            <Toggle
              checked={config.autoSync}
              onChange={(value) => requestSave({ ...config, autoSync: value })}
              label="Sinkronisasi otomatis"
            />
          </div>
          <Callout tone="info" className="callout" style={{ marginTop: 12 }}>
            Mengubah endpoint akan menghentikan sync otomatis sampai test koneksi berhasil.
          </Callout>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Data yang disinkronkan</h3>
              <p>Arah dan frekuensi pertukaran data</p>
            </div>
            <div className="movement-list">
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--sky-soft)', color: 'var(--sky-deep)' }}>
                  <ArrowDownUp size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Production schedule</strong>
                  <span>FSS → WPC · setiap 07:00 & 19:00</span>
                </div>
                <Badge tone="sky">Inbound</Badge>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)' }}>
                  <Database size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Production result</strong>
                  <span>WPC → FSS · setiap store in</span>
                </div>
                <Badge tone="orange">Outbound</Badge>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                  <Cloud size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Material master</strong>
                  <span>FSS → WPC · sinkron harian 06:00</span>
                </div>
                <Badge tone="success">Inbound</Badge>
              </div>
            </div>
          </section>

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Mapping field</h3>
              <p>Field wajib FSS ↔ WPC</p>
            </div>
            <div className="pickup-preview">
              <div className="pickup-line">
                <span>part_number</span>
                <strong>partNumber</strong>
              </div>
              <div className="pickup-line">
                <span>plan_qty</span>
                <strong>target</strong>
              </div>
              <div className="pickup-line">
                <span>due_time</span>
                <strong>dueTime</strong>
              </div>
              <div className="pickup-line">
                <span>line_code</span>
                <strong>line</strong>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Riwayat sinkronisasi</h2>
            <p className="section-sub">4 eksekusi terakhir</p>
          </div>
          <Badge tone="neutral">Log</Badge>
        </div>
        <div className="log-list">
          {logs.map((log) => (
            <div className="log-row" key={log.id}>
              <div className="log-row__main">
                <strong>{log.event}</strong>
                <span>{log.time}</span>
              </div>
              <div className="log-row__meta">
                {log.records} record · {log.duration}
              </div>
              <StatusBadge status={log.status} />
            </div>
          ))}
        </div>
      </section>

      {showConfirm && pendingConfig && (
        <Callout tone="info" title="Konfirmasi Perubahan" style={{ position: 'fixed', bottom: 24, right: 24, maxWidth: 420, zIndex: 100 }}>
          <p>Simpan perubahan konfigurasi FSS?</p>
          <div className="form-actions">
            <Button variant="secondary" onClick={handleCancel}>Batalkan</Button>
            <Button variant="primary" onClick={handleConfirm}>Simpan</Button>
          </div>
        </Callout>
      )}
    </div>
  )
}