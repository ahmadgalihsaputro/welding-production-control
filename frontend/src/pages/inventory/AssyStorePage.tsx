import { ArrowDownLeft, ArrowUpRight, CalendarDays, MapPin, Store } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AreaChart } from '../../components/charts/AreaChart'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatCard } from '../../components/ui/StatCard'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { describeApiError } from '../../lib/api'
import { listLedger, listStock, type LedgerEntryRecord, type StockItemRecord } from '../../lib/inventoryApi'
import { listParts } from '../../lib/masterApi'
import { formatNumber } from '../../lib/utils'

export function AssyStorePage() {
  const { activeLine } = useAuth()
  const { formatDate } = usePreferences()
  const [items, setItems] = useState<StockItemRecord[]>([])
  const [ledger, setLedger] = useState<LedgerEntryRecord[]>([])
  const [lineByPart, setLineByPart] = useState<Record<string, string>>({})
  const [selectedPart, setSelectedPart] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextItems, parts, nextLedger] = await Promise.all([
        listStock({ category: 'Assy' }),
        listParts(),
        listLedger(),
      ])
      setItems(nextItems)
      setLedger(nextLedger)
      setLineByPart(Object.fromEntries(parts.map((part) => [part.partNumber, part.line])))
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data Assy Store gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const assyItems = items.filter((item) => {
    const line = lineByPart[item.partNumber] ?? item.location
    return activeLine === 'all' || line === activeLine
  })
  const selected = assyItems.find((item) => item.partNumber === selectedPart) ?? assyItems[0]

  if (!selected) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Inventory Control"
          title="Assy Store"
          subtitle={`Belum ada stok Assy yang terdaftar untuk ${activeLine === 'all' ? 'semua line' : activeLine}.`}
          meta={<span className="page-meta__item"><MapPin size={12} /> {activeLine}</span>}
          actions={
            <Button variant="secondary" loading={loading} onClick={() => void loadData()}>
              Muat ulang
            </Button>
          }
        />
        {error && <Callout tone="danger" title="Gagal memuat">{error}</Callout>}
        <Callout tone="info" title="Data stok belum tersedia">
          Saldo Assy akan tampil setelah part dan stok untuk line ini dimasukkan.
        </Callout>
      </div>
    )
  }

  const currentQty = selected.store + selected.buffer
  const capacity = selected.maxStore > 0 ? (currentQty / selected.maxStore) * 100 : 0
  const selectedLedger = ledger.filter((entry) => entry.partNumber === selected.partNumber)
  const movements = selectedLedger.slice(0, 4)
  const trendEntries = selectedLedger.slice(0, 12).reverse()
  const labels = trendEntries.length > 0
    ? trendEntries.map((entry) => new Date(entry.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
    : ['Sekarang']
  const storeValues = trendEntries.length > 0
    ? trendEntries.map((entry) => entry.balance)
    : [selected.store]

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
              <CalendarDays size={12} /> {formatDate(new Date())}
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
            <Button variant="secondary" leftIcon={<Store size={15} />} loading={loading} onClick={() => void loadData()}>
              Muat ulang
            </Button>
          </>
        }
      />

      {error && <Callout tone="danger" title="Gagal memuat">{error}</Callout>}

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
              <h2 className="section-title">Tren saldo Assy</h2>
              <p className="section-sub">Dari {movements.length > 0 ? Math.min(selectedLedger.length, 12) : 0} mutasi terakhir</p>
            </div>
            <Badge tone="sky">Assy Store</Badge>
          </div>
          <AreaChart
            labels={labels}
            height={250}
            ariaLabel="Tren saldo Assy Store"
            series={[{ name: 'Store', color: '#38bdf8', values: storeValues }]}
          />
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Recent movement</h2>
              <p className="section-sub">{selected.partNumber}</p>
            </div>
            <Badge tone="neutral">{movements.length} transaksi</Badge>
          </div>

          <div className="movement-list">
            {movements.length === 0 && (
              <Callout tone="info">Belum ada mutasi stok untuk part ini.</Callout>
            )}
            {movements.map((movement) => (
              <div className="movement" key={movement.id}>
                <div className={`movement__icon ${movement.qty >= 0 ? 'stat-icon--green' : 'stat-icon--red'}`}>
                  {movement.qty >= 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                </div>
                <div className="movement__copy">
                  <strong>{movement.type}</strong>
                  <span>
                    {movement.reference} · {movement.user}
                  </span>
                </div>
                <div className={`movement__qty ${movement.qty >= 0 ? 'is-plus' : 'is-minus'}`}>
                  {movement.qty > 0 ? '+' : ''}
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
