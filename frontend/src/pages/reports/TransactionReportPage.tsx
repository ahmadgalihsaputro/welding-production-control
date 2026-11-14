import { ArrowDownUp, CircleCheck, Clock3, Download, ListFilter, ReceiptText, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tabs } from '../../components/ui/Tabs'
import { SearchInput } from '../../components/ui/SearchInput'
import { transactionRows } from '../../data/mock'
import { formatNumber } from '../../lib/utils'
import type { TransactionRow } from '../../types'

const statusTabs = [
  { value: 'all', label: 'Semua' },
  { value: 'posted', label: 'Posted' },
  { value: 'pending', label: 'Pending' },
  { value: 'void', label: 'Void' },
]

export function TransactionReportPage() {
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [search, setSearch] = useState('')

  const rows = transactionRows.filter((row) => {
    const needle = search.trim().toLowerCase()
    return (
      (status === 'all' || row.status === status) &&
      (type === 'all' || row.type === type) &&
      (!needle ||
        row.code.toLowerCase().includes(needle) ||
        row.partNumber.toLowerCase().includes(needle) ||
        row.user.toLowerCase().includes(needle))
    )
  })

  const columns: Column<TransactionRow>[] = [
    {
      key: 'code',
      header: 'Transaction',
      render: (row) => (
        <div className="cell-stack">
          <span className="cell-main mono">{row.code}</span>
          <span className="cell-sub">{row.time} · {row.location}</span>
        </div>
      ),
    },
    { key: 'part', header: 'Part Number', render: (row) => <span className="mono strong">{row.partNumber}</span> },
    { key: 'type', header: 'Tipe', render: (row) => <Badge tone="neutral">{row.type}</Badge> },
    {
      key: 'qty',
      header: 'Qty',
      align: 'right',
      render: (row) => (
        <span className={`mono strong ${row.qty < 0 ? 'text-red' : row.qty > 0 ? 'text-green' : ''}`}>
          {row.qty > 0 ? '+' : ''}
          {formatNumber(row.qty)}
        </span>
      ),
    },
    { key: 'user', header: 'User', render: (row) => <span className="muted small">{row.user}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ]

  const posted = transactionRows.filter((row) => row.status === 'posted').length
  const pending = transactionRows.filter((row) => row.status === 'pending').length
  const voided = transactionRows.filter((row) => row.status === 'void').length
  const netQty = transactionRows.reduce((sum, row) => sum + row.qty, 0)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Reports"
        title="Transaction Report"
        subtitle="Jejak audit seluruh transaksi inventory: store in, supply issue, pickup, return, adjustment, dan cetak kanban. Setiap baris terhubung ke user dan lokasi."
        meta={
          <>
            <span className="page-meta__item">
              <ReceiptText size={12} /> {transactionRows.length} transaksi
            </span>
            <span className="page-meta__item">
              <Clock3 size={12} /> 12 Nov 2026 · 08:00–09:12
            </span>
          </>
        }
        actions={
          <Button variant="secondary" leftIcon={<Download size={15} />}>
            Export ledger
          </Button>
        }
      />

      <div className="kpi-grid">
        <StatCard label="Total transaksi" value={String(transactionRows.length)} suffix="trx" icon={ReceiptText} tone="orange" note="Hari ini" />
        <StatCard label="Posted" value={String(posted)} suffix="trx" icon={CircleCheck} tone="green" note="Tervalidasi sistem" />
        <StatCard label="Pending" value={String(pending)} suffix="trx" icon={Clock3} tone="amber" note="Menunggu verifikasi" />
        <StatCard label="Net movement" value={formatNumber(netQty)} suffix="pcs" icon={ArrowDownUp} tone="sky" note={`${voided} transaksi void`} />
      </div>

      <section className="card">
        <div className="report-filters">
          <Field label="Dari tanggal" htmlFor="tx-from">
            <input id="tx-from" type="date" className="input" defaultValue="2026-11-12" />
          </Field>
          <Field label="Sampai tanggal" htmlFor="tx-to">
            <input id="tx-to" type="date" className="input" defaultValue="2026-11-12" />
          </Field>
          <Field label="Tipe transaksi" htmlFor="tx-type">
            <select id="tx-type" className="select" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">Semua tipe</option>
              <option>Store In</option>
              <option>Supply Issue</option>
              <option>Collect Pickup</option>
              <option>Return Kanban</option>
              <option>Adjustment</option>
              <option>Kanban Print</option>
            </select>
          </Field>
          <Field label="User" htmlFor="tx-user">
            <select id="tx-user" className="select" defaultValue="all">
              <option value="all">Semua user</option>
              <option>Adi Nugroho</option>
              <option>Bagas Saputra</option>
              <option>Rina Puspita</option>
              <option>Dimas Prakoso</option>
            </select>
          </Field>
          <Button variant="primary" leftIcon={<ListFilter size={15} />}>
            Terapkan
          </Button>
        </div>
      </section>

      <section className="card">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <Tabs items={statusTabs} value={status} onChange={setStatus} ariaLabel="Filter status transaksi" />
            <Badge tone={voided > 0 ? 'danger' : 'neutral'} dot>
              <XCircle size={11} /> {voided} void
            </Badge>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari kode, part, user…"
            className="search-inline"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          minWidth={900}
          footer={
            <div className="row row--between" style={{ width: '100%' }}>
              <span className="muted small">Menampilkan {rows.length} dari {transactionRows.length} transaksi</span>
              <span className="small">
                Net qty: <strong className="mono">{formatNumber(netQty)} pcs</strong>
              </span>
            </div>
          }
        />
      </section>
    </div>
  )
}
