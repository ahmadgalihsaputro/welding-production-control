import { Boxes, Container, PackageCheck, Plus, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
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
  createStockPolicy,
  deleteStockPolicy,
  listStockPolicy,
  updateStockPolicy,
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

const containerOptions = ['Box standard', 'Pallet', 'Small bin']

interface PolicyFormState {
  editingPartNumber: string | null
  partNumber: string
  description: string
  category: string
  packaging: string
  maxStore: string
  safetyStock: string
  container: string
  location: string
}

function emptyForm(): PolicyFormState {
  return {
    editingPartNumber: null,
    partNumber: '',
    description: '',
    category: 'Assy',
    packaging: '',
    maxStore: '',
    safetyStock: '',
    container: containerOptions[0],
    location: '',
  }
}

function optionalInt(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return Number(trimmed)
}

export function StockPolicyPage() {
  const [policies, setPolicies] = useState<StockPolicyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyPartNumber, setBusyPartNumber] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [containerFilter, setContainerFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PolicyFormState>(emptyForm)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setPolicies(await listStockPolicy())
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
    return policies.filter((policy) => {
      const container = policy.location.split(' · ')[0] ?? ''
      return (
        (categoryFilter === 'all' || policy.category === categoryFilter) &&
        (containerFilter === 'all' || container === containerFilter) &&
        (!needle || policy.partNumber.toLowerCase().includes(needle))
      )
    })
  }, [policies, search, categoryFilter, containerFilter])

  const openAddForm = () => {
    setForm(emptyForm())
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const openEditForm = (policy: StockPolicyRecord) => {
    const container = policy.location.split(' · ')[0] ?? ''
    const locationDetail = policy.location.split(' · ').slice(1).join(' · ') ?? ''
    setForm({
      editingPartNumber: policy.partNumber,
      partNumber: policy.partNumber,
      description: policy.description,
      category: policy.category,
      packaging: String(policy.packaging),
      maxStore: String(policy.maxStore),
      safetyStock: String(policy.safetyStock),
      container,
      location: locationDetail,
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
    const description = form.description.trim()
    const category = form.category.trim()
    const locationDetail = form.location.trim()
    if (!partNumber || !description || !category || !locationDetail) {
      setError('Part number, deskripsi, kategori, dan lokasi wajib diisi.')
      return
    }
    const packaging = Number(form.packaging)
    if (!Number.isInteger(packaging) || packaging < 1) {
      setError('Packaging harus bilangan bulat minimal 1.')
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

    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (form.editingPartNumber) {
        await updateStockPolicy(form.editingPartNumber, {
          description,
          category,
          packaging,
          maxStore,
          safetyStock,
          location: `${form.container} · ${locationDetail}`,
        })
        setNotice(`Policy ${form.editingPartNumber} berhasil diperbarui.`)
      } else {
        await createStockPolicy({
          partNumber,
          description,
          category,
          packaging,
          maxStore,
          safetyStock,
          location: `${form.container} · ${locationDetail}`,
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
    if (
      !window.confirm(
        `Hapus policy ${policy.partNumber}? Item yang masih dipakai part produksi, BOM, material, atau stock tidak dapat dihapus.`,
      )
    ) {
      return
    }
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
          <span className="cell-sub">{policy.description}</span>
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
      header: 'Isi standar (pcs/wadah)',
      align: 'right',
      render: (policy) => <span className="mono">{formatNumber(policy.packaging)} pcs/wadah</span>,
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
      key: 'container',
      header: 'Container',
      render: (policy) => {
        const container = policy.location.split(' · ')[0] ?? ''
        return (
          <span className="stock-location">
            <Container size={11} /> {container}
          </span>
        )
      },
    },
    {
      key: 'location',
      header: 'Lokasi',
      render: (policy) => {
        const location = policy.location.split(' · ').slice(1).join(' · ') ?? ''
        return <span className="muted small">{location}</span>
      },
    },
    {
      key: 'status',
      header: 'Status Stock',
      render: (policy) => <StatusBadge status={policy.status} />,
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
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Packaging & Stock Policy"
        subtitle="Standar packaging, Max Store, dan safety stock per part number. Kebijakan ini menentukan kapan buffer harus diisi dan kapan kanban belanja diterbitkan. Data tersimpan di database dan disinkronkan dengan Part Number produksi."
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

      <Callout tone="info" title="Cara kerja policy & sinkronisasi">
        Safety stock memicu peringatan low stock. Max Store membatasi penerimaan store in dari
        produksi. Isi standar adalah jumlah pcs dalam satu box atau pallet (istilah wadah
        disesuaikan dengan ukuran barang), dan menentukan kelipatan qty pada kanban dan pickup.
        Perubahan isi standar
        atau max store di halaman ini **langsung memperbarui** kolom yang sama di Master Data → Part Number.
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
          suffix="pcs/wadah"
          icon={Boxes}
          tone="sky"
          note="Per container"
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
                  ? 'Part number tetap; deskripsi, kategori, packaging, max store, safety stock, dan lokasi dapat diperbarui.'
                  : 'Part number dibuat sekali dan tidak dapat diubah setelah tersimpan.'}
              </p>
            </div>
            <Badge tone="success">Terhubung database</Badge>
          </div>

          <form className="form-grid" onSubmit={(event) => void savePolicy(event)}>
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
            <Field label="Deskripsi" htmlFor="policy-description">
              <input
                id="policy-description"
                className="input"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Contoh: Assy RN"
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
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Isi standar (pcs/wadah)"
              htmlFor="policy-packaging"
              hint="Jumlah pcs dalam satu box atau pallet. Pilih istilah sesuai ukuran barang; wajib bilangan bulat minimal 1."
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
              label="Container"
              htmlFor="policy-container"
              hint="Tipe wadah standar."
            >
              <select
                id="policy-container"
                className="select"
                value={form.container}
                disabled
              >
                {containerOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Lokasi detail"
              htmlFor="policy-location"
              hint="Rak/posisi di dalam container, mis. R01-A-3."
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

          <Callout tone="info" style={{ marginTop: 12 }}>
            Lokasi disimpan sebagai "<strong>Container · Detail</strong>", mis. "Box standard · R01-A-3".
            Perubahan packaging/max store di sini akan menimpa nilai di Part Number produksi.
          </Callout>
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
                style={{ width: 150, height: 38, minHeight: 38 }}
                value={containerFilter}
                onChange={(event) => setContainerFilter(event.target.value)}
                aria-label="Filter container"
              >
                <option value="all">Semua container</option>
                {containerOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
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