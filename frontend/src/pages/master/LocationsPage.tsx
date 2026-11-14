import { Boxes, MapPin, Plus, Warehouse } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { inventoryLocations, stockItems } from '../../data/mock'
import { formatNumber } from '../../lib/utils'
import type { InventoryLocation } from '../../types'

const usage: Record<string, number> = {
  'R-G/BUF': 151,
  'R-G/AS': 312,
  'R-G/SS': 410,
  'R-G/EXT': 88,
  'R-G/RET': 21,
}

export function LocationsPage() {
  const columns: Column<InventoryLocation>[] = [
    {
      key: 'location',
      header: 'Location',
      render: (location) => (
        <div className="cell-stack">
          <span className="cell-main">{location.name}</span>
          <span className="cell-sub mono">{location.code}</span>
        </div>
      ),
    },
    { key: 'type', header: 'Tipe', render: (location) => <Badge tone="neutral">{location.type}</Badge> },
    { key: 'line', header: 'Line', render: (location) => <span>{location.line}</span> },
    {
      key: 'capacity',
      header: 'Kapasitas',
      render: (location) => {
        const used = usage[location.code] ?? 0
        const percent = (used / location.capacity) * 100
        return (
          <div className="stock-level">
            <div className="stock-level__top">
              <strong>{Math.round(percent)}%</strong>
              <span>{formatNumber(used)} / {formatNumber(location.capacity)}</span>
            </div>
            <ProgressBar value={percent} thin tone={percent > 85 ? 'orange' : 'sky'} />
          </div>
        )
      },
    },
    { key: 'status', header: 'Status', render: (location) => <StatusBadge status={location.status} /> },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Inventory Location"
        subtitle="Lokasi penyimpanan fisik beserta kapasitasnya. Setiap transaksi store in, pickup, dan return wajib menunjuk lokasi yang valid."
        meta={
          <>
            <span className="page-meta__item">
              <MapPin size={12} /> {inventoryLocations.length} lokasi
            </span>
            <span className="page-meta__item">
              <Warehouse size={12} /> Robot G
            </span>
          </>
        }
        actions={
          <Button variant="primary" leftIcon={<Plus size={15} />}>
            Tambah lokasi
          </Button>
        }
      />

      <div className="kpi-grid">
        <StatCard label="Total lokasi" value={String(inventoryLocations.length)} suffix="lokasi" icon={MapPin} tone="orange" note="Buffer, store, external" />
        <StatCard label="Total kapasitas" value={formatNumber(inventoryLocations.reduce((sum, item) => sum + item.capacity, 0))} suffix="pcs" icon={Warehouse} tone="sky" note="Seluruh area" />
        <StatCard label="Terpakai" value="61%" icon={Boxes} tone="green" note="Rata-rata utilisasi" />
        <StatCard label="Lokasi aktif" value={String(inventoryLocations.filter((item) => item.status === 'active').length)} suffix="lokasi" icon={MapPin} tone="amber" note="Siap menerima stok" />
      </div>

      <div className="device-grid">
        {inventoryLocations.map((location) => {
          const used = usage[location.code] ?? 0
          const percent = (used / location.capacity) * 100
          return (
            <div className="device-card" key={location.id}>
              <div className="device-card__top">
                <span className="device-card__icon">
                  <Warehouse size={16} />
                </span>
                <StatusBadge status={location.status} />
              </div>
              <h3>{location.name}</h3>
              <p>
                {location.code} · {location.type} · {location.line}
              </p>
              <div style={{ marginTop: 10 }}>
                <div className="stock-level__top">
                  <span>Utilitas</span>
                  <strong>
                    {formatNumber(used)} / {formatNumber(location.capacity)} pcs
                  </strong>
                </div>
                <ProgressBar value={percent} thin tone={percent > 85 ? 'orange' : 'sky'} />
              </div>
              <div className="device-card__foot">
                <span>{stockItems.filter((item) => item.location.includes(location.type)).length} part number</span>
                <Badge tone="sky">{Math.round(percent)}%</Badge>
              </div>
            </div>
          )
        })}
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Daftar lokasi</h2>
            <p className="section-sub">Kapasitas dan status penyimpanan</p>
          </div>
        </div>
        <DataTable columns={columns} rows={inventoryLocations} rowKey={(location) => location.id} minWidth={760} />
      </section>
    </div>
  )
}
