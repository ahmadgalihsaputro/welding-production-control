import { CalendarDays, Download, PackageCheck, ShieldAlert, Target } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tabs } from '../../components/ui/Tabs'
import { useQueue } from '../../contexts/QueueContext'
import { useAuth } from '../../contexts/AuthContext'
import { getProductionPart, matchesProductionWorkArea } from '../../data/productionLines'
import {
  isBoxCompletedAfterShiftTotal,
  matchesProductionShiftBox,
} from '../../data/productionLog'
import { loadNgRecords, loadShiftResults } from '../../lib/productionApi'
import type { ProductionResult, ProductionShiftRecord, NgShiftRecord } from '../../types'
import { formatNumber, formatPercent } from '../../lib/utils'

interface ResultsState<T> {
  records: T[]
  error: string
  loading: boolean
}

const typeTabs = [
  { value: 'all', label: 'Semua' },
  { value: 'Assy', label: 'Assy' },
  { value: 'Sub Assy', label: 'Sub Assy' },
]

export function ProductionResultsPage() {
  const { activeLine, activeWorkArea } = useAuth()
  const [type, setType] = useState('all')
  const [search, setSearch] = useState('')
  const { completed } = useQueue()
  const [ngState, setNgState] = useState<ResultsState<NgShiftRecord>>({
    records: [],
    error: '',
    loading: true,
  })
  const [shiftTotalState, setShiftTotalState] = useState<ResultsState<ProductionShiftRecord>>({
    records: [],
    error: '',
    loading: true,
  })

  useEffect(() => {
    let active = true
    Promise.all([loadShiftResults(), loadNgRecords()])
      .then(([shiftRecords, ngRecords]) => {
        if (!active) return
        setShiftTotalState({ records: shiftRecords, error: '', loading: false })
        setNgState({ records: ngRecords, error: '', loading: false })
      })
      .catch((error) => {
        if (!active) return
        const message = error instanceof Error ? error.message : 'Data hasil produksi gagal dimuat.'
        setShiftTotalState((current) => ({ ...current, error: message, loading: false }))
        setNgState((current) => ({ ...current, error: message, loading: false }))
      })
    return () => {
      active = false
    }
  }, [completed.length])
  const shiftTotalKeys = new Set(
    shiftTotalState.records.map((record) =>
      `${record.date}:${record.partNumber}:${record.shift}:${record.line}:${record.process ?? ''}`,
    ),
  )
  const totalForBox = (box: (typeof completed)[number]) =>
    shiftTotalState.records.find((record) =>
      matchesProductionShiftBox(box, record) &&
      (record.process ?? '') === (getProductionPart(box.partNumber)?.process ?? ''),
    )

  const allResults: ProductionResult[] = [
    ...completed
      .filter((box) => {
        const total = totalForBox(box)
        return !total || isBoxCompletedAfterShiftTotal(box, total)
      })
      .map((box) => ({
      id: box.id,
      partNumber: box.partNumber,
      type: box.type,
      ok: box.qty,
      ng: 0,
      shift: box.shift ?? 1,
      operator: box.operator,
      time: box.completedAt,
      line: box.line ?? 'Robot G',
      date: box.date,
      process: getProductionPart(box.partNumber)?.process,
    })),
    ...ngState.records
      .filter((record) =>
        !shiftTotalKeys.has(
          `${record.date}:${record.partNumber}:${record.shift}:${record.line}:${getProductionPart(record.partNumber)?.process ?? ''}`,
        ),
      )
      .map((record) => ({
      id: record.id,
      partNumber: record.partNumber,
      type: record.type,
      ok: 0,
      ng: record.ng,
      shift: record.shift,
      operator: record.operator,
      time: record.time,
      line: record.line,
      date: record.date,
      process: getProductionPart(record.partNumber)?.process,
    })),
    ...shiftTotalState.records.map((record) => ({
      id: record.id,
      partNumber: record.partNumber,
      type: record.type,
      ok: record.ok + completed
        .filter((box) =>
          totalForBox(box)?.id === record.id &&
          isBoxCompletedAfterShiftTotal(box, record))
        .reduce((sum, box) => sum + box.qty, 0),
      ng: record.ng,
      shift: record.shift,
      operator: record.operator,
      time: `${record.date} ${record.time}`,
      line: record.line,
      date: record.date,
      process: record.process,
    })),
  ]
  const results = allResults.filter(
    (item) => {
      if (activeWorkArea) {
        const part = getProductionPart(item.partNumber)
        return Boolean(
          part &&
          matchesProductionWorkArea(activeWorkArea, {
            line: part.line,
            type: item.type,
            process: part.process,
          }),
        )
      }
      return activeLine === 'all' || item.line === activeLine
    },
  )

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return results.filter((item) => {
      const matchType = type === 'all' || item.type === type
      const matchSearch =
        !needle ||
        item.partNumber.toLowerCase().includes(needle) ||
        item.operator.toLowerCase().includes(needle)
      return matchType && matchSearch
    })
  }, [type, search, results])

  const totalOk = results.reduce((sum, item) => sum + item.ok, 0)
  const totalNg = results.reduce((sum, item) => sum + item.ng, 0)
  const totalOutput = totalOk + totalNg
  const yieldRate = (totalOk / Math.max(totalOutput, 1)) * 100

  const columns: Column<ProductionResult>[] = [
    {
      key: 'part',
      header: 'Part Number',
      render: (item) => (
        <div className="cell-stack">
          <span className="cell-main">{item.partNumber}</span>
          <span className="cell-sub">{item.type} · {item.line}</span>
        </div>
      ),
    },
    { key: 'shift', header: 'Shift', render: (item) => <Badge tone="neutral">Shift {item.shift}</Badge> },
    {
      key: 'ok',
      header: 'OK',
      align: 'right',
      render: (item) => <span className="mono text-green strong">{formatNumber(item.ok)}</span>,
    },
    {
      key: 'ng',
      header: 'NG',
      align: 'right',
      render: (item) => <span className="mono text-red">{formatNumber(item.ng)}</span>,
    },
    {
      key: 'yield',
      header: 'Yield',
      align: 'right',
      render: (item) => (
        <span className="mono">{formatPercent((item.ok / Math.max(item.ok + item.ng, 1)) * 100)}</span>
      ),
    },
    {
      key: 'operator',
      header: 'Operator',
      render: (item) => <span>{item.operator}</span>,
    },
    {
      key: 'time',
      header: 'Waktu',
      render: (item) => <span className="muted">{item.time}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: () => <StatusBadge status="complete" label="Posted" />,
    },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Production Control"
        title="Hasil Produksi"
        subtitle="Rekap hasil Assy dan Sub Assy per shift, operator, part number, dan line. Buka detail untuk melihat histori transaksi serta Kanban."
        meta={
          <>
            <span className="page-meta__item">
              <CalendarDays size={12} />{' '}
              {new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span className="page-meta__item">
              <PackageCheck size={12} /> {results.length} transaksi
            </span>
          </>
        }
        actions={
          <Button variant="primary" leftIcon={<Download size={15} />}>
            Export hasil
          </Button>
        }
      />

      {ngState.error && <Callout tone="danger">{ngState.error}</Callout>}
      {shiftTotalState.error && <Callout tone="danger">{shiftTotalState.error}</Callout>}
      {(ngState.loading || shiftTotalState.loading) && (
        <Callout tone="info">Memuat hasil produksi dari server…</Callout>
      )}

      <div className="kpi-grid">
        <StatCard
          label="Total OK"
          value={formatNumber(totalOk)}
          suffix="pcs"
          icon={PackageCheck}
          tone="green"
          note="Semua jenis produksi"
        />
        <StatCard
          label="Total NG"
          value={formatNumber(totalNg)}
          suffix="pcs"
          icon={ShieldAlert}
          tone="red"
          note={`${formatPercent((totalNg / Math.max(totalOutput, 1)) * 100, 2)} dari output`}
        />
        <StatCard
          label="Yield"
          value={formatPercent(yieldRate, 2)}
          icon={Target}
          tone="sky"
          trend={{ label: '+0,4%', direction: 'up' }}
          note="vs shift sebelumnya"
        />
        <StatCard
          label="Total output"
          value={formatNumber(totalOutput)}
          suffix="pcs"
          icon={PackageCheck}
          tone="orange"
          note="OK + NG"
        />
      </div>

      <div className="report-chart-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">Output per part number</h2>
              <p className="section-sub">Perbandingan OK dan NG hari ini</p>
            </div>
            <Badge tone="sky">{rows.length} PN</Badge>
          </div>
          <BarChart
            labels={results.map((item) => item.partNumber)}
            height={240}
            series={[
              {
                name: 'OK',
                color: '#10b981',
                values: results.map((item) => item.ok),
              },
              {
                name: 'NG',
                color: '#f97316',
                values: results.map((item) => item.ng),
              },
            ]}
          />
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Komposisi output</h2>
              <p className="section-sub">Assy vs Sub Assy</p>
            </div>
          </div>
          <DonutChart
            data={[
              {
                label: 'Assy',
                value: results.filter((item) => item.type === 'Assy').reduce((sum, item) => sum + item.ok, 0),
                color: '#f97316',
              },
              {
                label: 'Sub Assy',
                value: results.filter((item) => item.type === 'Sub Assy').reduce((sum, item) => sum + item.ok, 0),
                color: '#38bdf8',
              },
            ]}
            size={168}
            centerValue={formatNumber(totalOk)}
            centerLabel="pcs OK"
          />
        </section>
      </div>

      <section className="card">
        <div className="table-toolbar">
          <Tabs items={typeTabs} value={type} onChange={setType} ariaLabel="Filter jenis produksi" />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari PN atau operator…"
            className="search-inline"
          />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          minWidth={840}
          footer={
            <>
              <span>
                <strong>{rows.length}</strong> transaksi ditampilkan
              </span>
              <span>Yield keseluruhan {formatPercent(yieldRate, 2)}</span>
            </>
          }
        />
      </section>
    </div>
  )
}
