import { ArrowDownLeft, ArrowUpRight, CalendarDays, Download, FileClock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AreaChart } from '../../components/charts/AreaChart'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { ledgerEntries } from '../../data/mock'
import type { LedgerEntry } from '../../types'
import { formatNumber } from '../../lib/utils'

export function StockLedgerPage() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return ledgerEntries.filter((item) => {
      const matchType = type === 'all' || item.type === type
      const matchSearch =
        !needle ||
        item.partNumber.toLowerCase().includes(needle) ||
        item.reference.toLowerCase().includes(needle)
      return matchType && matchSearch
    })
  }, [search, type])

  const incoming = ledgerEntries
    .filter((item) => item.qty > 0)
    .reduce((sum, item) => sum + item.qty, 0)
  const outgoing = ledgerEntries
    .filter((item) => item.qty < 0)
    .reduce((sum, item) => sum + item.qty, 0)
  const net = incoming + outgoing

  const columns: Column<LedgerEntry>[] = [
    { key: 'time', header: 'Waktu', render: (item) => <span className="mono muted">{item.time}</span> },
    {
      key: 'part',
      header: 'Part Number',
      render: (item) => (
        <div className="cell-stack">
          <span className="cell-main">{item.partNumber}</span>
          <span className="cell-sub">{item.location}</span>
        </div>
      ),
    },
    { key: 'type', header: 'Transaksi', render: (item) => <Badge tone={item.qty > 0 ? 'success' : 'orange'}>{item.type}</Badge> },
    {
      key: 'qty',
      header: 'Qty',
      align: 'right',
      render: (item) => (
        <span className={`mono ${item.qty > 0 ? 'text-green' : 'text-red'}`}>
          {item.qty > 0 ? '+' : ''}
          {formatNumber(item.qty)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Saldo',
      align: 'right',
      render: (item) => <span className="mono strong">{formatNumber(item.balance)}</span>,
    },
    {
      key: 'ref',
      header: 'Referensi',
      render: (item) => <span className="small muted">{item.reference}</span>,
    },
    { key: 'user', header: 'User', render: (item) => item.user },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Inventory Control"
        title="Mutasi Stok"
        subtitle="Semua transaksi masuk dan keluar dapat ditelusuri sampai user, Kanban, work order, dan lokasi asal-tujuan."
        meta={
          <>
            <span className="page-meta__item">
              <CalendarDays size={12} /> 12 November 2026
            </span>
            <span className="page-meta__item">
              <FileClock size={12} /> {ledgerEntries.length} transaksi
            </span>
          </>
        }
        actions={
          <Button variant="primary" leftIcon={<Download size={15} />}>
            Export ledger
          </Button>
        }
      />

      <div className="kpi-grid kpi-grid--3">
        <StatCard
          label="Total masuk"
          value={formatNumber(incoming)}
          suffix="pcs"
          icon={ArrowDownLeft}
          tone="green"
          note="Store In & return"
        />
        <StatCard
          label="Total keluar"
          value={formatNumber(Math.abs(outgoing))}
          suffix="pcs"
          icon={ArrowUpRight}
          tone="red"
          note="Supply issue & pickup"
        />
        <StatCard
          label="Net movement"
          value={net > 0 ? `+${formatNumber(net)}` : formatNumber(net)}
          suffix="pcs"
          icon={FileClock}
          tone="sky"
          note="Saldo bergerak hari ini"
        />
      </div>

      <section className="card chart-card">
        <div className="chart-card__head">
          <div>
            <h2 className="section-title">Saldo berjalan</h2>
            <p className="section-sub">5220K814 · Sub Assy Store</p>
          </div>
          <Badge tone="sky">Opening 140 pcs</Badge>
        </div>
        <AreaChart
          labels={ledgerEntries.map((item) => item.time)}
          height={230}
          ariaLabel="Grafik saldo stok berjalan"
          series={[
            {
              name: 'Balance',
              color: '#38bdf8',
              values: ledgerEntries.map((item) => item.balance),
            },
          ]}
        />
      </section>

      <section className="card">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <div className="select-wrap">
              <select
                className="select"
                style={{ width: 170, height: 38, minHeight: 38 }}
                value={type}
                onChange={(event) => setType(event.target.value)}
                aria-label="Filter jenis transaksi"
              >
                <option value="all">Semua transaksi</option>
                <option value="Opening">Opening</option>
                <option value="Store In">Store In</option>
                <option value="Supply Issue">Supply Issue</option>
                <option value="Return Accepted">Return Accepted</option>
                <option value="Adjustment">Adjustment</option>
              </select>
            </div>
            <Badge tone="neutral">{rows.length} baris</Badge>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari PN atau referensi…"
            className="search-inline"
          />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          minWidth={820}
          footer={
            <>
              <span>
                Menampilkan <strong>{rows.length}</strong> transaksi
              </span>
              <span>Saldo akhir 85 pcs</span>
            </>
          }
        />
      </section>
    </div>
  )
}
