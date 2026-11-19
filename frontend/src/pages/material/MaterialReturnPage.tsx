import { CheckCircle2, FileWarning, Printer, RotateCcw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { usePreferences } from '../../contexts/PreferencesContext'
import { formatNumber } from '../../lib/utils'

interface ReturnEntry {
  id: string
  code: string
  partNumber: string
  qty: number
  status: 'pending' | 'received'
  time: string
}

const initialReturns: ReturnEntry[] = [
  { id: 'rt-1', code: 'RK-0091', partNumber: '5220K814', qty: 18, status: 'pending', time: '09:25' },
  { id: 'rt-2', code: 'RK-0090', partNumber: '50162B000P', qty: 35, status: 'received', time: '08:50' },
]

const reasonEnglish: Record<string, string> = {
  'Sisa produksi': 'Production remainder',
  'Perubahan jadwal': 'Schedule change',
  'Material tidak sesuai': 'Material mismatch',
  'Box rusak': 'Damaged box',
}

export function MaterialReturnPage() {
  const { t } = usePreferences()
  const [returns, setReturns] = useState(initialReturns)
  const [qty, setQty] = useState(18)
  const [reason, setReason] = useState('Sisa produksi')
  const [generated, setGenerated] = useState('')
  const standard = 50

  const generateReturn = () => {
    if (qty <= 0 || qty > standard) return
    const code = `RK-${String(92 + returns.length).padStart(4, '0')}`
    setReturns((current) => [
      { id: `rt-${Date.now()}`, code, partNumber: '5220K814', qty, status: 'pending', time: '09:35' },
      ...current,
    ])
    setGenerated(code)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Material Control"
        title="Pengembalian Material"
        subtitle="Buat Return Kanban dari sisa material di area produksi. Stok baru bertambah setelah petugas menerima dan memverifikasi return."
        meta={
          <>
            <span className="page-meta__item">
              <RotateCcw size={12} /> Partial return
            </span>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> Verifikasi penerimaan
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<Printer size={15} />}>
            Cetak Return Kanban
          </Button>
        }
      />

      {generated && (
        <Callout tone="success" title={`${generated} berhasil dibuat`}>
          Return Kanban menunggu verifikasi penerimaan. Stok belum bertambah sampai petugas
          menerima return.
        </Callout>
      )}

      <div className="material-split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Buat return</h2>
              <p className="section-sub">Original Kanban · 5220K814</p>
            </div>
            <Badge tone="orange">Standard 50 pcs</Badge>
          </div>

          <div className="glass-inset" style={{ padding: 14, marginBottom: 14 }}>
            <div className="row row--between">
              <div>
                <span className="info-label">Original Kanban</span>
                <span className="info-value info-value--strong">SK-2611-040 · 5220K814</span>
              </div>
              <StatusBadge status="complete" label="Consumed" />
            </div>
            <div className="progress-meta" style={{ marginTop: 10 }}>
              <span>Sisa material</span>
              <strong>{qty} / {standard} pcs</strong>
            </div>
            <div className="progress" style={{ marginTop: 5 }}>
              <span
                className="progress__fill"
                style={{ width: `${Math.min((qty / standard) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="form-grid">
            <Field label="Sisa material (pcs)" htmlFor="return-qty" hint="Tidak boleh melebihi standard packaging.">
              <input
                id="return-qty"
                className="input"
                type="number"
                min={1}
                max={standard}
                value={qty}
                onChange={(event) => setQty(Number(event.target.value))}
              />
            </Field>
            <Field label="Alasan return" htmlFor="return-reason">
              <select
                id="return-reason"
                className="select"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                <option>Sisa produksi</option>
                <option>Perubahan jadwal</option>
                <option>Material tidak sesuai</option>
                <option>Box rusak</option>
              </select>
            </Field>
            <Field label="Lokasi tujuan" htmlFor="return-location">
              <select id="return-location" className="select" defaultValue="Sub Assy Store">
                <option>Sub Assy Store</option>
                <option>Area Return Pending</option>
              </select>
            </Field>
            <Field label="Catatan" htmlFor="return-note">
              <input id="return-note" className="input" placeholder="Opsional…" />
            </Field>
          </div>

          <div className="form-actions">
            <Button
              variant="primary"
              leftIcon={<RotateCcw size={15} />}
              onClick={generateReturn}
              disabled={qty <= 0 || qty > standard}
            >
              Generate Return Kanban
            </Button>
          </div>
        </section>

        <div className="stack">
          <section className="card kanban-preview">
            <div className="kanban-preview__head">
              <strong>WPC · RETURN KANBAN</strong>
              <span>{generated || 'DRAFT'}</span>
            </div>
            <h3>5220K814</h3>
            <p>Sub Assy Bolt Bracket · Robot G</p>
            <div className="kanban-meta">
              <div>
                <span>Quantity</span>
                <strong>{qty} pcs</strong>
              </div>
              <div>
                <span>Original</span>
                <strong>SK-2611-040</strong>
              </div>
              <div>
                <span>Reason</span>
                <strong>{reason}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>Pending Receipt</strong>
              </div>
            </div>
            <div className="barcode" />
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Return pending</h2>
                <p className="section-sub">Menunggu verifikasi petugas</p>
              </div>
              <Badge tone="warning">
                {returns.filter((item) => item.status === 'pending').length} pending
              </Badge>
            </div>

            <div className="stack-sm">
              {returns.map((item) => (
                <div className="alert-row" key={item.id}>
                  <div
                    className={`alert-icon ${
                      item.status === 'pending' ? 'stat-icon--amber' : 'stat-icon--green'
                    }`}
                  >
                    {item.status === 'pending' ? (
                      <FileWarning size={15} />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                  </div>
                  <div className="alert-copy">
                    <span className="alert-title">{item.code} · {item.partNumber}</span>
                    <span className="alert-detail">
                      {formatNumber(item.qty)} pcs · {item.time}
                    </span>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          </section>

          <Callout tone="info" title="Stok bertambah setelah diterima">
            Petugas penerimaan dapat menerima atau menolak return dengan alasan. Stok hanya
            berubah ketika Return Kanban berstatus diterima.
          </Callout>
        </div>
      </div>
    </div>
  )
}
