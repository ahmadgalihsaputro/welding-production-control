import { Boxes, Layers3, Plus, RefreshCw, Search, Shapes, ToggleLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tabs } from '../../components/ui/Tabs'
import { describeApiError } from '../../lib/api'
import {
  createModel,
  deleteModel,
  listModels,
  updateModel,
  type MasterStatus,
  type ProductionModelRecord,
} from '../../lib/masterApi'
import { formatNumber } from '../../lib/utils'

const statusTabs = [
  { value: 'all', label: 'Semua' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

interface ModelFormState {
  id: string | null
  code: string
  name: string
  status: MasterStatus
}

function emptyForm(): ModelFormState {
  return { id: null, code: '', name: '', status: 'active' }
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date)
}

export function ModelsPage() {
  const [models, setModels] = useState<ProductionModelRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ModelFormState>(emptyForm)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setModels(await listModels())
    } catch (loadError) {
      setError(describeApiError(loadError, 'Daftar model gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return models.filter(
      (model) =>
        (status === 'all' || model.status === status) &&
        (!needle ||
          model.code.toLowerCase().includes(needle) ||
          model.name.toLowerCase().includes(needle)),
    )
  }, [models, status, search])

  const openAddForm = () => {
    setForm(emptyForm())
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const openEditForm = (model: ProductionModelRecord) => {
    setForm({
      id: model.id,
      code: model.code,
      name: model.name,
      status: model.status,
    })
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const closeForm = () => {
    setShowForm(false)
    setForm(emptyForm())
  }

  const saveModel = async () => {
    const code = form.code.trim().toUpperCase()
    const name = form.name.trim()
    if (!code) {
      setError('Kode model wajib diisi.')
      return
    }
    if (!name) {
      setError('Nama model wajib diisi.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (form.id) {
        await updateModel(form.id, { name, status: form.status })
        setNotice(`Model ${code} berhasil diperbarui.`)
      } else {
        await createModel({ code, name, status: form.status })
        setNotice(`Model ${code} berhasil ditambahkan.`)
      }
      setShowForm(false)
      setForm(emptyForm())
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Model gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (model: ProductionModelRecord) => {
    const nextStatus: MasterStatus = model.status === 'active' ? 'inactive' : 'active'
    if (
      nextStatus === 'inactive' &&
      !window.confirm(`Nonaktifkan model ${model.code}? Part yang sudah memakai model ini tidak dihapus.`)
    ) {
      return
    }
    setBusyId(model.id)
    setError('')
    setNotice('')
    try {
      await updateModel(model.id, { status: nextStatus })
      setNotice(`Model ${model.code} ${nextStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan'}.`)
      await loadData()
    } catch (statusError) {
      setError(describeApiError(statusError, 'Status model gagal diubah.'))
    } finally {
      setBusyId(null)
    }
  }

  const removeModel = async (model: ProductionModelRecord) => {
    if (
      !window.confirm(
        `Hapus model ${model.code}? Model yang masih dipakai part, routing, atau jadwal tidak dapat dihapus.`,
      )
    ) {
      return
    }
    setBusyId(model.id)
    setError('')
    setNotice('')
    try {
      await deleteModel(model.id)
      setNotice(`Model ${model.code} dihapus.`)
      await loadData()
    } catch (deleteError) {
      setError(describeApiError(deleteError, 'Model gagal dihapus.'))
    } finally {
      setBusyId(null)
    }
  }

  const columns: Column<ProductionModelRecord>[] = [
    {
      key: 'model',
      header: 'Model',
      render: (model) => (
        <div className="cell-stack">
          <span className="cell-main">{model.code}</span>
          <span className="cell-sub">{model.name}</span>
        </div>
      ),
    },
    {
      key: 'assy',
      header: 'Assy part',
      align: 'right',
      render: (model) => <span className="mono strong">{formatNumber(model.assyParts)}</span>,
    },
    {
      key: 'sub',
      header: 'Sub assy part',
      align: 'right',
      render: (model) => <span className="mono">{formatNumber(model.subAssyParts)}</span>,
    },
    {
      key: 'updated',
      header: 'Diperbarui',
      render: (model) => <span className="muted small">{formatDate(model.updatedAt)}</span>,
    },
    { key: 'status', header: 'Status', render: (model) => <StatusBadge status={model.status} /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (model) => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" onClick={() => openEditForm(model)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={busyId === model.id}
            onClick={() => void toggleStatus(model)}
          >
            {model.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === model.id}
            onClick={() => void removeModel(model)}
          >
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  const active = models.filter((model) => model.status === 'active').length
  const totalAssy = models.reduce((sum, model) => sum + model.assyParts, 0)
  const totalSub = models.reduce((sum, model) => sum + model.subAssyParts, 0)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Model"
        subtitle="Daftar model produksi yang tersimpan di database. Model menghubungkan part number, BOM, dan routing produksi."
        meta={
          <span className="page-meta__item">
            <Shapes size={12} /> {models.length} model terdaftar
          </span>
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
              Tambah model
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
      {loading && models.length === 0 && (
        <Callout tone="info">Memuat daftar model dari server…</Callout>
      )}

      <div className="kpi-grid">
        <StatCard
          label="Total model"
          value={String(models.length)}
          suffix="model"
          icon={Shapes}
          tone="orange"
          note="Terdaftar di database"
        />
        <StatCard
          label="Model aktif"
          value={String(active)}
          suffix="model"
          icon={Boxes}
          tone="green"
          note="Dapat dipakai produksi"
        />
        <StatCard
          label="Assy part"
          value={String(totalAssy)}
          suffix="PN"
          icon={Layers3}
          tone="sky"
          note="Seluruh model"
        />
        <StatCard
          label="Sub assy part"
          value={String(totalSub)}
          suffix="PN"
          icon={ToggleLeft}
          tone="amber"
          note="Komponen penyusun"
        />
      </div>

      {showForm && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">
                {form.id ? 'Ubah model' : 'Model baru'}
              </h2>
              <p className="section-sub">
                Kode model tidak dapat diubah setelah dibuat karena dipakai part, routing, dan jadwal.
              </p>
            </div>
            <Badge tone="success">Terhubung database</Badge>
          </div>
          <div className="form-grid">
            <Field
              label="Kode model"
              htmlFor="model-code"
              hint={form.id ? 'Kode model bersifat tetap.' : 'Contoh: RN3. Akan disimpan sebagai huruf besar.'}
            >
              <input
                id="model-code"
                className="input"
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value }))
                }
                placeholder="Contoh: RN3"
                disabled={Boolean(form.id)}
              />
            </Field>
            <Field label="Nama model" htmlFor="model-name">
              <input
                id="model-name"
                className="input"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Contoh: RN3 Frame Series"
              />
            </Field>
            <Field label="Status" htmlFor="model-status">
              <select
                id="model-status"
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
          </div>
          <Callout tone="info" style={{ marginTop: 12 }}>
            Model yang masih dipakai part, routing, atau jadwal tidak dapat dihapus. Gunakan status
            inactive agar histori tetap utuh.
          </Callout>
          <div className="form-actions">
            <Button variant="secondary" onClick={closeForm} disabled={saving}>
              Batal
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus size={15} />}
              loading={saving}
              onClick={() => void saveModel()}
            >
              {form.id ? 'Simpan perubahan' : 'Simpan model'}
            </Button>
          </div>
        </section>
      )}

      <section className="card">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <Tabs items={statusTabs} value={status} onChange={setStatus} ariaLabel="Filter status model" />
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari model atau kode…"
            className="search-inline"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(model) => model.id}
          minWidth={900}
          footer={
            <span className="row" style={{ gap: 5 }}>
              <Search size={12} /> Menampilkan {rows.length} dari {models.length} model
            </span>
          }
        />
      </section>
    </div>
  )
}
