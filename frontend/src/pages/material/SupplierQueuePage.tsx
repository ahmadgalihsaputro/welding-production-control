import { CheckCircle2, PackageCheck, RefreshCw, ScanLine, Truck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { describeApiError } from '../../lib/api'
import {
  listMaterialRequests,
  listScanDevices,
  listStock,
  scanKanban,
  updateMaterialRequestStatus,
  type MaterialRequestRecord,
  type ScanDeviceRecord,
  type StockItemRecord,
} from '../../lib/inventoryApi'
import { splitScanPrefix } from '../../lib/kanbanBarcode'
import { formatNumber } from '../../lib/utils'

export function SupplierQueuePage() {
  const { confirm } = useConfirmation()
  const [requests, setRequests] = useState<MaterialRequestRecord[]>([])
  const [stocks, setStocks] = useState<StockItemRecord[]>([])
  const [devices, setDevices] = useState<ScanDeviceRecord[]>([])
  const [pairingCode, setDeviceId] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const codeRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextRequests, nextStocks, nextDevices] = await Promise.all([
        listMaterialRequests({ kind: 'receiving', status: 'waiting' }),
        listStock(),
        listScanDevices(),
      ])
      setRequests(nextRequests.filter((request) => request.destination === 'Supplier'))
      setStocks(nextStocks)
      setDevices(nextDevices)
      setDeviceId((current) => current || nextDevices[0]?.pairingCode || '')
    } catch (loadError) {
      setError(describeApiError(loadError, 'Antrian supplier gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const categoryByPart = useMemo(
    () => new Map(stocks.map((stock) => [stock.partNumber, stock.category])),
    [stocks],
  )
  const totalQty = useMemo(
    () => requests.reduce((sum, request) => sum + request.boxes * request.pcsPerBox, 0),
    [requests],
  )

  const scan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (scanning) return

    const rawCode = code.trim()
    const { deviceCode } = splitScanPrefix(rawCode)
    const activePairingCode = deviceCode ?? pairingCode
    if (!rawCode) {
      setError('Kode scan tidak boleh kosong.')
      codeRef.current?.focus()
      return
    }
    if (!activePairingCode) {
      setError('Belum ada scanner online. Daftarkan dan hubungkan scanner di Device Management.')
      codeRef.current?.focus()
      return
    }

    setScanning(true)
    setError('')
    setNotice('')
    try {
      const result = await scanKanban({ code: rawCode, pairingCode: activePairingCode })
      const destination =
        result.destination === 'supplier'
          ? 'antrian supplier'
          : result.destination === 'assy'
            ? 'Antrian Assy'
            : 'Antrian Sub Assy'
      const quantity = result.request.boxes * result.request.pcsPerBox
      setNotice(`${result.request.partNumber} · ${formatNumber(quantity)} pcs masuk ${destination} via ${result.device} (${result.request.code}).`)
      setCode('')
      codeRef.current?.focus()
      await loadData()
    } catch (scanError) {
      setError(describeApiError(scanError, 'Scan kanban gagal disimpan.'))
    } finally {
      setScanning(false)
    }
  }

  const putIntoStock = async (request: MaterialRequestRecord) => {
    if (processingId) return
    setProcessingId(request.id)
    try {
      const quantity = request.boxes * request.pcsPerBox
      if (!(await confirm({
        title: 'Masukkan stok kanban?',
        message: `${formatNumber(quantity)} pcs ${request.partNumber} dari ${request.code} akan ditambahkan ke Store dan tercatat di Mutasi Stok.`,
        confirmLabel: 'Masukkan Stok',
      }))) return

      setError('')
      setNotice('')
      await updateMaterialRequestStatus(request.id, 'received')
      setNotice(`${request.code} selesai. Stok ${request.partNumber} bertambah ${formatNumber(quantity)} pcs.`)
      await loadData()
    } catch (stockError) {
      setError(describeApiError(stockError, 'Gagal memasukkan stok.'))
    } finally {
      setProcessingId(null)
    }
  }

  const columns: Column<MaterialRequestRecord>[] = [
    {
      key: 'part',
      header: 'Part Number',
      render: (request) => (
        <div className="cell-stack">
          <span className="cell-main mono">{request.partNumber}</span>
          <span className="cell-sub">{request.code}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Jenis',
      render: (request) => (
        <Badge tone="neutral">{categoryByPart.get(request.partNumber) ?? '—'}</Badge>
      ),
    },
    {
      key: 'qty',
      header: 'Qty kanban',
      align: 'right',
      render: (request) => `${formatNumber(request.boxes * request.pcsPerBox)} pcs`,
    },
    { key: 'requester', header: 'Discan oleh', render: (request) => request.requester },
    {
      key: 'time',
      header: 'Waktu scan',
      render: (request) => new Date(request.createdAt).toLocaleString('id-ID'),
    },
    {
      key: 'action',
      header: 'Aksi',
      render: (request) => (
        <Button
          variant="primary"
          size="sm"
          leftIcon={<CheckCircle2 size={14} />}
          loading={processingId === request.id}
          disabled={processingId !== null}
          onClick={() => void putIntoStock(request)}
        >
          Masukkan Stok
        </Button>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Inventory Control"
        title="Antrian Supplier"
        subtitle="Hasil scan scanner masuk ke sini otomatis. Tekan Masukkan Stok pada tiap kanban untuk menambah saldo Store dan catatan Mutasi Stok."
        meta={<span className="page-meta__item"><Truck size={12} /> {requests.length} kanban menunggu</span>}
        actions={
          <Button variant="secondary" leftIcon={<RefreshCw size={15} />} loading={loading} onClick={() => void loadData()}>
            Muat ulang
          </Button>
        }
      />

      {error && <Callout tone="danger" title="Aksi gagal">{error}</Callout>}
      {notice && (
        <div role="status" aria-live="polite">
          <Callout tone="success">{notice}</Callout>
        </div>
      )}

      <div className="kpi-grid kpi-grid--3">
        <StatCard label="Kanban antrian" value={String(requests.length)} suffix="kanban" icon={PackageCheck} tone="orange" note="Menunggu masuk stok" />
        <StatCard label="Total qty" value={formatNumber(totalQty)} suffix="pcs" icon={Truck} tone="sky" note="Belum masuk stok" />
        <StatCard label="Part terdaftar" value={String(stocks.length)} suffix="PN" icon={ScanLine} tone="green" note="Semua kategori" />
      </div>

      <section className="card" aria-labelledby="supplier-manual-scan-title">
        <div className="section-head">
          <div>
            <h2 id="supplier-manual-scan-title" className="section-title">Input kanban manual (cadangan)</h2>
            <p className="section-sub">Scanner yang sudah dipasangkan mengirim scan otomatis. Gunakan form ini hanya saat scan otomatis belum tersedia. QR part number polos dibaca sebagai 1 box; Assy/Sub Assy dialihkan ke antrean produksi.</p>
          </div>
          {devices.length > 0 ? (
            <Badge tone="success">{devices.length} scanner online</Badge>
          ) : (
            <Badge tone="warning">Belum ada scanner online</Badge>
          )}
        </div>
        <form className="form-grid" aria-labelledby="supplier-manual-scan-title" onSubmit={(event) => void scan(event)}>
          <Field
            label="Scanner (cadangan)"
            htmlFor="supplier-scan-device"
            hintId="supplier-scan-device-hint"
            hint="Kode pairing pada barcode terdeteksi otomatis. Pilih scanner hanya saat input manual."
          >
            <select
              id="supplier-scan-device"
              name="pairingCode"
              className="select"
              value={pairingCode}
              onChange={(event) => setDeviceId(event.target.value)}
              aria-describedby="supplier-scan-device-hint"
            >
              <option value="">Otomatis dari prefix barcode…</option>
              {devices.map((device) => (
                <option key={device.pairingCode} value={device.pairingCode}>
                  {device.name} — {device.location} ({device.pairingCode})
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Kode hasil scan"
            htmlFor="supplier-scan-code"
            hintId="supplier-scan-code-hint"
            hint="Contoh: SCN-F5C46105|4650C745 atau 4650C745."
          >
            <input
              ref={codeRef}
              id="supplier-scan-code"
              name="code"
              className="input"
              value={code}
              onChange={(event) => {
                setCode(event.target.value)
                if (error) setError('')
              }}
              placeholder="Tempel atau scan barcode di sini…"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby="supplier-scan-code-hint"
              required
            />
          </Field>
          <div className="form-actions" style={{ alignSelf: 'end' }}>
            <Button
              type="submit"
              variant="primary"
              loading={scanning}
              disabled={processingId !== null}
              leftIcon={<ScanLine size={15} />}
            >
              Input kanban
            </Button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Menunggu masuk stok</h2>
            <p className="section-sub">Satu baris = satu kanban hasil scan. Tombol Masukkan Stok tersedia di setiap baris.</p>
          </div>
          <Badge tone="orange">{requests.length} kanban</Badge>
        </div>
        <DataTable
          columns={columns}
          rows={requests}
          rowKey={(request) => request.id}
          minWidth={900}
          emptyMessage={loading ? 'Memuat antrian…' : 'Belum ada kanban yang discan.'}
        />
      </section>
    </div>
  )
}
