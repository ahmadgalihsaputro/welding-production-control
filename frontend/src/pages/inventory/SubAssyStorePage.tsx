import { AlertTriangle, Boxes, PackageSearch, Store, Warehouse } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { stockItems } from '../../data/mock'
import { getProductionPart } from '../../data/productionLines'
import type { StockItem } from '../../types'
import { formatNumber } from '../../lib/utils'

export function SubAssyStorePage() {
  const navigate = useNavigate()
  const { activeLine } = useAuth()
  const { items } = useQueue()
  const [search, setSearch] = useState('')
  const subAssyItems = useMemo(
    () =>
      stockItems.filter((item) => {
        if (item.category !== 'Sub Assy') return false
        const line =
          getProductionPart(item.partNumber)?.line ??
          (item.location.startsWith('R-H') ? 'Robot H' : 'Robot G')
        return activeLine === 'all' || line === activeLine
      }),
    [activeLine],
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
    (sum, item) => sum + Math.floor(item.store / item.packaging),
    0,
  )
  const lowStock = subAssyItems.filter((item) => item.status === 'low').length
  const needed = lineQueueItems.reduce((sum, item) => sum + item.taken, 0)

  const columns: Column<StockItem>[] = [
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
          {Math.floor(item.store / item.packaging)} <span className="muted tiny">box</span>
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
      render: (item) => (
        <div className="stock-level">
          <div className="stock-level__top">
            <strong>{Math.round((item.store / item.maxStore) * 100)}%</strong>
            <span>{item.location}</span>
          </div>
          <ProgressBar
            value={(item.store / item.maxStore) * 100}
            thin
            tone={item.status === 'low' ? 'orange' : 'green'}
          />
        </div>
      ),
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
              <span className="info-value info-value--strong">35 pcs / box</span>
            </div>
            <div className="info-item">
              <span className="info-label">Safety stock</span>
              <span className="info-value info-value--strong">70 pcs</span>
            </div>
            <div className="info-item">
              <span className="info-label">Max store</span>
              <span className="info-value info-value--strong">140 pcs</span>
            </div>
            <div className="info-item">
              <span className="info-label">Lokasi</span>
              <span className="info-value">R-G / SS / 01</span>
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
