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
import { usePreferences } from '../../contexts/PreferencesContext'
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
  const { t } = usePreferences()
  const { addFromScan } = useQueue()
  const [scanned, setScanned] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  const columns: Column<PickRow>[] = [
    { key: 'time', header: t('Waktu', 'Time'), render: (row) => <span className="mono muted">{row.time}</span> },
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
    { key: 'status', header: t('Status', 'Status'), render: (row) => <StatusBadge status={row.status} /> },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Material Control"
        title={t('Pengambilan Material oleh Supply', 'Material Pickup by Supply')}
        subtitle={t(
          'Scan Kanban Belanja lalu scan box Sub Assy yang diambil. Setiap pengambilan aktual langsung membuat kebutuhan replenishment.',
          'Scan the Kanban Belanja then scan each Sub Assy box picked. Every actual pickup immediately creates a replenishment requirement.',
        )}
        meta={
          <>
            <span className="page-meta__item">
              <ScanBarcode size={12} /> Scan mode
            </span>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> {t('Satu box = satu transaksi', 'One box = one transaction')}
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<ClipboardCheck size={15} />}>
            {t('Buka daftar request', 'Open request list')}
          </Button>
        }
      />

      {confirmed && (
        <Callout tone="success" title={t('Pengambilan berhasil', 'Pickup successful')}>
          {t(
            '35 pcs 5220K814 sudah diambil dari Sub Assy Store. Permintaan replenishment masuk ke Admin untuk dialokasikan ke shift produksi.',
            '35 pcs 5220K814 has been picked from Sub Assy Store. The replenishment request is sent to Admin to be allocated to a production shift.',
          )}
        </Callout>
      )}
      {error && <Callout tone="danger" title={t('Pengambilan gagal', 'Pickup failed')}>{error}</Callout>}

      <div className="material-split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{t('Scan material pickup', 'Scan material pickup')}</h2>
              <p className="section-sub">{t('Gunakan scanner atau input kode manual', 'Use a scanner or enter the code manually')}</p>
            </div>
            <Badge tone="success" dot>
              {t('Scanner online', 'Scanner online')}
            </Badge>
          </div>

          <div className="scan-box">
            <div className="scan-icon">
              <ScanLine size={25} />
            </div>
            <strong>{scanned ? t('BOX TERBACA', 'BOX SCANNED') : t('SCAN KANBAN BOX', 'SCAN KANBAN BOX')}</strong>
            <span>
              {scanned
                ? '5220K814 · 35 pcs · Sub Assy Store'
                : t('Arahkan scanner ke barcode Kanban Sub Assy', 'Point the scanner at the Sub Assy Kanban barcode')}
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
              {scanned ? t('Scan ulang', 'Scan again') : t('Simulasikan scan', 'Simulate scan')}
            </Button>
          </div>

          <div className="stack" style={{ marginTop: 14 }}>
            <div className="glass-inset" style={{ padding: 14 }}>
              <div className="section-title" style={{ fontSize: 12, marginBottom: 8 }}>
                {t('Langkah pengambilan', 'Pickup steps')}
              </div>
              <div className="stack-sm">
                {[
                  { icon: ScanBarcode, text: t('Scan Kanban Belanja dari Area Assy.', 'Scan the Kanban Belanja from the Assy Area.') },
                  { icon: Boxes, text: t('Scan setiap box Kanban Sub Assy yang diambil.', 'Scan each Sub Assy Kanban box picked.') },
                  { icon: MapPin, text: t('Validasi PN dan lokasi asal box.', 'Validate the PN and the box origin location.') },
                  { icon: CheckCircle2, text: t('Konfirmasi qty aktual dan kurangi stok Store.', 'Confirm the actual qty and deduct Store stock.') },
                ].map((step, index) => (
                  <div className="row row--start" key={step.text} style={{ gap: 9 }}>
                    <span className="queue-mini__num">{index + 1}</span>
                    <span className="small muted" style={{ lineHeight: 1.5 }}>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <Callout tone="warning">
              {t(
                'Box yang sama tidak boleh menghasilkan transaksi ganda. Sistem akan menolak scan ulang untuk Kanban yang sudah diproses.',
                'The same box must not produce duplicate transactions. The system will reject a rescan of an already processed Kanban.',
              )}
            </Callout>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">{t('Hasil scan', 'Scan result')}</h2>
                <p className="section-sub">{t('Validasi sebelum konfirmasi', 'Validate before confirming')}</p>
              </div>
              <StatusBadge status={scanned ? 'picked' : 'waiting'} label={scanned ? t('Valid', 'Valid') : t('Menunggu', 'Waiting')} />
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
                <span>{t('Lokasi asal', 'Origin location')}</span>
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
                <span>{t('Stok sebelum', 'Stock before')}</span>
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
                    setError(result.error ?? t('Permintaan replenishment gagal dibuat.', 'Failed to create replenishment request.'))
                    return
                  }
                  setConfirmed(true)
                  setScanned(false)
                  setError('')
                }}
              >
                {t('Konfirmasi pengambilan', 'Confirm pickup')}
              </Button>
            </div>

            <div className="progress-meta" style={{ marginTop: 10 }}>
              <span>{t('Stok setelah transaksi', 'Stock after transaction')}</span>
              <strong>35 pcs</strong>
            </div>
            <div className="progress" style={{ marginTop: 4 }}>
              <span className="progress__fill" style={{ width: '25%' }} />
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">{t('Dampak transaksi', 'Transaction impact')}</h2>
                <p className="section-sub">{t('Otomatis setelah konfirmasi', 'Automatic after confirmation')}</p>
              </div>
            </div>
            <div className="stack-sm">
              {[
                t('Stok Sub Assy Store berkurang 35 pcs.', 'Sub Assy Store stock decreases by 35 pcs.'),
                t('Replenishment queue #05 dibuat untuk 35 pcs.', 'Replenishment queue #05 is created for 35 pcs.'),
                t('Riwayat transaksi mencatat user dan waktu.', 'The transaction history records the user and time.'),
                t('Indikator kebutuhan produksi diperbarui.', 'Production requirement indicators are updated.'),
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
              {t('Lihat antrean replenishment', 'View replenishment queue')}
            </Button>
          </section>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">{t('Pengambilan terakhir', 'Recent pickups')}</h2>
            <p className="section-sub">{t('Transaksi Supply hari ini', 'Supply transactions today')}</p>
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
