import { AlertTriangle, Boxes, PackageSearch, Store, Warehouse } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { useQueue } from '../../contexts/QueueContext'
import { describeApiError } from '../../lib/api'
import { listStock, type StockItemRecord } from '../../lib/inventoryApi'
import { listParts } from '../../lib/masterApi'
import { formatNumber } from '../../lib/utils'

export function SubAssyStorePage() {
  const navigate = useNavigate()
  const { activeLine } = useAuth()
  const { items } = useQueue()
  const [search, setSearch] = useState('')
  const [stocks, setStocks] = useState<StockItemRecord[]>([])
  const [lineByPart, setLineByPart] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextStocks, parts] = await Promise.all([
        listStock({ category: 'Sub Assy' }),
        listParts(),
      ])
      setStocks(nextStocks)
      setLineByPart(Object.fromEntries(parts.map((part) => [part.partNumber, part.line])))
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data Sub Assy Store gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const subAssyItems = useMemo(
    () =>
      stocks.filter((item) => {
        const line = lineByPart[item.partNumber] ?? item.location
        return activeLine === 'all' || line === activeLine
      }),
    [activeLine, lineByPart, stocks],
  )
  const lineQueueItems = items.filter((item) => {
    if (item.type !== 'Sub Assy') return false
    return activeLine === 'all' || item.line === activeLine
  })

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return subAssyItems.filter(
      (item) =>
        !needle ||
        item.partNumber.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle),
    )
  }, [search, subAssyItems])

  const totalBoxes = subAssyItems.reduce(
    (sum, item) => sum + Math.floor(item.store / (item.packaging || 1)),
    0,
  )
  const lowStock = subAssyItems.filter((item) => item.status === 'low').length
  const needed = lineQueueItems.reduce((sum, item) => sum + item.taken, 0)
  const parameterItem = subAssyItems[0]

  const columns: Column<StockItemRecord>[] = [
    {
      key: 'part',
      header: 'Part Number',
      render: (item) => (
        <div className="cell-stack">
          <span className="cell-main">{item.partNumber}</span>
          <span className="cell-sub">{item.description}</span>
        </div>
      ),
    },
    {
      key: 'store',
      header: 'Store',
      align: 'right',
      render: (item) => <span className="mono strong">{formatNumber(item.store)} pcs</span>,
    },
    {
      key: 'boxes',
      header: 'Boxes',
      align: 'right',
      render: (item) => (
        <span>
          {Math.floor(item.store / (item.packaging || 1))} <span className="muted tiny">box</span>
        </span>
      ),
    },
    {
      key: 'safety',
      header: 'Safety',
      align: 'right',
      render: (item) => <span className="mono muted">{formatNumber(item.safetyStock)}</span>,
    },
    {
      key: 'max',
      header: 'Max Store',
      align: 'right',
      render: (item) => <span className="mono muted">{formatNumber(item.maxStore)}</span>,
    },
    {
      key: 'level',
      header: 'Level',
      render: (item) => {
        const percent = item.maxStore > 0 ? (item.store / item.maxStore) * 100 : 0
        return (
          <div className="stock-level">
            <div className="stock-level__top">
              <strong>{Math.round(percent)}%</strong>
              <span>{item.location}</span>
            </div>
            <ProgressBar
              value={percent}
              thin
              tone={item.status === 'low' ? 'orange' : 'green'}
            />
          </div>
        )
      },
    },
    { key: 'status', header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Inventory Control"
        title="Sub Assy Store"
        subtitle="Stok Sub Assy dengan parameter safety stock & Max Store per part number. Kebutuhan replenishment mengikuti pengambilan aktual Team Supply."
        meta={
          <>
            <span className="page-meta__item">
              <Warehouse size={12} /> {activeLine === 'all' ? 'Semua line' : activeLine} / SS
            </span>
            <span className="page-meta__item">
              <Boxes size={12} /> {subAssyItems.length} part number
            </span>
          </>
        }
        actions={
          <Button
            variant="primary"
            leftIcon={<PackageSearch size={15} />}
            onClick={() => navigate('/production/queue')}
          >
            Buka antrean
          </Button>
        }
      />

      {error && <Callout tone="danger" title="Gagal memuat">{error}</Callout>}

      <div className="kpi-grid">
        <StatCard
          label="Part number"
          value={String(subAssyItems.length)}
          suffix="PN"
          icon={Boxes}
          tone="sky"
          note="Sub Assy aktif"
        />
        <StatCard
          label="Total box"
          value={String(totalBoxes)}
          suffix="box"
          icon={Store}
          tone="orange"
          note="Sesuai standard packaging"
        />
        <StatCard
          label="Low stock"
          value={String(lowStock)}
          suffix="PN"
          icon={AlertTriangle}
          tone="red"
          note="Perlu replenishment"
        />
        <StatCard
          label="Kebutuhan antrean"
          value={formatNumber(needed)}
          suffix="pcs"
          icon={PackageSearch}
          tone="amber"
          note="Dari Supply pickup"
        />
      </div>

      {lowStock > 0 && (
        <Callout tone="danger" title="Safety stock terlewati">
          {lowStock} part number berada di bawah safety stock. Prioritaskan produksi Sub Assy
          sebelum Shift 2 untuk menjaga ketersediaan Area Assy.
        </Callout>
      )}

      <section className="card">
        <div className="table-toolbar">
          <div>
            <h2 className="section-title">Saldo Sub Assy</h2>
            <p className="section-sub">Store, box, safety stock, dan Max Store</p>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari part number…"
            className="search-inline"
          />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          minWidth={860}
          emptyMessage={loading ? 'Memuat data stok…' : 'Belum ada data Sub Assy.'}
          footer={
            <>
              <span>
                <strong>{rows.length}</strong> PN ditampilkan
              </span>
              <span>Box dihitung dari standard packaging</span>
            </>
          }
        />
      </section>

      <div className="grid grid-2">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Kebutuhan replenishment</h2>
              <p className="section-sub">Queue aktif {activeLine === 'all' ? 'semua line' : activeLine}</p>
            </div>
            <Badge tone="orange">{lineQueueItems.length} item</Badge>
          </div>

          <div className="stack-sm">
            {lineQueueItems.map((item) => (
              <div className="row row--between" key={item.id}>
                <div className="row">
                  <span className="queue-mini__num">{item.no}</span>
                  <div>
                    <div className="small strong">{item.partNumber}</div>
                    <div className="tiny muted">Diambil {item.taken} pcs · {item.time}</div>
                  </div>
                </div>
                <StatusBadge status={item.priority} />
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Parameter stok</h2>
              <p className="section-sub">Dasar perhitungan replenishment</p>
            </div>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Standard packaging</span>
              <span className="info-value info-value--strong">{formatNumber(parameterItem?.packaging ?? 0)} pcs / box</span>
            </div>
            <div className="info-item">
              <span className="info-label">Safety stock</span>
              <span className="info-value info-value--strong">{formatNumber(parameterItem?.safetyStock ?? 0)} pcs</span>
            </div>
            <div className="info-item">
              <span className="info-label">Max store</span>
              <span className="info-value info-value--strong">{formatNumber(parameterItem?.maxStore ?? 0)} pcs</span>
            </div>
            <div className="info-item">
              <span className="info-label">Lokasi</span>
              <span className="info-value">{parameterItem?.location ?? '—'}</span>
            </div>
          </div>
          <Callout tone="info" className="callout" style={{ marginTop: 14 }}>
            Stok gabungan untuk PN yang digunakan beberapa model tetap dihitung sebagai satu
            saldo store.
          </Callout>
        </section>
      </div>
    </div>
  )
}
