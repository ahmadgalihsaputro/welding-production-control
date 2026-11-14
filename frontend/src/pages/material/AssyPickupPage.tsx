import { ArrowRight, CheckCircle2, PackageCheck, ScanBarcode, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useQueue } from '../../contexts/QueueContext'
import { formatNumber } from '../../lib/utils'

interface AssyPickupRow {
  id: string
  time: string
  delivery: string
  partNumber: string
  qty: number
  user: string
}

const pickups: AssyPickupRow[] = [
  { id: 'ap-1', time: '08:55', delivery: 'DL-88210', partNumber: '5220AU52', qty: 105, user: 'Collect Team' },
  { id: 'ap-2', time: '07:40', delivery: 'DL-88209', partNumber: '5220BA42', qty: 50, user: 'Collect Team' },
  { id: 'ap-3', time: '06:58', delivery: 'DL-88208', partNumber: '75114W000P', qty: 40, user: 'Collect Team' },
]

export function AssyPickupPage() {
  const { addFromScan } = useQueue()
  const [scanned, setScanned] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [store, setStore] = useState(200)
  const [error, setError] = useState('')

  const columns: Column<AssyPickupRow>[] = [
    { key: 'time', header: 'Waktu', render: (row) => <span className="mono muted">{row.time}</span> },
    {
      key: 'part',
      header: 'Part Number',
      render: (row) => (
        <div className="cell-stack">
          <span className="cell-main">{row.partNumber}</span>
          <span className="cell-sub">{row.delivery}</span>
        </div>
      ),
    },
    { key: 'qty', header: 'Qty', align: 'right', render: (row) => `${formatNumber(row.qty)} pcs` },
    { key: 'user', header: 'Diambil oleh', render: (row) => row.user },
    { key: 'status', header: 'Status', render: () => <StatusBadge status="posted" /> },
  ]

  const confirmPickup = async () => {
    const result = await addFromScan({
      code: `DL-${Date.now().toString().slice(-8)}`,
      partNumber: '5220BA42',
      model: 'RN',
      type: 'Assy',
      qty: 50,
    })
    if (!result.ok) {
      setError(result.error ?? 'Pickup gagal dicatat untuk alokasi produksi.')
      return
    }
    setStore((value) => Math.max(value - 50, 0))
    setConfirmed(true)
    setScanned(false)
    setError('')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Material Control"
        title="Scan Pickup Assy"
        subtitle="Catat pengeluaran Assy Store saat Collect mengambil barang menggunakan delivery Kanban customer. Ini bukan pembuatan jadwal FSS baru."
        meta={
          <>
            <span className="page-meta__item">
              <ScanBarcode size={12} /> Delivery Kanban
            </span>
            <span className="page-meta__item">
              <PackageCheck size={12} /> Assy Store
            </span>
          </>
        }
      />

      {confirmed && (
        <Callout tone="success" title="Pickup tercatat">
          50 pcs 5220BA42 keluar dari Assy Store dan permintaan masuk ke Admin untuk dialokasikan
          ke shift produksi.
        </Callout>
      )}
      {error && <Callout tone="danger" title="Pickup gagal">{error}</Callout>}

      <div className="material-split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Scan delivery Kanban</h2>
              <p className="section-sub">Kanban pengiriman customer</p>
            </div>
            <Badge tone="success" dot>
              Scan mode
            </Badge>
          </div>

          <div className="scan-box">
            <div className="scan-icon">
              <ScanLine size={25} />
            </div>
            <strong>{scanned ? 'DELIVERY KANBAN TERBACA' : 'SCAN DELIVERY KANBAN'}</strong>
            <span>
              {scanned
                ? 'DL-88211 · 5220BA42 · 50 pcs'
                : 'Arahkan scanner ke barcode delivery Kanban customer'}
            </span>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<ScanBarcode size={14} />}
              onClick={() => {
                setScanned(true)
                setConfirmed(false)
              }}
            >
              {scanned ? 'Scan ulang' : 'Simulasikan scan'}
            </Button>
          </div>

          <div className="stack-sm" style={{ marginTop: 14 }}>
            {[
              'Validasi PN dan kuantitas pengambilan.',
              'Kurangi saldo Assy Store sesuai delivery qty.',
              'Catat waktu, user, dan referensi delivery Kanban.',
              'Perbarui indikator kebutuhan produksi.',
            ].map((step, index) => (
              <div className="row row--start" key={step} style={{ gap: 9 }}>
                <span className="queue-mini__num">{index + 1}</span>
                <span className="small muted">{step}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Hasil scan</h2>
                <p className="section-sub">Validasi pengeluaran</p>
              </div>
              <StatusBadge status={scanned ? 'picked' : 'waiting'} label={scanned ? 'Valid' : 'Menunggu'} />
            </div>

            <div className="scan-result">
              <div className="scan-result__item">
                <span>Part Number</span>
                <strong>{scanned ? '5220BA42' : '—'}</strong>
              </div>
              <div className="scan-result__item">
                <span>Delivery Qty</span>
                <strong>{scanned ? '50 pcs' : '—'}</strong>
              </div>
              <div className="scan-result__item">
                <span>Source</span>
                <strong>Assy Store</strong>
              </div>
              <div className="scan-result__item">
                <span>Delivery Kanban</span>
                <strong>{scanned ? 'DL-88211' : '—'}</strong>
              </div>
            </div>

            <div className="glass-inset" style={{ padding: 12, marginTop: 12 }}>
              <div className="row row--between">
                <span className="small muted">Stok Assy Store</span>
                <strong className="strong">{formatNumber(store)} pcs</strong>
              </div>
              <ProgressBar value={(store / 312) * 100} thin tone="sky" className="progress" />
              <div className="tiny muted" style={{ marginTop: 4 }}>Max store 312 pcs</div>
            </div>

            <div className="form-actions">
              <Button
                variant="primary"
                block
                leftIcon={<PackageCheck size={15} />}
                disabled={!scanned}
                onClick={confirmPickup}
              >
                Konfirmasi pickup
              </Button>
            </div>
          </section>

          <Callout tone="warning" title="Rekonsiliasi dengan jadwal FSS">
            Scan pickup hanya mencatat pengeluaran barang. Sistem merekonsiliasi kebutuhan
            dengan jadwal yang sudah ada agar tidak membuat order ganda.
          </Callout>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Pickup hari ini</h2>
            <p className="section-sub">Pengeluaran Assy Store oleh Collect</p>
          </div>
          <Badge tone="neutral">{formatNumber(pickups.reduce((sum, row) => sum + row.qty, 0))} pcs</Badge>
        </div>
        <DataTable columns={columns} rows={pickups} rowKey={(row) => row.id} minWidth={620} compact />
        <Button variant="ghost" size="sm" style={{ paddingLeft: 0, marginTop: 8 }} rightIcon={<ArrowRight size={13} />}>
          Lihat mutasi Assy Store
        </Button>
      </section>
    </div>
  )
}
