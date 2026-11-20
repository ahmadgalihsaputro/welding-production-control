import { Barcode, Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { FormDialog } from '../../components/ui/FormDialog'
import { PageHeader } from '../../components/ui/PageHeader'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { describeApiError } from '../../lib/api'
import {
  createKanbanPartConfig,
  deleteKanbanPartConfig,
  listDevices,
  listInventoryLocations,
  listKanbanPartConfigs,
  listMachines,
  listParts,
  listRoutings,
  listStockPolicy,
  updateKanbanPartConfig,
  type DeviceRecord,
  type InventoryLocationRecord,
  type KanbanPartConfigInput,
  type KanbanPartConfigRecord,
  type MachineRecord,
  type ProductionPartRecord,
  type RoutingRecord,
  type StockPolicyRecord,
} from '../../lib/masterApi'

interface KanbanForm {
  id: string | null
  partNumber: string
  model: string
  quantity: string
  storeLocation: string
  kanbanType: 'KD' | 'Reguler'
  nextProcess: string
  printerId: string
}

function emptyForm(): KanbanForm {
  return {
    id: null,
    partNumber: '',
    model: '',
    quantity: '',
    storeLocation: '',
    kanbanType: 'Reguler',
    nextProcess: '',
    printerId: '',
  }
}

function inputFromForm(form: KanbanForm): KanbanPartConfigInput {
  return {
    partNumber: form.partNumber,
    model: form.model,
    quantity: Number(form.quantity),
    storeLocation: form.storeLocation,
    kanbanType: form.kanbanType,
    nextProcess: form.nextProcess,
    printerId: form.printerId || null,
  }
}

export function KanbanConfigPage() {
  const { confirm } = useConfirmation()
  const [configs, setConfigs] = useState<KanbanPartConfigRecord[]>([])
  const [parts, setParts] = useState<ProductionPartRecord[]>([])
  const [locations, setLocations] = useState<InventoryLocationRecord[]>([])
  const [machines, setMachines] = useState<MachineRecord[]>([])
  const [routings, setRoutings] = useState<RoutingRecord[]>([])
  const [stockItems, setStockItems] = useState<StockPolicyRecord[]>([])
  const [devices, setDevices] = useState<DeviceRecord[]>([])
  const [form, setForm] = useState<KanbanForm | null>(null)
  const [previewConfig, setPreviewConfig] = useState<KanbanPartConfigRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const activeParts = useMemo(
    () => parts.filter((part) => part.status === 'active' && !part.placeholder),
    [parts],
  )
  const printers = useMemo(
    () => devices.filter((device) => device.type === 'Printer'),
    [devices],
  )
  const selectedPart = activeParts.find((part) => part.partNumber === form?.partNumber)
  const selectedStock = stockItems.find((stock) => stock.partNumber === selectedPart?.partNumber)
  const standardQuantity = selectedPart?.packaging ?? selectedStock?.packaging ?? null
  const previewPart = activeParts.find((part) => part.partNumber === previewConfig?.partNumber)
  const previewPayload = previewConfig && previewPart
    ? JSON.stringify({
        version: 1,
        preview: true,
        partNumber: previewConfig.partNumber,
        line: previewPart.line,
        qty: previewConfig.quantity,
        model: previewConfig.model,
        storeLocation: previewConfig.storeLocation,
        kanbanType: previewConfig.kanbanType,
        partType: previewPart.type,
        process: previewPart.process,
        nextProcess: previewConfig.nextProcess,
      })
    : ''
  const nextProcesses = useMemo(
    () =>
      Array.from(
        new Set([
          ...parts
            .filter((part) => part.type === 'Assy' || part.type === 'Sub_Assy')
            .map((part) => part.process),
          ...machines
            .filter((machine) => machine.status === 'active')
            .flatMap((machine) => [machine.line, ...machine.processes]),
        ]),
      ).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [parts, machines],
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextConfigs, nextParts, nextLocations, nextMachines, nextRoutings, nextStockItems, nextDevices] = await Promise.all([
        listKanbanPartConfigs(),
        listParts({ status: 'active' }),
        listInventoryLocations(),
        listMachines(),
        listRoutings(),
        listStockPolicy(),
        listDevices(),
      ])
      setConfigs(nextConfigs)
      setParts(nextParts)
      setLocations(nextLocations)
      setMachines(nextMachines)
      setRoutings(nextRoutings)
      setStockItems(nextStockItems)
      setDevices(nextDevices)
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data konfigurasi Kanban gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const startAdd = () => {
    setForm(emptyForm())
    setPreviewConfig(null)
    setError('')
    setNotice('')
  }

  const startEdit = (config: KanbanPartConfigRecord) => {
    setForm({
      id: config.id,
      partNumber: config.partNumber,
      model: config.model,
      quantity: String(config.quantity),
      storeLocation: config.storeLocation,
      kanbanType: config.kanbanType,
      nextProcess: config.nextProcess,
      printerId: config.printerId ?? '',
    })
    setError('')
    setNotice('')
  }

  const selectPart = (partNumber: string) => {
    const part = activeParts.find((item) => item.partNumber === partNumber)
    const model = part?.models[0] ?? ''
    const route = routings
      .filter((item) => item.partNumber === partNumber && item.model === model && item.status === 'active')
      .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0]
    const steps = route?.steps.slice().sort((left, right) => left.step - right.step) ?? []
    const currentStepIndex = steps.findIndex((step) => step.process === part?.process)
    const nextProcess = currentStepIndex >= 0
      ? steps[currentStepIndex + 1]?.process ?? ''
      : steps[0]?.process ?? ''
    const defaultLocation = locations.find(
      (location) => location.status === 'active' && location.line === part?.line,
    ) ?? locations.find((location) => location.status === 'active')
    setForm((current) => current ? {
      ...current,
      partNumber,
      model,
      quantity: String(part?.packaging ?? stockItems.find((stock) => stock.partNumber === partNumber)?.packaging ?? ''),
      storeLocation: defaultLocation?.code ?? '',
      nextProcess,
    } : current)
  }

  const saveConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return
    const input = {
      ...inputFromForm(form),
      quantity: standardQuantity ?? 0,
    }
    if (
      !input.partNumber ||
      !input.model ||
      !Number.isInteger(input.quantity) ||
      input.quantity < 1 ||
      !input.storeLocation ||
      !input.nextProcess
    ) {
      setError('PN, model, jumlah, store location, dan next process wajib diisi dengan benar.')
      return
    }
    const action = form.id ? 'Simpan perubahan' : 'Tambahkan konfigurasi'
    if (!(await confirm({
      title: 'Konfirmasi konfigurasi Kanban',
      message: `${action} untuk PN ${input.partNumber} model ${input.model}?`,
      confirmLabel: action,
    }))) return

    setSaving(true)
    setError('')
    setNotice('')
    try {
      const saved = form.id
        ? await updateKanbanPartConfig(form.id, input)
        : await createKanbanPartConfig(input)
      setForm(null)
      setPreviewConfig(saved)
      setNotice(`Konfigurasi Kanban ${saved.partNumber} · ${saved.model} berhasil disimpan.`)
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Konfigurasi Kanban gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const removeConfig = async (config: KanbanPartConfigRecord) => {
    if (!(await confirm({
      title: 'Hapus konfigurasi Kanban?',
      message: `Hapus konfigurasi ${config.partNumber} · ${config.model}?`,
      confirmLabel: 'Hapus',
      tone: 'danger',
    }))) return
    setError('')
    setNotice('')
    try {
      await deleteKanbanPartConfig(config.id)
      setConfigs((current) => current.filter((item) => item.id !== config.id))
      setNotice(`Konfigurasi ${config.partNumber} · ${config.model} dihapus.`)
    } catch (deleteError) {
      setError(describeApiError(deleteError, 'Konfigurasi Kanban gagal dihapus.'))
    }
  }

  const columns: Column<KanbanPartConfigRecord>[] = [
    {
      key: 'part',
      header: 'Part Number',
      render: (config) => (
        <div className="cell-stack">
          <strong className="cell-main mono">{config.partNumber}</strong>
          <span className="cell-sub">{config.model}</span>
        </div>
      ),
    },
    { key: 'line', header: 'Line', render: (config) => config.line },
    { key: 'process', header: 'Line Proses', render: (config) => config.process },
    {
      key: 'partType',
      header: 'Jenis',
      render: (config) => <Badge tone={config.partType === 'Assy' ? 'sky' : 'orange'}>{config.partType === 'Sub_Assy' ? 'Sub Assy' : config.partType}</Badge>,
    },
    { key: 'quantity', header: 'Qty / Kanban', align: 'right', render: (config) => `${config.quantity} pcs` },
    { key: 'location', header: 'Store Location', render: (config) => config.storeLocation },
    { key: 'kanbanType', header: 'Tipe', render: (config) => <Badge tone={config.kanbanType === 'KD' ? 'orange' : 'neutral'}>{config.kanbanType}</Badge> },
    { key: 'nextProcess', header: 'Next Process', render: (config) => config.nextProcess },
    {
      key: 'printer',
      header: 'Printer',
      render: (config) => config.printer
        ? (
          <div className="cell-stack">
            <span className="cell-main">{config.printer.name}</span>
            <span className="cell-sub">{config.printer.model ?? 'Model belum diisi'}</span>
          </div>
        )
        : <span className="muted small">Belum ditentukan</span>,
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      render: (config) => (
        <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
          <Button size="sm" variant="secondary" leftIcon={<Pencil size={12} />} onClick={() => startEdit(config)}>Edit</Button>
          <Button size="sm" variant="danger" leftIcon={<Trash2 size={12} />} onClick={() => void removeConfig(config)}>Hapus</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Kanban Configuration"
        subtitle="Satu konfigurasi per PN dan model. Barcode berisi data Kanban yang sama; operator dan shift dicatat saat cetak."
        meta={<span className="page-meta__item"><Barcode size={12} /> {configs.length} konfigurasi</span>}
        actions={
          <>
            <Button variant="secondary" leftIcon={<RefreshCw size={15} />} loading={loading} onClick={() => void loadData()}>
              Muat ulang
            </Button>
            <Button variant="primary" leftIcon={<Plus size={15} />} onClick={startAdd}>
              Tambah Kanban
            </Button>
          </>
        }
      />

      {error && <Callout tone="danger" title="Aksi gagal">{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && configs.length === 0 && <Callout tone="info">Memuat konfigurasi Kanban…</Callout>}

      {form && (
        <FormDialog
          open={Boolean(form)}
          onClose={() => setForm(null)}
          titleId="kanban-form-title"
          title={form.id ? 'Ubah Kanban' : 'Tambah Kanban'}
          subtitle="PN, model, line, dan jenis mengikuti Master Part."
          badge={<Badge tone="success">Data tersinkron</Badge>}
        >
          {error && <Callout tone="danger" title="Aksi gagal">{error}</Callout>}
          <form className="form-grid" onSubmit={(event) => void saveConfig(event)}>
            <Field label="Part Number" htmlFor="kanban-part-number">
              <select
                id="kanban-part-number"
                autoFocus
                className="select"
                value={form.partNumber}
                onChange={(event) => selectPart(event.target.value)}
                required
              >
                <option value="">Pilih part number</option>
                {activeParts.map((part) => (
                  <option key={part.partNumber} value={part.partNumber}>
                    {part.partNumber} · {part.line} / {part.process} · {part.type === 'Sub_Assy' ? 'Sub Assy' : part.type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Model" htmlFor="kanban-model">
              <select
                id="kanban-model"
                className="select"
                value={form.model}
                onChange={(event) => {
                  const model = event.target.value
                  const route = routings
                    .filter((item) => item.partNumber === form.partNumber && item.model === model && item.status === 'active')
                    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0]
                  const steps = route?.steps.slice().sort((left, right) => left.step - right.step) ?? []
                  const currentStepIndex = steps.findIndex((step) => step.process === selectedPart?.process)
                  const nextProcess = currentStepIndex >= 0
                    ? steps[currentStepIndex + 1]?.process ?? ''
                    : steps[0]?.process ?? ''
                  setForm((current) => current ? { ...current, model, nextProcess } : current)
                }}
                required
                disabled={!selectedPart}
              >
                <option value="">Pilih model</option>
                {selectedPart?.models.map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
            </Field>
            <Field label="Line produksi" htmlFor="kanban-line" hint="Mengikuti Master Part.">
              <input id="kanban-line" className="input" value={selectedPart?.line ?? ''} readOnly placeholder="Pilih part number" />
            </Field>
            <Field label="Line proses" htmlFor="kanban-process" hint="Mengikuti Master Part.">
              <input id="kanban-process" className="input" value={selectedPart?.process ?? ''} readOnly placeholder="Pilih part number" />
            </Field>
            <Field label="Qty per Kanban (pcs)" htmlFor="kanban-quantity" hint="Otomatis dari isi standar wadah di Master Part / Packaging & Policy.">
              <input id="kanban-quantity" className="input" value={standardQuantity ?? ''} readOnly placeholder="Atur isi standar wadah di Master Part" />
            </Field>
            <Field label="Operator" hint="Diisi otomatis dari akun saat Kanban dicetak.">
              <input className="input" value="Otomatis saat cetak" readOnly />
            </Field>
            <Field label="Shift" hint="Mengikuti shift operator saat cetak.">
              <input className="input" value="Otomatis saat cetak" readOnly />
            </Field>
            <Field label="Store Location" htmlFor="kanban-store-location">
              <select
                id="kanban-store-location"
                className="select"
                value={form.storeLocation}
                onChange={(event) => setForm((current) => current ? { ...current, storeLocation: event.target.value } : current)}
                required
              >
                <option value="">Pilih lokasi</option>
                {locations.filter((location) => location.status === 'active').map((location) => (
                  <option key={location.id} value={location.code}>{location.code} · {location.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Tipe Kanban" htmlFor="kanban-type">
              <select
                id="kanban-type"
                className="select"
                value={form.kanbanType}
                onChange={(event) => setForm((current) => current ? {
                  ...current,
                  kanbanType: event.target.value === 'KD' ? 'KD' : 'Reguler',
                } : current)}
              >
                <option value="Reguler">Reguler · lokal</option>
                <option value="KD">KD · ekspor</option>
              </select>
            </Field>
            <Field label="Next Process" htmlFor="kanban-next-process" hint="Proses/line tujuan berikutnya untuk part ini.">
              <select
                id="kanban-next-process"
                className="select"
                value={form.nextProcess}
                onChange={(event) => setForm((current) => current ? { ...current, nextProcess: event.target.value } : current)}
                required
              >
                <option value="">Pilih proses berikutnya</option>
                {nextProcesses.map((process) => <option key={process} value={process}>{process}</option>)}
              </select>
            </Field>
            <Field label="Printer Kanban" htmlFor="kanban-printer" hint="Terhubung ke Device Management. Kosongkan jika dicetak di printer default.">
              <select
                id="kanban-printer"
                className="select"
                value={form.printerId}
                onChange={(event) => setForm((current) => current ? { ...current, printerId: event.target.value } : current)}
              >
                <option value="">Ikuti printer default</option>
                {printers.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {printer.name}{printer.model ? ` · ${printer.model}` : ''} · {printer.status}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
              <Button type="button" variant="secondary" onClick={() => setForm(null)} disabled={saving}>Batal</Button>
              <Button type="submit" variant="primary" loading={saving}>Simpan Kanban</Button>
            </div>
          </form>
          {selectedPart && (
            <div className="kanban-config-preview">
              <div>
                <h3>Preview Kanban</h3>
                <p>Data line, model, dan jumlah mengikuti Master Part. QR final dibuat saat cetak produksi.</p>
              </div>
              <div className="kanban-config-preview__label">
                <div className="kanban-config-preview__heading">
                  <strong>WPC · KANBAN</strong>
                  <Badge tone={form.kanbanType === 'KD' ? 'orange' : 'neutral'}>{form.kanbanType}</Badge>
                </div>
                <h4>{selectedPart.partNumber}</h4>
                <div className="kanban-config-preview__details">
                  <span><small>Line produksi</small><strong>{selectedPart.line}</strong></span>
                  <span><small>Line proses</small><strong>{selectedPart.process}</strong></span>
                  <span><small>Jenis</small><strong>{selectedPart.type.replace('_', ' ')}</strong></span>
                  <span><small>Qty</small><strong>{standardQuantity ? `${standardQuantity} pcs` : 'Belum diatur'}</strong></span>
                  <span><small>Model</small><strong>{form.model || 'Pilih model'}</strong></span>
                  <span><small>Lokasi</small><strong>{form.storeLocation || 'Pilih lokasi'}</strong></span>
                  <span><small>Next Process</small><strong>{form.nextProcess || 'Pilih proses'}</strong></span>
                  <span><small>Printer</small><strong>{printers.find((printer) => printer.id === form.printerId)?.name ?? 'Printer default'}</strong></span>
                </div>
              </div>
            </div>
          )}
        </FormDialog>
      )}

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Daftar Kanban</h2>
            <p className="section-sub">Operator dan shift akan tercantum pada payload saat Kanban hasil produksi dicetak.</p>
          </div>
          <Badge tone="neutral">{configs.length} data</Badge>
        </div>
        <DataTable
          columns={[
            ...columns.slice(0, -1),
            {
              key: 'preview',
              header: 'Preview',
              align: 'right',
              render: (config) => (
                <Button size="sm" variant="secondary" leftIcon={<Eye size={12} />} onClick={() => setPreviewConfig(config)}>
                  Lihat
                </Button>
              ),
            },
            columns[columns.length - 1],
          ]}
          rows={configs}
          rowKey={(config) => config.id}
          minWidth={1080}
          emptyMessage={loading ? 'Memuat data…' : 'Belum ada konfigurasi Kanban.'}
        />
      </section>

      {previewConfig && previewPart && (
      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Preview {previewConfig.partNumber}</h2>
            <p className="section-sub">QR pada layar ini hanya contoh; QR valid dibuat dengan operator dan shift saat cetak produksi.</p>
          </div>
          <Button variant="secondary" onClick={() => setPreviewConfig(null)}>Tutup preview</Button>
        </div>
        <div className="kanban-config-preview__saved">
          <div className="kanban-config-preview__label">
            <div className="kanban-config-preview__heading"><strong>WPC · KANBAN</strong><Badge tone={previewConfig.kanbanType === 'KD' ? 'orange' : 'neutral'}>{previewConfig.kanbanType}</Badge></div>
            <h4>{previewConfig.partNumber}</h4>
            <div className="kanban-config-preview__details">
              <span><small>Line produksi</small><strong>{previewConfig.line}</strong></span>
              <span><small>Line proses</small><strong>{previewConfig.process}</strong></span>
              <span><small>Jenis</small><strong>{previewConfig.partType.replace('_', ' ')}</strong></span>
              <span><small>Qty</small><strong>{previewConfig.quantity} pcs</strong></span>
              <span><small>Model</small><strong>{previewConfig.model}</strong></span>
              <span><small>Lokasi</small><strong>{previewConfig.storeLocation}</strong></span>
              <span><small>Next Process</small><strong>{previewConfig.nextProcess}</strong></span>
              <span><small>Printer</small><strong>{previewConfig.printer?.name ?? 'Printer default'}</strong></span>
            </div>
            <div className="kanban-config-preview__qr">
              <QRCodeSVG value={previewPayload} size={160} level="M" />
              <span>QR preview · tidak berlaku untuk scan produksi</span>
            </div>
          </div>
        </div>
      </section>
      )}

      <Callout tone="info" title="Barcode tanpa nomor cetak unik">
        Barcode membawa PN, line, jumlah, operator, shift, model, lokasi, tipe KD/Reguler, jenis part, proses, dan next process. Cetakan dengan data yang sama memakai payload yang sama.
      </Callout>
    </div>
  )
}
