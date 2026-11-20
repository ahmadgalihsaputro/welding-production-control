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
import { usePreferences } from '../../contexts/PreferencesContext'
import { ngReasonRows } from '../../data/mock'
import { getProductionPart, matchesProductionWorkArea } from '../../data/productionLines'
import { readProductionShiftRecords } from '../../data/productionLog'

const ngColors = ['#f97316', '#38bdf8', '#f59e0b', '#ef4444', '#8b5cf6']

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

export function NgReportPage() {
  const { activeLine, activeWorkArea } = useAuth()
  const { t } = usePreferences()
  const [shift, setShift] = useState('all')
  const [reason, setReason] = useState('all')
  const [productionTotals] = useState(() => loadProductionTotals(t))

  const lineLabel = activeWorkArea?.label ?? (activeLine === 'all' ? 'All lines' : activeLine)
  const manualRows = productionTotals.records
    .filter((record) => record.ng > 0)
    .map((record) => ({
      id: record.id,
      partNumber: record.partNumber,
      reason: t('Belum dikategorikan', 'Uncategorised'),
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
    { key: 'count', header: t('Jumlah', 'Qty'), align: 'right', render: (row) => <span className="mono strong">{row.count} pcs</span> },
    {
      key: 'share',
      header: 'Share',
      render: (row) => (
        <div className="stock-level">
          <div className="stock-level__top">
            <strong>{row.share.toFixed(1).replace('.', ',')}%</strong>
            <span>{t('dari total NG', 'of total NG')}</span>
          </div>
          <ProgressBar value={row.share} thin tone={row.share > 30 ? 'orange' : 'sky'} />
        </div>
      ),
    },
    {
      key: 'action',
      header: t('Tindakan', 'Action'),
      render: (row) => (
        <span className="muted small">
          {row.share > 30 ? 'Root cause analysis' : row.count > 2 ? t('Monitoring proses', 'Process monitoring') : t('Standar', 'Standard')}
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
        subtitle={t(
          'Analisis defect berdasarkan penyebab, part number, dan shift. Gunakan pareto untuk memprioritaskan perbaikan proses dengan dampak terbesar.',
          'Defect analysis by cause, part number, and shift. Use the pareto to prioritise process improvements with the largest impact.',
        )}
        meta={
          <>
            <span className="page-meta__item">
              <FileWarning size={12} /> {totalAll} pcs NG · {lineLabel}
            </span>
            <span className="page-meta__item">
              <Target size={12} /> {t('Target NG < 1,5%', 'NG target < 1.5%')}
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<Download size={15} />} disabled title={t('Data contoh belum bisa diekspor', 'Demo data cannot be exported')}>
            Export NG
          </Button>
        }
      />

      <Callout tone="warning">{t('Sebagian angka di halaman ini adalah data contoh dan belum bisa diekspor.', 'Some figures on this page are demo data and cannot be exported.')}</Callout>

      {productionTotals.error && (
        <Callout tone="danger" title={t('Hasil produksi tidak tersedia', 'Production results unavailable')}>
          {productionTotals.error}
        </Callout>
      )}

      <div className="kpi-grid">
        <StatCard label="Total NG" value={String(totalAll)} suffix="pcs" icon={FileWarning} tone="red" note={t('Periode November', 'November period')} />
        <StatCard label="NG rate" value={activeLine === 'Robot H' ? '—' : '1,46%'} icon={Target} tone="amber" trend={activeLine === 'Robot H' ? undefined : { label: '-0,32%', direction: 'down', positive: true }} note={activeLine === 'Robot H' ? t('Belum ada data', 'No data yet') : t('vs periode lalu', 'vs previous period')} />
        <StatCard label="Top reason" value={topReason?.reason ?? '—'} icon={AlertTriangle} tone="orange" note={topReason ? `${topReason.share}% ${t('dari total NG', 'of total NG')}` : t('Tidak ada data NG', 'No NG data')} />
        <StatCard label={t('Part terdampak', 'Affected parts')} value={String(new Set(lineNgRows.map((row) => row.partNumber)).size)} suffix="PN" icon={ShieldAlert} tone="sky" note={lineLabel} />
      </div>

      <section className="card">
        <div className="report-filters">
          <Field label={t('Periode', 'Period')} htmlFor="ng-period">
            <select id="ng-period" className="select" defaultValue="month">
              <option value="month">{t('Bulan ini', 'This month')}</option>
              <option value="week">{t('Minggu ini', 'This week')}</option>
              <option value="shift">{t('Per shift hari ini', 'Per shift today')}</option>
            </select>
          </Field>
          <Field label="Shift" htmlFor="ng-shift">
            <select id="ng-shift" className="select" value={shift} onChange={(event) => setShift(event.target.value)}>
              <option value="all">{t('Semua shift', 'All shifts')}</option>
              <option>Shift 1</option>
              <option>Shift 2</option>
            </select>
          </Field>
          <Field label={t('Penyebab', 'Cause')} htmlFor="ng-reason">
            <select id="ng-reason" className="select" value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="all">{t('Semua penyebab', 'All causes')}</option>
              {rowsWithShare.map((row) => (
                <option key={row.reason} value={row.reason}>
                  {row.reason}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Part number" htmlFor="ng-part">
            <select id="ng-part" className="select" defaultValue="all">
              <option value="all">{t('Semua part', 'All parts')}</option>
              <option>5220BA42</option>
              <option>75114W000P</option>
              <option>5220K814</option>
            </select>
          </Field>
          <Button variant="primary" leftIcon={<FileWarning size={15} />}>
            {t('Terapkan', 'Apply')}
          </Button>
        </div>
      </section>

      <div className="report-chart-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">{t('Pareto penyebab NG', 'NG cause pareto')}</h2>
              <p className="section-sub">{t('Frekuensi defect (pcs)', 'Defect frequency (pcs)')}</p>
            </div>
            <Badge tone="orange">Pareto</Badge>
          </div>
          <BarChart
            labels={sortedRows.map((row) => row.reason)}
            height={260}
            ariaLabel={t('Grafik pareto penyebab NG', 'NG cause pareto chart')}
            series={[
              { name: 'NG', color: '#f97316', values: sortedRows.map((row) => row.count) },
            ]}
          />
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{t('Komposisi NG', 'NG composition')}</h2>
              <p className="section-sub">{t('Share per penyebab', 'Share per cause')}</p>
            </div>
          </div>
          <DonutChart data={donutData} size={172} centerValue={String(totalAll)} centerLabel="pcs NG" />
        </section>
      </div>

      <div className="report-split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{t('Pareto detail', 'Pareto details')}</h2>
              <p className="section-sub">{t('Urutan penyebab terbesar', 'Largest causes in order')}</p>
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
                <h2 className="section-title">{t('Rekomendasi perbaikan', 'Improvement recommendations')}</h2>
                <p className="section-sub">{t('Berdasarkan pareto', 'Based on the pareto')}</p>
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
                    {t(
                      'Evaluasi parameter arus dan kebersihan nozzle. Lakukan uji coba pada 3 jig dengan cycle time berbeda.',
                      'Review current parameters and nozzle cleanliness. Run trials on 3 jigs with different cycle times.',
                    )}
                  </p>
                </div>
              </div>
              <div className="timeline-item">
                <span className="timeline-dot timeline-dot--sky" />
                <div>
                  <div className="timeline-head">
                    <span className="timeline-title">{t('Dimensi tidak sesuai', 'Dimension mismatch')}</span>
                    <span className="timeline-time">25%</span>
                  </div>
                  <p className="timeline-text">
                    {t(
                      'Kalibrasi fixture dan verifikasi setting mesin setiap awal shift.',
                      'Calibrate fixtures and verify machine settings at the start of every shift.',
                    )}
                  </p>
                </div>
              </div>
              <div className="timeline-item">
                <span className="timeline-dot timeline-dot--green" />
                <div>
                  <div className="timeline-head">
                    <span className="timeline-title">{t('Rencana verifikasi', 'Verification plan')}</span>
                    <span className="timeline-time">{t('Minggu 3', 'Week 3')}</span>
                  </div>
                  <p className="timeline-text">
                    {t(
                      'Review hasil perbaikan dengan Leader dan Quality sebelum menutup temuan.',
                      'Review improvement results with the Leader and Quality before closing the findings.',
                    )}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Callout tone="danger" title={t('Perlu perhatian', 'Requires attention')}>
            {t(
              'Weld spatter menyumbang hampir separuh NG. Fokuskan improvement di proses ini minggu ini.',
              'Weld spatter accounts for almost half of all NG. Focus improvement efforts on this process this week.',
            )}
          </Callout>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">{t('Detail NG', 'NG details')}</h2>
            <p className="section-sub">{rows.length} {t('penyebab ditampilkan', 'causes shown')}</p>
          </div>
          <Badge tone="neutral">{shift === 'all' ? t('Semua shift', 'All shifts') : shift}</Badge>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} minWidth={760} />
      </section>
    </div>
  )
}
