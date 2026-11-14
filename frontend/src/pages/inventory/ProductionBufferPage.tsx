import {
  ArrowRight,
  Boxes,
  Clock3,
  PackageCheck,
  Store,
  Timer,
  Warehouse,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { bufferItems as initialBuffer } from '../../data/mock'
import { getProductionPart } from '../../data/productionLines'
import { formatNumber } from '../../lib/utils'

export function ProductionBufferPage() {
  const navigate = useNavigate()
  const { activeLine } = useAuth()
  const [items, setItems] = useState(initialBuffer)
  const [message, setMessage] = useState('')
  const lineItems = items.filter((item) => {
    const line = getProductionPart(item.partNumber)?.line ?? 'Robot G'
    return activeLine === 'all' || line === activeLine
  })

  const totalPcs = lineItems.reduce((sum, item) => sum + item.qty, 0)
  const oldest = Math.max(...lineItems.map((item) => item.waitingMinutes), 0)

  const storeIn = (id: string) => {
    const item = items.find((entry) => entry.id === id)
    if (!item) return
    setItems((current) => current.filter((entry) => entry.id !== id))
    setMessage(
      `${item.qty} pcs ${item.partNumber} berhasil di-Store In dari Production Buffer ke Assy Store.`,
    )
  }

  const storeAll = () => {
    if (lineItems.length === 0) return
    setMessage(`${lineItems.length} box berhasil di-Store In ke Assy Store.`)
    const lineItemIds = new Set(lineItems.map((item) => item.id))
    setItems((current) => current.filter((item) => !lineItemIds.has(item.id)))
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Inventory Control"
        title="Production Buffer"
        subtitle="Hasil produksi selesai tetapi belum masuk Store. Pantau lama barang menunggu Store In agar tidak menumpuk di area buffer."
        meta={
          <>
            <span className="page-meta__item">
              <Warehouse size={12} /> {activeLine === 'all' ? 'Semua line' : activeLine} — Production Buffer
            </span>
            <span className="page-meta__item">
              <Clock3 size={12} /> Update 09:41
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/inventory/ledger')}>
              Mutasi stok
            </Button>
            <Button variant="primary" leftIcon={<Store size={15} />} onClick={storeAll}>
              Store In semua
            </Button>
          </>
        }
      />

      {message && <Callout tone="success">{message}</Callout>}

      <div className="kpi-grid">
        <StatCard
          label="Box di buffer"
          value={String(lineItems.length)}
          suffix="box"
          icon={Boxes}
          tone="orange"
          note="Menunggu Store In"
        />
        <StatCard
          label="Total qty"
          value={formatNumber(totalPcs)}
          suffix="pcs"
          icon={PackageCheck}
          tone="sky"
          note="Hasil produksi selesai"
        />
        <StatCard
          label="Paling lama"
          value={String(oldest)}
          suffix="mnt"
          icon={Timer}
          tone="amber"
          note="Box menunggu terlama"
        />
        <StatCard
          label="Store In hari ini"
          value="6"
          suffix="box"
          icon={Store}
          tone="green"
          note="Selesai dipindahkan"
        />
      </div>

      {lineItems.length > 0 ? (
        <div className="queue-cards">
          {lineItems.map((item) => (
            <article className="queue-card" key={item.id}>
              <div className="queue-card__head">
                <div>
                  <h3>{item.partNumber}</h3>
                  <span>Kanban {item.kanban}</span>
                </div>
                <StatusBadge status="pending" label="Waiting Store In" />
              </div>

              <div className="queue-card__metrics">
                <div>
                  <span>Qty</span>
                  <strong>{formatNumber(item.qty)} pcs</strong>
                </div>
                <div>
                  <span>Selesai</span>
                  <strong>{item.completedAt}</strong>
                </div>
                <div>
                  <span>Menunggu</span>
                  <strong className={item.waitingMinutes > 60 ? 'text-amber' : ''}>
                    {item.waitingMinutes} mnt
                  </strong>
                </div>
              </div>

              <div className="row row--between" style={{ fontSize: 10 }}>
                <span className="muted">Operator: {item.operator}</span>
                <span className="badge badge--warning">{item.waitingMinutes > 60 ? 'Perlu segera' : 'Normal'}</span>
              </div>

              <Button
                variant="primary"
                size="sm"
                block
                leftIcon={<Store size={13} />}
                onClick={() => storeIn(item.id)}
              >
                Store In
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <section className="card">
          <div className="empty-state">
            <div className="empty-state__icon">
              <PackageCheck size={22} />
            </div>
            <strong>Production Buffer kosong</strong>
            <p>Semua hasil produksi sudah dipindahkan ke Store. Buffer bersih dan siap menerima box berikutnya.</p>
          </div>
        </section>
      )}

      <div className="grid grid-2">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Alur Buffer → Store</h2>
              <p className="section-sub">Kontrol perpindahan barang</p>
            </div>
          </div>
          <div className="timeline">
            {[
              { time: '08:30', title: 'Box dikonfirmasi', detail: '39 pcs 5220BA42 masuk Production Buffer' },
              { time: '08:45', title: 'Store In diterima', detail: '35 pcs 5220K814 masuk Sub Assy Store' },
              { time: '09:10', title: 'Buffer aging 52 menit', detail: '5220BA42 menunggu dipindahkan' },
              { time: '09:41', title: 'Stock update', detail: 'Assy Store menerima box terbaru' },
            ].map((item) => (
              <div className="timeline-item" key={item.time}>
                <span className="timeline-dot timeline-dot--sky" />
                <div>
                  <div className="timeline-head">
                    <span className="timeline-title">{item.title}</span>
                    <span className="timeline-time">{item.time}</span>
                  </div>
                  <span className="timeline-text">{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="stack">
          <Callout tone="warning" title="Aging buffer">
            Box dengan waktu tunggu di atas 60 menit ditandai kuning. Pastikan area buffer tidak
            penuh dan hasil produksi segera di-Store In.
          </Callout>
          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Ringkasan buffer</h2>
                <p className="section-sub">Per part number</p>
              </div>
              <Badge tone="neutral">              {lineItems.length} box</Badge>
            </div>
            <div className="stack-sm">
              {lineItems.map((item) => (
                <div className="row row--between" key={item.id}>
                  <span className="small strong">{item.partNumber}</span>
                  <span className="small muted">{formatNumber(item.qty)} pcs</span>
                </div>
              ))}
              {lineItems.length === 0 && <span className="small muted">Tidak ada box menunggu.</span>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              style={{ paddingLeft: 0, marginTop: 10 }}
              rightIcon={<ArrowRight size={13} />}
              onClick={() => navigate('/inventory/assy-store')}
            >
              Buka Assy Store
            </Button>
          </section>
        </div>
      </div>
    </div>
  )
}
