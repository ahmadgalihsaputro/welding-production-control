import { ArrowLeft, CheckCircle2, PackageCheck, ScanBarcode, ScanLine, Warehouse } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../../components/brand/Logo'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { useQueue } from '../../contexts/QueueContext'
import { parseKanbanBarcode, scannedKanbanFromPayload } from '../../lib/kanbanBarcode'
import { formatNumber } from '../../lib/utils'
import type { ScannedKanban } from '../../types'

interface ScanFeedback {
  ok: boolean
  text: string
  scan?: ScannedKanban
  sourceShift?: number
  line?: string
}

export function SupplyScanPage() {
  const { requests, addFromScan } = useQueue()
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const pendingRequests = requests.filter((request) => request.status === 'pending')
  const assyCount = pendingRequests.filter((item) => item.type === 'Assy').length
  const subAssyCount = pendingRequests.filter((item) => item.type === 'Sub Assy').length

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const rawCode = code.trim()
    if (!rawCode) {
      setFeedback({ ok: false, text: 'Scan atau masukkan kode kanban terlebih dahulu.' })
      return
    }

    const payload = parseKanbanBarcode(rawCode)
    if (!payload) {
      setFeedback({
        ok: false,
        text: 'Barcode tidak berisi payload Kanban yang valid. Pastikan scan barcode yang dicetak dari sistem.',
      })
      return
    }
    const scan = scannedKanbanFromPayload(rawCode, payload)

    setSubmitting(true)
    try {
      const result = await addFromScan(scan)
      if (!result.ok || !result.request) {
        setFeedback({ ok: false, text: result.error ?? 'Kanban gagal masuk antrian.' })
        return
      }

      setFeedback({
        ok: true,
        text: `Permintaan ${scan.partNumber} masuk antrean line ${result.request.line}. Admin menentukan shift produksinya.`,
        scan,
        sourceShift: result.request.sourceShift,
        line: result.request.line,
      })
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell auth-shell--simple">
      <section className="auth-panel">
        <div className="auth-card glass glass--strong supply-scan-card">
          <div className="auth-card__brand auth-card__brand--stack">
            <BrandMark size="lg" />
            <strong>WPC</strong>
            <span>Welding Production Control</span>
          </div>

          <div className="supply-scan-head">
            <span className="supply-scan-kicker">
              <ScanLine size={13} /> Supply Scan Station · Terhubung ke server
            </span>
            <h2>Scan Kanban</h2>
            <p>
              Scan barcode Kanban. Sistem membaca PN, model, line, jumlah, tipe, proses, operator, dan shift dari payload barcode.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label" htmlFor="kanban-code">
                Kode Kanban
              </label>
              <div className="input-wrap">
                <ScanBarcode size={16} className="input-wrap__icon" />
                <input
                  id="kanban-code"
                  className="input"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Scan barcode Kanban"
                  autoComplete="off"
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              disabled={submitting}
              leftIcon={<ScanLine size={16} />}
            >
              {submitting ? 'Mengirim…' : 'Scan & Kirim ke Admin'}
            </Button>
          </form>

          {feedback && (
            <div
              className={`supply-scan-feedback${feedback.ok ? ' is-success' : ' is-error'}`}
              role={feedback.ok ? 'status' : 'alert'}
            >
              <span className="supply-scan-feedback__icon">
                {feedback.ok ? <CheckCircle2 size={20} /> : <ScanLine size={20} />}
              </span>
              <div>
                <strong>{feedback.ok ? 'Kanban diterima' : 'Scan gagal'}</strong>
                <p>{feedback.text}</p>
                {feedback.scan && (
                  <div className="supply-scan-receipt">
                    <div>
                      <span>Part Number</span>
                      <strong>{feedback.scan.partNumber}</strong>
                    </div>
                    <div>
                      <span>Qty</span>
                      <strong>{feedback.scan.qty} pcs</strong>
                    </div>
                    <div>
                      <span>Antrian</span>
                      <strong>{feedback.scan.type} · {feedback.line} · Menunggu alokasi</strong>
                    </div>
                    <div>
                      <span>Shift scan</span>
                      <strong>{feedback.sourceShift ? `Shift ${feedback.sourceShift}` : 'Di luar jam shift'}</strong>
                    </div>
                    <Badge tone={feedback.scan.type === 'Assy' ? 'sky' : 'orange'}>
                      {feedback.scan.type}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="supply-scan-queue">
            <div className="supply-scan-queue__item">
              <span className="supply-scan-queue__icon supply-scan-queue__icon--assy">
                <PackageCheck size={16} />
              </span>
              <div>
                <strong>{assyCount} box</strong>
                <span>Antrian Assy</span>
              </div>
            </div>
            <div className="supply-scan-queue__item">
              <span className="supply-scan-queue__icon supply-scan-queue__icon--sub">
                <Warehouse size={16} />
              </span>
              <div>
                <strong>{subAssyCount} box</strong>
                <span>Antrian Sub Assy</span>
              </div>
            </div>
          </div>

          <Callout tone="info">
            Barcode Kanban yang sama dapat dipakai kembali setelah permintaan sebelumnya selesai diproses.
          </Callout>

          <div className="supply-scan-foot">
            <span>{formatNumber(assyCount + subAssyCount)} permintaan menunggu alokasi</span>
            <Link to="/login" className="auth-link auth-link--button">
              <ArrowLeft size={13} /> Kembali ke login
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
