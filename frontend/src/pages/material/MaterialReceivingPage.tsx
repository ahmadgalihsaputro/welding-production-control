import { CheckCircle2, MapPin, PackageCheck, PackageSearch, ScanBarcode } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { externalMaterials as initialMaterials } from '../../data/mock'
import { formatNumber } from '../../lib/utils'

export function MaterialReceivingPage() {
  const [materials, setMaterials] = useState(initialMaterials)
  const [selectedId, setSelectedId] = useState(initialMaterials[0].id)
  const [received, setReceived] = useState(initialMaterials[0].need)
  const [ng, setNg] = useState(0)
  const [location, setLocation] = useState('R-G / EXT / 01')
  const [message, setMessage] = useState('')

  const selected = materials.find((item) => item.id === selectedId) ?? materials[0]

  const selectMaterial = (id: string) => {
    const item = materials.find((entry) => entry.id === id)
    setSelectedId(id)
    setReceived(item?.need ?? 0)
    setNg(0)
    setMessage('')
  }

  const confirm = () => {
    setMaterials((current) =>
      current.map((item) =>
        item.id === selected.id
          ? {
              ...item,
              received: Math.min(item.received + received, item.need),
              status: item.received + received >= item.need ? 'received' : 'partial',
            }
          : item,
      ),
    )
    setMessage(
      `${formatNumber(received)} pcs ${selected.partNumber} diterima di ${location}. Stok area external diperbarui.`,
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Material Control"
        title="Penerimaan Material Eksternal"
        subtitle="Catat material yang benar-benar sudah tiba di area Welding. Penerimaan harus menyertakan qty baik dan qty bermasalah."
        meta={
          <>
            <span className="page-meta__item">
              <PackageSearch size={12} /> {materials.filter((item) => item.status !== 'received').length} menunggu
            </span>
            <span className="page-meta__item">
              <MapPin size={12} /> Area External Material
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<ScanBarcode size={15} />}>
            Scan material
          </Button>
        }
      />

      {message && (
        <Callout tone="success" title="Penerimaan tercatat">
          {message}
        </Callout>
      )}

      <div className="material-split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Antrean penerimaan</h2>
              <p className="section-sub">Pilih material yang tiba</p>
            </div>
            <Badge tone="warning">{materials.filter((item) => item.status !== 'received').length} pending</Badge>
          </div>

          <div className="stack-sm">
            {materials.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`request-item${item.id === selected.id ? ' is-active' : ''}`}
                onClick={() => selectMaterial(item.id)}
              >
                <div className="request-item__icon">
                  <PackageSearch size={17} />
                </div>
                <div className="grow">
                  <div className="row row--between">
                    <span className="cell-main">{item.partNumber}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="row row--between" style={{ marginTop: 3 }}>
                    <span className="tiny muted">
                      {item.source} · {formatNumber(item.need)} pcs
                    </span>
                    <span className="tiny muted">{item.requestedAt}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="table-footer">
            <span>Penerimaan menambah stok setelah dikonfirmasi</span>
            <span>Robot G</span>
          </div>
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Form penerimaan</h2>
              <p className="section-sub">{selected.partNumber} dari {selected.source}</p>
            </div>
            <StatusBadge status={selected.status} />
          </div>

          <div className="glass-inset" style={{ padding: 14, marginBottom: 14 }}>
            <div className="row row--between">
              <div>
                <span className="info-label">Kebutuhan</span>
                <span className="info-value info-value--strong">{formatNumber(selected.need)} pcs</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="info-label">Sudah diterima</span>
                <span className="info-value info-value--strong">{formatNumber(selected.received)} pcs</span>
              </div>
            </div>
            <div className="progress" style={{ marginTop: 10 }}>
              <span
                className="progress__fill"
                style={{ width: `${(selected.received / Math.max(selected.need, 1)) * 100}%` }}
              />
            </div>
          </div>

          <div className="form-grid">
            <Field label="Qty diterima (pcs)" htmlFor="received-qty">
              <input
                id="received-qty"
                className="input"
                type="number"
                min={0}
                value={received}
                onChange={(event) => setReceived(Number(event.target.value))}
              />
            </Field>
            <Field label="Qty bermasalah / NG" htmlFor="received-ng" hint="Isi 0 jika tidak ada masalah.">
              <input
                id="received-ng"
                className="input"
                type="number"
                min={0}
                value={ng}
                onChange={(event) => setNg(Number(event.target.value))}
              />
            </Field>
            <Field label="Lokasi penyimpanan" htmlFor="received-location">
              <select
                id="received-location"
                className="select"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              >
                <option>R-G / EXT / 01</option>
                <option>R-G / EXT / 02</option>
                <option>Area Return Pending</option>
              </select>
            </Field>
            <Field label="Catatan penerimaan" htmlFor="received-note">
              <input id="received-note" className="input" placeholder="Nomor surat jalan, dll…" />
            </Field>
          </div>

          <div className="form-actions">
            <Button
              variant="primary"
              leftIcon={<PackageCheck size={15} />}
              onClick={confirm}
              disabled={received <= 0}
            >
              Konfirmasi penerimaan
            </Button>
          </div>

          <div className="stack-sm" style={{ marginTop: 14 }}>
            <div className="row row--start" style={{ gap: 8 }}>
              <CheckCircle2 size={14} className="text-green" style={{ marginTop: 1 }} />
              <span className="tiny muted">Stok hanya berubah setelah tombol konfirmasi ditekan.</span>
            </div>
            <div className="row row--start" style={{ gap: 8 }}>
              <CheckCircle2 size={14} className="text-green" style={{ marginTop: 1 }} />
              <span className="tiny muted">Qty NG dicatat terpisah dan tidak menambah stok baik.</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
