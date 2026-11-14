import { Boxes, PackageSearch, Plus, RefreshCw, Tag } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { describeApiError } from '../../lib/api'
import {
  createPart,
  deletePart,
  listModels,
  listParts,
  listStockPolicy,
  updatePart,
  type MasterStatus,
  type PartType,
  type ProductionModelRecord,
  type ProductionPartRecord,
  type StockPolicyRecord,
} from '../../lib/masterApi'
import { formatNumber } from '../../lib/utils'

interface PartFormState {
  editingPartNumber: string | null
  partNumber: string
  line: string
  type: PartType
  process: string
  models: string[]
  packaging: string
  maxStore: string
  status: MasterStatus
}

function emptyForm(): PartFormState {
  return {
    editingPartNumber: null,
    partNumber: '',
    line: 'Robot G',
    type: 'Assy',
    process: 'RB.G',
    models: [],
    packaging: '',
    maxStore: '',
    status: 'active',
  }
}

function typeLabel(type: PartType): string {
  return type === 'Sub_Assy' ? 'Sub Assy' : 'Assy'
}

function optionalInt(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return Number(trimmed)
}

export function PartsPage() {
  const [parts, setParts] = useState<ProductionPartRecord[]>([])
  const [models, setModels] = useState<ProductionModelRecord[]>([])
  const [stockItems, setStockItems] = useState<StockPolicyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyPartNumber, setBusyPartNumber] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PartFormState>(emptyForm)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [lineFilter, setLineFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextParts, nextModels, nextStock] = await Promise.all([
        listParts(),
        listModels(),
        listStockPolicy(),
      ])
      setParts(nextParts)
      setModels(nextModels)
      setStockItems(nextStock)
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data part gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const stockByPart = useMemo(
    () => new Map(stockItems.map((item) => [item.partNumber, item])),
    [stockItems],
  )

  const lineOptions = useMemo(
    () =>
      Array.from(new Set(['Robot G', 'Robot H', ...parts.map((part) => part.line)])).sort(),
    [parts],
  )

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return parts.filter((part) => {
      const stock = stockByPart.get(part.partNumber)
      return (
        (typeFilter === 'all' || part.type === typeFilter) &&
        (lineFilter === 'all' || part.line === lineFilter) &&
        (statusFilter === 'all' || part.status === statusFilter) &&
        (!needle ||
          part.partNumber.toLowerCase().includes(needle) ||
          part.process.toLowerCase().includes(needle) ||
          (stock?.description ?? '').toLowerCase().includes(needle))
      )
    })
  }, [parts, stockByPart, typeFilter, lineFilter, statusFilter, search])

  const openAddForm = () => {
    setForm(emptyForm())
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const openEditForm = (part: ProductionPartRecord) => {
    setForm({
      editingPartNumber: part.partNumber,
      partNumber: part.partNumber,
      line: part.line,
      type: part.type,
      process: part.process,
      models: part.models,
      packaging: part.packaging === null ? '' : String(part.packaging),
      maxStore: part.maxStore === null ? '' : String(part.maxStore),
      status: part.status,
    })
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const closeForm = () => {
    setShowForm(false)
    setForm(emptyForm())
  }

  const toggleModel = (code: string) => {
    setForm((current) => ({
      ...current,
      models: current.models.includes(code)
        ? current.models.filter((model) => model !== code)
        : [...current.models, code],
    }))
  }

  const savePart = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const partNumber = form.partNumber.trim().toUpperCase()
    const process = form.process.trim()
    const line = form.line.trim()
    if (!partNumber) {
      setError('Part number wajib diisi.')
      return
    }
    if (!line) {
      setError('Line wajib diisi.')
      return
    }
    if (!process) {
      setError('Process wajib diisi.')
      return
    }
    if (form.models.length === 0) {
      setError('Pilih minimal satu model untuk part ini.')
      return
    }

    const packaging = optionalInt(form.packaging)
    if (packaging !== null && (!Number.isInteger(packaging) || packaging <= 0)) {
      setError('Standard packaging harus bilangan bulat lebih besar dari 0.')
      return
    }
    const maxStore = optionalInt(form.maxStore)
    if (maxStore !== null && (!Number.isInteger(maxStore) || maxStore < 0)) {
      setError('Max store harus bilangan bulat 0 atau lebih.')
      return
    }

    const currentPart = form.editingPartNumber
      ? parts.find((part) => part.partNumber === form.editingPartNumber)
      : undefined
    if (
      currentPart &&
      (currentPart.line !== line || currentPart.process !== process) &&
      !window.confirm(
        `Ubah mapping ${partNumber} dari ${currentPart.line} · ${currentPart.process} ke ${line} · ${process}?\n\nPerubahan berlaku untuk transaksi baru. Request/antrean aktif harus diselesaikan lebih dahulu. Riwayat lama dan saldo stok tidak diubah.`,
      )
    ) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (form.editingPartNumber) {
        await updatePart(form.editingPartNumber, {
          line,
          type: form.type,
          process,
          models: form.models,
          packaging,
          maxStore,
          status: form.status,
        })
        setNotice(`Part ${form.editingPartNumber} berhasil diperbarui.`)
      } else {
        await createPart({
          partNumber,
          line,
          type: form.type,
          process,
          models: form.models,
          packaging,
          maxStore,
          status: form.status,
        })
        setNotice(`Part ${partNumber} berhasil ditambahkan.`)
      }
      setShowForm(false)
      setForm(emptyForm())
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Part gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (part: ProductionPartRecord) => {
    const nextStatus: MasterStatus = part.status === 'active' ? 'inactive' : 'active'
    if (
      nextStatus === 'inactive' &&
      !window.confirm(`Nonaktifkan part ${part.partNumber}? Data transaksi lama tetap tersimpan.`)
    ) {
      return
    }
    setBusyPartNumber(part.partNumber)
    setError('')
    setNotice('')
    try {
      await updatePart(part.partNumber, { status: nextStatus })
      setNotice(
        `Part ${part.partNumber} ${nextStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan'}.`,
      )
      await loadData()
    } catch (statusError) {
      setError(describeApiError(statusError, 'Status part gagal diubah.'))
    } finally {
      setBusyPartNumber(null)
    }
  }

  const removePart = async (part: ProductionPartRecord) => {
    if (
      !window.confirm(
        `Hapus part ${part.partNumber}? Part yang sudah memiliki transaksi produksi tidak dapat dihapus.`,
      )
    ) {
      return
    }
    setBusyPartNumber(part.partNumber)
    setError('')
    setNotice('')
    try {
      await deletePart(part.partNumber)
      setNotice(`Part ${part.partNumber} dihapus.`)
      await loadData()
    } catch (deleteError) {
      setError(describeApiError(deleteError, 'Part gagal dihapus.'))
    } finally {
      setBusyPartNumber(null)
    }
  }

  const columns: Column<ProductionPartRecord>[] = [
    {
      key: 'part',
      header: 'Part Number',
      render: (part) => {
        const stock = stockByPart.get(part.partNumber)
        return (
          <div className="cell-stack">
            <span className="cell-main mono">{part.partNumber}</span>
            <span className="cell-sub">
              {stock?.description ?? (part.placeholder ? 'Dummy / placeholder' : '—')}
            </span>
          </div>
        )
      },
    },
    {
      key: 'type',
      header: 'Tipe',
      render: (part) => (
        <Badge tone={part.type === 'Assy' ? 'sky' : 'orange'}>{typeLabel(part.type)}</Badge>
      ),
    },
    {
      key: 'line',
      header: 'Line / Proses',
      render: (part) => (
        <div className="cell-stack">
          <span className="cell-main">{part.line}</span>
          <span className="cell-sub">{part.process}</span>
        </div>
      ),
    },
    {
      key: 'models',
      header: 'Model',
      render: (part) => (
        <div className="row row--wrap" style={{ gap: 4 }}>
          {part.models.map((model) => (
            <Badge key={model} tone="sky">
              {model}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'packaging',
      header: 'Isi standar',
      align: 'right',
      render: (part) => {
        const stock = stockByPart.get(part.partNumber)
        const packaging = part.packaging ?? stock?.packaging
        return (
          <div className="cell-stack" style={{ alignItems: 'flex-end' }}>
            <span className="mono">{packaging ? `${formatNumber(packaging)} pcs/wadah` : '—'}</span>
            <span className="cell-sub">
              Max {part.maxStore !== null ? formatNumber(part.maxStore) : '—'}
            </span>
          </div>
        )
      },
    },
    { key: 'status', header: 'Status', render: (part) => <StatusBadge status={part.status} /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (part) => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" onClick={() => openEditForm(part)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={busyPartNumber === part.partNumber}
            onClick={() => void toggleStatus(part)}
          >
            {part.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyPartNumber === part.partNumber}
            onClick={() => void removePart(part)}
          >
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  const totalAssy = parts.filter((part) => part.type === 'Assy').length
  const totalSub = parts.filter((part) => part.type === 'Sub_Assy').length
  const totalActive = parts.filter((part) => part.status === 'active').length

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Part Number"
        subtitle="Mapping part produksi ke line, proses, dan model. Data tersimpan di database dan menjadi dasar routing serta transaksi produksi."
        meta={
          <>
            <span className="page-meta__item">
              <Tag size={12} /> {parts.length} part number
            </span>
            <span className="page-meta__item">
              <Boxes size={12} /> {models.length} model
            </span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<RefreshCw size={15} />}
              loading={loading}
              onClick={() => void loadData()}
            >
              Muat ulang
            </Button>
            <Button variant="primary" leftIcon={<Plus size={15} />} onClick={openAddForm}>
              Tambah part
            </Button>
          </>
        }
      />

      {error && (
        <Callout tone="danger" title="Aksi gagal">
          {error}
        </Callout>
      )}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && parts.length === 0 && (
        <Callout tone="info">Memuat part number dari server…</Callout>
      )}

      <div className="kpi-grid">
        <StatCard
          label="Total part"
          value={String(parts.length)}
          suffix="PN"
          icon={Tag}
          tone="orange"
          note="Part produksi"
        />
        <StatCard
          label="Part Assy"
          value={String(totalAssy)}
          suffix="PN"
          icon={PackageSearch}
          tone="sky"
          note="Line Assy"
        />
        <StatCard
          label="Part Sub Assy"
          value={String(totalSub)}
          suffix="PN"
          icon={PackageSearch}
          tone="green"
          note="Line Sub Assy"
        />
        <StatCard
          label="Part aktif"
          value={String(totalActive)}
          suffix="PN"
          icon={Boxes}
          tone="amber"
          note="Dapat dipakai transaksi"
        />
      </div>

      {showForm && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">
                {form.editingPartNumber ? 'Ubah mapping part' : 'Part baru'}
              </h2>
              <p className="section-sub">
                {form.editingPartNumber
                  ? 'Part number tetap; line, proses, model, isi standar wadah, dan status dapat diperbarui.'
                  : 'Part number dibuat sekali dan tidak dapat diubah setelah tersimpan.'}
              </p>
            </div>
            <Badge tone="success">Terhubung database</Badge>
          </div>

          {models.length === 0 && (
            <Callout tone="warning">
              Belum ada model terdaftar. Tambahkan model terlebih dahulu di Master Data → Model.
            </Callout>
          )}

          <form className="form-grid" onSubmit={(event) => void savePart(event)}>
            <Field
              label="Part Number"
              htmlFor="part-number"
              hint={form.editingPartNumber ? 'Part number tidak dapat diubah.' : 'Disimpan sebagai huruf besar.'}
            >
              <input
                id="part-number"
                className="input mono"
                value={form.partNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, partNumber: event.target.value }))
                }
                placeholder="Contoh: 5220AU50"
                disabled={Boolean(form.editingPartNumber)}
                required
              />
            </Field>
            <Field label="Tipe" htmlFor="part-type">
              <select
                id="part-type"
                className="select"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as PartType,
                  }))
                }
              >
                <option value="Assy">Assy</option>
                <option value="Sub_Assy">Sub Assy</option>
              </select>
            </Field>
            <Field
              label="Robot / line"
              htmlFor="part-line"
              hint="Pilih dari daftar atau ketik line baru."
            >
              <input
                id="part-line"
                className="input"
                list="part-line-options"
                value={form.line}
                onChange={(event) =>
                  setForm((current) => ({ ...current, line: event.target.value }))
                }
                placeholder="Robot G"
              />
              <datalist id="part-line-options">
                {lineOptions.map((lineOption) => (
                  <option key={lineOption} value={lineOption} />
                ))}
              </datalist>
            </Field>
            <Field label="Line proses" htmlFor="part-process" hint="Contoh: RB.G, RB.H, SS.H.">
              <input
                id="part-process"
                className="input"
                value={form.process}
                onChange={(event) =>
                  setForm((current) => ({ ...current, process: event.target.value }))
                }
                placeholder="RB.G"
                required
              />
            </Field>
            <Field
              label="Isi standar wadah"
              htmlFor="part-packaging"
              hint="Jumlah pcs per box/pallet (wadah). Kosongkan bila belum ditentukan."
            >
              <input
                id="part-packaging"
                className="input"
                type="number"
                min="1"
                step="1"
                value={form.packaging}
                onChange={(event) =>
                  setForm((current) => ({ ...current, packaging: event.target.value }))
                }
                placeholder="Belum diatur"
              />
            </Field>
            <Field
              label="Max store"
              htmlFor="part-max-store"
              hint="Kapasitas penyimpanan maksimum."
            >
              <input
                id="part-max-store"
                className="input"
                type="number"
                min="0"
                step="1"
                value={form.maxStore}
                onChange={(event) =>
                  setForm((current) => ({ ...current, maxStore: event.target.value }))
                }
                placeholder="Belum diatur"
              />
            </Field>
            <Field label="Status" htmlFor="part-status">
              <select
                id="part-status"
                className="select"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as MasterStatus,
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <div className="field-label">
                <label>Model yang memakai part ini</label>
              </div>
              {models.length > 0 ? (
                <div className="stack-sm">
                  {models.map((model) => (
                    <label className="checkbox" key={model.id}>
                      <input
                        type="checkbox"
                        checked={form.models.includes(model.code)}
                        onChange={() => toggleModel(model.code)}
                      />
                      <span>
                        {model.code} — {model.name}{' '}
                        {model.status === 'inactive' && (
                          <span className="muted small">(inactive)</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="muted small">Belum ada model untuk dipilih.</p>
              )}
              <span className="field-hint">Pilih minimal satu model.</span>
            </div>

            <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
              <Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                leftIcon={<Plus size={15} />}
                loading={saving}
              >
                {form.editingPartNumber ? 'Simpan perubahan' : 'Simpan part'}
              </Button>
            </div>
          </form>

          <Callout tone="info" style={{ marginTop: 12 }}>
            Komponen/stock item non-produksi (bolt, nut, press part) dikelola di menu Packaging &amp;
            Policy. Halaman ini khusus part produksi Assy dan Sub Assy.
          </Callout>
        </section>
      )}

      <section className="card">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <div className="select-wrap">
              <select
                className="select"
                style={{ width: 150, height: 38, minHeight: 38 }}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Filter tipe part"
              >
                <option value="all">Semua tipe</option>
                <option value="Assy">Assy</option>
                <option value="Sub_Assy">Sub Assy</option>
              </select>
            </div>
            <div className="select-wrap">
              <select
                className="select"
                style={{ width: 130, height: 38, minHeight: 38 }}
                value={lineFilter}
                onChange={(event) => setLineFilter(event.target.value)}
                aria-label="Filter line"
              >
                <option value="all">Semua line</option>
                {lineOptions.map((lineOption) => (
                  <option key={lineOption} value={lineOption}>
                    {lineOption}
                  </option>
                ))}
              </select>
            </div>
            <div className="select-wrap">
              <select
                className="select"
                style={{ width: 130, height: 38, minHeight: 38 }}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter status part"
              >
                <option value="all">Semua status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari part number, deskripsi, proses…"
            className="search-inline"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(part) => part.partNumber}
          minWidth={980}
          footer={
            <span className="muted small">
              Menampilkan {rows.length} dari {parts.length} part produksi
            </span>
          }
        />
      </section>
    </div>
  )
}
