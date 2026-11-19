import {
  Barcode,
  CheckCircle2,
  Link2,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Tag,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Toggle } from '../../components/ui/Toggle'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { describeApiError } from '../../lib/api'
import {
  listDevices,
  listKanbanPartConfigs,
  updateDevice,
  type DeviceRecord,
  type KanbanPartConfigRecord,
} from '../../lib/masterApi'
import {
  getPrintingSettings,
  savePrintingSettings,
  type PrintingSettings,
} from '../../lib/settingsApi'

const connectionLabel = { wireless: 'Wireless', wired: 'Wired' } as const
const sizeLabel: Record<PrintingSettings['labelSize'], string> = {
  '100x150': '100 × 150 mm',
  '80x100': '80 × 100 mm',
  '60x80': '60 × 80 mm',
}
const symbologyLabel: Record<PrintingSettings['symbology'], string> = {
  code128: 'Code 128',
  qr: 'QR Code',
  both: 'Code 128 + QR',
}

export function PrintingPage() {
  const { confirm } = useConfirmation()
  const { t } = usePreferences()
  const [printers, setPrinters] = useState<DeviceRecord[]>([])
  const [configs, setConfigs] = useState<KanbanPartConfigRecord[]>([])
  const [settings, setSettings] = useState<PrintingSettings | null>(null)
  const [pending, setPending] = useState<PrintingSettings | null>(null)
  const [previewId, setPreviewId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [devices, kanbanConfigs, printing] = await Promise.all([
        listDevices(),
        listKanbanPartConfigs(),
        getPrintingSettings(),
      ])
      setPrinters(devices.filter((device) => device.type === 'Printer'))
      setConfigs(kanbanConfigs)
      setSettings(printing)
      setPending(null)
    } catch (loadError) {
      setError(describeApiError(loadError, t('Data printer dan cetak gagal dimuat.', 'Printer and printing data failed to load.')))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const current = pending ?? settings
  const previewConfig = configs.find((config) => config.id === previewId) ?? configs[0]
  const previewPrinter = previewConfig
    ? previewConfig.printer ?? printers.find((printer) => printer.isDefault) ?? null
    : null
  const previewPayload = previewConfig
    ? JSON.stringify({
        version: 1,
        preview: true,
        partNumber: previewConfig.partNumber,
        line: previewConfig.line,
        qty: previewConfig.quantity,
        model: previewConfig.model,
        storeLocation: previewConfig.storeLocation,
        kanbanType: previewConfig.kanbanType,
        partType: previewConfig.partType,
        process: previewConfig.process,
        nextProcess: previewConfig.nextProcess,
      })
    : ''

  const updateSetting = <K extends keyof PrintingSettings>(key: K, value: PrintingSettings[K]) => {
    if (!current) return
    setPending({ ...current, [key]: value })
  }

  const handleSave = async () => {
    if (!pending) return
    const confirmed = await confirm({
      title: t('Simpan pengaturan cetak?', 'Save printing settings?'),
      message: t('Pengaturan printer, ukuran label, dan barcode akan berlaku untuk seluruh pengguna.', 'Printer, label size, and barcode settings will apply to all users.'),
      confirmLabel: t('Simpan pengaturan', 'Save settings'),
    })
    if (!confirmed) return
    setSaving(true)
    setError('')
    try {
      const saved = await savePrintingSettings(pending)
      setSettings(saved)
      setPending(null)
      setNotice(t('Pengaturan cetak berhasil disimpan.', 'Printing settings saved.'))
      window.setTimeout(() => setNotice(''), 3000)
    } catch (saveError) {
      setError(describeApiError(saveError, t('Pengaturan cetak gagal disimpan.', 'Failed to save printing settings.')))
    } finally {
      setSaving(false)
    }
  }

  const setDefaultPrinter = async (printer: DeviceRecord) => {
    const confirmed = await confirm({
      title: t('Jadikan printer default?', 'Set as default printer?'),
      message: `${printer.name} ${t('akan dipakai sebagai printer utama untuk Kanban yang tidak memilih printer lain.', 'will be the main printer for Kanban that does not select another printer.')}`,
      confirmLabel: t('Jadikan default', 'Set as default'),
    })
    if (!confirmed) return
    setBusyId(printer.id)
    setError('')
    setNotice('')
    try {
      await updateDevice(printer.id, { isDefault: true })
      setNotice(`${printer.name} ${t('dijadikan printer default.', 'set as the default printer.')}`)
      await loadData()
    } catch (actionError) {
      setError(describeApiError(actionError, t('Printer default gagal diubah.', 'Failed to change the default printer.')))
    } finally {
      setBusyId(null)
    }
  }

  const togglePrinterStatus = async (printer: DeviceRecord) => {
    const nextStatus: DeviceRecord['status'] = printer.status === 'online' ? 'offline' : 'online'
    const confirmed = await confirm({
      title: nextStatus === 'online' ? t('Hubungkan printer?', 'Connect printer?') : t('Putuskan printer?', 'Disconnect printer?'),
      message: `${nextStatus === 'online' ? t('Hubungkan', 'Connect') : t('Putuskan', 'Disconnect')} ${printer.name}? ${t('Status koneksi akan diperbarui di database.', 'The connection status will be updated in the database.')}`,
      confirmLabel: nextStatus === 'online' ? t('Hubungkan', 'Connect') : t('Putuskan', 'Disconnect'),
      tone: nextStatus === 'online' ? 'primary' : 'danger',
    })
    if (!confirmed) return
    setBusyId(printer.id)
    setError('')
    setNotice('')
    try {
      await updateDevice(printer.id, { status: nextStatus })
      setNotice(`${printer.name} ${nextStatus === 'online' ? t('dihubungkan', 'connected') : t('diputuskan', 'disconnected')}.`)
      await loadData()
    } catch (actionError) {
      setError(describeApiError(actionError, t('Status printer gagal diubah.', 'Failed to change printer status.')))
    } finally {
      setBusyId(null)
    }
  }

  const onlineCount = printers.filter((printer) => printer.status === 'online').length
  const defaultPrinter = printers.find((printer) => printer.isDefault)
  const linkedConfigs = configs.filter((config) => config.printer).length

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('Pengaturan', 'Settings')}
        title={t('Barcode & Printing', 'Barcode & Printing')}
        subtitle={t('Printer diambil dari Device Management. Setiap konfigurasi Kanban dapat memilih printer sendiri; pengaturan label dan barcode berlaku global.', 'Printers come from Device Management. Each Kanban configuration can select its own printer; label and barcode settings apply globally.')}
        meta={
          <>
            <span className="page-meta__item">
              <Printer size={12} /> {printers.length} {t('printer', 'printers')}
            </span>
            <span className="page-meta__item">
              <Link2 size={12} /> {linkedConfigs} {t('Kanban terhubung', 'Kanban linked')}
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<RefreshCw size={15} />} loading={loading} onClick={() => void loadData()}>
            {t('Muat ulang', 'Reload')}
          </Button>
        }
      />

      {error && <Callout tone="danger" title={t('Aksi gagal', 'Action failed')}>{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && printers.length === 0 && <Callout tone="info">{t('Memuat data printer dari server…', 'Loading printer data from the server...')}</Callout>}

      <div className="kpi-grid">
        <StatCard label={t('Printer terdaftar', 'Registered printers')} value={String(printers.length)} suffix={t('unit', 'units')} icon={Printer} tone="orange" note={t('Dari Device Management', 'From Device Management')} />
        <StatCard label={t('Online', 'Online')} value={String(onlineCount)} suffix={t('unit', 'units')} icon={CheckCircle2} tone="green" note={t('Siap mencetak', 'Ready to print')} />
        <StatCard label={t('Printer default', 'Default printer')} value={defaultPrinter?.name ?? '—'} icon={Tag} tone="sky" note={defaultPrinter?.model ?? t('Belum ditentukan', 'Not set')} />
        <StatCard label={t('Kanban terhubung', 'Linked Kanban')} value={String(linkedConfigs)} suffix={t('model', 'models')} icon={Link2} tone="amber" note={`${configs.length} ${t('konfigurasi Kanban', 'Kanban configurations')}`} />
      </div>

      <div className="report-split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{t('Printer tersedia', 'Available printers')}</h2>
              <p className="section-sub">{t('Status, koneksi, dan Kanban yang memakai printer', 'Status, connection, and Kanban using the printer')}</p>
            </div>
            <Badge tone="neutral">Device Management</Badge>
          </div>
          {printers.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              <p>{t('Belum ada printer terdaftar. Tambahkan perangkat bertipe Printer di Device Management.', 'No printers registered. Add a Printer device in Device Management.')}</p>
            </div>
          ) : (
            <div className="device-grid">
              {printers.map((printer) => (
                <div className="device-card" key={printer.id}>
                  <div className="device-card__top">
                    <span className="device-card__icon">
                      <Printer size={16} />
                    </span>
                    <StatusBadge status={printer.status} />
                  </div>
                  <h3>{printer.name}</h3>
                  <p>{printer.model ?? t('Model belum diisi', 'Model not filled in')}</p>
                  <div className="row row--wrap" style={{ gap: 6 }}>
                    {printer.connectionType && (
                      <Badge tone="sky">{connectionLabel[printer.connectionType]}</Badge>
                    )}
                    {printer.isDefault && <Badge tone="orange">Default</Badge>}
                  </div>
                  <div className="info-grid" style={{ marginTop: 10 }}>
                    <div className="info-item">
                      <span className="info-label">{t('Lokasi', 'Location')}</span>
                      <span className="info-value">{printer.location}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Kanban</span>
                      <span className="info-value">{printer.kanbanConfigCount} {t('konfigurasi', 'configurations')}</span>
                    </div>
                  </div>
                  <div className="device-card__foot">
                    <span className="muted small">{printer.assignedTo ?? t('Tanpa penanggung jawab', 'No assignee')}</span>
                    {printer.isDefault ? (
                      <Badge tone="orange">{t('Aktif', 'Active')}</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busyId === printer.id}
                        onClick={() => void setDefaultPrinter(printer)}
                      >
                        {t('Set default', 'Set default')}
                      </Button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyId === printer.id}
                    onClick={() => void togglePrinterStatus(printer)}
                    block
                  >
                    {printer.status === 'online' ? t('Putuskan koneksi', 'Disconnect') : t('Hubungkan printer', 'Connect printer')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>{t('Pengaturan cetak', 'Printing settings')}</h3>
              <p>{t('Berlaku untuk seluruh printer thermal', 'Applies to all thermal printers')}</p>
            </div>
            <div className="form-grid">
              <Field label={t('Ukuran label', 'Label size')} htmlFor="print-size">
                <select
                  id="print-size"
                  className="select"
                  value={current?.labelSize ?? '100x150'}
                  onChange={(event) => updateSetting('labelSize', event.target.value as PrintingSettings['labelSize'])}
                >
                  <option value="100x150">100 × 150 mm</option>
                  <option value="80x100">80 × 100 mm</option>
                  <option value="60x80">60 × 80 mm</option>
                </select>
              </Field>
              <Field label={t('Resolusi', 'Resolution')} htmlFor="print-dpi">
                <select
                  id="print-dpi"
                  className="select"
                  value={current?.dpi ?? '203'}
                  onChange={(event) => updateSetting('dpi', event.target.value as PrintingSettings['dpi'])}
                >
                  <option value="203">203 dpi</option>
                  <option value="300">300 dpi</option>
                </select>
              </Field>
              <Field label={t('Jumlah salinan', 'Copies')} htmlFor="print-copies">
                <input
                  id="print-copies"
                  type="number"
                  className="input"
                  min={1}
                  max={10}
                  value={current?.copies ?? 1}
                  onChange={(event) => updateSetting('copies', Math.min(10, Math.max(1, Number(event.target.value) || 1)))}
                />
              </Field>
              <Field label={t('Barcode symbology', 'Barcode symbology')} htmlFor="print-symbology">
                <select
                  id="print-symbology"
                  className="select"
                  value={current?.symbology ?? 'code128'}
                  onChange={(event) => updateSetting('symbology', event.target.value as PrintingSettings['symbology'])}
                >
                  <option value="code128">Code 128</option>
                  <option value="qr">QR Code</option>
                  <option value="both">Code 128 + QR</option>
                </select>
              </Field>
            </div>
            <div className="switch-row">
              <div className="switch-copy">
                <strong>{t('Cetak otomatis', 'Auto print')}</strong>
                <span>{t('Print kanban langsung setelah store in / produksi selesai.', 'Print kanban immediately after store in / production completes.')}</span>
              </div>
              <Toggle
                checked={current?.autoPrint ?? false}
                onChange={(value) => updateSetting('autoPrint', value)}
                label={t('Cetak otomatis', 'Auto print')}
              />
            </div>
            <div className="form-actions">
              {pending && (
                <Button variant="secondary" onClick={() => setPending(null)} disabled={saving}>
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
                {t('Simpan pengaturan', 'Save settings')}
              </Button>
            </div>
          </section>

          <Callout tone="info" title={t('Tersinkron dengan Kanban', 'Synced with Kanban')}>
            {t('Printer yang dipilih pada Kanban Configuration tersimpan di database. Jika sebuah Kanban tidak memilih printer, printer default dari Device Management yang dipakai.', 'The printer selected in Kanban Configuration is stored in the database. If a Kanban does not select a printer, the default printer from Device Management is used.')}
          </Callout>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">{t('Preview label', 'Label preview')}</h2>
            <p className="section-sub">{t('Data diambil dari konfigurasi Kanban dan printer yang terhubung', 'Data comes from the Kanban configuration and connected printer')}</p>
          </div>
          <select
            className="select"
            style={{ width: 260 }}
            value={previewConfig?.id ?? ''}
            onChange={(event) => setPreviewId(event.target.value)}
            aria-label={t('Pilih konfigurasi Kanban untuk preview', 'Select a Kanban configuration for preview')}
            disabled={configs.length === 0}
          >
            {configs.length === 0 && <option value="">{t('Belum ada konfigurasi', 'No configuration yet')}</option>}
            {configs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.partNumber} · {config.model}
              </option>
            ))}
          </select>
        </div>
        {previewConfig ? (
          <div className="kanban-preview">
            <div className="kanban-preview__head">
              <strong>WPC · KANBAN {previewConfig.kanbanType}</strong>
              <span>{symbologyLabel[current?.symbology ?? 'code128']} · {sizeLabel[current?.labelSize ?? '100x150']}</span>
            </div>
            <h3>{previewConfig.partNumber}</h3>
            <p>{previewConfig.model} · {previewConfig.line} / {previewConfig.process}</p>
            <div className="kanban-meta">
              <div>
                <span>Qty</span>
                <strong>{previewConfig.quantity} pcs</strong>
              </div>
              <div>
                <span>{t('Lokasi', 'Location')}</span>
                <strong>{previewConfig.storeLocation}</strong>
              </div>
              <div>
                <span>{t('Next Process', 'Next Process')}</span>
                <strong>{previewConfig.nextProcess}</strong>
              </div>
              <div>
                <span>Printer</span>
                <strong>{previewPrinter?.name ?? t('Default belum diatur', 'Default not set')}</strong>
              </div>
            </div>
            <div className="kanban-config-preview__qr">
              <QRCodeSVG value={previewPayload} size={132} level="M" />
              <span>{t('QR preview · operator dan shift diisi saat cetak', 'QR preview · operator and shift are filled in when printing')}</span>
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <p>{t('Tambahkan konfigurasi Kanban untuk melihat preview label.', 'Add a Kanban configuration to see the label preview.')}</p>
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">{t('Kanban & printer', 'Kanban & printer')}</h2>
            <p className="section-sub">{t('Daftar konfigurasi Kanban beserta printer yang dipakai', 'List of Kanban configurations and their printers')}</p>
          </div>
          <Badge tone="neutral">{configs.length} {t('konfigurasi', 'configurations')}</Badge>
        </div>
        {configs.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <p>{t('Belum ada konfigurasi Kanban.', 'No Kanban configuration yet.')}</p>
          </div>
        ) : (
          <div className="pickup-preview">
            {configs.map((config) => (
              <div className="pickup-line" key={config.id}>
                <span className="row" style={{ gap: 8 }}>
                  <Barcode size={12} />
                  <span>
                    <strong>{config.partNumber}</strong>
                    <span className="muted small"> · {config.model} · {config.kanbanType} · {config.quantity} pcs</span>
                  </span>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  {config.printer ? (
                    <>
                      <QrCode size={12} />
                      <strong>{config.printer.name}</strong>
                      <StatusBadge status={config.printer.status} />
                    </>
                  ) : (
                    <Badge tone="neutral">{t('Printer default', 'Default printer')}</Badge>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
