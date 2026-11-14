import { Clock3, Gauge, RefreshCw, Timer } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { describeApiError } from '../../lib/api'
import {
  listParts,
  updatePart,
  type ProductionPartRecord,
} from '../../lib/masterApi'

interface CycleEdit {
  cycleTime: string
  cycleGroupId: string
}

function editFromPart(part: ProductionPartRecord): CycleEdit {
  return {
    cycleTime: part.cycleTime === null ? '' : String(part.cycleTime),
    cycleGroupId: part.cycleGroupId ?? '',
  }
}

function normalizeGroup(value: string): string | null {
  return value.trim().toUpperCase() || null
}

export function CycleTimePage() {
  const [parts, setParts] = useState<ProductionPartRecord[]>([])
  const [edits, setEdits] = useState<Record<string, CycleEdit>>({})
  const [loading, setLoading] = useState(true)
  const [savingPart, setSavingPart] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const nextParts = await listParts()
      setParts(nextParts)
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
    return parts.filter(
      (part) =>
        !needle ||
        part.partNumber.toLowerCase().includes(needle) ||
        part.process.toLowerCase().includes(needle) ||
        part.models.some((model) => model.toLowerCase().includes(needle)),
    )
  }, [parts, search])

  const configuredCount = parts.filter((part) => part.cycleTime !== null).length
  const groupedPartCount = parts.filter((part) => part.cycleGroupId).length

  const updateEdit = (partNumber: string, patch: Partial<CycleEdit>) => {
    setEdits((current) => ({
      ...current,
      [partNumber]: { ...(current[partNumber] ?? { cycleTime: '', cycleGroupId: '' }), ...patch },
    }))
  }

  const isDirty = (part: ProductionPartRecord): boolean => {
    const edit = edits[part.partNumber] ?? editFromPart(part)
    return (
      edit.cycleTime.trim() !== (part.cycleTime === null ? '' : String(part.cycleTime)) ||
      normalizeGroup(edit.cycleGroupId) !== part.cycleGroupId
    )
  }

  const saveRow = async (part: ProductionPartRecord) => {
    const edit = edits[part.partNumber] ?? editFromPart(part)
    const trimmed = edit.cycleTime.trim()
    const cycleTime = trimmed === '' ? null : Number(trimmed)
    if (cycleTime !== null && (!Number.isFinite(cycleTime) || cycleTime <= 0)) {
      setError('Cycle time harus berupa angka lebih besar dari 0 detik, atau kosongkan bila belum diatur.')
      return
    }

    setSavingPart(part.partNumber)
    setError('')
    setNotice('')
    try {
      const updated = await updatePart(part.partNumber, {
        cycleTime,
        cycleGroupId: normalizeGroup(edit.cycleGroupId),
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
      header: 'Kapasitas pcs/jam',
      align: 'right',
      render: (part) => {
        const edit = edits[part.partNumber] ?? editFromPart(part)
        const value = edit.cycleTime.trim() === '' ? part.cycleTime : Number(edit.cycleTime)
        return value && Number.isFinite(value) && value > 0 ? (
          <span className="mono">{`${(3600 / value).toFixed(1)} pcs`}</span>
        ) : (
          <Badge tone="warning">Belum diatur</Badge>
        )
      },
    },
    {
      key: 'cycleGroup',
      header: 'Kelompok mesin bergantian',
      render: (part) => {
        const edit = edits[part.partNumber] ?? editFromPart(part)
        return (
          <label className="row" style={{ gap: 7 }}>
            <input
              className="input mono"
              style={{ width: 150, minHeight: 34 }}
              value={edit.cycleGroupId}
              placeholder="Mandiri"
              aria-label={`Kelompok mesin bergantian ${part.partNumber}`}
              onChange={(event) =>
                updateEdit(part.partNumber, { cycleGroupId: event.target.value })
              }
            />
            {normalizeGroup(edit.cycleGroupId) && <Badge tone="orange">Kiri/kanan</Badge>}
          </label>
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
        subtitle="Cycle time disimpan per part di database dan dipakai Admin untuk memperkirakan beban kerja sebelum membagi permintaan hasil scan ke shift produksi."
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

      <Callout tone="info" title="Cycle time per pcs dan kelompok mesin">
        Isi waktu aktual dalam detik untuk menghasilkan satu pcs. Estimasi beban adalah jumlah pcs ×
        detik/pcs; tidak ada asumsi 45 menit per pallet. Untuk item yang berbagi mesin dengan urutan
        bergantian kiri/kanan, masukkan ID kelompok yang sama. Cycle time masing-masing tetap
        dihitung per pcs dan beban keduanya dijumlahkan pada sumber daya yang sama.
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
          label="Item dalam kelompok mesin"
          value={String(groupedPartCount)}
          suffix="PN"
          icon={Clock3}
          tone="orange"
          note="Berbagi sumber daya/urutan"
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
