import { Clock3, Gauge, RefreshCw, Timer } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { describeApiError } from '../../lib/api'
import {
  listMachines,
  listParts,
  updatePart,
  type MachineRecord,
  type ProductionPartRecord,
} from '../../lib/masterApi'

interface CycleEdit {
  cycleTime: string
}

function editFromPart(part: ProductionPartRecord): CycleEdit {
  return {
    cycleTime: part.cycleTime === null ? '' : String(part.cycleTime),
  }
}

export function CycleTimePage() {
  const { confirm } = useConfirmation()
  const [parts, setParts] = useState<ProductionPartRecord[]>([])
  const [machines, setMachines] = useState<MachineRecord[]>([])
  const [edits, setEdits] = useState<Record<string, CycleEdit>>({})
  const [loading, setLoading] = useState(true)
  const [savingPart, setSavingPart] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [lineFilter, setLineFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [modelFilter, setModelFilter] = useState('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextParts, nextMachines] = await Promise.all([listParts(), listMachines()])
      setParts(nextParts)
      setMachines(nextMachines)
      setEdits(Object.fromEntries(nextParts.map((part) => [part.partNumber, editFromPart(part)])))
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data cycle time gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return parts.filter((part) => part.type === 'Assy' || part.type === 'Sub_Assy').filter((part) => {
      const matchesFilters =
        (lineFilter === 'all' || part.line === lineFilter) &&
        (typeFilter === 'all' || part.type === typeFilter) &&
        (modelFilter === 'all' || part.models.includes(modelFilter))
      const matchesSearch =
        !needle ||
        part.partNumber.toLowerCase().includes(needle) ||
        part.process.toLowerCase().includes(needle) ||
        part.models.some((model) => model.toLowerCase().includes(needle))
      return matchesFilters && matchesSearch
    })
  }, [parts, search, lineFilter, typeFilter, modelFilter])

  const productionParts = parts.filter((part) => part.type === 'Assy' || part.type === 'Sub_Assy')
  const configuredCount = productionParts.filter((part) => part.cycleTime !== null).length
  const lines = [...new Set([...machines.map((machine) => machine.line), ...productionParts.map((part) => part.line)])].sort()
  const models = [...new Set(productionParts.flatMap((part) => part.models))].sort()

  const updateEdit = (partNumber: string, patch: Partial<CycleEdit>) => {
    setEdits((current) => ({
      ...current,
      [partNumber]: { ...(current[partNumber] ?? { cycleTime: '' }), ...patch },
    }))
  }

  const isDirty = (part: ProductionPartRecord): boolean => {
    const edit = edits[part.partNumber] ?? editFromPart(part)
    return edit.cycleTime.trim() !== (part.cycleTime === null ? '' : String(part.cycleTime))
  }

  const saveRow = async (part: ProductionPartRecord) => {
    const edit = edits[part.partNumber] ?? editFromPart(part)
    const trimmed = edit.cycleTime.trim()
    const cycleTime = trimmed === '' ? null : Number(trimmed)
    if (cycleTime !== null && (!Number.isFinite(cycleTime) || cycleTime <= 0)) {
      setError('Cycle time harus berupa angka lebih besar dari 0 detik, atau kosongkan bila belum diatur.')
      return
    }
    const confirmed = await confirm({
      title: 'Konfirmasi perubahan cycle time',
      message: `Simpan cycle time ${cycleTime === null ? 'kosong' : `${cycleTime} detik`} untuk ${part.partNumber}?`,
      confirmLabel: 'Simpan perubahan',
    })
    if (!confirmed) return

    setSavingPart(part.partNumber)
    setError('')
    setNotice('')
    try {
      const updated = await updatePart(part.partNumber, {
        cycleTime,
      })
      setParts((current) =>
        current.map((item) => (item.partNumber === updated.partNumber ? updated : item)),
      )
      setEdits((current) => ({ ...current, [updated.partNumber]: editFromPart(updated) }))
      setNotice(`Cycle time ${updated.partNumber} tersimpan di database.`)
    } catch (saveError) {
      setError(describeApiError(saveError, 'Cycle time gagal disimpan.'))
    } finally {
      setSavingPart(null)
    }
  }

  const resetRow = (part: ProductionPartRecord) => {
    setEdits((current) => ({ ...current, [part.partNumber]: editFromPart(part) }))
  }

  const columns: Column<ProductionPartRecord>[] = [
    {
      key: 'part',
      header: 'Part Number',
      render: (part) => (
        <div className="cell-stack">
          <span className="cell-main mono">{part.partNumber}</span>
          <span className="cell-sub">
            {part.type === 'Sub_Assy' ? 'Sub Assy' : 'Assy'} · {part.process}
          </span>
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
      key: 'cycle',
      header: 'Cycle time (detik/pcs)',
      align: 'right',
      render: (part) => {
        const edit = edits[part.partNumber] ?? editFromPart(part)
        return (
          <label className="row" style={{ justifyContent: 'flex-end', gap: 7 }}>
            <input
              className="input mono"
              style={{ width: 110, minHeight: 34, textAlign: 'right' }}
              type="number"
              min="0.1"
              step="0.1"
              aria-label={`Cycle time ${part.partNumber} dalam detik per pcs`}
              value={edit.cycleTime}
              onChange={(event) => updateEdit(part.partNumber, { cycleTime: event.target.value })}
            />
            <span className="muted small">s/pcs</span>
          </label>
        )
      },
    },
    {
      key: 'capacity',
      header: 'Target item/jam (85%)',
      align: 'right',
      render: (part) => {
        const edit = edits[part.partNumber] ?? editFromPart(part)
        const value = edit.cycleTime.trim() === '' ? null : Number(edit.cycleTime)
        return value && Number.isFinite(value) && value > 0 ? (
          <span className="mono">{`${Math.round((3600 / value) * 0.85)} item`}</span>
        ) : (
          <Badge tone="warning">Belum diatur</Badge>
        )
      },
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (part) => (
        <div className="table-actions">
          <Button
            size="sm"
            variant="primary"
            loading={savingPart === part.partNumber}
            disabled={!isDirty(part)}
            onClick={() => void saveRow(part)}
          >
            Simpan
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!isDirty(part) || savingPart === part.partNumber}
            onClick={() => resetRow(part)}
          >
            Batal
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data · Robot G & H"
        title="Cycle Time & Capacity"
        subtitle="Target item per jam dihitung dari cycle time dengan efisiensi 85%: 3600 ÷ cycle time (detik) × 0,85."
        meta={
          <span className="page-meta__item">
            <Clock3 size={12} /> {parts.length} PN Assy/Sub Assy
          </span>
        }
        actions={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw size={15} />}
            loading={loading}
            onClick={() => void loadData()}
          >
            Muat ulang
          </Button>
        }
      />

      {error && (
        <Callout tone="danger" title="Gagal menyimpan cycle time">
          {error}
        </Callout>
      )}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && parts.length === 0 && (
        <Callout tone="info">Memuat data cycle time dari server…</Callout>
      )}

      <Callout tone="info" title="Perhitungan target per jam">
        Isi cycle time dalam detik per item. Target item per jam = 3600 ÷ cycle time × 0,85.
      </Callout>

      <div className="kpi-grid">
        <StatCard
          label="Part terdaftar"
          value={String(parts.length)}
          suffix="PN"
          icon={Gauge}
          tone="sky"
          note="Robot G/H · Assy & Sub Assy"
        />
        <StatCard
          label="Cycle time tersedia"
          value={String(configuredCount)}
          suffix="PN"
          icon={Timer}
          tone="green"
          note="Siap dihitung beban kerjanya"
        />
        <StatCard
          label="Line terdaftar"
          value={String(lines.length)}
          suffix="line"
          icon={Clock3}
          tone="orange"
          note="Filter berdasarkan line"
        />
        <StatCard
          label="Belum diatur"
          value={String(parts.length - configuredCount)}
          suffix="PN"
          icon={Clock3}
          tone="amber"
          note="Belum dapat diestimasi"
        />
      </div>

      <section className="card">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <select
              className="select"
              style={{ width: 150, height: 38, minHeight: 38 }}
              value={lineFilter}
              onChange={(event) => setLineFilter(event.target.value)}
              aria-label="Filter line"
            >
              <option value="all">Semua line</option>
              {lines.map((line) => <option key={line} value={line}>{line}</option>)}
            </select>
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
            <select
              className="select"
              style={{ width: 150, height: 38, minHeight: 38 }}
              value={modelFilter}
              onChange={(event) => setModelFilter(event.target.value)}
              aria-label="Filter project atau model"
            >
              <option value="all">Semua project / model</option>
              {models.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari PN, proses, atau model…"
            className="search-inline"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(part) => part.partNumber}
          minWidth={1050}
          footer={
            <span className="muted small">
              Perubahan disimpan ke database setelah menekan Simpan pada baris terkait.
            </span>
          }
        />
      </section>
    </div>
  )
}
