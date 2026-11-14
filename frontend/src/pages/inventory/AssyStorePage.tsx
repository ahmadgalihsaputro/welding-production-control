import { ArrowDownLeft, ArrowUpRight, CalendarDays, MapPin, Store } from 'lucide-react'
import { useState } from 'react'
import { AreaChart } from '../../components/charts/AreaChart'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatCard } from '../../components/ui/StatCard'
import { useAuth } from '../../contexts/AuthContext'
import { stockItems, inventoryTrend } from '../../data/mock'
import { getProductionPart } from '../../data/productionLines'
import { formatNumber } from '../../lib/utils'

const movements = [
  { id: 'mv-1', time: '09:12', type: 'Store In', qty: 39, ref: 'KN-2611-041', user: 'Adi Nugroho', tone: 'plus' },
  { id: 'mv-2', time: '08:55', type: 'Collect Pickup', qty: -50, ref: 'DL-88210', user: 'Collect Team', tone: 'minus' },
  { id: 'mv-3', time: '07:40', type: 'Collect Pickup', qty: -50, ref: 'DL-88209', user: 'Collect Team', tone: 'minus' },
  { id: 'mv-4', time: '07:15', type: 'Store In', qty: 40, ref: 'KN-2611-038', user: 'Adi Nugroho', tone: 'plus' },
]

export function AssyStorePage() {
  const { activeLine } = useAuth()
  const assyItems = stockItems.filter((item) => {
    if (item.category !== 'Assy') return false
    const line =
      getProductionPart(item.partNumber)?.line ??
      (item.location.startsWith('R-H') ? 'Robot H' : 'Robot G')
    return activeLine === 'all' || line === activeLine
  })
  const [selectedPart, setSelectedPart] = useState('')
  const selected = assyItems.find((item) => item.partNumber === selectedPart) ?? assyItems[0]

  if (!selected) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Inventory Control"
          title="Assy Store"
          subtitle={`Belum ada stok Assy yang terdaftar untuk ${activeLine === 'all' ? 'semua line' : activeLine}.`}
          meta={<span className="page-meta__item"><MapPin size={12} /> {activeLine}</span>}
        />
        <Callout tone="info" title="Data stok belum tersedia">
          Saldo Assy akan tampil setelah part dan stok untuk line ini dimasukkan.
        </Callout>
      </div>
    )
  }

  const currentQty = selected.store + selected.buffer
  const capacity = (currentQty / selected.maxStore) * 100

  return (
    <div className="page">
      <PageHeader
        eyebrow="Inventory Control"
        title="Assy Store"
        subtitle="Stok Assy siap kirim atau diambil Collect. Saldo per part number, safety stock, dan riwayat Store In maupun pickup tercatat di sini."
        meta={
          <>
            <span className="page-meta__item">
              <MapPin size={12} /> {activeLine === 'all' ? 'Semua line' : activeLine} / AS
            </span>
            <span className="page-meta__item">
              <CalendarDays size={12} /> 12 November 2026
            </span>
          </>
        }
        actions={
          <>
            <div className="select-wrap">
              <select
                className="select"
                value={selected.partNumber}
                onChange={(event) => setSelectedPart(event.target.value)}
                aria-label="Pilih part number"
              >
                {assyItems.map((item) => (
                  <option key={item.partNumber} value={item.partNumber}>
                    {item.partNumber}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="secondary" leftIcon={<Store size={15} />}>
              Store In
            </Button>
          </>
        }
      />

      <section className="card store-hero">
        <div>
          <span className="page-eyebrow" style={{ marginBottom: 4 }}>
            {selected.description}
          </span>
          <h2 className="store-balance">
            {formatNumber(currentQty)} <small>pcs</small>
          </h2>
          <div className="store-hero__meta">
            <span>
              Safety stock <strong>{formatNumber(selected.safetyStock)} pcs</strong>
            </span>
            <span>
              Max store <strong>{formatNumber(selected.maxStore)} pcs</strong>
            </span>
            <span>
              Buffer <strong>{formatNumber(selected.buffer)} pcs</strong>
            </span>
          </div>
        </div>
        <div className="capacity">
          <div className="progress-meta" style={{ marginTop: 0, marginBottom: 5 }}>
            <span>Kapasitas terpakai</span>
            <strong>{capacity.toFixed(0)}%</strong>
          </div>
          <ProgressBar value={capacity} thick tone={capacity > 90 ? 'orange' : 'sky'} />
          <div className="capacity__labels">
            <span>0</span>
            <span>Max {formatNumber(selected.maxStore)}</span>
          </div>
        </div>
      </section>

      <div className="kpi-grid kpi-grid--3">
        <StatCard
          label="Store saldo"
          value={formatNumber(selected.store)}
          suffix="pcs"
          icon={Store}
          tone="sky"
          note="Siap kirim / diambil"
        />
        <StatCard
          label="Safety stock"
          value={formatNumber(selected.safetyStock)}
          suffix="pcs"
          icon={ArrowDownLeft}
          tone="orange"
          note="Batas minimum"
        />
        <StatCard
          label="Buffer"
          value={formatNumber(selected.buffer)}
          suffix="pcs"
          icon={ArrowUpRight}
          tone="green"
          note="Belum masuk store"
        />
      </div>

      <div className="report-chart-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">Tren stok Assy</h2>
              <p className="section-sub">Store vs Buffer · 12 hari terakhir</p>
            </div>
            <Badge tone="sky">Assy Store</Badge>
          </div>
          <AreaChart
            labels={inventoryTrend.map((item) => item.period)}
            height={250}
            ariaLabel="Tren stok Assy Store dan Buffer"
            series={[
              { name: 'Store', color: '#38bdf8', values: activeLine === 'Robot H' ? inventoryTrend.map(() => 0) : inventoryTrend.map((item) => item.store) },
              { name: 'Buffer', color: '#f97316', values: activeLine === 'Robot H' ? inventoryTrend.map(() => 0) : inventoryTrend.map((item) => item.buffer) },
            ]}
          />
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Recent movement</h2>
              <p className="section-sub">{selected.partNumber}</p>
            </div>
            <Badge tone="neutral">Hari ini</Badge>
          </div>

          <div className="movement-list">
            {movements.map((movement) => (
              <div className="movement" key={movement.id}>
                <div
                  className={`movement__icon ${
                    movement.tone === 'plus' ? 'stat-icon--green' : 'stat-icon--red'
                  }`}
                >
                  {movement.tone === 'plus' ? (
                    <ArrowDownLeft size={14} />
                  ) : (
                    <ArrowUpRight size={14} />
                  )}
                </div>
                <div className="movement__copy">
                  <strong>{movement.type}</strong>
                  <span>
                    {movement.ref} · {movement.user}
                  </span>
                </div>
                <div className={`movement__qty ${movement.tone === 'plus' ? 'is-plus' : 'is-minus'}`}>
                  {movement.tone === 'plus' ? '+' : ''}
                  {formatNumber(movement.qty)} pcs
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Saldo semua Assy</h2>
            <p className="section-sub">Stok per part number di Assy Store</p>
          </div>
          <Badge tone="neutral">{assyItems.length} PN</Badge>
        </div>

        <div className="stack-sm">
          {assyItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`request-item${item.partNumber === selected.partNumber ? ' is-active' : ''}`}
              onClick={() => setSelectedPart(item.partNumber)}
            >
              <div className="request-item__icon">
                <Store size={16} />
              </div>
              <div className="grow">
                <div className="row row--between">
                  <span className="cell-main">{item.partNumber}</span>
                  <span className="cell-main mono">{formatNumber(item.store)} pcs</span>
                </div>
                <div className="row row--between" style={{ marginTop: 3 }}>
                  <span className="tiny muted">{item.description}</span>
                  <span className="tiny muted">Max {formatNumber(item.maxStore)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
