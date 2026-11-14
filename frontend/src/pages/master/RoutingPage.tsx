import {
  ArrowRight,
  CircleCheck,
  Clock3,
  Cog,
  GitBranch,
  Plus,
  RefreshCw,
  Route,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { describeApiError } from '../../lib/api'
import {
  createRouting,
  deleteRouting,
  listMachines,
  listModels,
  listParts,
  listRoutings,
  updateRouting,
  type MachineRecord,
  type MasterStatus,
  type ProductionModelRecord,
  type ProductionPartRecord,
  type RoutingRecord,
  type RoutingStepRecord,
} from '../../lib/masterApi'
import { formatNumber } from '../../lib/utils'

interface RoutingFormState {
  partNumber: string
  model: string
  version: string
  effectiveDate: string
  status: MasterStatus
  steps: RoutingStepRecord[]
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyForm(): RoutingFormState {
  return {
    partNumber: '',
    model: '',
    version: '1.0',
    effectiveDate: today(),
    status: 'active',
    steps: [],
  }
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date)
}

export function RoutingPage() {
  const [routings, setRoutings] = useState<RoutingRecord[]>([])
  const [parts, setParts] = useState<ProductionPartRecord[]>([])
  const [models, setModels] = useState<ProductionModelRecord[]>([])
  const [machines, setMachines] = useState<MachineRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RoutingFormState>(emptyForm)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextRoutings, nextParts, nextModels, nextMachines] = await Promise.all([
        listRoutings(),
        listParts(),
        listModels(),
        listMachines(),
      ])
      setRoutings(nextRoutings)
      setParts(nextParts)
      setModels(nextModels)
      setMachines(nextMachines)
      setSelectedId((current) =>
        nextRoutings.some((routing) => routing.id === current)
          ? current
          : (nextRoutings[0]?.id ?? ''),
      )
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data routing gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const selected = useMemo(
    () => routings.find((routing) => routing.id === selectedId) ?? routings[0],
    [routings, selectedId],
  )

  const machineByCode = useMemo(
    () => new Map(machines.map((machine) => [machine.code, machine])),
    [machines],
  )

  const usedMachines = useMemo(
    () => new Set(routings.flatMap((routing) => routing.steps.map((step) => step.machine))).size,
    [routings],
  )
  const totalSteps = useMemo(
    () => routings.reduce((sum, routing) => sum + routing.steps.length, 0),
    [routings],
  )
  const totalCycle = selected?.steps.reduce((sum, step) => sum + step.cycle, 0) ?? 0

  const openAddForm = () => {
    const next = emptyForm()
    next.partNumber = parts[0]?.partNumber ?? ''
    next.model = models[0]?.code ?? ''
    setEditingId(null)
    setForm(next)
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const openEditForm = (routing: RoutingRecord) => {
    setEditingId(routing.id)
    setForm({
      partNumber: routing.partNumber,
      model: routing.model,
      version: routing.version,
      effectiveDate: routing.effectiveDate,
      status: routing.status,
      steps: routing.steps.map((step) => ({ ...step })),
    })
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  const addStep = () => {
    setForm((current) => ({
      ...current,
      steps: [
        ...current.steps,
        {
          step: current.steps.length + 1,
          process: '',
          machine: machines[0]?.code ?? '',
          cycle: 0,
          status: 'active',
        },
      ],
    }))
  }

  const updateStep = (index: number, patch: Partial<RoutingStepRecord>) => {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step,
      ),
    }))
  }

  const removeStep = (index: number) => {
    setForm((current) => ({
      ...current,
      steps: current.steps
        .filter((_, stepIndex) => stepIndex !== index)
        .map((step, stepIndex) => ({ ...step, step: stepIndex + 1 })),
    }))
  }

  const saveRouting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const partNumber = form.partNumber.trim().toUpperCase()
    const model = form.model.trim().toUpperCase()
    const version = form.version.trim()
    if (!partNumber || !model || !version || !form.effectiveDate) {
      setError('Part, model, versi, dan effective date wajib diisi.')
      return
    }
    if (form.steps.length === 0) {
      setError('Routing minimal memiliki satu step proses.')
      return
    }
    for (const [index, step] of form.steps.entries()) {
      if (!step.process.trim()) {
        setError(`Process pada step ${index + 1} wajib diisi.`)
        return
      }
      if (!step.machine) {
        setError(`Machine pada step ${index + 1} wajib dipilih.`)
        return
      }
      if (!Number.isFinite(step.cycle) || step.cycle <= 0) {
        setError(`Cycle time pada step ${index + 1} harus lebih besar dari 0 detik.`)
        return
      }
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = {
        partNumber,
        model,
        version,
        effectiveDate: form.effectiveDate,
        status: form.status,
        steps: form.steps.map((step, index) => ({
          ...step,
          step: index + 1,
          process: step.process.trim(),
          machine: step.machine.trim().toUpperCase(),
        })),
      }
      if (editingId) {
        await updateRouting(editingId, payload)
        setNotice(`Routing ${partNumber} model ${model} v${version} diperbarui.`)
      } else {
        await createRouting(payload)
        setNotice(`Routing ${partNumber} model ${model} v${version} dibuat.`)
      }
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm())
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Routing gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (routing: RoutingRecord) => {
    const nextStatus: MasterStatus = routing.status === 'active' ? 'inactive' : 'active'
    setBusyId(routing.id)
    setError('')
    setNotice('')
    try {
      await updateRouting(routing.id, { status: nextStatus })
      setNotice(
        `Routing ${routing.partNumber} v${routing.version} ${
          nextStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan'
        }.`,
      )
      await loadData()
    } catch (statusError) {
      setError(describeApiError(statusError, 'Status routing gagal diubah.'))
    } finally {
      setBusyId(null)
    }
  }

  const removeRouting = async (routing: RoutingRecord) => {
    if (
      !window.confirm(
        `Hapus routing ${routing.partNumber} model ${routing.model} v${routing.version}?`,
      )
    ) {
      return
    }
    setBusyId(routing.id)
    setError('')
    setNotice('')
    try {
      await deleteRouting(routing.id)
      setNotice(`Routing ${routing.partNumber} v${routing.version} dihapus.`)
      await loadData()
    } catch (deleteError) {
      setError(describeApiError(deleteError, 'Routing gagal dihapus.'))
    } finally {
      setBusyId(null)
    }
  }

  const stepColumns: Column<RoutingStepRecord>[] = [
    {
      key: 'step',
      header: 'Step',
      render: (step) => <span className="pareto-row__rank">{step.step}</span>,
    },
    {
      key: 'process',
      header: 'Process',
      render: (step) => {
        const machine = machineByCode.get(step.machine)
        return (
          <div className="cell-stack">
            <span className="cell-main">{step.process}</span>
            <span className="cell-sub">
              {step.machine}
              {machine ? ` · ${machine.name}` : ''}
            </span>
          </div>
        )
      },
    },
    {
      key: 'cycle',
      header: 'Cycle time',
      align: 'right',
      render: (step) => <span className="mono">{formatNumber(step.cycle)} s</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (step) => <StatusBadge status={step.status} />,
    },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Routing & Process"
        subtitle="Urutan proses produksi beserta machine dan cycle time standar. Routing menjadi acuan pencatatan output per stasiun."
        meta={
          <>
            <span className="page-meta__item">
              <Route size={12} /> {routings.length} routing
            </span>
            <span className="page-meta__item">
              <GitBranch size={12} /> {totalSteps} step
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
            <Button
              variant="primary"
              leftIcon={<GitBranch size={15} />}
              onClick={openAddForm}
              disabled={parts.length === 0 || models.length === 0 || machines.length === 0}
            >
              Buat routing
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
      {loading && routings.length === 0 && (
        <Callout tone="info">Memuat data routing dari server…</Callout>
      )}
      {(parts.length === 0 || models.length === 0 || machines.length === 0) && (
        <Callout tone="warning">
          Routing membutuhkan minimal satu Part Number, satu Model, dan satu Machine yang terdaftar.
        </Callout>
      )}

      <div className="kpi-grid">
        <StatCard
          label="Routing part"
          value={String(routings.length)}
          suffix="PN"
          icon={Route}
          tone="orange"
          note="Tersimpan di database"
        />
        <StatCard
          label="Total step"
          value={String(totalSteps)}
          suffix="step"
          icon={Cog}
          tone="sky"
          note="Seluruh routing"
        />
        <StatCard
          label="Machine dipakai"
          value={String(usedMachines)}
          suffix="unit"
          icon={Cog}
          tone="amber"
          note="Dari Master Machine"
        />
        <StatCard
          label="Total cycle terpilih"
          value={`${formatNumber(totalCycle)} s`}
          icon={Clock3}
          tone="green"
          note={selected?.partNumber ?? 'Belum ada routing'}
        />
      </div>

      {showForm && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">
                {editingId ? 'Ubah routing' : 'Routing baru'}
              </h2>
              <p className="section-sub">
                Machine harus terdaftar di Master Machine. Nomor step diurutkan otomatis.
              </p>
            </div>
            <Badge tone="success">Terhubung database</Badge>
          </div>

          <form className="form-grid" onSubmit={(event) => void saveRouting(event)}>
            <Field label="Part number" htmlFor="routing-part">
              <select
                id="routing-part"
                className="select"
                value={form.partNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, partNumber: event.target.value }))
                }
                required
              >
                <option value="">Pilih part</option>
                {parts.map((part) => (
                  <option key={part.partNumber} value={part.partNumber}>
                    {part.partNumber} · {part.type === 'Sub_Assy' ? 'Sub Assy' : 'Assy'} ·{' '}
                    {part.process}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Model" htmlFor="routing-model">
              <select
                id="routing-model"
                className="select"
                value={form.model}
                onChange={(event) =>
                  setForm((current) => ({ ...current, model: event.target.value }))
                }
                required
              >
                <option value="">Pilih model</option>
                {models.map((model) => (
                  <option key={model.id} value={model.code}>
                    {model.code} — {model.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Versi" htmlFor="routing-version">
              <input
                id="routing-version"
                className="input mono"
                value={form.version}
                onChange={(event) =>
                  setForm((current) => ({ ...current, version: event.target.value }))
                }
                placeholder="1.0"
                required
              />
            </Field>
            <Field label="Effective date" htmlFor="routing-date">
              <input
                id="routing-date"
                className="input"
                type="date"
                value={form.effectiveDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, effectiveDate: event.target.value }))
                }
                required
              />
            </Field>
            <Field label="Status" htmlFor="routing-status">
              <select
                id="routing-status"
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

            <div style={{ gridColumn: '1 / -1' }}>
              <div className="section-head" style={{ marginBottom: 10 }}>
                <div>
                  <h3 className="section-title" style={{ fontSize: 15 }}>
                    Step proses
                  </h3>
                  <p className="section-sub">{form.steps.length} step</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus size={14} />}
                  onClick={addStep}
                  disabled={machines.length === 0}
                >
                  Tambah step
                </Button>
              </div>

              {form.steps.length === 0 ? (
                <Callout tone="info">
                  Belum ada step. Tambahkan minimal satu step proses sebelum menyimpan routing.
                </Callout>
              ) : (
                <div className="stack-sm">
                  {form.steps.map((step, index) => (
                    <div className="glass-inset" key={index} style={{ padding: 12 }}>
                      <div className="form-grid">
                        <Field label="Step" htmlFor={`step-number-${index}`}>
                          <input
                            id={`step-number-${index}`}
                            className="input mono"
                            value={index + 1}
                            disabled
                          />
                        </Field>
                        <Field label="Process" htmlFor={`step-process-${index}`}>
                          <input
                            id={`step-process-${index}`}
                            className="input"
                            value={step.process}
                            onChange={(event) =>
                              updateStep(index, { process: event.target.value })
                            }
                            placeholder="Contoh: Welding Assy"
                            required
                          />
                        </Field>
                        <Field label="Machine" htmlFor={`step-machine-${index}`}>
                          <select
                            id={`step-machine-${index}`}
                            className="select"
                            value={step.machine}
                            onChange={(event) =>
                              updateStep(index, { machine: event.target.value })
                            }
                            required
                          >
                            <option value="">Pilih machine</option>
                            {machines.map((machine) => (
                              <option key={machine.id} value={machine.code}>
                                {machine.code} — {machine.name}
                                {machine.status !== 'active' ? ` (${machine.status})` : ''}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Cycle time (detik)" htmlFor={`step-cycle-${index}`}>
                          <input
                            id={`step-cycle-${index}`}
                            className="input mono"
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={step.cycle}
                            onChange={(event) =>
                              updateStep(index, { cycle: Number(event.target.value) })
                            }
                            required
                          />
                        </Field>
                        <Field label="Status" htmlFor={`step-status-${index}`}>
                          <select
                            id={`step-status-${index}`}
                            className="select"
                            value={step.status}
                            onChange={(event) =>
                              updateStep(index, {
                                status: event.target.value as MasterStatus,
                              })
                            }
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </Field>
                        <div className="form-actions" style={{ alignSelf: 'end' }}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Hapus step ${index + 1}`}
                            onClick={() => removeStep(index)}
                          >
                            <Trash2 size={14} /> Hapus
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
              <Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" variant="primary" leftIcon={<Plus size={15} />} loading={saving}>
                {editingId ? 'Simpan perubahan' : 'Simpan routing'}
              </Button>
            </div>
          </form>
        </section>
      )}

      {selected ? (
        <>
          <section className="card">
            <div className="routing-head">
              <div>
                <h2 className="section-title">Routing aktif</h2>
                <p className="section-sub">Pilih part number dan versi untuk melihat urutan proses</p>
              </div>
              <div className="row row--wrap">
                <div className="select-wrap">
                  <select
                    className="select"
                    value={selected.id}
                    onChange={(event) => setSelectedId(event.target.value)}
                    aria-label="Pilih routing"
                  >
                    {routings.map((routing) => (
                      <option key={routing.id} value={routing.id}>
                        {routing.partNumber} · {routing.model} · v{routing.version}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openEditForm(selected)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busyId === selected.id}
                  onClick={() => void toggleStatus(selected)}
                >
                  {selected.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === selected.id}
                  onClick={() => void removeRouting(selected)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <div className="routing-steps" aria-label={`Urutan proses ${selected.partNumber}`}>
              {selected.steps.map((step, index) => (
                <div className="routing-step" key={`${selected.id}-${step.step}`}>
                  <span className="routing-step__num">{step.step}</span>
                  <strong>{step.process}</strong>
                  <span>{machineByCode.get(step.machine)?.name ?? step.machine}</span>
                  <div className="row row--between" style={{ marginTop: 9 }}>
                    <Badge tone="sky">{formatNumber(step.cycle)} s</Badge>
                    {index < selected.steps.length - 1 && (
                      <ArrowRight size={13} className="muted" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="row row--wrap" style={{ marginTop: 14, gap: 8 }}>
              <Badge tone={selected.status === 'active' ? 'success' : 'neutral'} dot>
                <CircleCheck size={11} />{' '}
                {selected.status === 'active' ? 'Routing aktif' : 'Routing inactive'}
              </Badge>
              <span className="muted small">
                Total cycle {formatNumber(totalCycle)} detik · output standar{' '}
                {Math.round(3600 / (totalCycle || 1))} pcs/jam
              </span>
            </div>
          </section>

          <div className="report-split">
            <section className="card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Detail step</h2>
                  <p className="section-sub">
                    {selected.partNumber} · {selected.model} · v{selected.version}
                  </p>
                </div>
              </div>
              <DataTable
                columns={stepColumns}
                rows={selected.steps}
                rowKey={(step) => String(step.step)}
                minWidth={640}
                compact
              />
            </section>

            <div style={{ display: 'grid', gap: 16 }}>
              <section className="card section-card">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">Informasi routing</h2>
                    <p className="section-sub">Ringkasan versi terpilih</p>
                  </div>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Part number</span>
                    <span className="info-value info-value--strong">{selected.partNumber}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Model</span>
                    <span className="info-value">{selected.model}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Versi</span>
                    <span className="info-value">
                      <Badge tone="orange">v{selected.version}</Badge>
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Effective date</span>
                    <span className="info-value">{formatDate(selected.effectiveDate)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Jumlah step</span>
                    <span className="info-value">{selected.steps.length} proses</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Terakhir diperbarui</span>
                    <span className="info-value">{formatDate(selected.updatedAt)}</span>
                  </div>
                </div>
              </section>
              <Callout tone="info" title="Cycle time aktual">
                Cycle time aktual dihitung otomatis dari selisih scan kanban antar stasiun. Gunakan
                halaman Reports → Production untuk analisis mendalam.
              </Callout>
            </div>
          </div>
        </>
      ) : (
        !loading && (
          <section className="card">
            <div className="empty-state">
              <div className="empty-state__icon">
                <Route size={22} />
              </div>
              <strong>Belum ada routing</strong>
              <p>Buat routing pertama setelah Part Number, Model, dan Machine terdaftar.</p>
            </div>
          </section>
        )
      )}
    </div>
  )
}
