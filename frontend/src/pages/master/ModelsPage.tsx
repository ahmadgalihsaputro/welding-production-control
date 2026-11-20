import { Boxes, Layers3, Plus, RefreshCw, Search, Shapes, ToggleLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { FormDialog } from '../../components/ui/FormDialog'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tabs } from '../../components/ui/Tabs'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { usePreferences } from '../../contexts/PreferencesContext'
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

interface ModelFormState {
  id: string | null
  code: string
  name: string
  status: MasterStatus
}

function emptyForm(): ModelFormState {
  return { id: null, code: '', name: '', status: 'active' }
}

export function ModelsPage() {
  const { confirm } = useConfirmation()
  const { t, formatDate } = usePreferences()
  const statusTabs = [
    { value: 'all', label: t('Semua', 'All') },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]
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
      setError(describeApiError(loadError, t('Daftar model gagal dimuat.', 'Failed to load the model list.')))
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
      setError(t('Kode model wajib diisi.', 'Model code is required.'))
      return
    }
    if (!name) {
      setError(t('Nama model wajib diisi.', 'Model name is required.'))
      return
    }
    const confirmed = await confirm({
      title: form.id
        ? t('Konfirmasi perubahan model', 'Confirm model change')
        : t('Konfirmasi model baru', 'Confirm new model'),
      message: `${form.id ? t('Simpan perubahan pada', 'Save changes to') : t('Tambahkan', 'Add')} model ${code}?`,
      confirmLabel: form.id
        ? t('Simpan perubahan', 'Save changes')
        : t('Tambah model', 'Add model'),
    })
    if (!confirmed) return

    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (form.id) {
        await updateModel(form.id, { name, status: form.status })
        setNotice(`${t('Model', 'Model')} ${code} ${t('berhasil diperbarui.', 'updated successfully.')}`)
      } else {
        await createModel({ code, name, status: form.status })
        setNotice(`${t('Model', 'Model')} ${code} ${t('berhasil ditambahkan.', 'added successfully.')}`)
      }
      setShowForm(false)
      setForm(emptyForm())
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, t('Model gagal disimpan.', 'Failed to save the model.')))
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (model: ProductionModelRecord) => {
    const nextStatus: MasterStatus = model.status === 'active' ? 'inactive' : 'active'
    const confirmed = await confirm({
      title: t('Konfirmasi status model', 'Confirm model status'),
      message: `${nextStatus === 'active' ? t('Aktifkan', 'Activate') : t('Nonaktifkan', 'Deactivate')} model ${model.code}? ${t('Part yang sudah memakai model ini tetap tercatat.', 'Parts already using this model remain recorded.')}`,
      confirmLabel: nextStatus === 'active' ? t('Aktifkan', 'Activate') : t('Nonaktifkan', 'Deactivate'),
      tone: nextStatus === 'active' ? 'primary' : 'danger',
    })
    if (!confirmed) return
    setBusyId(model.id)
    setError('')
    setNotice('')
    try {
      await updateModel(model.id, { status: nextStatus })
      setNotice(`${t('Model', 'Model')} ${model.code} ${nextStatus === 'active' ? t('diaktifkan', 'activated') : t('dinonaktifkan', 'deactivated')}.`)
      await loadData()
    } catch (statusError) {
      setError(describeApiError(statusError, t('Status model gagal diubah.', 'Failed to change the model status.')))
    } finally {
      setBusyId(null)
    }
  }

  const removeModel = async (model: ProductionModelRecord) => {
    const confirmed = await confirm({
      title: t('Konfirmasi hapus model', 'Confirm model deletion'),
      message: `${t('Hapus', 'Delete')} model ${model.code}? ${t('Model yang masih dipakai part, routing, atau jadwal tidak dapat dihapus.', 'Models still used by parts, routings, or schedules cannot be deleted.')}`,
      confirmLabel: t('Hapus model', 'Delete model'),
      tone: 'danger',
    })
    if (!confirmed) return
    setBusyId(model.id)
    setError('')
    setNotice('')
    try {
      await deleteModel(model.id)
      setNotice(`${t('Model', 'Model')} ${model.code} ${t('dihapus.', 'deleted.')}`)
      await loadData()
    } catch (deleteError) {
      setError(describeApiError(deleteError, t('Model gagal dihapus.', 'Failed to delete the model.')))
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
      header: t('Diperbarui', 'Updated'),
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
            {t('Edit', 'Edit')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={busyId === model.id}
            onClick={() => void toggleStatus(model)}
          >
            {model.status === 'active' ? t('Nonaktifkan', 'Deactivate') : t('Aktifkan', 'Activate')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === model.id}
            onClick={() => void removeModel(model)}
          >
            {t('Hapus', 'Delete')}
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
        eyebrow={t('Master Data', 'Master Data')}
        title="Model"
        subtitle={t('Daftar model produksi yang tersimpan di database. Model menghubungkan part number, BOM, dan routing produksi.', 'List of production models stored in the database. Models link part numbers, BOM, and production routing.')}
        meta={
          <span className="page-meta__item">
            <Shapes size={12} /> {models.length} {t('model terdaftar', 'registered models')}
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
              {t('Muat ulang', 'Reload')}
            </Button>
            <Button variant="primary" leftIcon={<Plus size={15} />} onClick={openAddForm}>
              {t('Tambah model', 'Add model')}
            </Button>
          </>
        }
      />

      {error && (
        <Callout tone="danger" title={t('Aksi gagal', 'Action failed')}>
          {error}
        </Callout>
      )}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && models.length === 0 && (
        <Callout tone="info">{t('Memuat daftar model dari server…', 'Loading model list from the server…')}</Callout>
      )}

      <div className="kpi-grid">
        <StatCard
          label={t('Total model', 'Total models')}
          value={String(models.length)}
          suffix="model"
          icon={Shapes}
          tone="orange"
          note={t('Terdaftar di database', 'Registered in the database')}
        />
        <StatCard
          label={t('Model aktif', 'Active models')}
          value={String(active)}
          suffix="model"
          icon={Boxes}
          tone="green"
          note={t('Dapat dipakai produksi', 'Available for production')}
        />
        <StatCard
          label="Assy part"
          value={String(totalAssy)}
          suffix="PN"
          icon={Layers3}
          tone="sky"
          note={t('Seluruh model', 'All models')}
        />
        <StatCard
          label="Sub assy part"
          value={String(totalSub)}
          suffix="PN"
          icon={ToggleLeft}
          tone="amber"
          note={t('Komponen penyusun', 'Component parts')}
        />
      </div>

      <FormDialog
        open={showForm}
        onClose={closeForm}
        titleId="model-form-title"
        title={form.id ? t('Ubah model', 'Edit model') : t('Model baru', 'New model')}
        subtitle={t('Kode model tidak dapat diubah setelah dibuat karena dipakai part, routing, dan jadwal.', 'The model code cannot be changed after creation because it is used by parts, routings, and schedules.')}
        badge={<Badge tone="success">{t('Terhubung database', 'Connected to database')}</Badge>}
      >
        {error && (
          <Callout tone="danger" title={t('Aksi gagal', 'Action failed')}>
            {error}
          </Callout>
        )}
        <div className="form-grid master-model-form">
            <Field
              label={t('Kode model', 'Model code')}
              htmlFor="model-code"
              hint={form.id ? t('Kode model bersifat tetap.', 'The model code is permanent.') : t('Contoh: RN3. Akan disimpan sebagai huruf besar.', 'Example: RN3. Will be saved in uppercase.')}
            >
              <input
                id="model-code"
                className="input"
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value }))
                }
                placeholder={t('Contoh: RN3', 'Example: RN3')}
                disabled={Boolean(form.id)}
              />
            </Field>
            <Field label={t('Nama model', 'Model name')} htmlFor="model-name">
              <input
                id="model-name"
                className="input"
                autoFocus
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder={t('Contoh: RN3 Frame Series', 'Example: RN3 Frame Series')}
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
            {t('Model yang masih dipakai part, routing, atau jadwal tidak dapat dihapus. Gunakan status inactive agar histori tetap utuh.', 'Models still used by parts, routings, or schedules cannot be deleted. Use inactive status to keep the history intact.')}
          </Callout>
          <div className="form-actions master-model-form__actions">
            <Button variant="secondary" onClick={closeForm} disabled={saving}>
              {t('Batal', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus size={15} />}
              loading={saving}
              onClick={() => void saveModel()}
            >
              {form.id ? t('Simpan perubahan', 'Save changes') : t('Simpan model', 'Save model')}
            </Button>
          </div>
      </FormDialog>

      <section className="card">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <Tabs items={statusTabs} value={status} onChange={setStatus} ariaLabel={t('Filter status model', 'Filter model status')} />
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('Cari model atau kode…', 'Search model or code…')}
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
              <Search size={12} /> {t('Menampilkan', 'Showing')} {rows.length} {t('dari', 'of')} {models.length} model
            </span>
          }
        />
      </section>
    </div>
  )
}
