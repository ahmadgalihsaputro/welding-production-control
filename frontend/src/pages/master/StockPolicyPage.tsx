import { Boxes, PackageCheck, Plus, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { describeApiError } from '../../lib/api'
import {
  createStockPolicy,
  deleteStockPolicy,
  listParts,
  listStockPolicy,
  updateStockPolicy,
  type ProductionPartRecord,
  type StockPolicyRecord,
} from '../../lib/masterApi'
import { formatNumber } from '../../lib/utils'

const categories = [
  'Assy',
  'Sub Assy',
  'Press Part',
  'Bolt',
  'Nut',
  'Bolt/Nut',
  'Child Part',
]

interface PolicyFormState {
  editingPartNumber: string | null
  partNumber: string
  category: string
  packaging: string
  maxStore: string
  safetyStock: string
  location: string
}

function emptyForm(): PolicyFormState {
  return {
    editingPartNumber: null,
    partNumber: '',
    category: 'Assy',
    packaging: '',
    maxStore: '',
    safetyStock: '',
    location: '',
  }
}

function policyLocation(value: string): string {
  const legacyContainers = ['Box standard', 'Pallet', 'Small bin']
  const prefix = legacyContainers.find((container) => value.startsWith(`${container} · `))
  return prefix ? value.slice(prefix.length + 3) : value
}

export function StockPolicyPage() {
  const { confirm } = useConfirmation()
  const [policies, setPolicies] = useState<StockPolicyRecord[]>([])
  const [parts, setParts] = useState<ProductionPartRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyPartNumber, setBusyPartNumber] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [lineFilter, setLineFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PolicyFormState>(emptyForm)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextPolicies, nextParts] = await Promise.all([listStockPolicy(), listParts()])
      setPolicies(nextPolicies)
      setParts(nextParts)
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data packaging & policy gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const lineByPartNumber = new Map(parts.map((part) => [part.partNumber, part.line]))
    return policies.filter((policy) => {
      return (
        (categoryFilter === 'all' || policy.category === categoryFilter) &&
        (lineFilter === 'all' || lineByPartNumber.get(policy.partNumber) === lineFilter) &&
        (!needle || policy.partNumber.toLowerCase().includes(needle))
      )
    })
  }, [policies, parts, search, categoryFilter, lineFilter])

  const openAddForm = () => {
    setForm(emptyForm())
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const openEditForm = (policy: StockPolicyRecord) => {
    setForm({
      editingPartNumber: policy.partNumber,
      partNumber: policy.partNumber,
      category: policy.category,
      packaging: String(policy.packaging),
      maxStore: String(policy.maxStore),
      safetyStock: String(policy.safetyStock),
      location: policyLocation(policy.location),
    })
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const closeForm = () => {
    setShowForm(false)
    setForm(emptyForm())
  }

  const savePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const partNumber = form.partNumber.trim().toUpperCase()
    const category = form.category.trim()
    const locationDetail = form.location.trim()
    if (!partNumber || !category || !locationDetail) {
      setError('Part number, kategori, dan lokasi wajib diisi.')
      return
    }
    const packaging = Number(form.packaging)
    if (!Number.isInteger(packaging) || packaging < 1) {
      setError('Standar qty harus bilangan bulat minimal 1.')
      return
    }
    const maxStore = Number(form.maxStore)
    if (!Number.isInteger(maxStore) || maxStore < 0) {
      setError('Max store harus bilangan bulat 0 atau lebih.')
      return
    }
    const safetyStock = Number(form.safetyStock)
    if (!Number.isInteger(safetyStock) || safetyStock < 0) {
      setError('Safety stock harus bilangan bulat 0 atau lebih.')
      return
    }
    const confirmed = await confirm({
      title: form.editingPartNumber ? 'Konfirmasi perubahan stock policy' : 'Konfirmasi stock policy baru',
      message: `${form.editingPartNumber ? 'Simpan perubahan' : 'Tambahkan policy'} untuk part ${partNumber}?`,
      confirmLabel: form.editingPartNumber ? 'Simpan perubahan' : 'Tambah policy',
    })
    if (!confirmed) return

    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (form.editingPartNumber) {
        await updateStockPolicy(form.editingPartNumber, {
          category,
          packaging,
          maxStore,
          safetyStock,
          location: locationDetail,
        })
        setNotice(`Policy ${form.editingPartNumber} berhasil diperbarui.`)
      } else {
        await createStockPolicy({
          partNumber,
          description: partNumber,
          category,
          packaging,
          maxStore,
          safetyStock,
          location: locationDetail,
        })
        setNotice(`Policy ${partNumber} berhasil ditambahkan.`)
      }
      setShowForm(false)
      setForm(emptyForm())
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Policy gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const removePolicy = async (policy: StockPolicyRecord) => {
    const confirmed = await confirm({
      title: 'Konfirmasi hapus stock policy',
      message: `Hapus policy ${policy.partNumber}? Item yang masih dipakai part produksi, BOM, material, atau stok tidak dapat dihapus.`,
      confirmLabel: 'Hapus policy',
      tone: 'danger',
    })
    if (!confirmed) return
    setBusyPartNumber(policy.partNumber)
    setError('')
    setNotice('')
    try {
      await deleteStockPolicy(policy.partNumber)
      setNotice(`Policy ${policy.partNumber} dihapus.`)
      await loadData()
    } catch (deleteError) {
      setError(describeApiError(deleteError, 'Policy gagal dihapus.'))
    } finally {
      setBusyPartNumber(null)
    }
  }

  const columns: Column<StockPolicyRecord>[] = [
    {
      key: 'part',
      header: 'Part Number',
      render: (policy) => (
        <div className="cell-stack">
          <span className="cell-main mono">{policy.partNumber}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Kategori',
      render: (policy) => <Badge tone="sky">{policy.category}</Badge>,
    },
    {
      key: 'packaging',
      header: 'Standar Qty',
      align: 'right',
      render: (policy) => <span className="mono">{formatNumber(policy.packaging)} pcs</span>,
    },
    {
      key: 'max',
      header: 'Max Store',
      align: 'right',
      render: (policy) => <span className="mono strong">{formatNumber(policy.maxStore)} pcs</span>,
    },
    {
      key: 'safety',
      header: 'Safety Stock',
      align: 'right',
      render: (policy) => <span className="mono">{formatNumber(policy.safetyStock)} pcs</span>,
    },
    {
      key: 'location',
      header: 'Lokasi',
      render: (policy) => <span className="muted small">{policyLocation(policy.location)}</span>,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (policy) => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" onClick={() => openEditForm(policy)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyPartNumber === policy.partNumber}
            onClick={() => void removePolicy(policy)}
          >
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  const totalPolicies = policies.length
  const lines = [...new Set(
    parts
      .filter((part) => part.type === 'Assy' || part.type === 'Sub_Assy')
      .map((part) => part.line),
  )].sort()
  const avgPackaging =
    policies.length > 0
      ? Math.round(policies.reduce((sum, policy) => sum + policy.packaging, 0) / policies.length)
      : 0
  const avgSafety =
    policies.length > 0
      ? Math.round(policies.reduce((sum, policy) => sum + policy.safetyStock, 0) / policies.length)
      : 0
  const avgMax =
    policies.length > 0
      ? Math.round(policies.reduce((sum, policy) => sum + policy.maxStore, 0) / policies.length)
      : 0

  return (
    <div className="page stock-policy-page">
      <PageHeader
        eyebrow="Master Data"
        title="Stock Policy"
        subtitle="Atur kategori, standar qty, max store, safety stock, dan lokasi untuk setiap part number."
        meta={
          <>
            <span className="page-meta__item">
              <Boxes size={12} /> {policies.length} part number
            </span>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> Disinkronkan ke ProductionPart
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
              Tambah policy
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
      {loading && policies.length === 0 && (
        <Callout tone="info">Memuat packaging & policy dari server…</Callout>
      )}

      <Callout tone="info" title="Safety stock dapat diedit">
        Ubah data melalui tombol Edit pada baris part number. Perubahan standar qty dan max store
        tetap disinkronkan dengan data part produksi.
      </Callout>

      <div className="kpi-grid">
        <StatCard
          label="Policy aktif"
          value={String(totalPolicies)}
          suffix="PN"
          icon={ShieldCheck}
          tone="orange"
          note="Seluruh store"
        />
        <StatCard
          label="Rata-rata packaging"
          value={String(avgPackaging)}
          suffix="pcs"
          icon={Boxes}
          tone="sky"
          note="Standar qty per part"
        />
        <StatCard
          label="Safety stock"
          value={String(avgSafety)}
          suffix="pcs"
          icon={TriangleAlert}
          tone="amber"
          note="Rata-rata per PN"
        />
        <StatCard
          label="Max store"
          value={String(avgMax)}
          suffix="pcs"
          icon={PackageCheck}
          tone="green"
          note="Rata-rata per PN"
        />
      </div>

      {showForm && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{form.editingPartNumber ? 'Ubah policy' : 'Policy baru'}</h2>
              <p className="section-sub">
                {form.editingPartNumber
                  ? 'Part number tetap; kategori, standar qty, max store, safety stock, dan lokasi dapat diperbarui.'
                  : 'Part number dibuat sekali dan tidak dapat diubah setelah tersimpan.'}
              </p>
            </div>
            <Badge tone="success">Terhubung database</Badge>
          </div>

          <form className="form-grid stock-policy-form" onSubmit={(event) => void savePolicy(event)}>
            <Field
              label="Part Number"
              htmlFor="policy-part-number"
              hint={form.editingPartNumber ? 'Part number tidak dapat diubah.' : 'Disimpan sebagai huruf besar.'}
            >
              <input
                id="policy-part-number"
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
            <Field label="Kategori" htmlFor="policy-category">
              <select
                id="policy-category"
                className="select"
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({ ...current, category: event.target.value }))
                }
                required
              >
                {form.editingPartNumber && form.category === 'Bolt/Nut' && (
                  <option value="Bolt/Nut">Bolt/Nut (lama; pilih Bolt atau Nut saat mengubah)</option>
                )}
                {categories.filter((cat) => cat !== 'Bolt/Nut').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Standar Qty (pcs)"
              htmlFor="policy-packaging"
              hint="Jumlah standar per part; wajib bilangan bulat minimal 1."
            >
              <input
                id="policy-packaging"
                className="input"
                type="number"
                min="1"
                step="1"
                value={form.packaging}
                onChange={(event) =>
                  setForm((current) => ({ ...current, packaging: event.target.value }))
                }
                placeholder="Contoh: 35"
                required
              />
            </Field>
            <Field
              label="Max Store"
              htmlFor="policy-max-store"
              hint="Kapasitas penyimpanan maksimum (pcs). 0 = tidak dibatasi."
            >
              <input
                id="policy-max-store"
                className="input"
                type="number"
                min="0"
                step="1"
                value={form.maxStore}
                onChange={(event) =>
                  setForm((current) => ({ ...current, maxStore: event.target.value }))
                }
                placeholder="Contoh: 312"
                required
              />
            </Field>
            <Field
              label="Safety Stock"
              htmlFor="policy-safety-stock"
              hint="Batas bawah stok aman. Di bawah ini status jadi 'low'."
            >
              <input
                id="policy-safety-stock"
                className="input"
                type="number"
                min="0"
                step="1"
                value={form.safetyStock}
                onChange={(event) =>
                  setForm((current) => ({ ...current, safetyStock: event.target.value }))
                }
                placeholder="Contoh: 79"
                required
              />
            </Field>
            <Field
              label="Lokasi"
              htmlFor="policy-location"
              hint="Contoh: R01-A-3."
            >
              <input
                id="policy-location"
                className="input"
                value={form.location}
                onChange={(event) =>
                  setForm((current) => ({ ...current, location: event.target.value }))
                }
                placeholder="Contoh: R01-A-3"
                required
              />
            </Field>

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
                {form.editingPartNumber ? 'Simpan perubahan' : 'Simpan policy'}
              </Button>
            </div>
          </form>

        </section>
      )}

      <section className="card">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <div className="select-wrap">
              <select
                className="select"
                style={{ width: 170, height: 38, minHeight: 38 }}
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter kategori"
              >
                <option value="all">Semua kategori</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="select-wrap">
              <select
                className="select"
                style={{ width: 170, height: 38, minHeight: 38 }}
                value={lineFilter}
                onChange={(event) => setLineFilter(event.target.value)}
                aria-label="Filter line proses"
              >
                <option value="all">Semua line</option>
                {lines.map((line) => (
                  <option key={line} value={line}>
                    {line}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari part number…"
            className="search-inline"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(policy) => policy.id}
          minWidth={1000}
          footer={
            <span className="muted small">
              Menampilkan {rows.length} dari {policies.length} policy
            </span>
          }
        />
      </section>
    </div>
  )
}