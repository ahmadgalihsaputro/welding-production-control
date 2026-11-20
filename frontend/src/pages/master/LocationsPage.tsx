import { Boxes, Gauge, PackageCheck, Pencil, RefreshCw, Search, Warehouse } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { FormDialog } from '../../components/ui/FormDialog'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { describeApiError } from '../../lib/api'
import { adjustStock, listStock } from '../../lib/inventoryApi'
import {
  DEFAULT_PRODUCTION_CAPACITY_PER_HOUR,
  getProductionCapacityPerHour,
  listParts,
  updateProductionCapacityPerHour,
  type ProductionPartRecord,
  type StockPolicyRecord,
} from '../../lib/masterApi'
import { formatNumber } from '../../lib/utils'

interface InventoryStockRow extends StockPolicyRecord {
  line: string
  partType: string
  total: number
}

export function LocationsPage() {
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const [stocks, setStocks] = useState<StockPolicyRecord[]>([])
  const [parts, setParts] = useState<ProductionPartRecord[]>([])
  const [pcsPerHour, setPcsPerHour] = useState(String(DEFAULT_PRODUCTION_CAPACITY_PER_HOUR))
  const [search, setSearch] = useState('')
  const [lineFilter, setLineFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<StockPolicyRecord | null>(null)
  const [newStore, setNewStore] = useState('')
  const [reason, setReason] = useState('Koreksi stok manual')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextStocks, nextParts, capacity] = await Promise.all([
        listStock(),
        listParts(),
        getProductionCapacityPerHour(),
      ])
      setStocks(nextStocks)
      setParts(nextParts)
      setPcsPerHour(String(capacity))
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data stok gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const inventoryRows = useMemo<InventoryStockRow[]>(() => {
    const partByNumber = new Map(parts.map((part) => [part.partNumber, part]))
    return stocks.map((stock) => {
      const part = partByNumber.get(stock.partNumber)
      return {
        ...stock,
        line: part?.line ?? '—',
        partType: part?.type?.replace('_', ' ') ?? stock.category,
        total: stock.store + stock.buffer,
      }
    })
  }, [parts, stocks])
  const lines = useMemo(
    () => [...new Set(inventoryRows.map((stock) => stock.line))].sort((a, b) => a.localeCompare(b)),
    [inventoryRows],
  )
  const partTypes = useMemo(
    () => [...new Set(inventoryRows.map((stock) => stock.partType))].sort((a, b) => a.localeCompare(b)),
    [inventoryRows],
  )
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return inventoryRows.filter((stock) =>
      (lineFilter === 'all' || stock.line === lineFilter) &&
      (typeFilter === 'all' || stock.partType === typeFilter) &&
      (!needle ||
        `${stock.partNumber} ${stock.description} ${stock.line} ${stock.partType}`
          .toLowerCase()
          .includes(needle)),
    )
  }, [inventoryRows, lineFilter, search, typeFilter])

  const totalStock = stocks.reduce((total, stock) => total + stock.store + stock.buffer, 0)
  const activeItems = stocks.filter((stock) => stock.store + stock.buffer > 0).length
  const capacity = Number(pcsPerHour)
  const validCapacity = Number.isInteger(capacity) && capacity > 0 ? capacity : null

  const saveCapacity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!Number.isInteger(capacity) || capacity <= 0) {
      setError('Kemampuan produksi per jam harus berupa bilangan bulat lebih dari 0.')
      return
    }
    if (!(await confirm({
      title: 'Ubah kemampuan produksi per jam?',
      message: `Nilai baru ${formatNumber(capacity)} pcs/jam akan dipakai untuk menghitung safety stock semua part.`,
      confirmLabel: 'Simpan nilai',
    }))) return

    setSaving(true)
    setError('')
    setNotice('')
    try {
      await updateProductionCapacityPerHour(capacity)
      setPcsPerHour(String(capacity))
      setNotice(`Kemampuan produksi per jam disimpan: ${formatNumber(capacity)} pcs/jam.`)
    } catch (saveError) {
      setError(describeApiError(saveError, 'Pengaturan kemampuan produksi gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (stock: StockPolicyRecord) => {
    setEditing(stock)
    setNewStore(String(stock.store))
    setReason('Koreksi stok manual')
    setError('')
    setNotice('')
  }

  const saveStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return
    const nextStore = Number(newStore)
    if (!Number.isInteger(nextStore) || nextStore < 0) {
      setError('Stok harus berupa bilangan bulat 0 atau lebih.')
      return
    }
    if (nextStore === editing.store) {
      setError('Tidak ada perubahan stok.')
      return
    }
    if (!reason.trim()) {
      setError('Alasan perubahan stok wajib diisi.')
      return
    }
    const delta = nextStore - editing.store
    if (!(await confirm({
      title: 'Simpan perubahan stok?',
      message: `Ubah stok ${editing.partNumber} dari ${formatNumber(editing.store)} pcs menjadi ${formatNumber(nextStore)} pcs (${delta > 0 ? '+' : ''}${formatNumber(delta)} pcs). Perubahan tercatat di Mutasi Stok.`,
      confirmLabel: 'Simpan stok',
    }))) return

    setSaving(true)
    setError('')
    setNotice('')
    try {
      await adjustStock({
        partNumber: editing.partNumber,
        newStore: nextStore,
        reason: reason.trim(),
        location: editing.location,
      })
      setNotice(`Stok ${editing.partNumber} disimpan: ${formatNumber(nextStore)} pcs.`)
      setEditing(null)
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Stok gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<InventoryStockRow>[] = [
    {
      key: 'part',
      header: 'Part Number',
      render: (stock) => (
        <div className="cell-stack">
          <strong className="cell-main mono">{stock.partNumber}</strong>
          <span className="cell-sub">{stock.description}</span>
        </div>
      ),
    },
    { key: 'partType', header: 'Jenis', render: (stock) => <Badge tone={stock.partType === 'Assy' ? 'sky' : 'orange'}>{stock.partType}</Badge> },
    { key: 'line', header: 'Line', render: (stock) => stock.line },
    { key: 'store', header: 'Store', align: 'right', render: (stock) => `${formatNumber(stock.store)} pcs` },
    { key: 'buffer', header: 'Buffer', align: 'right', render: (stock) => `${formatNumber(stock.buffer)} pcs` },
    {
      key: 'total',
      header: 'Total Stok',
      align: 'right',
      render: (stock) => <strong>{formatNumber(stock.total)} pcs</strong>,
    },
    {
      key: 'packages',
      header: 'Pallet / Box',
      render: (stock) => {
        const packages = Math.floor(stock.total / stock.packaging)
        const remainder = stock.total % stock.packaging
        return (
          <span>
            {formatNumber(packages)} box{remainder > 0 ? ` + ${formatNumber(remainder)} pcs` : ''}
            <span className="cell-sub"> · isi {formatNumber(stock.packaging)} pcs</span>
          </span>
        )
      },
    },
    {
      key: 'safetyHours',
      header: 'Safety Stock',
      align: 'right',
      render: (stock) => validCapacity
        ? `${(stock.total / validCapacity).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} jam`
        : '—',
    },
    { key: 'location', header: 'Lokasi', render: (stock) => stock.location },
    { key: 'status', header: 'Status', render: (stock) => <StatusBadge status={stock.status} /> },
    {
      key: 'action',
      header: 'Aksi',
      render: (stock) => (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Pencil size={14} />}
          onClick={() => startEdit(stock)}
        >
          Edit stok
        </Button>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Inventory Location"
        subtitle="Pantau stok setiap part number dalam pcs, box, dan estimasi safety stock berdasarkan kemampuan produksi per jam."
        meta={<span className="page-meta__item"><Warehouse size={12} /> {stocks.length} part number</span>}
        actions={
          <Button variant="secondary" leftIcon={<RefreshCw size={15} />} loading={loading} onClick={() => void loadData()}>
            Muat ulang
          </Button>
        }
      />

      {error && !editing && <Callout tone="danger" title="Aksi gagal">{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}

      <div className="kpi-grid">
        <StatCard label="Part number" value={String(stocks.length)} suffix="item" icon={PackageCheck} tone="orange" note="Data stok terdaftar" />
        <StatCard label="Total stok" value={formatNumber(totalStock)} suffix="pcs" icon={Boxes} tone="sky" note="Store + buffer" />
        <StatCard label="Stok tersedia" value={String(activeItems)} suffix="item" icon={Warehouse} tone="green" note="Stok lebih dari 0 pcs" />
        <StatCard label="Kemampuan produksi" value={validCapacity ? formatNumber(validCapacity) : '—'} suffix="pcs/jam" icon={Gauge} tone="amber" note="Dasar hitung safety stock" />
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Kemampuan produksi per jam</h2>
            <p className="section-sub">Satu nilai global untuk menghitung jam safety stock: total stok pcs ÷ pcs/jam.</p>
          </div>
          <Badge tone="sky">Default {DEFAULT_PRODUCTION_CAPACITY_PER_HOUR} pcs/jam</Badge>
        </div>
        <form className="form-grid" onSubmit={(event) => void saveCapacity(event)}>
          <Field label="Kemampuan produksi (pcs/jam)" htmlFor="capacity-per-hour">
            <input
              id="capacity-per-hour"
              className="input"
              type="number"
              min="1"
              step="1"
              value={pcsPerHour}
              onChange={(event) => setPcsPerHour(event.target.value)}
              disabled={user?.role !== 'admin'}
              required
            />
          </Field>
          {user?.role === 'admin' && (
            <div className="form-actions" style={{ alignSelf: 'end' }}>
              <Button type="submit" variant="primary" loading={saving}>Simpan kemampuan</Button>
            </div>
          )}
        </form>
      </section>

      <FormDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        titleId="edit-stock-form-title"
        title={`Edit stok · ${editing?.partNumber ?? ''}`}
        subtitle={editing ? `${editing.description} · Store saat ini ${formatNumber(editing.store)} pcs` : undefined}
        badge={editing ? <Badge tone="sky">{editing.category}</Badge> : undefined}
      >
        {error && <Callout tone="danger" title="Aksi gagal">{error}</Callout>}
        <form className="form-grid" onSubmit={(event) => void saveStock(event)}>
          <Field label="Store baru (pcs)" htmlFor="edit-store">
            <input
              id="edit-store"
              className="input"
              type="number"
              min="0"
              step="1"
              value={newStore}
              onChange={(event) => setNewStore(event.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field label="Alasan perubahan" htmlFor="edit-reason">
            <input
              id="edit-reason"
              className="input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          </Field>
          <div className="form-actions" style={{ alignSelf: 'end' }}>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Batal</Button>
            <Button type="submit" variant="primary" loading={saving}>Simpan stok</Button>
          </div>
        </form>
      </FormDialog>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Stok per part number</h2>
            <p className="section-sub">Safety stock dalam jam dihitung dari total Store + Buffer.</p>
          </div>
          <div className="inventory-location-filters">
            <select
              className="select"
              value={lineFilter}
              onChange={(event) => setLineFilter(event.target.value)}
              aria-label="Filter line"
            >
              <option value="all">Semua line</option>
              {lines.map((line) => <option key={line} value={line}>{line}</option>)}
            </select>
            <select
              className="select"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Filter jenis part"
            >
              <option value="all">Semua jenis</option>
              {partTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <div className="input-wrap">
              <Search size={15} className="input-wrap__icon" />
              <input
                className="input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari PN"
              />
            </div>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(stock) => stock.id}
          minWidth={1160}
          emptyMessage={loading ? 'Memuat data stok…' : 'Belum ada data stok yang sesuai.'}
        />
      </section>
    </div>
  )
}
