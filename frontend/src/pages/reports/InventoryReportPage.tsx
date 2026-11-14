import { Boxes, CalendarDays, Download, Layers3, TriangleAlert, Warehouse } from 'lucide-react'
import { useState } from 'react'
import { AreaChart } from '../../components/charts/AreaChart'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { inventoryHealth, inventoryTrend, stockItems } from '../../data/mock'
import { formatNumber } from '../../lib/utils'
import type { StockItem } from '../../types'

export function InventoryReportPage() {
  const [period, setPeriod] = useState('12d')
  const [category, setCategory] = useState('all')

  const rows = stockItems.filter((item) => category === 'all' || item.category === category)
  const totalStore = stockItems.reduce((sum, item) => sum + item.store, 0)
  const totalBuffer = stockItems.reduce((sum, item) => sum + item.buffer, 0)
  const low = stockItems.filter((item) => item.status === 'low').length

  const columns: Column<StockItem>[] = [
    {
      key: 'part',
      header: 'Part Number',
      render: (item) => (
        <div className="cell-stack">
          <span className="cell-main mono">{item.partNumber}</span>
          <span className="cell-sub">{item.description}</span>
        </div>
      ),
    },
    { key: 'category', header: 'Kategori', render: (item) => <Badge tone="neutral">{item.category}</Badge> },
    { key: 'store', header: 'Store', align: 'right', render: (item) => <span className="mono">{formatNumber(item.store)}</span> },
    { key: 'buffer', header: 'Buffer', align: 'right', render: (item) => <span className="mono">{formatNumber(item.buffer)}</span> },
    { key: 'max', header: 'Max store', align: 'right', render: (item) => <span className="mono muted">{formatNumber(item.maxStore)}</span> },
    { key: 'safety', header: 'Safety', align: 'right', render: (item) => <span className="mono muted">{formatNumber(item.safetyStock)}</span> },
    { key: 'status', header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
  ]

  const trend = inventoryTrend.map((item) => ({
    label: item.period,
    store: item.store,
    buffer: item.buffer,
  }))
  const visibleTrend = period === '12d' ? trend : trend.slice(2)
  const labels = visibleTrend.map((item) => item.label)
  const store = visibleTrend.map((item) => item.store)
  const buffer = visibleTrend.map((item) => item.buffer)
  const inventoryHealthData = [
    { label: 'Aman', value: inventoryHealth.safe, color: '#10b981' },
    { label: 'Low stock', value: inventoryHealth.low, color: '#f97316' },
    { label: 'Kosong', value: inventoryHealth.empty, color: '#ef4444' },
    { label: 'Full store', value: inventoryHealth.full, color: '#38bdf8' },
  ]

  const categoryTotals = ['Assy', 'Sub Assy', 'Press Part', 'Bolt/Nut', 'Child Part'].map((name) => ({
    name,
    value: stockItems
      .filter((item) => item.category === name)
      .reduce((sum, item) => sum + item.store + item.buffer, 0),
  }))

  return (
    <div className="page">
      <PageHeader
        eyebrow="Reports"
        title="Inventory Report"
        subtitle="Posisi stok store dan buffer, tren pergerakan, serta kesehatan inventory per kategori. Digunakan untuk review mingguan bersama Leader."
        meta={
          <>
            <span className="page-meta__item">
              <CalendarDays size={12} /> 12 November 2026
            </span>
            <span className="page-meta__item">
              <Warehouse size={12} /> Buffer &amp; Store
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<Download size={15} />}>
            Export PDF
          </Button>
        }
      />

      <div className="kpi-grid">
        <StatCard label="Total store" value={formatNumber(totalStore)} suffix="pcs" icon={Warehouse} tone="sky" note="Seluruh PN" />
        <StatCard label="Total buffer" value={formatNumber(totalBuffer)} suffix="pcs" icon={Boxes} tone="orange" note="Menunggu store in" />
        <StatCard label="Low stock" value={String(low)} suffix="PN" icon={TriangleAlert} tone="red" note="Butuh replenishment" />
        <StatCard label="Kategori" value="5" suffix="jenis" icon={Layers3} tone="green" note="Assy — child part" />
      </div>

      <section className="card">
        <div className="report-filters">
          <Field label="Periode" htmlFor="inv-period">
            <select id="inv-period" className="select" value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="12d">12 hari terakhir</option>
              <option value="7d">7 hari terakhir</option>
            </select>
          </Field>
          <Field label="Kategori" htmlFor="inv-category">
            <select id="inv-category" className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">Semua kategori</option>
              <option value="Assy">Assy</option>
              <option value="Sub Assy">Sub Assy</option>
              <option value="Press Part">Press Part</option>
              <option value="Bolt/Nut">Bolt/Nut</option>
              <option value="Child Part">Child Part</option>
            </select>
          </Field>
          <Field label="Lokasi" htmlFor="inv-location">
            <select id="inv-location" className="select" defaultValue="all">
              <option value="all">Semua lokasi</option>
              <option>Production Buffer</option>
              <option>Assy Store</option>
              <option>Sub Assy Store</option>
            </select>
          </Field>
          <Field label="Tipe laporan" htmlFor="inv-type">
            <select id="inv-type" className="select" defaultValue="summary">
              <option value="summary">Summary</option>
              <option value="detail">Detail per part</option>
            </select>
          </Field>
          <Button variant="primary" leftIcon={<Warehouse size={15} />}>
            Terapkan
          </Button>
        </div>
      </section>

      <div className="report-chart-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">Tren inventory</h2>
              <p className="section-sub">Store vs buffer (pcs)</p>
            </div>
            <Badge tone="sky">Daily</Badge>
          </div>
          <AreaChart
            labels={labels}
            height={270}
            ariaLabel="Grafik tren stok store dan buffer"
            series={[
              { name: 'Store', color: '#38bdf8', values: store, area: true },
              { name: 'Buffer', color: '#f97316', values: buffer, area: true },
            ]}
          />
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Kesehatan stok</h2>
              <p className="section-sub">Status PN saat ini</p>
            </div>
          </div>
          <DonutChart
            data={inventoryHealthData}
            size={172}
            centerValue={String(stockItems.length)}
            centerLabel="part number"
          />
        </section>
      </div>

      <div className="report-split">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">Stok per kategori</h2>
              <p className="section-sub">Store + buffer (pcs)</p>
            </div>
          </div>
          <BarChart
            labels={categoryTotals.map((item) => item.name)}
            height={250}
            ariaLabel="Grafik stok per kategori"
            series={[
              {
                name: 'Qty',
                color: '#38bdf8',
                values: categoryTotals.map((item) => item.value),
              },
            ]}
          />
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Catatan inventory</h2>
              <p className="section-sub">Rekomendasi tindakan</p>
            </div>
          </div>
          <div className="timeline">
            <div className="timeline-item">
              <span className="timeline-dot timeline-dot--amber" />
              <div>
                <div className="timeline-head">
                  <span className="timeline-title">Replenishment sub assy</span>
                  <span className="timeline-time">Prioritas</span>
                </div>
                <p className="timeline-text">
                  Tiga part number sub assy berada di bawah safety stock. Terbitkan kanban belanja
                  sebelum shift 2.
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <span className="timeline-dot timeline-dot--green" />
              <div>
                <div className="timeline-head">
                  <span className="timeline-title">Store in stabil</span>
                  <span className="timeline-time">Hari ini</span>
                </div>
                <p className="timeline-text">
                  Rata-rata waktu tunggu buffer ke store 11 menit, masih di bawah standar 20 menit.
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <span className="timeline-dot timeline-dot--sky" />
              <div>
                <div className="timeline-head">
                  <span className="timeline-title">Akurasi stok</span>
                  <span className="timeline-time">Opname</span>
                </div>
                <p className="timeline-text">
                  Akurasi stock opname terakhir 99,2% dengan 3 selisih kecil yang sudah diajukan.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Detail stok</h2>
            <p className="section-sub">{rows.length} part number</p>
          </div>
          <Badge tone="neutral">Snapshot 09:12</Badge>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(item) => item.id} minWidth={820} />
      </section>
    </div>
  )
}
