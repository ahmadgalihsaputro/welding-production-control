import { CheckCircle2, ClipboardCheck, FilePlus2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { stockItems } from '../../data/mock'
import { formatNumber } from '../../lib/utils'

interface AdjustmentEntry {
  id: string
  code: string
  partNumber: string
  difference: number
  reason: string
  status: 'pending' | 'approved'
  user: string
}

const initialAdjustments: AdjustmentEntry[] = [
  { id: 'adj-1', code: 'ADJ-0021', partNumber: '5220K814', difference: -3, reason: 'Stock opname', status: 'pending', user: 'Dimas Prakoso' },
  { id: 'adj-2', code: 'ADJ-0020', partNumber: '5220K816', difference: -5, reason: 'Material defect', status: 'approved', user: 'Rina Puspita' },
  { id: 'adj-3', code: 'ADJ-0019', partNumber: '90101B010', difference: 12, reason: 'Salah input', status: 'approved', user: 'Dimas Prakoso' },
]

export function StockAdjustmentPage() {
  const [partNumber, setPartNumber] = useState('5220K814')
  const [systemQty, setSystemQty] = useState(85)
  const [physicalQty, setPhysicalQty] = useState(82)
  const [reason, setReason] = useState('Stock opname')
  const [note, setNote] = useState('')
  const [adjustments, setAdjustments] = useState(initialAdjustments)
  const [message, setMessage] = useState('')

  const difference = physicalQty - systemQty

  const submit = () => {
    if (difference === 0) {
      setMessage('Tidak ada selisih. Adjustment tidak diperlukan.')
      return
    }
    const code = `ADJ-${String(22 + adjustments.length).padStart(4, '0')}`
    setAdjustments((current) => [
      {
        id: `adj-${Date.now()}`,
        code,
        partNumber,
        difference,
        reason,
        status: 'pending',
        user: 'Rina Puspita',
      },
      ...current,
    ])
    setMessage(
      `${code} diajukan. Menunggu persetujuan Leader/Admin sebelum stok dikoreksi.`,
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Inventory Control"
        title="Stock Adjustment"
        subtitle="Catat selisih stok fisik dan sistem. Adjustment tidak menghapus histori lama — koreksi dibuat sebagai transaksi baru dengan alasan dan persetujuan."
        meta={
          <>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> Perlu persetujuan
            </span>
            <span className="page-meta__item">
              <ClipboardCheck size={12} /> Leader / Admin
            </span>
          </>
        }
      />

      {message && (
        <Callout tone={message.includes('diajukan') ? 'success' : 'warning'}>{message}</Callout>
      )}

      <div className="kpi-grid kpi-grid--3">
        <StatCard
          label="Pending approval"
          value={String(adjustments.filter((item) => item.status === 'pending').length)}
          suffix="request"
          icon={ClipboardCheck}
          tone="amber"
          note="Menunggu verifikasi"
        />
        <StatCard
          label="Disetujui bulan ini"
          value={String(adjustments.filter((item) => item.status === 'approved').length)}
          suffix="request"
          icon={CheckCircle2}
          tone="green"
          note="Sudah dikoreksi"
        />
        <StatCard
          label="Total selisih"
          value={formatNumber(adjustments.reduce((sum, item) => sum + Math.abs(item.difference), 0))}
          suffix="pcs"
          icon={TriangleAlert}
          tone="red"
          note="Akumulasi adjustment"
        />
      </div>

      <div className="material-split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Form adjustment</h2>
              <p className="section-sub">Bandingkan stok sistem dan fisik</p>
            </div>
            <Badge tone="neutral">Draft</Badge>
          </div>

          <div className="form-grid">
            <Field label="Part Number" htmlFor="adj-part" className="span-2">
              <div className="select-wrap">
                <select
                  id="adj-part"
                  className="select"
                  value={partNumber}
                  onChange={(event) => setPartNumber(event.target.value)}
                >
                  {stockItems.map((item) => (
                    <option key={item.partNumber} value={item.partNumber}>
                      {item.partNumber} — {item.description}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            <Field label="Qty sistem" htmlFor="adj-system">
              <input
                id="adj-system"
                className="input"
                type="number"
                value={systemQty}
                onChange={(event) => setSystemQty(Number(event.target.value))}
              />
            </Field>
            <Field label="Qty fisik" htmlFor="adj-physical">
              <input
                id="adj-physical"
                className="input"
                type="number"
                value={physicalQty}
                onChange={(event) => setPhysicalQty(Number(event.target.value))}
              />
            </Field>
            <Field label="Alasan adjustment" htmlFor="adj-reason">
              <select
                id="adj-reason"
                className="select"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                <option>Stock opname</option>
                <option>Material defect</option>
                <option>Salah input transaksi</option>
                <option>Kehilangan material</option>
                <option>Koreksi return</option>
              </select>
            </Field>
            <Field label="Lokasi" htmlFor="adj-location">
              <select id="adj-location" className="select" defaultValue="Sub Assy Store">
                <option>Sub Assy Store</option>
                <option>Assy Store</option>
                <option>Production Buffer</option>
                <option>Area External Material</option>
              </select>
            </Field>
            <Field
              label="Catatan / bukti"
              htmlFor="adj-note"
              hint="Sertakan referensi berita acara atau bukti opname."
              className="span-2"
            >
              <textarea
                id="adj-note"
                className="textarea"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Contoh: berita acara stock opname 12 Nov 2026, halaman 2…"
              />
            </Field>
          </div>

          <div className="glass-inset" style={{ padding: 14, marginTop: 14 }}>
            <div className="row row--between">
              <div>
                <span className="info-label">Selisih</span>
                <strong
                  className={`report-value ${
                    difference < 0 ? 'text-red' : difference > 0 ? 'text-green' : ''
                  }`}
                >
                  {difference > 0 ? '+' : ''}
                  {formatNumber(difference)} <small>pcs</small>
                </strong>
              </div>
              <StatusBadge
                status={difference === 0 ? 'normal' : 'pending'}
                label={difference === 0 ? 'Tidak ada selisih' : 'Perlu approval'}
              />
            </div>
          </div>

          <div className="form-actions">
            <Button variant="secondary">Simpan draft</Button>
            <Button
              variant="primary"
              leftIcon={<FilePlus2 size={15} />}
              onClick={submit}
              disabled={difference === 0}
            >
              Ajukan approval
            </Button>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Riwayat adjustment</h2>
                <p className="section-sub">Approval & koreksi stok</p>
              </div>
              <Badge tone="neutral">{adjustments.length} request</Badge>
            </div>

            <div className="stack-sm">
              {adjustments.map((item) => (
                <div className="alert-row" key={item.id}>
                  <div
                    className={`alert-icon ${
                      item.status === 'pending' ? 'stat-icon--amber' : 'stat-icon--green'
                    }`}
                  >
                    {item.status === 'pending' ? (
                      <TriangleAlert size={15} />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                  </div>
                  <div className="alert-copy">
                    <span className="alert-title">
                      {item.code} · {item.partNumber}
                    </span>
                    <span className="alert-detail">
                      {item.reason} · {item.user}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={`mono small ${item.difference < 0 ? 'text-red' : 'text-green'}`}>
                      {item.difference > 0 ? '+' : ''}
                      {item.difference}
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Callout tone="warning" title="Operator tidak boleh adjustment">
            Hanya Leader yang dapat mengajukan, dan Admin yang dapat menyetujui. Setiap koreksi
            membuat transaksi baru; histori lama tetap tersimpan.
          </Callout>
        </div>
      </div>
    </div>
  )
}
