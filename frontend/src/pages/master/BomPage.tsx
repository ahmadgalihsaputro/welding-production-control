import { Boxes, Layers3, PackageSearch, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { describeApiError } from '../../lib/api'
import {
  addBomComponent,
  deleteBomComponent,
  listBom,
  listParts,
  listStockPolicy,
  updateBomComponent,
  type BomComponentRecord,
  type ProductionPartRecord,
  type StockPolicyRecord,
} from '../../lib/masterApi'
import { formatNumber } from '../../lib/utils'
import type { Tone } from '../../types'

interface EditingQty {
  componentPartNumber: string
  value: string
}

function sourceLabel(row: BomComponentRecord): string {
  if (row.source === 'production') {
    return row.type === 'Sub_Assy' ? 'Sub Assy' : 'Part produksi'
  }
  return row.category ?? 'Stock item'
}

function sourceTone(row: BomComponentRecord): Tone {
  if (row.source === 'production') return 'sky'
  switch (row.category) {
    case 'Press Part':
      return 'orange'
    case 'Bolt/Nut':
      return 'warning'
    case 'Child Part':
      return 'success'
    default:
      return 'neutral'
  }
}

export function BomPage() {
  const [parts, setParts] = useState<ProductionPartRecord[]>([])
  const [stockItems, setStockItems] = useState<StockPolicyRecord[]>([])
  const [bomRows, setBomRows] = useState<BomComponentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [parentPartNumber, setParentPartNumber] = useState('')
  const [componentPartNumber, setComponentPartNumber] = useState('')
  const [quantityPerAssy, setQuantityPerAssy] = useState('')
  const [assyPlanQty, setAssyPlanQty] = useState('1')
  const [editing, setEditing] = useState<EditingQty | null>(null)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextParts, nextStock, nextBom] = await Promise.all([
        listParts(),
        listStockPolicy(),
        listBom(),
      ])
      setParts(nextParts)
      setStockItems(nextStock)
      setBomRows(nextBom)
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data BOM gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const assyParts = useMemo(
    () => parts.filter((part) => part.type === 'Assy'),
    [parts],
  )
  const subAssyParts = useMemo(
    () => parts.filter((part) => part.type === 'Sub_Assy'),
    [parts],
  )
  const productionPartNumbers = useMemo(
    () => new Set(parts.map((part) => part.partNumber)),
    [parts],
  )
  const stockOnlyItems = useMemo(
    () => stockItems.filter((item) => !productionPartNumbers.has(item.partNumber)),
    [stockItems, productionPartNumbers],
  )

  const componentOptions = useMemo(
    () =>
      [
        ...subAssyParts.map((part) => ({
          value: part.partNumber,
          label: `${part.partNumber} · Sub Assy · ${part.line} · ${part.process}`,
          disabled: part.status === 'inactive',
        })),
        ...stockOnlyItems.map((item) => ({
          value: item.partNumber,
          label: `${item.partNumber} · ${item.category} · ${item.description}`,
          disabled: false,
        })),
      ].sort((left, right) => left.value.localeCompare(right.value)),
    [subAssyParts, stockOnlyItems],
  )

  useEffect(() => {
    if (assyParts.length === 0) {
      setParentPartNumber('')
      return
    }
    setParentPartNumber((current) =>
      assyParts.some((part) => part.partNumber === current)
        ? current
        : (assyParts.find((part) => part.status === 'active') ?? assyParts[0]).partNumber,
    )
  }, [assyParts])

  useEffect(() => {
    if (componentOptions.length === 0) {
      setComponentPartNumber('')
      return
    }
    setComponentPartNumber((current) =>
      componentOptions.some((option) => option.value === current)
        ? current
        : (componentOptions.find((option) => !option.disabled) ?? componentOptions[0]).value,
    )
  }, [componentOptions])

  const components = useMemo(
    () =>
      bomRows
        .filter((row) => row.parentPartNumber === parentPartNumber)
        .sort((left, right) => left.componentPartNumber.localeCompare(right.componentPartNumber)),
    [bomRows, parentPartNumber],
  )

  const visibleComponents = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return components
    return components.filter(
      (row) =>
        row.componentPartNumber.toLowerCase().includes(needle) ||
        (row.description ?? '').toLowerCase().includes(needle) ||
        (row.category ?? '').toLowerCase().includes(needle),
    )
  }, [components, search])

  const planQty = Math.max(0, Number(assyPlanQty) || 0)
  const configuredParentCount = new Set(bomRows.map((row) => row.parentPartNumber)).size
  const productionComponentCount = bomRows.filter((row) => row.source === 'production').length
  const stockComponentCount = bomRows.filter((row) => row.source === 'stock').length

  const refreshBom = async () => {
    setBomRows(await listBom())
  }

  const addOrUpdateComponent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!parentPartNumber) {
      setError('Pilih parent Assy terlebih dahulu.')
      return
    }
    if (!componentPartNumber) {
      setError('Pilih komponen yang akan ditambahkan.')
      return
    }
    const qty = Number(quantityPerAssy)
    if (!Number.isInteger(qty) || qty < 1) {
      setError('Qty per 1 Assy harus bilangan bulat minimal 1.')
      return
    }

    const existing = components.find(
      (row) => row.componentPartNumber === componentPartNumber,
    )
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (existing) {
        await updateBomComponent(parentPartNumber, componentPartNumber, qty)
        setNotice(`Qty ${componentPartNumber} diperbarui menjadi ${qty} pcs per 1 Assy.`)
      } else {
        await addBomComponent(parentPartNumber, {
          partNumber: componentPartNumber,
          quantityPerAssy: qty,
        })
        setNotice(`${componentPartNumber} ditambahkan ke BOM ${parentPartNumber}.`)
      }
      setQuantityPerAssy('')
      await refreshBom()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Komponen BOM gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const saveQuantity = async (row: BomComponentRecord) => {
    const qty = Number(editing?.value)
    if (!Number.isInteger(qty) || qty < 1) {
      setError('Qty per 1 Assy harus bilangan bulat minimal 1.')
      return
    }
    setBusyKey(row.componentPartNumber)
    setError('')
    setNotice('')
    try {
      await updateBomComponent(row.parentPartNumber, row.componentPartNumber, qty)
      setNotice(`Qty ${row.componentPartNumber} diperbarui menjadi ${qty} pcs per 1 Assy.`)
      setEditing(null)
      await refreshBom()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Qty komponen gagal diperbarui.'))
    } finally {
      setBusyKey(null)
    }
  }

  const removeComponent = async (row: BomComponentRecord) => {
    if (
      !window.confirm(
        `Hapus ${row.componentPartNumber} dari BOM ${row.parentPartNumber}? Master part/stock tidak ikut terhapus.`,
      )
    ) {
      return
    }
    setBusyKey(row.componentPartNumber)
    setError('')
    setNotice('')
    try {
      await deleteBomComponent(row.parentPartNumber, row.componentPartNumber)
      setNotice(`${row.componentPartNumber} dihapus dari BOM ${row.parentPartNumber}.`)
      if (editing?.componentPartNumber === row.componentPartNumber) setEditing(null)
      await refreshBom()
    } catch (deleteError) {
      setError(describeApiError(deleteError, 'Komponen BOM gagal dihapus.'))
    } finally {
      setBusyKey(null)
    }
  }

  const columns: Column<BomComponentRecord>[] = [
    {
      key: 'component',
      header: 'Komponen',
      render: (row) => (
        <div className="cell-stack">
          <span className="cell-main mono">{row.componentPartNumber}</span>
          <span className="cell-sub">
            {row.source === 'production'
              ? `${row.line ?? '—'} · ${row.process ?? '—'}`
              : (row.description ?? '—')}
          </span>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Sumber',
      render: (row) => <Badge tone={sourceTone(row)}>{sourceLabel(row)}</Badge>,
    },
    {
      key: 'qty',
      header: 'Qty / 1 Assy',
      align: 'right',
      render: (row) =>
        editing?.componentPartNumber === row.componentPartNumber ? (
          <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
            <input
              className="input mono"
              style={{ width: 84, height: 34, minHeight: 34 }}
              type="number"
              min="1"
              step="1"
              value={editing.value}
              onChange={(event) =>
                setEditing((current) =>
                  current ? { ...current, value: event.target.value } : current,
                )
              }
              aria-label={`Qty ${row.componentPartNumber}`}
            />
            <Button
              size="sm"
              variant="primary"
              loading={busyKey === row.componentPartNumber}
              onClick={() => void saveQuantity(row)}
            >
              Simpan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Batal
            </Button>
          </div>
        ) : (
          <span className="mono strong">{formatNumber(row.quantityPerAssy)} pcs</span>
        ),
    },
    {
      key: 'required',
      header: `Kebutuhan ${formatNumber(planQty)} Assy`,
      align: 'right',
      render: (row) => (
        <span className="mono">{formatNumber(row.quantityPerAssy * planQty)} pcs</span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="table-actions">
          <Button
            size="sm"
            variant="ghost"
            disabled={busyKey === row.componentPartNumber}
            onClick={() =>
              setEditing({
                componentPartNumber: row.componentPartNumber,
                value: String(row.quantityPerAssy),
              })
            }
          >
            Ubah qty
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyKey === row.componentPartNumber}
            onClick={() => void removeComponent(row)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ]

  const selectedParent = assyParts.find((part) => part.partNumber === parentPartNumber)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data · Robot G & H"
        title="Bill of Material Assy → Sub Assy & Komponen"
        subtitle="Satu relasi menyatakan qty komponen yang dibutuhkan untuk membuat satu Assy. Komponen boleh berupa Part Number produksi (Sub Assy) atau Stock Item (Press Part, Bolt/Nut, Child Part)."
        meta={
          <>
            <span className="page-meta__item">
              <Boxes size={12} /> {formatNumber(bomRows.length)} relasi BOM
            </span>
            <span className="page-meta__item">
              <Layers3 size={12} /> {configuredParentCount} Assy terkonfigurasi
            </span>
          </>
        }
        actions={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw size={15} />}
            loading={loading}
            onClick={() => void loadData()}
          >
            Muat ulang
          </Button>
        }
      />

      {error && (
        <Callout tone="danger" title="Aksi gagal">
          {error}
        </Callout>
      )}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && bomRows.length === 0 && (
        <Callout tone="info">Memuat BOM dari server…</Callout>
      )}

      <Callout tone="warning" title="Data aktual, bukan angka contoh">
        BOM disimpan per baris ke database. Tanpa BOM yang tersimpan, alokasi Assy ditahan agar
        kebutuhan Sub Assy tidak terlewat.
      </Callout>

      <div className="kpi-grid">
        <StatCard
          label="Assy dengan BOM"
          value={String(configuredParentCount)}
          suffix="PN"
          icon={Boxes}
          tone="orange"
          note={`Dari ${assyParts.length} PN Assy`}
        />
        <StatCard
          label="Relasi BOM"
          value={formatNumber(bomRows.length)}
          suffix="baris"
          icon={Layers3}
          tone="sky"
          note="Qty per 1 Assy"
        />
        <StatCard
          label="Komponen Sub Assy"
          value={formatNumber(productionComponentCount)}
          suffix="baris"
          icon={PackageSearch}
          tone="green"
          note="Part produksi"
        />
        <StatCard
          label="Komponen stock"
          value={formatNumber(stockComponentCount)}
          suffix="baris"
          icon={PackageSearch}
          tone="amber"
          note="Press part, bolt/nut, child part"
        />
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Master kebutuhan komponen</h2>
            <p className="section-sub">
              Pilih parent Assy, lalu tambahkan komponen dan qty per satu Assy.
            </p>
          </div>
          <Badge tone={components.length > 0 ? 'success' : 'warning'}>
            {components.length > 0
              ? `${components.length} komponen aktif`
              : 'BOM belum diatur'}
          </Badge>
        </div>

        <div className="form-grid">
          <Field label="Parent Assy" htmlFor="bom-parent">
            <select
              id="bom-parent"
              className="select"
              value={parentPartNumber}
              onChange={(event) => {
                setParentPartNumber(event.target.value)
                setEditing(null)
              }}
              disabled={assyParts.length === 0}
            >
              {assyParts.length === 0 && <option value="">Belum ada PN Assy</option>}
              {assyParts.map((part) => (
                <option key={part.partNumber} value={part.partNumber}>
                  {part.partNumber} · {part.line} · {part.process}
                  {part.status === 'inactive' ? ' · INACTIVE' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Qty Assy yang direncanakan"
            htmlFor="assy-plan-qty"
            hint="Dipakai untuk menghitung kolom kebutuhan."
          >
            <input
              id="assy-plan-qty"
              className="input"
              type="number"
              min="0"
              step="1"
              value={assyPlanQty}
              onChange={(event) => setAssyPlanQty(event.target.value)}
            />
          </Field>
        </div>

        {selectedParent?.status === 'inactive' && (
          <Callout tone="warning" style={{ marginTop: 12 }}>
            Parent {selectedParent.partNumber} sedang inactive. BOM tetap dapat dilihat, tetapi
            pastikan part diaktifkan sebelum dipakai produksi.
          </Callout>
        )}

        {assyParts.length === 0 && (
          <Callout tone="warning" style={{ marginTop: 12 }}>
            Belum ada Part Number bertipe Assy. Daftarkan dulu di Master Data → Part Number.
          </Callout>
        )}

        <form className="form-grid" onSubmit={(event) => void addOrUpdateComponent(event)} style={{ marginTop: 16 }}>
          <Field
            label="Komponen"
            htmlFor="bom-component"
            hint="Sub Assy atau Stock Item yang belum terdaftar sebagai part produksi."
          >
            <select
              id="bom-component"
              className="select"
              value={componentPartNumber}
              onChange={(event) => setComponentPartNumber(event.target.value)}
              disabled={componentOptions.length === 0}
            >
              {componentOptions.length === 0 && <option value="">Belum ada komponen</option>}
              {componentOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                  {option.disabled ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Qty untuk 1 Assy"
            htmlFor="bom-quantity"
            hint="Bilangan bulat minimal 1."
          >
            <input
              id="bom-quantity"
              className="input"
              type="number"
              min="1"
              step="1"
              value={quantityPerAssy}
              placeholder="Isi qty aktual"
              onChange={(event) => setQuantityPerAssy(event.target.value)}
              required
            />
          </Field>
          <div className="form-actions">
            <Button
              type="submit"
              variant="primary"
              leftIcon={<Plus size={15} />}
              loading={saving}
              disabled={!parentPartNumber || componentOptions.length === 0}
            >
              Tambah / perbarui komponen
            </Button>
          </div>
        </form>

        <Callout tone="info" style={{ marginTop: 12 }}>
          Jika komponen sudah ada di BOM parent ini, menyimpan akan memperbarui qty-nya. Semua
          perubahan langsung tersimpan ke database.
        </Callout>

        <div className="table-toolbar" style={{ marginTop: 18 }}>
          <div className="toolbar-group">
            <Badge tone="neutral">{components.length} baris</Badge>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari komponen, kategori, deskripsi…"
            className="search-inline"
          />
        </div>

        {visibleComponents.length > 0 ? (
          <DataTable
            columns={columns}
            rows={visibleComponents}
            rowKey={(row) => row.componentPartNumber}
            minWidth={880}
            footer={
              <span className="muted small">
                Menampilkan {visibleComponents.length} dari {components.length} komponen
              </span>
            }
          />
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon">
              <Boxes size={22} />
            </div>
            <strong>
              {components.length === 0
                ? `Belum ada data BOM untuk ${parentPartNumber || 'PN ini'}`
                : 'Tidak ada komponen yang cocok dengan pencarian'}
            </strong>
            <p>
              Tambahkan baris komponen berdasarkan BOM aktual; jumlah tidak diisi otomatis.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
