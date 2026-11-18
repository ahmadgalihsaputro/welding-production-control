import { Barcode, CheckCircle2, Printer, QrCode, ScanLine, Settings2, Tag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Toggle } from '../../components/ui/Toggle'

interface PrinterDevice {
  id: string
  name: string
  model: string
  location: string
  type: 'Thermal' | 'Laser' | 'Inkjet'
  status: 'online' | 'offline' | 'maintenance'
  isDefault?: boolean
}

const initialPrinters: PrinterDevice[] = [
  { id: 'pr-1', name: 'Printer Kanban Buffer', model: 'Zebra ZT230', location: 'Production Buffer', type: 'Thermal', status: 'maintenance' },
  { id: 'pr-2', name: 'Printer Assy Store', model: 'Zebra ZD421', location: 'Assy Store', type: 'Thermal', status: 'online', isDefault: true },
  { id: 'pr-3', name: 'Printer Supply Room', model: 'Brother QL-820', location: 'Material Supply', type: 'Thermal', status: 'online' },
  { id: 'pr-4', name: 'Office Laser', model: 'HP LaserJet Pro', location: 'Meeting Room G', type: 'Laser', status: 'offline' },
]

const STORAGE_KEY = 'wpc.printing.v1'

function loadData(): { printers: PrinterDevice[]; autoPrint: boolean; labelSize: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { printers: initialPrinters, autoPrint: true, labelSize: '100x150' }
    return JSON.parse(raw)
  } catch {
    return { printers: initialPrinters, autoPrint: true, labelSize: '100x150' }
  }
}

function saveData(data: { printers: PrinterDevice[]; autoPrint: boolean; labelSize: string }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function PrintingPage() {
  const [printers, setPrinters] = useState<PrinterDevice[]>(initialPrinters)
  const [autoPrint, setAutoPrint] = useState(true)
  const [labelSize, setLabelSize] = useState('100x150')
  const [message, setMessage] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pending, setPending] = useState<{ printers: PrinterDevice[]; autoPrint: boolean; labelSize: string } | null>(null)

  useEffect(() => {
    const data = loadData()
    setPrinters(data.printers)
    setAutoPrint(data.autoPrint)
    setLabelSize(data.labelSize)
  }, [])

  const requestSave = (next: { printers: PrinterDevice[]; autoPrint: boolean; labelSize: string }) => {
    setPending(next)
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    if (!pending) return
    saveData(pending)
    setPrinters(pending.printers)
    setAutoPrint(pending.autoPrint)
    setLabelSize(pending.labelSize)
    setPending(null)
    setShowConfirm(false)
    setMessage('Pengaturan cetak berhasil disimpan.')
    setTimeout(() => setMessage(''), 3000)
  }

  const handleCancel = () => {
    setPending(null)
    setShowConfirm(false)
  }

  const testPrint = (printer: PrinterDevice) => {
    if (printer.status !== 'online') {
      setMessage(`Test print gagal: ${printer.name} sedang ${printer.status}.`)
      return
    }
    setMessage(`Test print dikirim ke ${printer.name}. Periksa hasil label.`)
    setTimeout(() => setMessage(''), 3000)
  }

  const setDefault = (id: string) => {
    const nextPrinters = printers.map((printer) => ({ ...printer, isDefault: printer.id === id }))
    requestSave({ printers: nextPrinters, autoPrint, labelSize })
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Settings"
        title="Barcode & Printing"
        subtitle="Konfigurasi printer label, ukuran kanban, dan perilaku cetak otomatis saat produksi selesai atau pickup material."
        meta={
          <>
            <span className="page-meta__item">
              <Printer size={12} /> {printers.length} printer
            </span>
            <span className="page-meta__item">
              <Barcode size={12} /> Code 128
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<Settings2 size={15} />}>
            Kalibrasi printer
          </Button>
        }
      />

      {message && (
        <Callout tone={message.includes('gagal') ? 'warning' : 'success'}>{message}</Callout>
      )}

      <div className="kpi-grid">
        <StatCard label="Printer terdaftar" value={String(printers.length)} suffix="unit" icon={Printer} tone="orange" note="Thermal & laser" />
        <StatCard label="Online" value={String(printers.filter((printer) => printer.status === 'online').length)} suffix="unit" icon={CheckCircle2} tone="green" note="Siap mencetak" />
        <StatCard label="Printer default" value={printers.find((printer) => printer.isDefault)?.name ?? '—'} icon={Tag} tone="sky" note="Assy Store" />
        <StatCard label="Format barcode" value="Code 128" icon={QrCode} tone="amber" note="Scan 1D + QR fallback" />
      </div>

      <div className="report-split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Printer tersedia</h2>
              <p className="section-sub">Status dan penempatan printer</p>
            </div>
            <Badge tone="neutral">Network</Badge>
          </div>
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
                <p>
                  {printer.model} · {printer.type}
                </p>
                <div className="device-card__foot">
                  <span>{printer.location}</span>
                  {printer.isDefault ? (
                    <Badge tone="orange">Default</Badge>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setDefault(printer.id)}>
                      Set default
                    </Button>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Printer size={12} />}
                  onClick={() => testPrint(printer)}
                  block
                >
                  Test print
                </Button>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Pengaturan cetak</h3>
              <p>Berlaku untuk seluruh printer thermal</p>
            </div>
            <div className="form-grid">
              <Field label="Ukuran label" htmlFor="print-size">
                <select
                  id="print-size"
                  className="select"
                  value={labelSize}
                  onChange={(event) => requestSave({ printers, autoPrint, labelSize: event.target.value })}
                >
                  <option value="100x150">100 × 150 mm</option>
                  <option value="80x100">80 × 100 mm</option>
                  <option value="60x80">60 × 80 mm</option>
                </select>
              </Field>
              <Field label="Resolusi" htmlFor="print-dpi">
                <select id="print-dpi" className="select" defaultValue="203">
                  <option value="203">203 dpi</option>
                  <option value="300">300 dpi</option>
                </select>
              </Field>
              <Field label="Jumlah salinan" htmlFor="print-copies">
                <input id="print-copies" type="number" className="input" defaultValue={1} min={1} />
              </Field>
              <Field label="Barcode symbology" htmlFor="print-symbology">
                <select id="print-symbology" className="select" defaultValue="code128">
                  <option value="code128">Code 128</option>
                  <option value="qr">QR Code</option>
                  <option value="both">Code 128 + QR</option>
                </select>
              </Field>
            </div>
            <div className="switch-row">
              <div className="switch-copy">
                <strong>Cetak otomatis</strong>
                <span>Print kanban langsung setelah store in / produksi selesai.</span>
              </div>
              <Toggle
                checked={autoPrint}
                onChange={(value) => requestSave({ printers, autoPrint: value, labelSize })}
                label="Cetak otomatis"
              />
            </div>
          </section>

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Preview label</h3>
              <p>{labelSize.replace('x', ' × ')} mm · Code 128</p>
            </div>
            <div className="kanban-preview">
              <div className="kanban-preview__head">
                <strong>WPC · KANBAN</strong>
                <span>KN-2611-001</span>
              </div>
              <h3>5220BA42</h3>
              <p>Assy bracket main · Robot G</p>
              <div className="kanban-meta">
                <div>
                  <span>Qty</span>
                  <strong>39 pcs</strong>
                </div>
                <div>
                  <span>Shift</span>
                  <strong>Shift 1</strong>
                </div>
                <div>
                  <span>Operator</span>
                  <strong>Adi Nugroho</strong>
                </div>
                <div>
                  <span>Date</span>
                  <strong>12 Nov 2026</strong>
                </div>
              </div>
              <div className="barcode" />
            </div>
          </section>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Template label</h2>
            <p className="section-sub">Template aktif per jenis kanban</p>
          </div>
        </div>
        <div className="pickup-preview">
          <div className="pickup-line">
            <span className="row" style={{ gap: 6 }}>
              <ScanLine size={12} /> Assy Production Kanban
            </span>
            <strong>100 × 150 mm · Code 128</strong>
          </div>
          <div className="pickup-line">
            <span className="row" style={{ gap: 6 }}>
              <ScanLine size={12} /> Sub Assy Production Kanban
            </span>
            <strong>100 × 150 mm · Code 128</strong>
          </div>
          <div className="pickup-line">
            <span className="row" style={{ gap: 6 }}>
              <ScanLine size={12} /> Kanban Belanja
            </span>
            <strong>80 × 100 mm · Code 128</strong>
          </div>
          <div className="pickup-line">
            <span className="row" style={{ gap: 6 }}>
              <ScanLine size={12} /> Return Kanban
            </span>
            <strong>80 × 100 mm · QR Code</strong>
          </div>
        </div>
      </section>

      {showConfirm && pending && (
        <Callout tone="info" title="Konfirmasi Perubahan" style={{ position: 'fixed', bottom: 24, right: 24, maxWidth: 420, zIndex: 100 }}>
          <p>Simpan pengaturan printer dan cetak?</p>
          <div className="form-actions">
            <Button variant="secondary" onClick={handleCancel}>Batalkan</Button>
            <Button variant="primary" onClick={handleConfirm}>Simpan</Button>
          </div>
        </Callout>
      )}
    </div>
  )
}