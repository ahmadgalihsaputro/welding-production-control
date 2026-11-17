import { Boxes, Layers3, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { useConfirmation } from '../../contexts/ConfirmationContext'
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
  if (row.source === 'production') return row.type?.replace('_', ' ') ?? 'Komponen'
  if (row.category === 'Bolt' || row.category === 'Nut' || row.category === 'Bolt/Nut') {
    return 'Bolt & Nut'
  }
  return row.category ?? 'Komponen'
}

function sourceTone(row: BomComponentRecord): Tone {
  if (row.source === 'production') {
    if (row.type === 'Sub_Assy') return 'sky'
    if (row.type === 'Press_Part') return 'orange'
    if (row.type === 'Child_Part') return 'success'
    if (row.type === 'Bolt' || row.type === 'Nut') return 'warning'
  }
  switch (row.category) {
    case 'Press Part':
      return 'orange'
    case 'Bolt':
    case 'Nut':
    case 'Bolt/Nut':
      return 'warning'
    case 'Child Part':
      return 'success'
    default:
      return 'neutral'
  }
}

function groupLabel(row: BomComponentRecord): string {
  return sourceLabel(row)
}

export function BomPage() {
  const { confirm } = useConfirmation()
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
  const [componentSearch, setComponentSearch] = useState('')
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
    () => parts.filter((part) => part.type === 'Assy').sort((a, b) => a.partNumber.localeCompare(b.partNumber)),
    [parts],
  )
  const subAssyParts = useMemo(
    () => parts.filter((part) => part.type !== 'Assy'),
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
          label: `${part.partNumber} · ${part.type.replace('_', ' ')}`,
          disabled: part.status === 'inactive',
        })),
        ...stockOnlyItems.map((item) => ({
          value: item.partNumber,
          label: `${item.partNumber} · ${item.category}`,
          disabled: false,
        })),
      ].sort((left, right) => left.value.localeCompare(right.value)),
    [subAssyParts, stockOnlyItems],
  )
  const filteredComponentOptions = useMemo(() => {
    const needle = componentSearch.trim().toLowerCase()
    if (!needle) return componentOptions
    return componentOptions.filter((option) => option.label.toLowerCase().includes(needle))
  }, [componentOptions, componentSearch])

  useEffect(() => {
    if (parentPartNumber && !assyParts.some((part) => part.partNumber === parentPartNumber)) {
      setParentPartNumber('')
    }
  }, [assyParts, parentPartNumber])

  useEffect(() => {
    if (componentOptions.length === 0) {
      setComponentPartNumber('')
      return
    }
    setComponentPartNumber((current) =>
      componentOptions.some((option) => option.value === current) ? current : '',
    )
  }, [componentOptions])
  const selectedComponentOption = componentOptions.find((option) => option.value === componentPartNumber)
  const showComponentOptions = componentSearch.trim().length > 0 &&
    (!selectedComponentOption || componentSearch.trim() !== selectedComponentOption.label)

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
  const compositionGroups = useMemo(() => {
    const grouped = new Map<string, BomComponentRecord[]>()
    visibleComponents.forEach((row) => {
      const group = groupLabel(row)
      grouped.set(group, [...(grouped.get(group) ?? []), row])
    })
    const preferredOrder = ['Sub Assy', 'Press Part', 'Child Part', 'Bolt & Nut']
    return [...grouped.entries()].sort(([left], [right]) => {
      const leftIndex = preferredOrder.indexOf(left)
      const rightIndex = preferredOrder.indexOf(right)
      if (leftIndex < 0 && rightIndex < 0) return left.localeCompare(right)
      if (leftIndex < 0) return 1
      if (rightIndex < 0) return -1
      return leftIndex - rightIndex
    })
  }, [visibleComponents])

  const planQty = Math.max(0, Number(assyPlanQty) || 0)
  const configuredParentCount = new Set(bomRows.map((row) => row.parentPartNumber)).size
  const selectedParent = assyParts.find((part) => part.partNumber === parentPartNumber)
  const refreshBom = async () => setBomRows(await listBom())

  const selectParent = (partNumber: string) => {
    setParentPartNumber(partNumber)
    setEditing(null)
    setSearch('')
    setComponentSearch('')
    setError('')
    setNotice('')
  }

  const addOrUpdateComponent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!parentPartNumber) {
      setError('Pilih part Assy untuk melihat atau mengubah komposisinya.')
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

    const existing = components.find((row) => row.componentPartNumber === componentPartNumber)
    const confirmed = await confirm({
      title: existing ? 'Konfirmasi perubahan BOM' : 'Konfirmasi tambah komponen',
      message: `${existing ? 'Perbarui' : 'Tambahkan'} ${componentPartNumber} sebanyak ${qty} pcs untuk 1 Assy ${parentPartNumber}?`,
      confirmLabel: existing ? 'Simpan perubahan' : 'Tambah komponen',
    })
    if (!confirmed) return

    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (existing) {
        await updateBomComponent(parentPartNumber, componentPartNumber, qty)
        setNotice(`Qty ${componentPartNumber} diperbarui menjadi ${qty} pcs per 1 Assy.`)
      } else {
        await addBomComponent(parentPartNumber, { partNumber: componentPartNumber, quantityPerAssy: qty })
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
    const confirmed = await confirm({
      title: 'Konfirmasi perubahan qty',
      message: `Ubah kebutuhan ${row.componentPartNumber} menjadi ${qty} pcs per 1 Assy ${row.parentPartNumber}?`,
      confirmLabel: 'Simpan perubahan',
    })
    if (!confirmed) return

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
    const confirmed = await confirm({
      title: 'Konfirmasi hapus komponen',
      message: `Hapus ${row.componentPartNumber} dari BOM ${row.parentPartNumber}?`,
      confirmLabel: 'Hapus komponen',
      tone: 'danger',
    })
    if (!confirmed) return
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

  const parentColumns: Column<ProductionPartRecord>[] = [
    {
      key: 'part',
      header: 'Part Assy',
      render: (part) => (
        <div className="cell-stack">
          <span className="cell-main mono">{part.partNumber}</span>
          <span className="cell-sub">{part.models.join(', ') || 'Model belum diatur'}</span>
        </div>
      ),
    },
    { key: 'line', header: 'Line', render: (part) => <Badge tone="neutral">{part.line}</Badge> },
    {
      key: 'components',
      header: 'Komposisi',
      render: (part) => {
        const count = bomRows.filter((row) => row.parentPartNumber === part.partNumber).length
        return <Badge tone={count ? 'success' : 'warning'}>{count ? `${count} komponen` : 'Belum diatur'}</Badge>
      },
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (part) => (
        <Button size="sm" variant={parentPartNumber === part.partNumber ? 'primary' : 'secondary'} onClick={() => selectParent(part.partNumber)}>
          {parentPartNumber === part.partNumber ? 'Dipilih' : 'Lihat komposisi'}
        </Button>
      ),
    },
  ]

  const componentColumns: Column<BomComponentRecord>[] = [
    {
      key: 'component',
      header: 'Part komponen',
      render: (row) => (
        <div className="cell-stack">
          <span className="cell-main mono">{row.componentPartNumber}</span>
          <span className="cell-sub">{row.description ?? row.process ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'quantity',
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
              onChange={(event) => setEditing((current) => current ? { ...current, value: event.target.value } : current)}
              aria-label={`Qty ${row.componentPartNumber}`}
            />
            <Button size="sm" variant="primary" loading={busyKey === row.componentPartNumber} onClick={() => void saveQuantity(row)}>Simpan</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Batal</Button>
          </div>
        ) : <span className="mono strong">{formatNumber(row.quantityPerAssy)} pcs</span>,
    },
    {
      key: 'planned',
      header: `Kebutuhan ${formatNumber(planQty)} Assy`,
      align: 'right',
      render: (row) => <span className="mono">{formatNumber(row.quantityPerAssy * planQty)} pcs</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" disabled={busyKey === row.componentPartNumber} onClick={() => setEditing({ componentPartNumber: row.componentPartNumber, value: String(row.quantityPerAssy) })}>Ubah qty</Button>
          <Button size="sm" variant="ghost" disabled={busyKey === row.componentPartNumber} onClick={() => void removeComponent(row)}><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="BOM"
        subtitle="Pilih part Assy untuk melihat komposisi Sub Assy, Press Part, Child Part, dan Bolt & Nut yang digunakan."
        meta={
          <>
            <span className="page-meta__item"><Boxes size={12} /> {assyParts.length} part Assy</span>
            <span className="page-meta__item"><Layers3 size={12} /> {formatNumber(bomRows.length)} komponen</span>
          </>
        }
        actions={<Button variant="secondary" leftIcon={<RefreshCw size={15} />} loading={loading} onClick={() => void loadData()}>Muat ulang</Button>}
      />

      {error && <Callout tone="danger" title="Aksi gagal">{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && parts.length === 0 && <Callout tone="info">Memuat daftar BOM…</Callout>}

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Daftar part Assy</h2>
            <p className="section-sub">Klik salah satu part Assy untuk membuka komposisinya.</p>
          </div>
          <Badge tone="neutral">{configuredParentCount} dari {assyParts.length} sudah memiliki BOM</Badge>
        </div>
        <DataTable
          columns={parentColumns}
          rows={assyParts}
          rowKey={(part) => part.partNumber}
          minWidth={720}
          emptyMessage="Belum ada part bertipe Assy."
        />
      </section>

      {selectedParent ? (
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Komposisi {selectedParent.partNumber}</h2>
              <p className="section-sub">{selectedParent.line} · {selectedParent.models.join(', ') || 'Model belum diatur'}</p>
            </div>
            <Badge tone={components.length ? 'success' : 'warning'}>{components.length} komponen</Badge>
          </div>

          {selectedParent.status === 'inactive' && <Callout tone="warning">Part Assy ini sedang nonaktif.</Callout>}

          <div className="form-grid">
            <Field label="Qty Assy yang direncanakan" htmlFor="assy-plan-qty" hint="Dipakai untuk menghitung total kebutuhan komponen.">
              <input id="assy-plan-qty" className="input" type="number" min="0" step="1" value={assyPlanQty} onChange={(event) => setAssyPlanQty(event.target.value)} />
            </Field>
          </div>

          <form className="form-grid bom-add-form" onSubmit={(event) => void addOrUpdateComponent(event)}>
            <Field label="Part komponen" htmlFor="bom-component-search" hint="Cari PN atau jenis, lalu pilih hasilnya.">
              <SearchInput
                id="bom-component-search"
                value={componentSearch}
                onChange={(value) => {
                  setComponentSearch(value)
                  setComponentPartNumber('')
                }}
                placeholder="Cari PN, Sub Assy, Press Part, Bolt, Nut…"
                className="search-inline"
              />
              {showComponentOptions && (
                <div className="bom-component-search__results">
                  {filteredComponentOptions.slice(0, 8).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="bom-component-search__option"
                      disabled={option.disabled}
                      onClick={() => {
                        setComponentPartNumber(option.value)
                        setComponentSearch(option.label)
                      }}
                    >
                      <span className="mono">{option.value}</span>
                      <span>{option.label.split(' · ')[1]}{option.disabled ? ' · inactive' : ''}</span>
                    </button>
                  ))}
                  {filteredComponentOptions.length === 0 && (
                    <span className="bom-component-search__empty">Tidak ada part yang cocok.</span>
                  )}
                  {filteredComponentOptions.length > 8 && (
                    <span className="bom-component-search__empty">
                      Tulis pencarian lebih spesifik untuk melihat {filteredComponentOptions.length - 8} hasil lainnya.
                    </span>
                  )}
                </div>
              )}
              {selectedComponentOption && (
                <div className="bom-component-search__selected">
                  <Badge tone="sky">{selectedComponentOption.label}</Badge>
                </div>
              )}
            </Field>
            <Field label="Qty untuk 1 Assy" htmlFor="bom-quantity" hint="Bilangan bulat minimal 1.">
              <input id="bom-quantity" className="input" type="number" min="1" step="1" value={quantityPerAssy} placeholder="Isi qty aktual" onChange={(event) => setQuantityPerAssy(event.target.value)} required />
            </Field>
            <div className="form-actions bom-add-form__actions">
              <Button type="submit" variant="primary" leftIcon={<Plus size={15} />} loading={saving} disabled={componentOptions.length === 0}>Tambah / perbarui komponen</Button>
            </div>
          </form>

          <div className="table-toolbar" style={{ marginTop: 18 }}>
            <div className="toolbar-group"><Badge tone="neutral">{components.length} komponen</Badge></div>
            <SearchInput value={search} onChange={setSearch} placeholder="Cari part atau kategori…" className="search-inline" />
          </div>

          {compositionGroups.length > 0 ? (
            <div style={{ display: 'grid', gap: 16 }}>
              {compositionGroups.map(([group, rows]) => (
                <section key={group}>
                  <div className="section-head" style={{ marginBottom: 8 }}>
                    <h3 className="section-title">{group}</h3>
                    <Badge tone={sourceTone(rows[0])}>{rows.length} part</Badge>
                  </div>
                  <DataTable columns={componentColumns} rows={rows} rowKey={(row) => row.componentPartNumber} minWidth={780} />
                </section>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon"><Boxes size={22} /></div>
              <strong>{components.length === 0 ? 'Belum ada komposisi untuk part Assy ini' : 'Tidak ada komponen yang cocok dengan pencarian'}</strong>
              <p>Hanya komponen yang benar-benar digunakan perlu ditambahkan ke BOM.</p>
            </div>
          )}
        </section>
      ) : (
        <div className="empty-state">
          <div className="empty-state__icon"><Boxes size={22} /></div>
          <strong>Pilih part Assy</strong>
          <p>Komposisi BOM akan tampil setelah Anda memilih part Assy di daftar.</p>
        </div>
      )}
    </div>
  )
}
