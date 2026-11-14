import { ArrowLeft, CheckCircle2, PackageCheck, ScanBarcode, ScanLine, Warehouse } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../../components/brand/Logo'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useQueue } from '../../contexts/QueueContext'
import { formatNumber } from '../../lib/utils'
import type { ScannedKanban } from '../../types'

const kanbanCatalog: ScannedKanban[] = [
  { code: 'KN-ASSY-88213', partNumber: '75110B000P', model: 'RV', type: 'Assy', qty: 50 },
  { code: 'KN-ASSY-88214', partNumber: '5220BA42', model: 'RN', type: 'Assy', qty: 78 },
  { code: 'KN-SA-2611-045', partNumber: '5220K814', model: 'RN', type: 'Sub Assy', process: 'SS.H', qty: 70 },
  { code: 'KN-SA-2611-046', partNumber: '50162B000P', model: 'RN', type: 'Sub Assy', process: 'SS.M', qty: 140 },
  { code: 'KN-ASSY-88215', partNumber: '5220AU50', model: 'RN', type: 'Assy', qty: 39 },
  { code: 'KN-ASSY-88216', partNumber: '75114W000P', model: 'RNE', type: 'Assy', qty: 35 },
]

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
    const normalized = code.trim().toUpperCase()
    if (!normalized) {
      setFeedback({ ok: false, text: 'Scan atau masukkan kode kanban terlebih dahulu.' })
      return
    }

    const scan = kanbanCatalog.find((item) => item.code === normalized)
    if (!scan) {
      setFeedback({
        ok: false,
        text: `Kanban ${normalized} tidak dikenali. Gunakan salah satu contoh kanban di bawah.`,
      })
      return
    }

    setSubmitting(true)
    try {
      const result = await addFromScan(scan)
      if (!result.ok || !result.request) {
        setFeedback({ ok: false, text: result.error ?? 'Kanban gagal masuk antrian.' })
        return
      }

      setFeedback({
        ok: true,
        text: `Permintaan ${scan.code} masuk antrean Admin Robot ${result.request.line.slice(-1)}. Admin menentukan shift produksinya.`,
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
              Scan kanban Assy atau Sub Assy. Sistem otomatis membaca tipe kanban dan
              merutekannya ke antrean Admin Robot G/H sesuai mapping part number.
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
                  placeholder="Scan barcode atau ketik kode kanban"
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

          <div className="supply-scan-samples">
            <span>Contoh scan demo:</span>
            <div className="supply-scan-samples__list">
              {kanbanCatalog.map((item) => (
                <button
                  type="button"
                  key={item.code}
                  className="supply-scan-sample"
                  onClick={() => {
                    setCode(item.code)
                    setFeedback(null)
                  }}
                >
                  {item.code}
                  <em>{item.model} · {item.type}</em>
                </button>
              ))}
            </div>
          </div>

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
