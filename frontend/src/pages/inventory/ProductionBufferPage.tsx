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
import { usePreferences } from '../../contexts/PreferencesContext'
import { bufferItems as initialBuffer } from '../../data/mock'
import { getProductionPart } from '../../data/productionLines'
import { formatNumber } from '../../lib/utils'

export function ProductionBufferPage() {
  const navigate = useNavigate()
  const { activeLine } = useAuth()
  const { t } = usePreferences()
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
      `${item.qty} pcs ${item.partNumber} ${t('berhasil di-Store In dari Production Buffer ke Assy Store.', 'successfully Stored In from Production Buffer to Assy Store.')}`,
    )
  }

  const storeAll = () => {
    if (lineItems.length === 0) return
    setMessage(`${lineItems.length} box ${t('berhasil di-Store In ke Assy Store.', 'successfully Stored In to Assy Store.')}`)
    const lineItemIds = new Set(lineItems.map((item) => item.id))
    setItems((current) => current.filter((item) => !lineItemIds.has(item.id)))
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Inventory Control"
        title="Production Buffer"
        subtitle={t(
          'Hasil produksi selesai tetapi belum masuk Store. Pantau lama barang menunggu Store In agar tidak menumpuk di area buffer.',
          'Finished production that has not yet entered the Store. Monitor how long items wait for Store In so they do not pile up in the buffer area.',
        )}
        meta={
          <>
            <span className="page-meta__item">
              <Warehouse size={12} /> {activeLine === 'all' ? t('Semua line', 'All lines') : activeLine} — Production Buffer
            </span>
            <span className="page-meta__item">
              <Clock3 size={12} /> {t('Update 09:41', 'Updated 09:41')}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/inventory/ledger')}>
              {t('Mutasi stok', 'Stock Movements')}
            </Button>
            <Button variant="primary" leftIcon={<Store size={15} />} onClick={storeAll}>
              {t('Store In semua', 'Store In All')}
            </Button>
          </>
        }
      />

      {message && <Callout tone="success">{message}</Callout>}

      <div className="kpi-grid">
        <StatCard
          label={t('Box di buffer', 'Boxes in buffer')}
          value={String(lineItems.length)}
          suffix="box"
          icon={Boxes}
          tone="orange"
          note={t('Menunggu Store In', 'Waiting for Store In')}
        />
        <StatCard
          label={t('Total qty', 'Total qty')}
          value={formatNumber(totalPcs)}
          suffix="pcs"
          icon={PackageCheck}
          tone="sky"
          note={t('Hasil produksi selesai', 'Finished production')}
        />
        <StatCard
          label={t('Paling lama', 'Longest wait')}
          value={String(oldest)}
          suffix={t('mnt', 'min')}
          icon={Timer}
          tone="amber"
          note={t('Box menunggu terlama', 'Longest waiting box')}
        />
        <StatCard
          label={t('Store In hari ini', 'Store In today')}
          value="6"
          suffix="box"
          icon={Store}
          tone="green"
          note={t('Selesai dipindahkan', 'Completed transfers')}
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
                  <span>{t('Selesai', 'Completed')}</span>
                  <strong>{item.completedAt}</strong>
                </div>
                <div>
                  <span>{t('Menunggu', 'Waiting')}</span>
                  <strong className={item.waitingMinutes > 60 ? 'text-amber' : ''}>
                    {item.waitingMinutes} {t('mnt', 'min')}
                  </strong>
                </div>
              </div>

              <div className="row row--between" style={{ fontSize: 10 }}>
                <span className="muted">Operator: {item.operator}</span>
                <span className="badge badge--warning">{item.waitingMinutes > 60 ? t('Perlu segera', 'Needs attention') : 'Normal'}</span>
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
            <strong>{t('Production Buffer kosong', 'Production Buffer is empty')}</strong>
            <p>{t(
              'Semua hasil produksi sudah dipindahkan ke Store. Buffer bersih dan siap menerima box berikutnya.',
              'All finished production has been moved to the Store. The buffer is clear and ready for the next box.',
            )}</p>
          </div>
        </section>
      )}

      <div className="grid grid-2">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{t('Alur Buffer → Store', 'Buffer → Store Flow')}</h2>
              <p className="section-sub">{t('Kontrol perpindahan barang', 'Item movement control')}</p>
            </div>
          </div>
          <div className="timeline">
            {[
              { time: '08:30', title: t('Box dikonfirmasi', 'Box confirmed'), detail: t('39 pcs 5220BA42 masuk Production Buffer', '39 pcs 5220BA42 entered Production Buffer') },
              { time: '08:45', title: t('Store In diterima', 'Store In received'), detail: t('35 pcs 5220K814 masuk Sub Assy Store', '35 pcs 5220K814 entered Sub Assy Store') },
              { time: '09:10', title: t('Buffer aging 52 menit', 'Buffer aging 52 minutes'), detail: t('5220BA42 menunggu dipindahkan', '5220BA42 waiting to be moved') },
              { time: '09:41', title: t('Stock update', 'Stock update'), detail: t('Assy Store menerima box terbaru', 'Assy Store received the latest box') },
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
          <Callout tone="warning" title={t('Aging buffer', 'Buffer aging')}>
            {t(
              'Box dengan waktu tunggu di atas 60 menit ditandai kuning. Pastikan area buffer tidak penuh dan hasil produksi segera di-Store In.',
              'Boxes waiting more than 60 minutes are marked yellow. Make sure the buffer area is not full and finished production is Stored In promptly.',
            )}
          </Callout>
          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">{t('Ringkasan buffer', 'Buffer Summary')}</h2>
                <p className="section-sub">{t('Per part number', 'Per part number')}</p>
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
              {lineItems.length === 0 && <span className="small muted">{t('Tidak ada box menunggu.', 'No boxes waiting.')}</span>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              style={{ paddingLeft: 0, marginTop: 10 }}
              rightIcon={<ArrowRight size={13} />}
              onClick={() => navigate('/inventory/assy-store')}
            >
              {t('Buka Assy Store', 'Open Assy Store')}
            </Button>
          </section>
        </div>
      </div>
    </div>
  )
}
