import { Activity, Cog, Plus, RefreshCw, Wrench } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
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
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { describeApiError } from '../../lib/api'
import {
  createMachine,
  listMachines,
  updateMachine,
  type MachineRecord,
  type MachineStatus,
} from '../../lib/masterApi'

interface MachineLineRecord {
  line: string
  machineIds: string[]
  status: MachineStatus
}

interface MachineFormState {
  line: string
  machineIds: string[]
  status: MachineStatus
}

function emptyForm(): MachineFormState {
  return { line: '', machineIds: [], status: 'active' }
}

function groupMachines(machines: MachineRecord[]): MachineLineRecord[] {
  const grouped = new Map<string, MachineRecord[]>()
  machines.forEach((machine) => {
    grouped.set(machine.line, [...(grouped.get(machine.line) ?? []), machine])
  })

  return [...grouped.entries()]
    .map(([line, lineMachines]): MachineLineRecord => ({
      line,
      machineIds: lineMachines.map((machine) => machine.id),
      status: lineMachines.some((machine) => machine.status === 'active')
        ? 'active'
        : lineMachines.some((machine) => machine.status === 'maintenance')
          ? 'maintenance'
          : 'inactive',
    }))
    .sort((left, right) => left.line.localeCompare(right.line))
}

export function MachinesPage() {
  const { confirm } = useConfirmation()
  const [machines, setMachines] = useState<MachineRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyLine, setBusyLine] = useState<string | null>(null)
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
      setError(describeApiError(loadError, 'Data mesin / line gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const allRows = useMemo(() => groupMachines(machines), [machines])
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return allRows.filter((machine) => machine.line.toLowerCase().includes(needle))
  }, [allRows, search])

  const openAddForm = () => {
    setForm(emptyForm())
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const openEditForm = (machine: MachineLineRecord) => {
    setForm({
      line: machine.line,
      machineIds: machine.machineIds,
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
    const line = form.line.trim()
    if (!line) {
      setError('Nama mesin / line wajib diisi.')
      return
    }
    if (
      form.machineIds.length === 0 &&
      allRows.some((machine) => machine.line.toLowerCase() === line.toLowerCase())
    ) {
      setError(`Mesin / line ${line} sudah terdaftar.`)
      return
    }
    const confirmed = await confirm({
      title: form.machineIds.length > 0 ? 'Konfirmasi perubahan mesin / line' : 'Konfirmasi mesin / line baru',
      message: `${form.machineIds.length > 0 ? 'Simpan perubahan pada' : 'Tambahkan'} mesin / line ${line}?`,
      confirmLabel: form.machineIds.length > 0 ? 'Simpan perubahan' : 'Tambah mesin',
    })
    if (!confirmed) return

    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (form.machineIds.length > 0) {
        await Promise.all(
          form.machineIds.map((id) =>
            updateMachine(id, { name: line, line, processes: [], status: form.status }),
          ),
        )
        setNotice(`Mesin / line ${line} berhasil diperbarui.`)
      } else {
        const code = `LINE-${line.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`
        await createMachine({ code, name: line, line, processes: [], status: form.status })
        setNotice(`Mesin / line ${line} berhasil ditambahkan.`)
      }
      closeForm()
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Mesin / line gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (machine: MachineLineRecord) => {
    const nextStatus: MachineStatus = machine.status === 'active' ? 'inactive' : 'active'
    const confirmed = await confirm({
      title: 'Konfirmasi status mesin / line',
      message: `${nextStatus === 'active' ? 'Aktifkan' : 'Nonaktifkan'} mesin / line ${machine.line}?`,
      confirmLabel: nextStatus === 'active' ? 'Aktifkan' : 'Nonaktifkan',
      tone: nextStatus === 'active' ? 'primary' : 'danger',
    })
    if (!confirmed) return
    setBusyLine(machine.line)
    setError('')
    setNotice('')
    try {
      await Promise.all(
        machine.machineIds.map((id) => updateMachine(id, { status: nextStatus })),
      )
      setNotice(
        `Mesin / line ${machine.line} ${nextStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan'}.`,
      )
      await loadData()
    } catch (statusError) {
      setError(describeApiError(statusError, 'Status mesin / line gagal diubah.'))
    } finally {
      setBusyLine(null)
    }
  }

  const columns: Column<MachineLineRecord>[] = [
    {
      key: 'line',
      header: 'Mesin / Line',
      render: (machine) => <span className="cell-main">{machine.line}</span>,
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
            loading={busyLine === machine.line}
            onClick={() => void toggleActive(machine)}
          >
            {machine.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
        </div>
      ),
    },
  ]

  const activeCount = allRows.filter((machine) => machine.status === 'active').length
  const maintenanceCount = allRows.filter((machine) => machine.status === 'maintenance').length

  return (
    <div className="page master-machine-page">
      <PageHeader
        eyebrow="Master Data"
        title="Machine / Line"
        subtitle="Daftar mesin disederhanakan menjadi nama line produksi, misalnya Robot G, Robot H, dan Robot A."
        meta={
          <>
            <span className="page-meta__item">
              <Cog size={12} /> {allRows.length} mesin / line
            </span>
            <span className="page-meta__item">
              <Activity size={12} /> {activeCount} aktif
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
              Tambah mesin / line
            </Button>
          </>
        }
      />

      {error && <Callout tone="danger" title="Aksi gagal">{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && machines.length === 0 && (
        <Callout tone="info">Memuat daftar mesin / line dari server…</Callout>
      )}

      <div className="kpi-grid">
        <StatCard label="Mesin / line" value={String(allRows.length)} suffix="line" icon={Cog} tone="orange" note="Dikelompokkan per nama line" />
        <StatCard label="Aktif" value={String(activeCount)} suffix="line" icon={Activity} tone="green" note="Siap beroperasi" />
        <StatCard label="Maintenance" value={String(maintenanceCount)} suffix="line" icon={Wrench} tone="amber" note="Perlu perhatian" />
        <StatCard label="Contoh nama" value="Robot G" icon={Cog} tone="sky" note="Robot H · Robot A" />
      </div>

      <FormDialog
        open={showForm}
        onClose={closeForm}
        titleId="machine-form-title"
        title={form.machineIds.length > 0 ? 'Ubah mesin / line' : 'Mesin / line baru'}
        subtitle="Satu baris mewakili satu mesin produksi, bukan jenis proses."
        badge={<Badge tone="success">Terhubung database</Badge>}
      >
        {error && <Callout tone="danger" title="Aksi gagal">{error}</Callout>}
        <form className="form-grid master-machine-form" onSubmit={(event) => void saveMachine(event)}>
            <Field label="Nama mesin / line" htmlFor="machine-line" hint="Contoh: Robot G, Robot H, atau Robot A.">
              <input
                id="machine-line"
                className="input"
                autoFocus
                value={form.line}
                onChange={(event) => setForm((current) => ({ ...current, line: event.target.value }))}
                placeholder="Robot G"
                required
              />
            </Field>
            <Field label="Status" htmlFor="machine-status" hint="Kondisi line produksi saat ini.">
              <select
                id="machine-status"
                className="select"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({ ...current, status: event.target.value as MachineStatus }))
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
                {form.machineIds.length > 0 ? 'Simpan perubahan' : 'Simpan mesin / line'}
              </Button>
            </div>
          </form>
      </FormDialog>

      <section className="card">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <Badge tone="neutral">{allRows.length} mesin / line</Badge>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nama mesin / line…"
            className="search-inline"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(machine) => machine.line}
          minWidth={540}
          footer={<span className="muted small">Menampilkan {rows.length} dari {allRows.length} mesin / line</span>}
        />
      </section>
    </div>
  )
}
