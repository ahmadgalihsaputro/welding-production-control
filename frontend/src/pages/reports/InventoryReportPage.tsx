import { Boxes, CalendarDays, Layers3, RefreshCw, TriangleAlert, Warehouse } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AreaChart } from '../../components/charts/AreaChart'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { usePreferences } from '../../contexts/PreferencesContext'
import { describeApiError } from '../../lib/api'
import { listLedger, listStock, type LedgerEntryRecord, type StockItemRecord } from '../../lib/inventoryApi'
import { formatNumber } from '../../lib/utils'

export function InventoryReportPage() {
  const { t, formatDate } = usePreferences()
  const [period, setPeriod] = useState('12d')
  const [category, setCategory] = useState('all')
  const [items, setItems] = useState<StockItemRecord[]>([])
  const [ledger, setLedger] = useState<LedgerEntryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextItems, nextLedger] = await Promise.all([listStock(), listLedger()])
      setItems(nextItems)
      setLedger(nextLedger)
    } catch (loadError) {
      setError(describeApiError(loadError, 'Laporan inventory gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(
    () => items.filter((item) => category === 'all' || item.category === category),
    [category, items],
  )
  const totalStore = items.reduce((sum, item) => sum + item.store, 0)
  const totalBuffer = items.reduce((sum, item) => sum + item.buffer, 0)
  const low = items.filter((item) => item.status === 'low').length
  const statusCount = (status: StockItemRecord['status']) =>
    items.filter((item) => item.status === status).length

  const columns: Column<StockItemRecord>[] = [
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
    { key: 'category', header: t('Kategori', 'Category'), render: (item) => <Badge tone="neutral">{item.category}</Badge> },
    { key: 'store', header: 'Store', align: 'right', render: (item) => <span className="mono">{formatNumber(item.store)}</span> },
    { key: 'buffer', header: 'Buffer', align: 'right', render: (item) => <span className="mono">{formatNumber(item.buffer)}</span> },
    { key: 'max', header: 'Max store', align: 'right', render: (item) => <span className="mono muted">{formatNumber(item.maxStore)}</span> },
    { key: 'safety', header: 'Safety', align: 'right', render: (item) => <span className="mono muted">{formatNumber(item.safetyStock)}</span> },
    { key: 'status', header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
  ]

  const trendEntries = ledger.slice(0, 12).reverse()
  const labels = trendEntries.length > 0
    ? trendEntries.map((item) => new Date(item.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
    : ['Sekarang']
  const store = trendEntries.length > 0 ? trendEntries.map((item) => item.balance) : [totalStore]
  const buffer = trendEntries.length > 0 ? trendEntries.map(() => totalBuffer) : [totalBuffer]
  const inventoryHealthData = [
    { label: t('Aman', 'Safe'), value: statusCount('safe'), color: '#10b981' },
    { label: 'Low stock', value: statusCount('low'), color: '#f97316' },
    { label: t('Kosong', 'Empty'), value: statusCount('empty'), color: '#ef4444' },
    { label: 'Full store', value: statusCount('full'), color: '#38bdf8' },
  ]

  const categoryTotals = ['Assy', 'Sub Assy', 'Press Part', 'Bolt/Nut', 'Child Part'].map((name) => ({
    name,
    value: items
      .filter((item) => item.category === name)
      .reduce((sum, item) => sum + item.store + item.buffer, 0),
  }))

  return (
    <div className="page">
      <PageHeader
        eyebrow="Reports"
        title="Inventory Report"
        subtitle={t(
          'Posisi stok store dan buffer, tren pergerakan, serta kesehatan inventory per kategori. Digunakan untuk review mingguan bersama Leader.',
          'Store and buffer stock positions, movement trends, and inventory health by category. Used for the weekly review with the Leader.',
        )}
        meta={
          <>
            <span className="page-meta__item">
              <CalendarDays size={12} /> {formatDate(new Date())}
            </span>
            <span className="page-meta__item">
              <Warehouse size={12} /> Buffer &amp; Store
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<RefreshCw size={15} />} loading={loading} onClick={() => void loadData()}>
            Muat ulang
          </Button>
        }
      />

      {error && <Callout tone="danger" title="Gagal memuat">{error}</Callout>}

      <div className="kpi-grid">
        <StatCard label="Total store" value={formatNumber(totalStore)} suffix="pcs" icon={Warehouse} tone="sky" note={t('Seluruh PN', 'All part numbers')} />
        <StatCard label="Total buffer" value={formatNumber(totalBuffer)} suffix="pcs" icon={Boxes} tone="orange" note={t('Menunggu store in', 'Awaiting store in')} />
        <StatCard label="Low stock" value={String(low)} suffix="PN" icon={TriangleAlert} tone="red" note={t('Butuh replenishment', 'Needs replenishment')} />
        <StatCard label={t('Kategori', 'Category')} value={String(new Set(items.map((item) => item.category)).size)} suffix={t('jenis', 'types')} icon={Layers3} tone="green" note="Assy — child part" />
      </div>

      <section className="card">
        <div className="report-filters">
          <Field label={t('Periode', 'Period')} htmlFor="inv-period">
            <select id="inv-period" className="select" value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="12d">{t('12 hari terakhir', 'Last 12 days')}</option>
              <option value="7d">{t('7 hari terakhir', 'Last 7 days')}</option>
            </select>
          </Field>
          <Field label={t('Kategori', 'Category')} htmlFor="inv-category">
            <select id="inv-category" className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">{t('Semua kategori', 'All categories')}</option>
              <option value="Assy">Assy</option>
              <option value="Sub Assy">Sub Assy</option>
              <option value="Press Part">Press Part</option>
              <option value="Bolt/Nut">Bolt/Nut</option>
              <option value="Child Part">Child Part</option>
            </select>
          </Field>
          <Field label={t('Lokasi', 'Location')} htmlFor="inv-location">
            <select id="inv-location" className="select" defaultValue="all">
              <option value="all">{t('Semua lokasi', 'All locations')}</option>
              <option>Production Buffer</option>
              <option>Assy Store</option>
              <option>Sub Assy Store</option>
            </select>
          </Field>
          <Field label={t('Tipe laporan', 'Report type')} htmlFor="inv-type">
            <select id="inv-type" className="select" defaultValue="summary">
              <option value="summary">Summary</option>
              <option value="detail">{t('Detail per part', 'Detail per part')}</option>
            </select>
          </Field>
          <Button variant="primary" leftIcon={<Warehouse size={15} />}>
            {t('Terapkan', 'Apply')}
          </Button>
        </div>
      </section>

      <div className="report-chart-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">{t('Tren inventory', 'Inventory trend')}</h2>
              <p className="section-sub">Store vs buffer (pcs)</p>
            </div>
            <Badge tone="sky">Daily</Badge>
          </div>
          <AreaChart
            labels={labels}
            height={270}
            ariaLabel={t('Grafik tren stok store dan buffer', 'Store and buffer stock trend chart')}
            series={[
              { name: 'Store', color: '#38bdf8', values: store, area: true },
              { name: 'Buffer', color: '#f97316', values: buffer, area: true },
            ]}
          />
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{t('Kesehatan stok', 'Stock health')}</h2>
              <p className="section-sub">{t('Status PN saat ini', 'Current part number status')}</p>
            </div>
          </div>
          <DonutChart
            data={inventoryHealthData}
            size={172}
            centerValue={String(items.length)}
            centerLabel={t('part number', 'part numbers')}
          />
        </section>
      </div>

      <div className="report-split">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">{t('Stok per kategori', 'Stock by category')}</h2>
              <p className="section-sub">Store + buffer (pcs)</p>
            </div>
          </div>
          <BarChart
            labels={categoryTotals.map((item) => item.name)}
            height={250}
            ariaLabel={t('Grafik stok per kategori', 'Stock by category chart')}
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
              <h2 className="section-title">{t('Catatan inventory', 'Inventory notes')}</h2>
              <p className="section-sub">{t('Rekomendasi tindakan', 'Recommended actions')}</p>
            </div>
          </div>
          <div className="timeline">
            <div className="timeline-item">
              <span className="timeline-dot timeline-dot--amber" />
              <div>
                <div className="timeline-head">
                  <span className="timeline-title">{t('Replenishment sub assy', 'Sub Assy replenishment')}</span>
                  <span className="timeline-time">{t('Prioritas', 'Priority')}</span>
                </div>
                <p className="timeline-text">
                  {t(
                    'Tiga part number sub assy berada di bawah safety stock. Terbitkan kanban belanja sebelum shift 2.',
                    'Three sub Assy part numbers are below safety stock. Issue purchase kanbans before shift 2.',
                  )}
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <span className="timeline-dot timeline-dot--green" />
              <div>
                <div className="timeline-head">
                  <span className="timeline-title">{t('Store in stabil', 'Store in stable')}</span>
                  <span className="timeline-time">{t('Hari ini', 'Today')}</span>
                </div>
                <p className="timeline-text">
                  {t(
                    'Rata-rata waktu tunggu buffer ke store 11 menit, masih di bawah standar 20 menit.',
                    'Average buffer-to-store waiting time is 11 minutes, still below the 20-minute standard.',
                  )}
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <span className="timeline-dot timeline-dot--sky" />
              <div>
                <div className="timeline-head">
                  <span className="timeline-title">{t('Akurasi stok', 'Stock accuracy')}</span>
                  <span className="timeline-time">{t('Opname', 'Stocktake')}</span>
                </div>
                <p className="timeline-text">
                  {t(
                    'Akurasi stock opname terakhir 99,2% dengan 3 selisih kecil yang sudah diajukan.',
                    'The last stocktake accuracy was 99.2% with 3 minor discrepancies already submitted.',
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">{t('Detail stok', 'Stock details')}</h2>
            <p className="section-sub">{rows.length} part number</p>
          </div>
          <Badge tone="neutral">{formatDate(new Date(), true)}</Badge>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(item) => item.id} minWidth={820} />
      </section>
    </div>
  )
}
