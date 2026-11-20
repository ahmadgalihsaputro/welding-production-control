import { ArrowDownRight, Download, PackageMinus, PackagePlus, Scale, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatCard } from '../../components/ui/StatCard'
import { materialUsageRows } from '../../data/mock'
import { formatNumber, formatPercent } from '../../lib/utils'

export function MaterialUsagePage() {
  const [period, setPeriod] = useState('month')
  const [view, setView] = useState('all')

  const usageRows = materialUsageRows.map((row) => {
    const taken = row.requisitioned
    const net = taken - row.returned
    const bomNeed = row.used
    const variance = bomNeed > 0 ? ((net - bomNeed) / bomNeed) * 100 : 0
    return {
      ...row,
      id: row.partNumber,
      taken,
      net,
      bomNeed,
      variance,
    }
  })
  const totalTaken = usageRows.reduce((sum, row) => sum + row.taken, 0)
  const totalReturned = usageRows.reduce((sum, row) => sum + row.returned, 0)
  const totalNet = usageRows.reduce((sum, row) => sum + row.net, 0)
  const totalBomNeed = usageRows.reduce((sum, row) => sum + row.bomNeed, 0)
  const totalVariance = totalBomNeed > 0 ? ((totalNet - totalBomNeed) / totalBomNeed) * 100 : 0
  const withinToleranceCount = usageRows.filter((row) => Math.abs(row.variance) <= 5).length
  const overToleranceCount = usageRows.length - withinToleranceCount

  const columns: Column<(typeof usageRows)[number]>[] = [
    {
      key: 'part',
      header: 'Part Number',
      render: (row) => <span className="cell-main mono">{row.partNumber}</span>,
    },
    { key: 'taken', header: 'Taken', align: 'right', render: (row) => <span className="mono">{formatNumber(row.taken)}</span> },
    { key: 'returned', header: 'Returned', align: 'right', render: (row) => <span className="mono">{formatNumber(row.returned)}</span> },
    { key: 'net', header: 'Net usage', align: 'right', render: (row) => <span className="mono strong">{formatNumber(row.net)}</span> },
    { key: 'bom', header: 'BOM need', align: 'right', render: (row) => <span className="mono muted">{formatNumber(row.bomNeed)}</span> },
    {
      key: 'variance',
      header: 'Variance',
      render: (row) => (
        <div className="row" style={{ gap: 7, minWidth: 130 }}>
          <Badge tone={Math.abs(row.variance) > 5 ? 'danger' : row.variance !== 0 ? 'warning' : 'success'}>
            {row.variance > 0 ? '+' : ''}
            {formatPercent(row.variance)}
          </Badge>
          <ProgressBar
            value={Math.min((Math.abs(row.variance) / 10) * 100, 100)}
            thin
            tone={Math.abs(row.variance) > 5 ? 'orange' : 'green'}
            className="progress--grow"
          />
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Evaluasi',
      render: (row) => (
        <span className="muted small">
          {row.variance === 0
            ? 'Sesuai BOM'
            : Math.abs(row.variance) <= 5
              ? 'Dalam toleransi'
              : 'Perlu investigasi'}
        </span>
      ),
    },
  ]

  const usageSplit = [
    { label: 'Dalam toleransi (≤ 5%)', value: withinToleranceCount, color: '#38bdf8' },
    { label: 'Melewati toleransi (> 5%)', value: overToleranceCount, color: '#f97316' },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Reports"
        title="Material Usage"
        subtitle="Perbandingan material yang diambil, dikembalikan, dan dipakai aktual terhadap kebutuhan BOM. Selisih menjadi indikator efisiensi material."
        meta={
          <>
            <span className="page-meta__item">
              <Scale size={12} /> {usageRows.length} part number
            </span>
            <span className="page-meta__item">
              <TriangleAlert size={12} /> Toleransi variance 5%
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<Download size={15} />} disabled title="Data contoh belum bisa diekspor">
            Export usage
          </Button>
        }
      />

      <Callout tone="warning">Data contoh untuk simulasi; belum terhubung ke transaksi scanner atau mutasi stok nyata. Ekspor dinonaktifkan.</Callout>

      <div className="kpi-grid">
        <StatCard label="Material taken" value={formatNumber(totalTaken)} suffix="pcs" icon={PackagePlus} tone="orange" note="Seluruh pickup" />
        <StatCard label="Returned" value={formatNumber(totalReturned)} suffix="pcs" icon={ArrowDownRight} tone="sky" note="Diterima kembali" />
        <StatCard label="Net usage" value={formatNumber(totalNet)} suffix="pcs" icon={Scale} tone="green" note="Taken − returned" />
        <StatCard label="Variance" value={formatPercent(totalVariance)} icon={TriangleAlert} tone={Math.abs(totalVariance) > 5 ? 'red' : 'green'} note="Selisih net usage terhadap BOM" />
      </div>

      <section className="card">
        <div className="report-filters">
          <Field label="Periode" htmlFor="usage-period">
            <select id="usage-period" className="select" value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="week">Minggu ini</option>
              <option value="month">Bulan ini</option>
              <option value="custom">Custom range</option>
            </select>
          </Field>
          <Field label="Tampilan" htmlFor="usage-view">
            <select id="usage-view" className="select" value={view} onChange={(event) => setView(event.target.value)}>
              <option value="all">Semua part</option>
              <option value="variance">Hanya variance</option>
            </select>
          </Field>
          <Field label="Line" htmlFor="usage-line">
            <select id="usage-line" className="select" defaultValue="Robot G">
              <option>Robot G</option>
              <option>Robot H</option>
            </select>
          </Field>
          <Field label="Shift" htmlFor="usage-shift">
            <select id="usage-shift" className="select" defaultValue="all">
              <option value="all">Semua shift</option>
              <option>Shift 1</option>
              <option>Shift 2</option>
            </select>
          </Field>
          <Button variant="primary" leftIcon={<Scale size={15} />}>
            Terapkan
          </Button>
        </div>
      </section>

      <div className="report-chart-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">Material taken vs returned</h2>
              <p className="section-sub">Per part number (pcs)</p>
            </div>
            <Badge tone="sky">Usage</Badge>
          </div>
          <BarChart
            labels={usageRows.map((row) => row.partNumber)}
            height={268}
            ariaLabel="Grafik material taken dan returned per part number"
            series={[
              { name: 'Taken', color: '#f97316', values: usageRows.map((row) => row.taken) },
              { name: 'Returned', color: '#38bdf8', values: usageRows.map((row) => row.returned) },
            ]}
          />
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Kepatuhan BOM</h2>
              <p className="section-sub">Dibandingkan dengan toleransi 5%</p>
            </div>
          </div>
          <DonutChart data={usageSplit} size={172} centerValue={String(usageRows.length)} centerLabel="part number" />
          {overToleranceCount > 0 && <Callout tone="warning" className="callout" style={{ marginTop: 14 }}>
            <span className="row" style={{ gap: 6 }}>
              <TriangleAlert size={13} /> {overToleranceCount} part melewati toleransi variance.
            </span>
          </Callout>}
        </section>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Detail material usage</h2>
            <p className="section-sub">Taken, returned, net, dan kebutuhan BOM</p>
          </div>
          <Badge tone="neutral">{view === 'all' ? 'Semua part' : 'Variance only'}</Badge>
        </div>
        <DataTable
          columns={columns}
          rows={view === 'variance' ? usageRows.filter((row) => row.variance !== 0) : usageRows}
          rowKey={(row) => row.id}
          minWidth={860}
          footer={<span className="muted small">Variance = (net usage − BOM need) ÷ BOM need × 100%</span>}
        />
      </section>
    </div>
  )
}
