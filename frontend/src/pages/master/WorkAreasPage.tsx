import { MapPin, Plus, RefreshCw, ShieldCheck, UsersRound, Workflow } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  createWorkArea,
  deleteWorkArea,
  listWorkAreas,
  updateWorkArea,
  type WorkAreaInput,
  type WorkAreaRecord,
  type WorkAreaType,
} from '../../lib/masterApi'

interface WorkAreaFormState {
  id: string | null
  label: string
  line: string
  type: WorkAreaType
  process: string
}

function emptyForm(): WorkAreaFormState {
  return {
    id: null,
    label: '',
    line: 'Robot G',
    type: 'Assy',
    process: 'RB.G',
  }
}

function typeLabel(type: WorkAreaType): string {
  return type === 'Sub_Assy' ? 'Sub Assy' : 'Assy'
}

function suggestedLabel(input: Pick<WorkAreaInput, 'line' | 'type' | 'process'>): string {
  const line = input.line.trim()
  return `${line} · ${input.type === 'Assy' ? 'Assy' : input.process.trim()}`
}

export function WorkAreasPage() {
  const [areas, setAreas] = useState<WorkAreaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<WorkAreaFormState>(emptyForm)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAreas(await listWorkAreas())
    } catch (loadError) {
      setError(describeApiError(loadError, 'Area kerja gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return areas
    return areas.filter((area) =>
      [area.label, area.line, area.type, area.process].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    )
  }, [areas, search])

  function updateForm<K extends keyof WorkAreaFormState>(key: K, value: WorkAreaFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openAddForm = () => {
    setForm(emptyForm())
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const openEditForm = (area: WorkAreaRecord) => {
    setForm({
      id: area.id,
      label: area.label,
      line: area.line,
      type: area.type,
      process: area.process,
    })
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const closeForm = () => {
    setShowForm(false)
    setForm(emptyForm())
  }

  const saveArea = async () => {
    const input: WorkAreaInput = {
      label: form.label.trim() || suggestedLabel(form),
      line: form.line.trim(),
      type: form.type,
      process: form.process.trim(),
    }

    if (!input.line) {
      setError('Line wajib diisi.')
      return
    }
    if (!input.process) {
      setError('Process wajib diisi.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (form.id) {
        await updateWorkArea(form.id, input)
        setNotice('Area kerja berhasil diperbarui.')
      } else {
        await createWorkArea(input)
        setNotice('Area kerja baru berhasil ditambahkan.')
      }
      setShowForm(false)
      setForm(emptyForm())
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Area kerja gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const removeArea = async (area: WorkAreaRecord) => {
    if (area.users.length > 0) {
      setError(
        `Area ${area.label} masih ditugaskan ke ${area.users.length} user. Lepaskan penugasan di User List sebelum menghapus.`,
      )
      setNotice('')
      return
    }
    if (!window.confirm(`Hapus area kerja ${area.label}?`)) return

    setBusyId(area.id)
    setError('')
    setNotice('')
    try {
      await deleteWorkArea(area.id)
      setNotice(`Area kerja ${area.label} dihapus.`)
      await loadData()
    } catch (deleteError) {
      setError(describeApiError(deleteError, 'Area kerja gagal dihapus.'))
    } finally {
      setBusyId(null)
    }
  }

  const columns: Column<WorkAreaRecord>[] = [
    {
      key: 'label',
      header: 'Area kerja',
      render: (area) => (
        <div className="cell-stack">
          <span className="cell-main">{area.label}</span>
          <span className="cell-sub">
            {area.line} · {area.process}
          </span>
        </div>
      ),
    },
    { key: 'line', header: 'Line', render: (area) => <Badge tone="neutral">{area.line}</Badge> },
    {
      key: 'type',
      header: 'Tipe',
      render: (area) => (
        <Badge tone={area.type === 'Assy' ? 'sky' : 'orange'}>{typeLabel(area.type)}</Badge>
      ),
    },
    { key: 'process', header: 'Process', render: (area) => <Badge tone="neutral">{area.process}</Badge> },
    {
      key: 'users',
      header: 'User ditugaskan',
      render: (area) => {
        if (area.users.length === 0) {
          return <span className="muted small">Belum ada</span>
        }
        const names = area.users.slice(0, 2).map((assignment) => assignment.user.name)
        return (
          <div className="cell-stack">
            <span className="cell-main">{names.join(', ')}</span>
            <span className="cell-sub">
              {area.users.length > 2 ? `+${area.users.length - 2} user lain` : 'Terhubung ke user'}
            </span>
          </div>
        )
      },
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (area) => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" onClick={() => openEditForm(area)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === area.id}
            onClick={() => void removeArea(area)}
          >
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  const assignedCount = areas.reduce((total, area) => total + area.users.length, 0)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Work Area"
        subtitle="Kelola area kerja operator per line, tipe, dan proses. Kombinasi line + tipe + proses bersifat unik dan hanya Admin yang dapat mengubah data ini."
        meta={
          <>
            <span className="page-meta__item">
              <MapPin size={12} /> {areas.length} area
            </span>
            <span className="page-meta__item">
              <UsersRound size={12} /> {assignedCount} penugasan user
            </span>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> Admin only
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
              Tambah area
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
      {loading && areas.length === 0 && (
        <Callout tone="info">Memuat area kerja dari server…</Callout>
      )}

      <div className="kpi-grid">
        <StatCard
          label="Total area"
          value={String(areas.length)}
          suffix="area"
          icon={MapPin}
          tone="orange"
          note="Line + tipe + proses"
        />
        <StatCard
          label="Area Assy"
          value={String(areas.filter((area) => area.type === 'Assy').length)}
          suffix="area"
          icon={Workflow}
          tone="sky"
          note="Operator Assy"
        />
        <StatCard
          label="Area Sub Assy"
          value={String(areas.filter((area) => area.type === 'Sub_Assy').length)}
          suffix="area"
          icon={Workflow}
          tone="green"
          note="Operator Sub Assy"
        />
        <StatCard
          label="Penugasan user"
          value={String(assignedCount)}
          suffix="relasi"
          icon={UsersRound}
          tone="amber"
          note="UserWorkArea"
        />
      </div>

      {showForm && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">
                {form.id ? 'Ubah area kerja' : 'Area kerja baru'}
              </h2>
              <p className="section-sub">
                Pastikan kombinasi line, tipe, dan proses belum terdaftar.
              </p>
            </div>
            <Badge tone="success">Terhubung database</Badge>
          </div>

          <div className="form-grid">
            <Field
              label="Label"
              htmlFor="area-label"
              hint="Kosongkan untuk otomatis mengikuti line dan proses."
            >
              <input
                id="area-label"
                className="input"
                value={form.label}
                onChange={(event) => updateForm('label', event.target.value)}
                placeholder={suggestedLabel(form)}
              />
            </Field>
            <Field label="Line" htmlFor="area-line" hint="Contoh: Robot G atau Robot H.">
              <input
                id="area-line"
                className="input"
                value={form.line}
                onChange={(event) => updateForm('line', event.target.value)}
                placeholder="Robot G"
              />
            </Field>
            <Field label="Tipe" htmlFor="area-type">
              <select
                id="area-type"
                className="select"
                value={form.type}
                onChange={(event) => updateForm('type', event.target.value as WorkAreaType)}
              >
                <option value="Assy">Assy</option>
                <option value="Sub_Assy">Sub Assy</option>
              </select>
            </Field>
            <Field label="Process" htmlFor="area-process" hint="Contoh: RB.G, SS.D, SPW.1.">
              <input
                id="area-process"
                className="input"
                value={form.process}
                onChange={(event) => updateForm('process', event.target.value)}
                placeholder="RB.G"
              />
            </Field>
          </div>

          <Callout tone="info" style={{ marginTop: 12 }}>
            Role Operator Assy hanya dapat ditugaskan ke area bertipe Assy. Operator Sub Assy hanya
            ke Sub Assy. Operator gabungan dapat memakai keduanya.
          </Callout>

          <div className="form-actions">
            <Button variant="secondary" onClick={closeForm} disabled={saving}>
              Batal
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus size={15} />}
              loading={saving}
              onClick={() => void saveArea()}
            >
              {form.id ? 'Simpan perubahan' : 'Simpan area'}
            </Button>
          </div>
        </section>
      )}

      <section className="card">
        <div className="table-toolbar">
          <div className="section-head" style={{ margin: 0 }}>
            <div>
              <h2 className="section-title">Daftar area kerja</h2>
              <p className="section-sub">Area kerja tersimpan di database dan dipakai saat penugasan user.</p>
            </div>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari label, line, tipe, proses…"
            className="search-inline"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(area) => area.id}
          minWidth={900}
          footer={
            <span className="muted small">
              Menampilkan {rows.length} dari {areas.length} area kerja
            </span>
          }
        />
      </section>
    </div>
  )
}
