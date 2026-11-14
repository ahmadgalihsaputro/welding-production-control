import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  PackageCheck,
  ScanBarcode,
  ScanLine,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useQueue } from '../../contexts/QueueContext'
import { formatNumber } from '../../lib/utils'

interface PickRow {
  id: string
  time: string
  partNumber: string
  qty: number
  request: string
  user: string
  status: string
}

const recentPicks: PickRow[] = [
  { id: 'pk-1', time: '08:42', partNumber: '5220K814', qty: 35, request: 'MR-00125', user: 'Bagas Saputra', status: 'posted' },
  { id: 'pk-2', time: '08:18', partNumber: '50162B000P', qty: 140, request: 'MR-00124', user: 'Bagas Saputra', status: 'posted' },
  { id: 'pk-3', time: '07:58', partNumber: '5220AU52', qty: 105, request: 'MR-00123', user: 'Bagas Saputra', status: 'posted' },
  { id: 'pk-4', time: '07:30', partNumber: '5220K816', qty: 70, request: 'MR-00122', user: 'Bagas Saputra', status: 'posted' },
]

export function SupplyPickupPage() {
  const { addFromScan } = useQueue()
  const [scanned, setScanned] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  const columns: Column<PickRow>[] = [
    { key: 'time', header: 'Waktu', render: (row) => <span className="mono muted">{row.time}</span> },
    {
      key: 'part',
      header: 'Part Number',
      render: (row) => (
        <div className="cell-stack">
          <span className="cell-main">{row.partNumber}</span>
          <span className="cell-sub">{row.request}</span>
        </div>
      ),
    },
    { key: 'qty', header: 'Qty', align: 'right', render: (row) => `${row.qty} pcs` },
    { key: 'user', header: 'Supply', render: (row) => row.user },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Material Control"
        title="Pengambilan Material oleh Supply"
        subtitle="Scan Kanban Belanja lalu scan box Sub Assy yang diambil. Setiap pengambilan aktual langsung membuat kebutuhan replenishment."
        meta={
          <>
            <span className="page-meta__item">
              <ScanBarcode size={12} /> Scan mode
            </span>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> Satu box = satu transaksi
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<ClipboardCheck size={15} />}>
            Buka daftar request
          </Button>
        }
      />

      {confirmed && (
        <Callout tone="success" title="Pengambilan berhasil">
          35 pcs 5220K814 sudah diambil dari Sub Assy Store. Permintaan replenishment masuk ke
          Admin untuk dialokasikan ke shift produksi.
        </Callout>
      )}
      {error && <Callout tone="danger" title="Pengambilan gagal">{error}</Callout>}

      <div className="material-split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Scan material pickup</h2>
              <p className="section-sub">Gunakan scanner atau input kode manual</p>
            </div>
            <Badge tone="success" dot>
              Scanner online
            </Badge>
          </div>

          <div className="scan-box">
            <div className="scan-icon">
              <ScanLine size={25} />
            </div>
            <strong>{scanned ? 'BOX TERBACA' : 'SCAN KANBAN BOX'}</strong>
            <span>
              {scanned
                ? '5220K814 · 35 pcs · Sub Assy Store'
                : 'Arahkan scanner ke barcode Kanban Sub Assy'}
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

          <div className="stack" style={{ marginTop: 14 }}>
            <div className="glass-inset" style={{ padding: 14 }}>
              <div className="section-title" style={{ fontSize: 12, marginBottom: 8 }}>
                Langkah pengambilan
              </div>
              <div className="stack-sm">
                {[
                  { icon: ScanBarcode, text: 'Scan Kanban Belanja dari Area Assy.' },
                  { icon: Boxes, text: 'Scan setiap box Kanban Sub Assy yang diambil.' },
                  { icon: MapPin, text: 'Validasi PN dan lokasi asal box.' },
                  { icon: CheckCircle2, text: 'Konfirmasi qty aktual dan kurangi stok Store.' },
                ].map((step, index) => (
                  <div className="row row--start" key={step.text} style={{ gap: 9 }}>
                    <span className="queue-mini__num">{index + 1}</span>
                    <span className="small muted" style={{ lineHeight: 1.5 }}>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <Callout tone="warning">
              Box yang sama tidak boleh menghasilkan transaksi ganda. Sistem akan menolak scan
              ulang untuk Kanban yang sudah diproses.
            </Callout>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Hasil scan</h2>
                <p className="section-sub">Validasi sebelum konfirmasi</p>
              </div>
              <StatusBadge status={scanned ? 'picked' : 'waiting'} label={scanned ? 'Valid' : 'Menunggu'} />
            </div>

            <div className="scan-result">
              <div className="scan-result__item">
                <span>Part Number</span>
                <strong>{scanned ? '5220K814' : '—'}</strong>
              </div>
              <div className="scan-result__item">
                <span>Quantity</span>
                <strong>{scanned ? '35 pcs' : '—'}</strong>
              </div>
              <div className="scan-result__item">
                <span>Lokasi asal</span>
                <strong>{scanned ? 'Sub Assy Store' : '—'}</strong>
              </div>
              <div className="scan-result__item">
                <span>Kanban</span>
                <strong>{scanned ? 'SK-2611-042' : '—'}</strong>
              </div>
              <div className="scan-result__item">
                <span>Request</span>
                <strong>{scanned ? 'MR-00125' : '—'}</strong>
              </div>
              <div className="scan-result__item">
                <span>Stok sebelum</span>
                <strong>{scanned ? '70 pcs' : '—'}</strong>
              </div>
            </div>

            <div className="form-actions">
              <Button
                variant="primary"
                block
                leftIcon={<PackageCheck size={15} />}
                disabled={!scanned}
                onClick={async () => {
                  const result = await addFromScan({
                    code: `SK-${Date.now().toString().slice(-8)}`,
                    partNumber: '5220K814',
                    model: 'RN',
                    type: 'Sub Assy',
                    process: 'SS.H',
                    qty: 35,
                  })
                  if (!result.ok) {
                    setError(result.error ?? 'Permintaan replenishment gagal dibuat.')
                    return
                  }
                  setConfirmed(true)
                  setScanned(false)
                  setError('')
                }}
              >
                Konfirmasi pengambilan
              </Button>
            </div>

            <div className="progress-meta" style={{ marginTop: 10 }}>
              <span>Stok setelah transaksi</span>
              <strong>35 pcs</strong>
            </div>
            <div className="progress" style={{ marginTop: 4 }}>
              <span className="progress__fill" style={{ width: '25%' }} />
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Dampak transaksi</h2>
                <p className="section-sub">Otomatis setelah konfirmasi</p>
              </div>
            </div>
            <div className="stack-sm">
              {[
                'Stok Sub Assy Store berkurang 35 pcs.',
                'Replenishment queue #05 dibuat untuk 35 pcs.',
                'Riwayat transaksi mencatat user dan waktu.',
                'Indikator kebutuhan produksi diperbarui.',
              ].map((text) => (
                <div className="row row--start" key={text} style={{ gap: 8 }}>
                  <CheckCircle2 size={15} className="text-green" style={{ marginTop: 1 }} />
                  <span className="small muted">{text}</span>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              style={{ paddingLeft: 0, marginTop: 10 }}
              rightIcon={<ArrowRight size={13} />}
            >
              Lihat antrean replenishment
            </Button>
          </section>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Pengambilan terakhir</h2>
            <p className="section-sub">Transaksi Supply hari ini</p>
          </div>
          <Badge tone="neutral">{formatNumber(recentPicks.reduce((sum, row) => sum + row.qty, 0))} pcs</Badge>
        </div>
        <DataTable
          columns={columns}
          rows={recentPicks}
          rowKey={(row) => row.id}
          minWidth={640}
          compact
        />
      </section>
    </div>
  )
}
