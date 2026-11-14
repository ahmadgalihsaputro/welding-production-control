import {
  ArrowUpDown,
  CheckCircle2,
  Clock3,
  ExternalLink,
  PackageSearch,
  Truck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tabs } from '../../components/ui/Tabs'
import { externalMaterials } from '../../data/mock'
import type { ExternalMaterial } from '../../types'
import { formatNumber } from '../../lib/utils'

const statusTabs = [
  { value: 'all', label: 'Semua' },
  { value: 'waiting', label: 'Menunggu' },
  { value: 'partial', label: 'Partial' },
  { value: 'received', label: 'Diterima' },
]

export function ExternalQueuePage() {
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState<Record<string, ExternalMaterial['priority']>>({})

  const rows = useMemo(
    () => externalMaterials.filter((item) => status === 'all' || item.status === status),
    [status],
  )

  const pending = externalMaterials.filter((item) => item.status !== 'received').length
  const totalNeed = externalMaterials.reduce((sum, item) => sum + item.need, 0)
  const totalReceived = externalMaterials.reduce((sum, item) => sum + item.received, 0)

  const togglePriority = (item: ExternalMaterial) => {
    setPriority((current) => ({
      ...current,
      [item.id]: (current[item.id] ?? item.priority) === 'urgent' ? 'normal' : 'urgent',
    }))
  }

  const columns: Column<ExternalMaterial>[] = [
    {
      key: 'part',
      header: 'Part Number',
      render: (item) => (
        <div className="cell-stack">
          <span className="cell-main">{item.partNumber}</span>
          <span className="cell-sub">Source: {item.source}</span>
        </div>
      ),
    },
    { key: 'need', header: 'Kebutuhan', align: 'right', render: (item) => `${formatNumber(item.need)} pcs` },
    {
      key: 'received',
      header: 'Diterima',
      align: 'right',
      render: (item) => (
        <span className={item.received >= item.need ? 'text-green' : ''}>
          {formatNumber(item.received)} pcs
        </span>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (item) => (
        <div style={{ minWidth: 110 }}>
          <ProgressBar
            value={(item.received / Math.max(item.need, 1)) * 100}
            thin
            tone={item.received >= item.need ? 'green' : 'sky'}
          />
          <div className="progress-meta" style={{ marginTop: 4 }}>
            <span>{Math.round((item.received / Math.max(item.need, 1)) * 100)}%</span>
            <span>{item.requestedAt}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Prioritas',
      render: (item) => (
        <StatusBadge status={priority[item.id] ?? item.priority} />
      ),
    },
    { key: 'status', header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (item) => (
        <div className="table-actions">
          <button
            type="button"
            className="btn-icon"
            aria-label="Ubah prioritas"
            onClick={() => togglePriority(item)}
          >
            <ArrowUpDown size={14} />
          </button>
          <button type="button" className="btn-icon" aria-label="Buka penerimaan">
            <ExternalLink size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Material Control"
        title="External Material Queue"
        subtitle="Material yang dibutuhkan dari proses di luar Welding — Supplier, Stamping, atau TANDUM. WPC hanya memantau antrean, bukan mengelola proses produksi sumber."
        meta={
          <>
            <span className="page-meta__item">
              <Truck size={12} /> External source
            </span>
            <span className="page-meta__item">
              <Clock3 size={12} /> Update 09:30
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<ArrowUpDown size={15} />}>
            Atur prioritas
          </Button>
        }
      />

      <div className="kpi-grid kpi-grid--3">
        <StatCard
          label="Antrean tertunda"
          value={String(pending)}
          suffix="item"
          icon={PackageSearch}
          tone="orange"
          note="Menunggu kedatangan"
        />
        <StatCard
          label="Total kebutuhan"
          value={formatNumber(totalNeed)}
          suffix="pcs"
          icon={Truck}
          tone="sky"
          note="Seluruh source"
        />
        <StatCard
          label="Sudah diterima"
          value={formatNumber(totalReceived)}
          suffix="pcs"
          icon={CheckCircle2}
          tone="green"
          note={`${Math.round((totalReceived / Math.max(totalNeed, 1)) * 100)}% dari kebutuhan`}
        />
      </div>

      <section className="card">
        <div className="table-toolbar">
          <Tabs items={statusTabs} value={status} onChange={setStatus} ariaLabel="Filter status material eksternal" />
          <Badge tone="neutral">{rows.length} item</Badge>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          minWidth={860}
          footer={
            <>
              <span>
                <strong>{rows.length}</strong> item ditampilkan
              </span>
              <span>Source: Supplier · Stamping · TANDUM</span>
            </>
          }
        />
      </section>

      <div className="grid grid-2">
        <Callout tone="info" title="Batas tanggung jawab WPC">
          WPC mencatat kebutuhan dan penerimaan material eksternal. Proses produksi Supplier,
          Stamping, atau TANDUM tetap dikelola di sistem masing-masing.
        </Callout>
        <Callout tone="warning" title="Prioritas Leader">
          Perubahan prioritas hanya memengaruhi urutan perhatian di area Welding, bukan
          mengubah jadwal produksi sumber.
        </Callout>
      </div>
    </div>
  )
}
