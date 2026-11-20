import { CalendarDays, Download, Factory, FileBarChart2, Target, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AreaChart } from '../../components/charts/AreaChart'
import { BarChart } from '../../components/charts/BarChart'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatCard } from '../../components/ui/StatCard'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { dailyProductionTrend, productionReportRows } from '../../data/mock'
import { getProductionPart, matchesProductionWorkArea } from '../../data/productionLines'
import { readProductionShiftRecords } from '../../data/productionLog'
import { formatNumber, formatPercent } from '../../lib/utils'

const shifts = ['all', 'Shift 1', 'Shift 2']

interface ProductionReportRow {
  partNumber: string
  model: string
  type: string
  target: number
  actual: number
  ng: number
  ngRate: number
  shift: string
  date?: string
}

function loadProductionTotals(t: (id: string, en: string) => string) {
  try {
    return { records: readProductionShiftRecords(), error: '' }
  } catch (error) {
    return {
      records: [],
      error: error instanceof Error ? error.message : t('Hasil shift gagal dibaca.', 'Failed to read shift results.'),
    }
  }
}

export function ProductionReportPage() {
  const { activeLine, activeWorkArea } = useAuth()
  const { t, formatDate } = usePreferences()
  const [shift, setShift] = useState('all')
  const [part, setPart] = useState('all')
  const [period, setPeriod] = useState('7d')
  const [productionTotals] = useState(() => loadProductionTotals(t))
  const lineLabel = activeWorkArea?.label ?? (activeLine === 'all' ? 'All lines' : activeLine)
  const manualRows: ProductionReportRow[] = productionTotals.records.map((record) => {
    const partData = getProductionPart(record.partNumber)
    const output = record.ok + record.ng
    return {
      partNumber: record.partNumber,
      model: partData?.models.join('/') ?? '—',
      type: record.type,
      target: 0,
      actual: record.ok,
      ng: record.ng,
      ngRate: output > 0 ? (record.ng / output) * 100 : 0,
      shift: String(record.shift),
      date: record.date,
    }
  })
  const manualKeys = new Set(
    productionTotals.records.map((record) => `${record.partNumber}:${record.shift}:${record.line}`),
  )
  const lineRows = useMemo(
    (): ProductionReportRow[] =>
      [
        ...productionReportRows.filter((row) =>
          !manualKeys.has(
            `${row.partNumber}:${Number(row.shift)}:${getProductionPart(row.partNumber)?.line ?? ''}`,
          ),
        ),
        ...manualRows,
      ].filter((row) => {
        const part = getProductionPart(row.partNumber)
        if (!part) return false
        return activeWorkArea
          ? matchesProductionWorkArea(activeWorkArea, {
              line: part.line,
              type: part.type,
              process: part.process,
            })
          : activeLine === 'all' || part.line === activeLine
      }),
    [activeLine, activeWorkArea?.id, productionTotals.records],
  )

  const rows = useMemo(
    () =>
      lineRows.filter(
        (row) =>
          (shift === 'all' || row.shift === shift.replace('Shift ', '')) &&
          (part === 'all' || row.partNumber === part),
      ),
    [shift, part, lineRows],
  )

  const totalTarget = rows.reduce((sum, row) => sum + row.target, 0)
  const totalActual = rows.reduce((sum, row) => sum + row.actual, 0)
  const totalNg = rows.reduce((sum, row) => sum + row.ng, 0)
  const achievement = totalTarget ? (totalActual / totalTarget) * 100 : 0

  const columns: Column<ProductionReportRow>[] = [
    {
      key: 'date',
      header: t('Tanggal', 'Date'),
      render: (row) => (
        <div className="cell-stack">
          <span className="cell-main">{row.date ? formatDate(row.date) : t('Data demo', 'Demo data')}</span>
        </div>
      ),
    },
    { key: 'part', header: 'Part Number', render: (row) => <span className="mono strong">{row.partNumber}</span> },
    { key: 'target', header: 'Target', align: 'right', render: (row) => <span className="mono">{formatNumber(row.target)}</span> },
    { key: 'actual', header: 'Actual', align: 'right', render: (row) => <span className="mono strong">{formatNumber(row.actual)}</span> },
    { key: 'ng', header: 'NG', align: 'right', render: (row) => <span className={`mono ${row.ng > 0 ? 'text-red' : ''}`}>{row.ng}</span> },
    {
      key: 'achievement',
      header: 'Achievement',
      render: (row) => {
        const rowAchievement = row.target > 0 ? (row.actual / row.target) * 100 : 0
        return (
          <div className="stock-level">
            <div className="stock-level__top">
              <strong>{formatPercent(rowAchievement)}</strong>
              <span>{rowAchievement >= 100 ? 'On target' : 'Below'}</span>
            </div>
            <ProgressBar value={rowAchievement} thin tone={rowAchievement >= 100 ? 'green' : 'orange'} />
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.actual >= row.target ? 'success' : 'warning'} dot>
          {row.actual >= row.target ? 'Achieved' : 'Monitoring'}
        </Badge>
      ),
    },
  ]

  const trend = dailyProductionTrend.map((item) => ({
    label: formatDate(item.date),
    target: activeLine === 'Robot H' ? 0 : item.target,
    assy: activeLine === 'Robot H' ? 0 : item.assy,
    subAssy: activeLine === 'Robot H' ? 0 : item.subAssy,
  }))
  const visibleTrend = period === '7d' ? trend.slice(-7) : trend
  const labels = visibleTrend.map((item) => item.label)
  const target = visibleTrend.map((item) => item.target)
  const assy = visibleTrend.map((item) => item.assy)
  const subAssy = visibleTrend.map((item) => item.subAssy)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Reports"
        title="Production Report"
        subtitle={t(
          'Analisis output Assy dan Sub Assy per tanggal, shift, dan part number. Membandingkan target FSS dengan hasil aktual serta jumlah NG.',
          'Output analysis for Assy and Sub Assy by date, shift, and part number. Compares FSS targets with actual results and NG counts.',
        )}
        meta={
          <>
            <span className="page-meta__item">
              <CalendarDays size={12} /> 01–12 November 2026
            </span>
            <span className="page-meta__item">
              <Factory size={12} /> {lineLabel}
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<Download size={15} />} disabled title={t('Data contoh belum bisa diekspor', 'Demo data cannot be exported')}>
            Export Excel
          </Button>
        }
      />

      <Callout tone="warning">{t('Target dan tren memakai data contoh; ekspor dinonaktifkan sampai tersedia laporan dari backend.', 'Targets and trends use demo data; export is disabled until a backend report is available.')}</Callout>

      {productionTotals.error && (
        <Callout tone="danger" title={t('Hasil produksi tidak tersedia', 'Production results unavailable')}>
          {productionTotals.error}
        </Callout>
      )}
      <Callout tone="info" title={t('Target dan tren masih data demo', 'Targets and trends are still demo data')}>
        {t(
          'Hasil OK/NG yang disimpan operator muncul per shift. Baris dengan tanggal "Data demo" dan grafik tren berasal dari data contoh; target FSS belum terhubung ke hasil aktual frontend.',
          'OK/NG results saved by operators appear per shift. Rows dated "Demo data" and the trend chart come from sample data; FSS targets are not yet connected to actual frontend results.',
        )}
      </Callout>

      <div className="kpi-grid">
        <StatCard label={t('Total target', 'Total target')} value={formatNumber(totalTarget)} suffix="pcs" icon={Target} tone="orange" note={t('Periode terpilih', 'Selected period')} />
        <StatCard label={t('Total actual', 'Total actual')} value={formatNumber(totalActual)} suffix="pcs" icon={TrendingUp} tone="sky" trend={{ label: '+6,4%', direction: 'up' }} note={t('vs periode lalu', 'vs previous period')} />
        <StatCard label="Achievement" value={formatPercent(achievement)} icon={FileBarChart2} tone="green" note={t('Target vs actual', 'Target vs actual')} />
        <StatCard label="Total NG" value={String(totalNg)} suffix="pcs" icon={FileBarChart2} tone="red" note={`NG rate ${((totalNg / (totalActual || 1)) * 100).toFixed(2).replace('.', ',')}%`} />
      </div>

      <section className="card">
        <div className="report-filters">
          <Field label={t('Periode', 'Period')} htmlFor="prod-period">
            <select id="prod-period" className="select" value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="7d">{t('7 hari terakhir', 'Last 7 days')}</option>
              <option value="12d">{t('12 hari terakhir', 'Last 12 days')}</option>
              <option value="30d">{t('30 hari terakhir', 'Last 30 days')}</option>
            </select>
          </Field>
          <Field label="Shift" htmlFor="prod-shift">
            <select id="prod-shift" className="select" value={shift} onChange={(event) => setShift(event.target.value)}>
              {shifts.map((item) => (
                <option key={item} value={item}>
                  {item === 'all' ? t('Semua shift', 'All shifts') : item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Part number" htmlFor="prod-part">
            <select id="prod-part" className="select" value={part} onChange={(event) => setPart(event.target.value)}>
              <option value="all">{t('Semua part number', 'All part numbers')}</option>
              {[...new Set(lineRows.map((row) => row.partNumber))].map((partNumber) => (
                <option key={partNumber} value={partNumber}>
                  {partNumber}
                </option>
              ))}
            </select>
          </Field>
          <div className="field">
            <span className="field-label">{t('Line aktif', 'Active line')}</span>
            <Badge tone="sky">{lineLabel}</Badge>
          </div>
        </div>
      </section>

      <div className="report-chart-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">{t('Tren target vs actual', 'Target vs actual trend')}</h2>
              <p className="section-sub">{t('Output harian seluruh part number (pcs)', 'Daily output for all part numbers (pcs)')}</p>
            </div>
            <Badge tone="sky">Daily</Badge>
          </div>
          <AreaChart
            labels={labels}
            height={270}
            ariaLabel={t('Grafik target dan actual produksi harian', 'Daily production target and actual chart')}
            series={[
              { name: 'Target', color: '#38bdf8', values: target, dashed: true },
              { name: 'Assy', color: '#f97316', values: assy, area: true },
              { name: 'Sub Assy', color: '#10b981', values: subAssy, area: true },
            ]}
          />
        </section>

        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">{t('Output per shift', 'Output per shift')}</h2>
              <p className="section-sub">{t('Perbandingan 2 shift (pcs)', 'Comparison of 2 shifts (pcs)')}</p>
            </div>
          </div>
          <BarChart
            labels={['Shift 1', 'Shift 2']}
            height={270}
            ariaLabel={t('Grafik output per shift', 'Output per shift chart')}
            series={[
              { name: 'Target', color: '#38bdf8', values: [1, 2].map((shiftNumber) =>
                lineRows.filter((row) => row.shift === String(shiftNumber)).reduce((sum, row) => sum + row.target, 0),
              ) },
              { name: 'Actual', color: '#f97316', values: [1, 2].map((shiftNumber) =>
                lineRows.filter((row) => row.shift === String(shiftNumber)).reduce((sum, row) => sum + row.actual, 0),
              ) },
            ]}
          />
          <div className="chart-card__foot">
            <span className="muted small">{lineLabel} · {t('dari data produksi terpilih', 'from selected production data')}</span>
            <Badge tone="success">{rows.length} {t('item', 'items')}</Badge>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">{t('Detail produksi', 'Production details')}</h2>
            <p className="section-sub">{rows.length} {t('baris data', 'data rows')}</p>
          </div>
          <Badge tone="neutral">{period === '7d' ? t('7 hari', '7 days') : period === '12d' ? t('12 hari', '12 days') : t('30 hari', '30 days')}</Badge>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => `${row.partNumber}-${row.shift}`}
          minWidth={820}
          footer={<span className="muted small">{t('Achievement dihitung dari total actual ÷ total target', 'Achievement is calculated from total actual ÷ total target')}</span>}
        />
      </section>
    </div>
  )
}
