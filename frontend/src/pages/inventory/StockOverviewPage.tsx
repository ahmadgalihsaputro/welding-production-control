import {
  Boxes,
  Download,
  PackageMinus,
  PackageSearch,
  SlidersHorizontal,
  TriangleAlert,
  Warehouse,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tabs } from '../../components/ui/Tabs'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { stockItems } from '../../data/mock'
import { getProductionPart } from '../../data/productionLines'
import type { StockItem } from '../../types'
import { formatNumber } from '../../lib/utils'

export function StockOverviewPage() {
  const navigate = useNavigate()
  const { activeLine } = useAuth()
  const { t } = usePreferences()
  const statusTabs = [
    { value: 'all', label: t('Semua', 'All') },
    { value: 'safe', label: t('Aman', 'Safe') },
    { value: 'low', label: 'Low stock' },
    { value: 'full', label: 'Full store' },
  ]
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  const lineStockItems = useMemo(
    () =>
      stockItems.filter((item) => {
        const line =
          getProductionPart(item.partNumber)?.line ??
          (item.location.startsWith('R-H') ? 'Robot H' : 'Robot G')
        return activeLine === 'all' || line === activeLine
      }),
    [activeLine],
  )
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return lineStockItems.filter((item) => {
      const matchStatus = status === 'all' || item.status === status
      const matchCategory = category === 'all' || item.category === category
      const matchSearch =
        !needle ||
        item.partNumber.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle)
      return matchStatus && matchCategory && matchSearch
    })
  }, [status, category, search, lineStockItems])

  const totalQty = lineStockItems.reduce((sum, item) => sum + item.store + item.buffer, 0)
  const lowStock = lineStockItems.filter((item) => item.status === 'low').length
  const fullStore = lineStockItems.filter((item) => item.status === 'full').length
  const lineLabel = activeLine === 'all' ? t('semua line', 'all lines') : activeLine
  const inventoryHealthData = [
    { label: t('Aman', 'Safe'), value: lineStockItems.filter((item) => item.status === 'safe').length, color: '#10b981' },
    { label: 'Low stock', value: lowStock, color: '#f97316' },
    { label: t('Kosong', 'Empty'), value: lineStockItems.filter((item) => item.status === 'empty').length, color: '#ef4444' },
    { label: 'Full store', value: fullStore, color: '#38bdf8' },
  ]

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
    { key: 'category', header: t('Kategori', 'Category'), render: (item) => <Badge tone="neutral">{item.category}</Badge> },
    {
      key: 'location',
      header: t('Lokasi', 'Location'),
      render: (item) => <span className="stock-location">{item.location}</span>,
    },
    {
      key: 'store',
      header: 'Store',
      align: 'right',
      render: (item) => <span className="mono strong">{formatNumber(item.store)}</span>,
    },
    {
      key: 'buffer',
      header: 'Buffer',
      align: 'right',
      render: (item) => <span className="mono">{formatNumber(item.buffer)}</span>,
    },
    {
      key: 'level',
      header: 'Level',
      render: (item) => {
        const percent = ((item.store + item.buffer) / item.maxStore) * 100
        return (
          <div className="stock-level">
            <div className="stock-level__top">
              <strong>{Math.round(percent)}%</strong>
              <span>max {formatNumber(item.maxStore)}</span>
            </div>
            <ProgressBar
              value={percent}
              thin
              tone={item.status === 'low' ? 'orange' : item.status === 'full' ? 'sky' : 'green'}
            />
          </div>
        )
      },
    },
    {
      key: 'safety',
      header: 'Safety',
      align: 'right',
      render: (item) => <span className="mono muted">{formatNumber(item.safetyStock)}</span>,
    },
    { key: 'status', header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Inventory Control"
        title={t('Ringkasan Stok', 'Stock Overview')}
        subtitle={`${t('Sumber kebenaran stok untuk', 'Single source of truth for stock in')} ${lineLabel}. ${t(
          'Buffer dan Store dipisahkan, lengkap dengan standard packaging, safety stock, dan Max Store per part number.',
          'Buffer and Store are kept separate, complete with standard packaging, safety stock, and Max Store per part number.',
        )}`}
        meta={
          <>
            <span className="page-meta__item">
              <Warehouse size={12} /> Buffer &amp; Store
            </span>
            <span className="page-meta__item">
              <Boxes size={12} /> {lineStockItems.length} {t('part number', 'part numbers')}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" leftIcon={<Download size={15} />}>
              {t('Export stok', 'Export stock')}
            </Button>
            <Button
              variant="primary"
              leftIcon={<SlidersHorizontal size={15} />}
              onClick={() => navigate('/inventory/adjustment')}
            >
              Adjustment
            </Button>
          </>
        }
      />

      <div className="kpi-grid">
        <StatCard
          label={t('Total part number', 'Total part numbers')}
          value={String(lineStockItems.length)}
          suffix="PN"
          icon={Boxes}
          tone="sky"
          note={t('Assy, Sub Assy & external', 'Assy, Sub Assy & external')}
        />
        <StatCard
          label={t('Total qty stok', 'Total stock qty')}
          value={formatNumber(totalQty)}
          suffix="pcs"
          icon={Warehouse}
          tone="orange"
          note="Store + Buffer"
        />
        <StatCard
          label="Low stock"
          value={String(lowStock)}
          suffix="PN"
          icon={TriangleAlert}
          tone="red"
          note={t('Di bawah safety stock', 'Below safety stock')}
        />
        <StatCard
          label="Full store"
          value={String(fullStore)}
          suffix="PN"
          icon={PackageMinus}
          tone="amber"
          note={t('Mencapai Max Store', 'Reached Max Store')}
        />
      </div>

      <div className="report-chart-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">{t('Stok per part number', 'Stock per part number')}</h2>
              <p className="section-sub">{t('Store vs Buffer (pcs)', 'Store vs Buffer (pcs)')}</p>
            </div>
            <Badge tone="neutral">Top 6</Badge>
          </div>
          <BarChart
            labels={lineStockItems.slice(0, 6).map((item) => item.partNumber)}
            height={230}
            ariaLabel={t('Grafik stok store dan buffer per part number', 'Store and buffer stock chart per part number')}
            series={[
              {
                name: 'Store',
                color: '#38bdf8',
                values: lineStockItems.slice(0, 6).map((item) => item.store),
              },
              {
                name: 'Buffer',
                color: '#f97316',
                values: lineStockItems.slice(0, 6).map((item) => item.buffer),
              },
            ]}
          />
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{t('Kesehatan stok', 'Stock Health')}</h2>
              <p className="section-sub">{t('Status seluruh PN', 'Status of all PNs')}</p>
            </div>
          </div>
          <DonutChart
            data={inventoryHealthData}
            size={172}
            centerValue={String(lineStockItems.length)}
            centerLabel={t('part number', 'part numbers')}
          />
          {lowStock > 0 && (
            <Callout tone="danger" className="callout" style={{ marginTop: 14 }}>
              <span className="row" style={{ gap: 6 }}>
                <TriangleAlert size={13} /> {lowStock} {t('PN berada di bawah safety stock untuk line terpilih.', 'PNs are below safety stock for the selected line.')}
              </span>
            </Callout>
          )}
        </section>
      </div>

      <section className="card">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <Tabs items={statusTabs} value={status} onChange={setStatus} ariaLabel={t('Filter status stok', 'Filter stock status')} />
            <div className="select-wrap">
              <select
                className="select"
                style={{ width: 150, height: 38, minHeight: 38 }}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label={t('Filter kategori', 'Filter category')}
              >
                <option value="all">{t('Semua kategori', 'All categories')}</option>
                <option value="Assy">Assy</option>
                <option value="Sub Assy">Sub Assy</option>
                <option value="Press Part">Press Part</option>
                <option value="Bolt/Nut">Bolt/Nut</option>
                <option value="Child Part">Child Part</option>
              </select>
            </div>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('Cari part number…', 'Search part number…')}
            className="search-inline"
          />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          minWidth={920}
          footer={
            <>
              <span>
                {t('Menampilkan', 'Showing')} <strong>{rows.length}</strong> {t('dari', 'of')} {lineStockItems.length} PN
              </span>
              <span>
                <PackageSearch size={12} style={{ display: 'inline', marginRight: 4 }} />
                {t('Stok update 09:40', 'Stock updated 09:40')}
              </span>
            </>
          }
        />
      </section>
    </div>
  )
}
