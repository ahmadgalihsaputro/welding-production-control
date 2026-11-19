import {
  Cog,
  Route,
  ScanLine,
  Save,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { SectionCard } from '../../components/ui/SectionCard'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { getProductionDateForShift, getShiftNumberAt } from '../../data/productionPlanning'
import { describeApiError } from '../../lib/api'
import { listParts, type ProductionPartRecord } from '../../lib/masterApi'
import { loadShiftResults, saveNgResult, saveShiftResult } from '../../lib/productionApi'

export function SubAssyProductionPage() {
  const navigate = useNavigate()
  const { user, activeLine, activeWorkArea } = useAuth()
  const { t } = usePreferences()
  const productionLine = user?.productionLine ??
    (activeLine === 'Robot H' ? 'Robot H' : 'Robot G')
  const [parts, setParts] = useState<ProductionPartRecord[]>([])
  const [partLoading, setPartLoading] = useState(true)
  const [partError, setPartError] = useState('')

  useEffect(() => {
    let active = true
    listParts({ type: 'Sub_Assy', line: productionLine })
      .then((records) => {
        if (!active) return
        setParts(records)
        setPartError('')
      })
      .catch((error) => {
        if (active) setPartError(describeApiError(error, 'Master part Sub Assy gagal dimuat.'))
      })
      .finally(() => {
        if (active) setPartLoading(false)
      })
    return () => {
      active = false
    }
  }, [productionLine])

  const availableParts = useMemo(
    () =>
      parts.filter(
        (part) =>
          !activeWorkArea ||
          (activeWorkArea.type === 'Sub Assy' && part.process === activeWorkArea.process),
      ),
    [parts, activeWorkArea?.type, activeWorkArea?.process],
  )
  const activeShift = getShiftNumberAt()
  const [partNumber, setPartNumber] = useState(
    () => availableParts[0]?.partNumber ?? '',
  )
  const [ok, setOk] = useState(0)
  const [ng, setNg] = useState(0)
  const [message, setMessage] = useState('')
  const [recordError, setRecordError] = useState('')
  useEffect(() => {
    setPartNumber(availableParts[0]?.partNumber ?? '')
  }, [availableParts])
  const selectedPart = availableParts.find((part) => part.partNumber === partNumber)
  useEffect(() => {
    if (!selectedPart || !activeShift) {
      setOk(0)
      setNg(0)
      return
    }
    let active = true
    loadShiftResults({
      date: getProductionDateForShift(activeShift),
      line: selectedPart.line,
      type: 'Sub Assy',
    })
      .then((records) => {
        if (!active) return
        const saved = records.find(
          (record) =>
            record.partNumber === selectedPart.partNumber &&
            record.shift === activeShift &&
            record.line === selectedPart.line &&
            (record.process ?? '') === selectedPart.process,
        )
        setOk(saved?.ok ?? 0)
        setNg(saved?.ng ?? 0)
        setRecordError('')
      })
      .catch((error) => {
        if (active) {
          setRecordError(describeApiError(error, 'Data hasil shift gagal dibaca.'))
        }
      })
    return () => {
      active = false
    }
  }, [selectedPart?.partNumber, activeShift, selectedPart?.line, selectedPart?.process])

  const isAdmin = user?.role === 'admin'
  const saveShiftTotals = async () => {
    if (!user || !activeShift || !selectedPart) {
      setMessage('Tidak ada shift aktif atau area produksi valid. Hasil tidak dapat disimpan.')
      return
    }
    if (isAdmin) {
      setMessage('Admin hanya dapat memantau; penyimpanan hasil produksi dilakukan operator.')
      return
    }
    setMessage('Menyimpan hasil shift ke server…')
    try {
      const date = getProductionDateForShift(activeShift)
      await Promise.all([
        saveShiftResult({
          date,
          partNumber,
          type: 'Sub Assy',
          shift: activeShift,
          ok,
          ng,
          line: selectedPart.line,
          process: selectedPart.process,
        }),
        saveNgResult({
          date,
          partNumber,
          type: 'Sub Assy',
          shift: activeShift,
          ng,
          line: selectedPart.line,
        }),
      ])
      setMessage(`Total shift tersimpan: ${ok} OK dan ${ng} NG untuk ${partNumber}, Shift ${activeShift}.`)
    } catch (error) {
      setMessage(describeApiError(error, 'Hasil shift gagal disimpan.'))
    }
  }

  if (availableParts.length === 0) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Production Control"
          title="Produksi Sub Assy"
          subtitle={`Belum ada part Sub Assy yang terdaftar untuk ${productionLine}.`}
          meta={<span className="page-meta__item"><Cog size={12} /> {productionLine} — Sub Assy</span>}
        />
        {partLoading && (
          <Callout tone="info">
            {t('Memuat master part Sub Assy dari database…', 'Loading Sub Assy master parts from the database...')}
          </Callout>
        )}
        {partError && (
          <Callout tone="danger" title={t('Master part gagal dimuat', 'Master parts failed to load')}>
            {partError}
          </Callout>
        )}
        {!partLoading && !partError && (
          <Callout tone="warning" title="Master part belum tersedia">
            Daftarkan part Sub Assy dan line prosesnya di Master Data sebelum memulai produksi pada
            line ini.
          </Callout>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Production Control"
        title="Produksi Sub Assy"
        subtitle="Pilih part number dan catat total kumulatif OK/NG satu kali atau saat perlu diperbarui selama shift."
        meta={
          <>
            <span className="page-meta__item">
              <Cog size={12} /> {productionLine} — Sub Assy
            </span>
            <span className="page-meta__item">
              <Route size={12} /> {selectedPart?.process ?? 'Sub Assy'}
            </span>
            <span className="page-meta__item">
              <ScanLine size={12} /> Scan-ready
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/production/queue')}>
              Lihat antrian / Kanban
            </Button>
          </>
        }
      />

      {partError && (
        <Callout tone="danger" title={t('Master part gagal dimuat', 'Master parts failed to load')}>
          {partError}
        </Callout>
      )}
      {message && <Callout tone={message.includes('tersimpan') ? 'success' : 'warning'}>{message}</Callout>}
      {recordError && <Callout tone="danger" title="Hasil shift gagal dibaca">{recordError}</Callout>}

      <div className="production-board">
        <div className="stack">
          <section className="card job-hero">
            <div className="job-hero__top">
              <div>
                <span className="page-eyebrow" style={{ marginBottom: 4 }}>Part yang dipilih</span>
                <h2 className="job-number">{partNumber}</h2>
                <p className="job-model">
                Sub Assy · {selectedPart?.process} · Model {selectedPart?.models.join(', ')}
                </p>
              </div>
              <Badge tone={activeShift ? 'sky' : 'warning'} dot>
                {activeShift ? `Shift ${activeShift}` : 'Di luar shift'}
              </Badge>
            </div>

            <div className="job-counts">
              <div className="job-count job-count--accent">
                <strong>{selectedPart?.packaging ?? '—'}</strong>
                <span>pcs / box</span>
              </div>
              <div className="job-count">
                <strong>{selectedPart?.process ?? '—'}</strong>
                <span>Proses</span>
              </div>
              <div className="job-count">
                <strong>{selectedPart?.models.length ?? 0}</strong>
                <span>Model</span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Total hasil shift</h2>
                <p className="section-sub">Isi total kumulatif; menyimpan ulang akan memperbarui angka, bukan menambahkan.</p>
              </div>
              <Badge tone={activeShift ? 'sky' : 'warning'}>
                {activeShift ? `Shift ${activeShift}` : 'Di luar jam shift'}
              </Badge>
            </div>

            <div className="grid grid-2">
            <div className="field">
              <label className="field-label" htmlFor="sub-assy-ok-qty">
                OK Qty · {partNumber} · Shift {activeShift ?? '—'}
              </label>
              <input
                id="sub-assy-ok-qty"
                className="input"
                type="number"
                min="0"
                step="1"
                value={ok}
                onChange={(event) => setOk(Number(event.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="sub-assy-ng-qty">
                NG Qty · {partNumber} · Shift {activeShift ?? '—'}
              </label>
              <input
                id="sub-assy-ng-qty"
                className="input"
                type="number"
                min="0"
                step="1"
                value={ng}
                onChange={(event) => setNg(Number(event.target.value) || 0)}
              />
            </div>
            </div>

            <div className="info-grid" style={{ marginTop: 14 }}>
              <div className="info-item">
                <span className="info-label">Standard packaging</span>
                <span className="info-value info-value--strong">{selectedPart?.packaging ?? '—'} pcs / box</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status master</span>
                <span className="info-value info-value--strong">{selectedPart?.status ?? '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Line</span>
                <span className="info-value">{selectedPart?.line ?? '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Operator</span>
                <span className="info-value">{user?.name ?? 'Operator'}</span>
              </div>
            </div>

            <div className="form-actions">
              <Button
                variant="secondary"
                leftIcon={<Save size={15} />}
                onClick={() => void saveShiftTotals()}
                disabled={!activeShift || !selectedPart || isAdmin}
              >
                Simpan total shift
              </Button>
              <Button variant="primary" onClick={() => navigate('/production/queue')}>
                Ke antrian produksi
              </Button>
            </div>
            <p className="field-hint" style={{ marginTop: 10 }}>
              Masukkan total kumulatif OK dan NG untuk shift aktif; tidak perlu input setiap pallet
              atau box. Aksi Kanban mengubah antrean, sedangkan total hasil shift disimpan terpisah.
            </p>
          </section>
        </div>

        <div className="stack">
          <SectionCard title={`Part Sub Assy ${productionLine}`} subtitle="Pilih PN untuk rekap NG shift">
            <div className="stack-sm">
              {availableParts.map((part) => (
                <button
                  key={part.partNumber}
                  type="button"
                  className={`queue-card${part.partNumber === partNumber ? ' is-urgent' : ''}`}
                  style={{ padding: 13, textAlign: 'left', boxShadow: 'none' }}
                  onClick={() => {
                    setPartNumber(part.partNumber)
                    setNg(0)
                    setMessage('')
                  }}
                >
                  <div className="queue-card__head">
                    <div>
                      <h3 style={{ fontSize: 13 }}>{part.partNumber}</h3>
                      <span>{part.line} · {part.process} · Model {part.models.join(', ')} · {part.packaging ?? '—'} pcs/box</span>
                    </div>
                    {part.partNumber === partNumber && <Badge tone="orange" dot>Dipilih</Badge>}
                  </div>
                </button>
              ))}
            </div>

            <Callout tone="info" className="callout" style={{ marginTop: 12 }}>
              {t(
                'PN Sub Assy diambil langsung dari Master Data → Part Number di database.',
                'Sub Assy part numbers come directly from Master Data → Part Number in the database.',
              )}
            </Callout>
          </SectionCard>

          <SectionCard title="Alur produksi Sub Assy" subtitle="Sesuai antrian dan Kanban shift">
            <div className="stack-sm">
              {[
                'Pilih antrian Sub Assy untuk shift yang sedang berjalan.',
                'Selesaikan Kanban; qty OK mengikuti standar packaging.',
                'Catat total NG per part number dan shift.',
                'Periksa rekap OK dan NG di menu Hasil Produksi.',
              ].map((step, index) => (
                <div className="row row--start" key={step} style={{ gap: 9 }}>
                  <span className="queue-mini__num">{index + 1}</span>
                  <span className="small muted" style={{ lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>
            <Callout tone="info" className="callout" style={{ marginTop: 12 }}>
              {t(
                'Line proses diambil dari Master Data. Qty OK berasal dari Kanban yang diselesaikan.',
                'Process lines come from Master Data. OK qty comes from completed kanban.',
              )}
            </Callout>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
