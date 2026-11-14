import { AlertTriangle, Download, FileWarning, ShieldAlert, Target, Wrench } from 'lucide-react'
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
import { useAuth } from '../../contexts/AuthContext'
import { ngReasonRows } from '../../data/mock'
import { getProductionPart, matchesProductionWorkArea } from '../../data/productionLines'
import { readProductionShiftRecords } from '../../data/productionLog'

const ngColors = ['#f97316', '#38bdf8', '#f59e0b', '#ef4444', '#8b5cf6']

function loadProductionTotals() {
  try {
    return { records: readProductionShiftRecords(), error: '' }
  } catch (error) {
    return {
      records: [],
      error: error instanceof Error ? error.message : 'Hasil shift gagal dibaca.',
    }
  }
}

export function NgReportPage() {
  const { activeLine, activeWorkArea } = useAuth()
  const [shift, setShift] = useState('all')
  const [reason, setReason] = useState('all')
  const [productionTotals] = useState(loadProductionTotals)

  const lineLabel = activeWorkArea?.label ?? (activeLine === 'all' ? 'All lines' : activeLine)
  const manualRows = productionTotals.records
    .filter((record) => record.ng > 0)
    .map((record) => ({
      id: record.id,
      partNumber: record.partNumber,
      reason: 'Belum dikategorikan',
      count: record.ng,
      shift: String(record.shift),
      operator: record.operator,
      time: record.time,
    }))
  const manualKeys = new Set(
    productionTotals.records.map((record) => `${record.partNumber}:${record.shift}:${record.line}`),
  )
  const lineNgRows = [
    ...ngReasonRows.filter((row) =>
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
  })
  const totalAll = lineNgRows.reduce((sum, row) => sum + row.count, 0)
  const rowsWithShare = lineNgRows.map((row) => ({
    ...row,
    share: totalAll > 0 ? (row.count / totalAll) * 100 : 0,
  }))
  const rows = rowsWithShare.filter(
    (row) =>
      (shift === 'all' || row.shift === shift.replace('Shift ', '')) &&
      (reason === 'all' || row.reason === reason),
  )
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const topReason = [...rowsWithShare].sort((a, b) => b.count - a.count)[0]

  const columns: Column<(typeof rowsWithShare)[number]>[] = [
    {
      key: 'reason',
      header: 'NG Reason',
      render: (row) => (
        <div className="cell-stack">
          <span className="cell-main">{row.reason}</span>
          <span className="cell-sub">{row.partNumber}</span>
        </div>
      ),
    },
    { key: 'shift', header: 'Shift', render: (row) => <Badge tone="neutral">{row.shift}</Badge> },
    { key: 'count', header: 'Jumlah', align: 'right', render: (row) => <span className="mono strong">{row.count} pcs</span> },
    {
      key: 'share',
      header: 'Share',
      render: (row) => (
        <div className="stock-level">
          <div className="stock-level__top">
            <strong>{row.share.toFixed(1).replace('.', ',')}%</strong>
            <span>dari total NG</span>
          </div>
          <ProgressBar value={row.share} thin tone={row.share > 30 ? 'orange' : 'sky'} />
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Tindakan',
      render: (row) => (
        <span className="muted small">
          {row.share > 30 ? 'Root cause analysis' : row.count > 2 ? 'Monitoring proses' : 'Standar'}
        </span>
      ),
    },
  ]

  const sortedRows = [...rowsWithShare].sort((a, b) => b.count - a.count)
  const donutData = sortedRows.map((row, index) => ({
    label: row.reason,
    value: row.count,
    color: ngColors[index % ngColors.length],
  }))

  return (
    <div className="page">
      <PageHeader
        eyebrow="Reports"
        title="NG Report"
        subtitle="Analisis defect berdasarkan penyebab, part number, dan shift. Gunakan pareto untuk memprioritaskan perbaikan proses dengan dampak terbesar."
        meta={
          <>
            <span className="page-meta__item">
              <FileWarning size={12} /> {totalAll} pcs NG · {lineLabel}
            </span>
            <span className="page-meta__item">
              <Target size={12} /> Target NG &lt; 1,5%
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<Download size={15} />}>
            Export NG
          </Button>
        }
      />

      {productionTotals.error && (
        <Callout tone="danger" title="Hasil produksi tidak tersedia">
          {productionTotals.error}
        </Callout>
      )}

      <div className="kpi-grid">
        <StatCard label="Total NG" value={String(totalAll)} suffix="pcs" icon={FileWarning} tone="red" note="Periode November" />
        <StatCard label="NG rate" value={activeLine === 'Robot H' ? '—' : '1,46%'} icon={Target} tone="amber" trend={activeLine === 'Robot H' ? undefined : { label: '-0,32%', direction: 'down', positive: true }} note={activeLine === 'Robot H' ? 'Belum ada data' : 'vs periode lalu'} />
        <StatCard label="Top reason" value={topReason?.reason ?? '—'} icon={AlertTriangle} tone="orange" note={topReason ? `${topReason.share}% dari total NG` : 'Tidak ada data NG'} />
        <StatCard label="Part terdampak" value={String(new Set(lineNgRows.map((row) => row.partNumber)).size)} suffix="PN" icon={ShieldAlert} tone="sky" note={lineLabel} />
      </div>

      <section className="card">
        <div className="report-filters">
          <Field label="Periode" htmlFor="ng-period">
            <select id="ng-period" className="select" defaultValue="month">
              <option value="month">Bulan ini</option>
              <option value="week">Minggu ini</option>
              <option value="shift">Per shift hari ini</option>
            </select>
          </Field>
          <Field label="Shift" htmlFor="ng-shift">
            <select id="ng-shift" className="select" value={shift} onChange={(event) => setShift(event.target.value)}>
              <option value="all">Semua shift</option>
              <option>Shift 1</option>
              <option>Shift 2</option>
            </select>
          </Field>
          <Field label="Penyebab" htmlFor="ng-reason">
            <select id="ng-reason" className="select" value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="all">Semua penyebab</option>
              {rowsWithShare.map((row) => (
                <option key={row.reason} value={row.reason}>
                  {row.reason}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Part number" htmlFor="ng-part">
            <select id="ng-part" className="select" defaultValue="all">
              <option value="all">Semua part</option>
              <option>5220BA42</option>
              <option>75114W000P</option>
              <option>5220K814</option>
            </select>
          </Field>
          <Button variant="primary" leftIcon={<FileWarning size={15} />}>
            Terapkan
          </Button>
        </div>
      </section>

      <div className="report-chart-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">Pareto penyebab NG</h2>
              <p className="section-sub">Frekuensi defect (pcs)</p>
            </div>
            <Badge tone="orange">Pareto</Badge>
          </div>
          <BarChart
            labels={sortedRows.map((row) => row.reason)}
            height={260}
            ariaLabel="Grafik pareto penyebab NG"
            series={[
              { name: 'NG', color: '#f97316', values: sortedRows.map((row) => row.count) },
            ]}
          />
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Komposisi NG</h2>
              <p className="section-sub">Share per penyebab</p>
            </div>
          </div>
          <DonutChart data={donutData} size={172} centerValue={String(totalAll)} centerLabel="pcs NG" />
        </section>
      </div>

      <div className="report-split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Pareto detail</h2>
              <p className="section-sub">Urutan penyebab terbesar</p>
            </div>
          </div>
          <div className="pareto-list">
            {sortedRows.map((row, index) => (
              <div className="pareto-row" key={row.id}>
                <span className="pareto-row__rank">{index + 1}</span>
                <div className="pareto-row__body">
                  <div className="pareto-row__label">
                    <span style={{ color: 'var(--text-soft)', fontWeight: 500 }}>{row.reason}</span>
                    <span>{row.partNumber}</span>
                  </div>
                  <ProgressBar value={row.share} thin tone={index === 0 ? 'orange' : 'sky'} />
                </div>
                <span className="pareto-row__count">{row.count}</span>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card section-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Rekomendasi perbaikan</h2>
                <p className="section-sub">Berdasarkan pareto</p>
              </div>
            </div>
            <div className="timeline">
              <div className="timeline-item">
                <span className="timeline-dot timeline-dot--amber" />
                <div>
                  <div className="timeline-head">
                    <span className="timeline-title">Weld spatter</span>
                    <span className="timeline-time">41,7%</span>
                  </div>
                  <p className="timeline-text">
                    Evaluasi parameter arus dan kebersihan nozzle. Lakukan uji coba pada 3 jig
                    dengan cycle time berbeda.
                  </p>
                </div>
              </div>
              <div className="timeline-item">
                <span className="timeline-dot timeline-dot--sky" />
                <div>
                  <div className="timeline-head">
                    <span className="timeline-title">Dimensi tidak sesuai</span>
                    <span className="timeline-time">25%</span>
                  </div>
                  <p className="timeline-text">
                    Kalibrasi fixture dan verifikasi setting mesin setiap awal shift.
                  </p>
                </div>
              </div>
              <div className="timeline-item">
                <span className="timeline-dot timeline-dot--green" />
                <div>
                  <div className="timeline-head">
                    <span className="timeline-title">Rencana verifikasi</span>
                    <span className="timeline-time">Minggu 3</span>
                  </div>
                  <p className="timeline-text">
                    Review hasil perbaikan dengan Leader dan Quality sebelum menutup temuan.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Callout tone="danger" title="Perlu perhatian">
            Weld spatter menyumbang hampir separuh NG. Fokuskan improvement di proses ini minggu
            ini.
          </Callout>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Detail NG</h2>
            <p className="section-sub">{rows.length} penyebab ditampilkan</p>
          </div>
          <Badge tone="neutral">{shift === 'all' ? 'Semua shift' : shift}</Badge>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} minWidth={760} />
      </section>
    </div>
  )
}
