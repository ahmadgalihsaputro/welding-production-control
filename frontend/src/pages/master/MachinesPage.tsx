import { Activity, Cog, Plus, RefreshCw, Wrench } from 'lucide-react'
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
  createMachine,
  deleteMachine,
  listMachines,
  updateMachine,
  type MachineRecord,
  type MachineStatus,
} from '../../lib/masterApi'

interface MachineFormState {
  id: string | null
  code: string
  name: string
  line: string
  processes: string
  status: MachineStatus
}

function emptyForm(): MachineFormState {
  return {
    id: null,
    code: '',
    name: '',
    line: 'Robot G',
    processes: '',
    status: 'active',
  }
}

function splitProcesses(value: string): string[] {
  return value
    .split(',')
    .map((process) => process.trim())
    .filter(Boolean)
}

export function MachinesPage() {
  const [machines, setMachines] = useState<MachineRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<MachineFormState>(emptyForm)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setMachines(await listMachines())
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data machine gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return machines.filter(
      (machine) =>
        !needle ||
        machine.code.toLowerCase().includes(needle) ||
        machine.name.toLowerCase().includes(needle) ||
        machine.line.toLowerCase().includes(needle) ||
        machine.processes.some((process) => process.toLowerCase().includes(needle)),
    )
  }, [machines, search])

  const activeMachines = machines.filter((machine) => machine.status === 'active').length
  const maintenanceMachines = machines.filter(
    (machine) => machine.status === 'maintenance',
  ).length
  const lines = new Set(machines.map((machine) => machine.line)).size

  const openAddForm = () => {
    setForm(emptyForm())
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const openEditForm = (machine: MachineRecord) => {
    setForm({
      id: machine.id,
      code: machine.code,
      name: machine.name,
      line: machine.line,
      processes: machine.processes.join(', '),
      status: machine.status,
    })
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const closeForm = () => {
    setShowForm(false)
    setForm(emptyForm())
  }

  const saveMachine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = form.code.trim().toUpperCase()
    const name = form.name.trim()
    const line = form.line.trim()
    if (!code || !name || !line) {
      setError('Kode, nama, dan line machine wajib diisi.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (form.id) {
        await updateMachine(form.id, {
          name,
          line,
          processes: splitProcesses(form.processes),
          status: form.status,
        })
        setNotice(`Machine ${code} berhasil diperbarui.`)
      } else {
        await createMachine({
          code,
          name,
          line,
          processes: splitProcesses(form.processes),
          status: form.status,
        })
        setNotice(`Machine ${code} berhasil ditambahkan.`)
      }
      setShowForm(false)
      setForm(emptyForm())
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Machine gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (machine: MachineRecord) => {
    const nextStatus: MachineStatus = machine.status === 'active' ? 'inactive' : 'active'
    if (
      nextStatus === 'inactive' &&
      !window.confirm(
        `Nonaktifkan machine ${machine.code}? Machine yang dinonaktifkan tidak menerima work order baru.`,
      )
    ) {
      return
    }
    setBusyId(machine.id)
    setError('')
    setNotice('')
    try {
      await updateMachine(machine.id, { status: nextStatus })
      setNotice(`Machine ${machine.code} ${nextStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan'}.`)
      await loadData()
    } catch (statusError) {
      setError(describeApiError(statusError, 'Status machine gagal diubah.'))
    } finally {
      setBusyId(null)
    }
  }

  const removeMachine = async (machine: MachineRecord) => {
    if (
      !window.confirm(
        `Hapus machine ${machine.code}? Machine yang masih dipakai di routing tidak dapat dihapus.`,
      )
    ) {
      return
    }
    setBusyId(machine.id)
    setError('')
    setNotice('')
    try {
      await deleteMachine(machine.id)
      setNotice(`Machine ${machine.code} dihapus.`)
      await loadData()
    } catch (deleteError) {
      setError(describeApiError(deleteError, 'Machine gagal dihapus.'))
    } finally {
      setBusyId(null)
    }
  }

  const columns: Column<MachineRecord>[] = [
    {
      key: 'machine',
      header: 'Machine',
      render: (machine) => (
        <div className="cell-stack">
          <span className="cell-main">{machine.name}</span>
          <span className="cell-sub mono">{machine.code}</span>
        </div>
      ),
    },
    {
      key: 'line',
      header: 'Line',
      render: (machine) => <Badge tone="neutral">{machine.line}</Badge>,
    },
    {
      key: 'process',
      header: 'Process',
      render: (machine) => (
        <div className="row row--wrap" style={{ gap: 4 }}>
          {machine.processes.length > 0 ? (
            machine.processes.map((process) => (
              <Badge key={process} tone="sky">
                {process}
              </Badge>
            ))
          ) : (
            <span className="muted small">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (machine) => <StatusBadge status={machine.status} />,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (machine) => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" onClick={() => openEditForm(machine)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={busyId === machine.id}
            onClick={() => void toggleActive(machine)}
          >
            {machine.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === machine.id}
            onClick={() => void removeMachine(machine)}
          >
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Machine"
        subtitle="Data mesin produksi, line penempatan, dan proses yang dijalankan. Machine dipakai sebagai referensi step routing."
        meta={
          <>
            <span className="page-meta__item">
              <Cog size={12} /> {machines.length} machine
            </span>
            <span className="page-meta__item">
              <Activity size={12} /> {activeMachines} aktif
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
              Tambah machine
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
      {loading && machines.length === 0 && (
        <Callout tone="info">Memuat data machine dari server…</Callout>
      )}

      <div className="kpi-grid">
        <StatCard
          label="Total machine"
          value={String(machines.length)}
          suffix="unit"
          icon={Cog}
          tone="orange"
          note="Terdaftar di database"
        />
        <StatCard
          label="Machine aktif"
          value={String(activeMachines)}
          suffix="unit"
          icon={Activity}
          tone="green"
          note="Siap produksi"
        />
        <StatCard
          label="Maintenance"
          value={String(maintenanceMachines)}
          suffix="unit"
          icon={Wrench}
          tone="amber"
          note="Tidak menerima work order baru"
        />
        <StatCard
          label="Line terpakai"
          value={String(lines)}
          suffix="line"
          icon={Cog}
          tone="sky"
          note="Robot G & H"
        />
      </div>

      {showForm && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{form.id ? 'Ubah machine' : 'Machine baru'}</h2>
              <p className="section-sub">
                Kode machine tidak dapat diubah setelah dibuat karena dipakai pada step routing.
              </p>
            </div>
            <Badge tone="success">Terhubung database</Badge>
          </div>

          <form className="form-grid" onSubmit={(event) => void saveMachine(event)}>
            <Field
              label="Kode machine"
              htmlFor="machine-code"
              hint={form.id ? 'Kode machine bersifat tetap.' : 'Contoh: RB-G-WLD-ASSY.'}
            >
              <input
                id="machine-code"
                className="input mono"
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value }))
                }
                placeholder="Contoh: RB-G-WLD-ASSY"
                disabled={Boolean(form.id)}
                required
              />
            </Field>
            <Field label="Nama machine" htmlFor="machine-name">
              <input
                id="machine-name"
                className="input"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Contoh: Robot G — Welding Assy"
                required
              />
            </Field>
            <Field label="Line" htmlFor="machine-line">
              <input
                id="machine-line"
                className="input"
                value={form.line}
                onChange={(event) =>
                  setForm((current) => ({ ...current, line: event.target.value }))
                }
                placeholder="Robot G"
                required
              />
            </Field>
            <Field
              label="Proses"
              htmlFor="machine-processes"
              hint="Pisahkan dengan koma, contoh: Assy Welding, Sub Assy Welding."
            >
              <input
                id="machine-processes"
                className="input"
                value={form.processes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, processes: event.target.value }))
                }
                placeholder="Assy Welding, Sub Assy Welding"
              />
            </Field>
            <Field label="Status" htmlFor="machine-status">
              <select
                id="machine-status"
                className="select"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as MachineStatus,
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </Field>

            <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
              <Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" variant="primary" leftIcon={<Plus size={15} />} loading={saving}>
                {form.id ? 'Simpan perubahan' : 'Simpan machine'}
              </Button>
            </div>
          </form>

          <Callout tone="info" style={{ marginTop: 12 }}>
            Machine yang masih dipakai pada routing tidak dapat dihapus. Gunakan status inactive atau
            maintenance agar histori routing tetap utuh.
          </Callout>
        </section>
      )}

      <section className="card">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <Badge tone="neutral">{machines.length} machine</Badge>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari kode, nama, line, proses…"
            className="search-inline"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(machine) => machine.id}
          minWidth={820}
          footer={
            <span className="muted small">
              Menampilkan {rows.length} dari {machines.length} machine
            </span>
          }
        />
      </section>
    </div>
  )
}
