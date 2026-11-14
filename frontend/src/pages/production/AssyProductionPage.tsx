import {
  ChevronRight,
  ClipboardCheck,
  Flame,
  Info,
  Save,
  ScanLine,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { SectionCard } from '../../components/ui/SectionCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { scheduleItems } from '../../data/mock'
import { getProductionDateForShift, getShiftNumberAt } from '../../data/productionPlanning'
import { loadShiftResults, saveNgResult, saveShiftResult } from '../../lib/productionApi'
import { getProductionPart } from '../../data/productionLines'
import { formatNumber, formatPercent } from '../../lib/utils'

export function AssyProductionPage() {
  const navigate = useNavigate()
  const { user, activeLine, activeWorkArea } = useAuth()
  const productionLine = user?.productionLine ??
    (activeLine === 'Robot H' ? 'Robot H' : 'Robot G')
  const lineJobs = useMemo(
    () =>
      scheduleItems.filter(
        (item) =>
          item.line === productionLine &&
          (!activeWorkArea ||
            (activeWorkArea.type === 'Assy' &&
              getProductionPart(item.partNumber)?.process === activeWorkArea.process)),
      ),
    [productionLine, activeWorkArea?.type],
  )
  const activeShift = getShiftNumberAt()
  const [jobId, setJobId] = useState('sch-1')
  const [ok, setOk] = useState(0)
  const [ng, setNg] = useState(0)
  const [message, setMessage] = useState('')
  const [recordError, setRecordError] = useState('')
  useEffect(() => {
    setJobId(lineJobs[0]?.id ?? '')
  }, [lineJobs])

  const job = lineJobs.find((item) => item.id === jobId) ?? lineJobs[0]
  const process = activeWorkArea?.process ?? getProductionPart(job?.partNumber ?? '')?.process
  useEffect(() => {
    if (!job || !activeShift || !process) {
      setOk(0)
      setNg(0)
      return
    }
    let active = true
    loadShiftResults({
      date: getProductionDateForShift(activeShift),
      line: productionLine,
      type: 'Assy',
    })
      .then((records) => {
        if (!active) return
        const saved = records.find(
          (record) =>
            record.partNumber === job.partNumber &&
            record.shift === activeShift &&
            record.line === productionLine &&
            (record.process ?? '') === process,
        )
        setOk(saved?.ok ?? 0)
        setNg(saved?.ng ?? 0)
        setRecordError('')
      })
      .catch((error) => {
        if (active) {
          setRecordError(error instanceof Error ? error.message : 'Data hasil shift gagal dibaca.')
        }
      })
    return () => {
      active = false
    }
  }, [job?.partNumber, activeShift, productionLine, process])
  const progress = job ? (job.actual / job.target) * 100 : 0
  const remaining = job ? Math.max(job.target - job.actual, 0) : 0

  const isAdmin = user?.role === 'admin'
  const saveShiftTotals = async () => {
    if (!user || !activeShift || !job || !process) {
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
          partNumber: job.partNumber,
          type: 'Assy',
          shift: activeShift,
          ok,
          ng,
          line: productionLine,
          process,
        }),
        saveNgResult({
          date,
          partNumber: job.partNumber,
          type: 'Assy',
          shift: activeShift,
          ng,
          line: productionLine,
        }),
      ])
      setMessage(`Total shift tersimpan: ${ok} OK dan ${ng} NG untuk ${job.partNumber}, Shift ${activeShift}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Hasil shift gagal disimpan.')
    }
  }

  if (!job) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Production Control"
          title="Produksi Assy"
          subtitle={`Belum ada jadwal Assy yang terdaftar untuk ${productionLine}.`}
          meta={<span className="page-meta__item"><Flame size={12} /> {productionLine}</span>}
        />
        <Callout tone="warning" title="Jadwal line belum tersedia">
          Tambahkan atau sinkronkan jadwal untuk line ini sebelum memulai produksi.
        </Callout>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Production Control"
        title="Produksi Assy"
        subtitle="Catat total kumulatif OK/NG satu kali atau saat perlu diperbarui selama shift. Penyelesaian Kanban tetap mengatur progres antrian."
        meta={
          <>
            <span className="page-meta__item">
              <Flame size={12} /> {productionLine}
            </span>
            <span className="page-meta__item">
              <ClipboardCheck size={12} /> {activeShift ? `Shift ${activeShift}` : 'Di luar jam shift'} · Operator
            </span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<ScanLine size={15} />}
              onClick={() => navigate('/production/assy-queue')}
            >
              Lihat antrian
            </Button>
            <Button variant="primary" onClick={() => navigate('/production/results')}>
              Hasil produksi
            </Button>
          </>
        }
      />

      {message && (
        <Callout tone={message.includes('tersimpan') ? 'success' : 'warning'}>
          {message}
        </Callout>
      )}
      {recordError && <Callout tone="danger" title="Hasil shift gagal dibaca">{recordError}</Callout>}

      <div className="production-board">
        <div className="stack">
          <section className="card job-hero">
            <div className="job-hero__top">
              <div>
                <span className="page-eyebrow" style={{ marginBottom: 4 }}>
                  Pekerjaan aktif
                </span>
                <h2 className="job-number">{job.partNumber}</h2>
                <p className="job-model">
                  {job.model} · {job.line} · Shift {activeShift ?? '—'}
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>

            <div className="job-progress">
              <div className="progress-meta" style={{ marginTop: 0, marginBottom: 6 }}>
                <span>Target {formatNumber(job.target)} pcs</span>
                <strong className="text-accent">{formatPercent(progress)}</strong>
              </div>
              <ProgressBar value={progress} thick />
            </div>

            <div className="job-counts">
              <div className="job-count job-count--accent">
                <strong>{formatNumber(job.actual)}</strong>
                <span>Actual hari ini</span>
              </div>
              <div className="job-count">
                <strong>{formatNumber(remaining)}</strong>
                <span>Balance</span>
              </div>
              <div className="job-count">
                <strong>{formatNumber(job.target)}</strong>
                <span>Target</span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Total hasil shift</h2>
                <p className="section-sub">
                  Isi total kumulatif hasil saat ini. Menyimpan ulang akan memperbarui total, bukan menambahkan angka.
                </p>
              </div>
              <Badge tone={activeShift ? 'sky' : 'warning'}>
                {activeShift ? `Shift ${activeShift}` : 'Di luar jam shift'}
              </Badge>
            </div>

            <div className="grid grid-2">
            <div className="field">
              <label className="field-label" htmlFor="assy-ok-qty">
                OK Qty · {job.partNumber} · Shift {activeShift ?? '—'}
              </label>
              <input
                id="assy-ok-qty"
                className="input"
                type="number"
                min="0"
                step="1"
                value={ok}
                onChange={(event) => setOk(Number(event.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="assy-ng-qty">
                NG Qty · {job.partNumber} · Shift {activeShift ?? '—'}
              </label>
              <input
                id="assy-ng-qty"
                className="input"
                type="number"
                min="0"
                step="1"
                value={ng}
                onChange={(event) => setNg(Number(event.target.value) || 0)}
              />
            </div>
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label className="field-label" htmlFor="assy-note">
                Catatan (opsional)
              </label>
              <input
                id="assy-note"
                className="input"
                placeholder="Contoh: setup awal, ganti jig, atau alasan NG…"
              />
            </div>

            <div className="form-actions">
              <Button
                variant="secondary"
                leftIcon={<Save size={15} />}
                onClick={() => void saveShiftTotals()}
                disabled={!activeShift || isAdmin}
              >
                Simpan total shift
              </Button>
              <Button
                variant="primary"
                leftIcon={<ScanLine size={15} />}
                onClick={() => navigate('/production/assy-queue')}
              >
                Lihat antrian / Kanban
              </Button>
            </div>

            <p className="field-hint" style={{ marginTop: 10 }}>
              Masukkan jumlah kumulatif OK dan NG untuk shift aktif; tidak perlu input setiap pallet
              atau box. Aksi Kanban mengubah antrean, sedangkan total hasil shift disimpan terpisah.
            </p>
          </section>
        </div>

        <div className="stack">
          <SectionCard title="Pekerjaan hari ini" subtitle="Pilih PN yang akan dijalankan">
            <div className="stack-sm">
              {lineJobs.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`queue-card${item.id === job.id ? ' is-urgent' : ''}`}
                  style={{ padding: 13, textAlign: 'left', boxShadow: 'none' }}
                  onClick={() => {
                    setJobId(item.id)
                    setNg(0)
                    setMessage('')
                  }}
                >
                  <div className="queue-card__head">
                    <div>
                      <h3 style={{ fontSize: 13 }}>{item.partNumber}</h3>
                      <span>
                        {item.model} · {item.actual}/{item.target} pcs
                      </span>
                    </div>
                    {item.id === job.id ? (
                      <Badge tone="orange" dot>
                        Dipilih
                      </Badge>
                    ) : (
                      <StatusBadge status={item.status} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Panduan operator" subtitle="Alur singkat per box">
            <div className="stack-sm">
              {[
                'Pilih pekerjaan Assy yang aktif.',
                'Selesaikan Kanban; qty OK mengikuti standar packaging.',
                'Catat total NG per part number dan shift.',
                'Pastikan Kanban sesuai dengan box yang diproduksi.',
                'Periksa rekap OK dan NG di menu Hasil Produksi.',
              ].map((step, index) => (
                <div className="row row--start" key={step} style={{ gap: 9 }}>
                  <span className="queue-mini__num">{index + 1}</span>
                  <span className="small muted" style={{ lineHeight: 1.5 }}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
            <Callout tone="info" className="callout" style={{ marginTop: 14 }}>
              <span className="row" style={{ gap: 6 }}>
                <Info size={13} /> Jangan membuat Kanban ganda untuk box yang sama.
              </span>
            </Callout>
          </SectionCard>

          <section className="card">
            <div className="row row--between">
              <div className="row">
                <div className="stat-icon stat-icon--amber">
                  <TriangleAlert size={18} />
                </div>
                <div>
                  <div className="small strong">NG hari ini</div>
                  <div className="tiny muted">Assy {productionLine}</div>
                </div>
              </div>
              <div className="report-value">
                7 <small>pcs</small>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ paddingLeft: 0, marginTop: 8 }}
              onClick={() => navigate('/reports/ng')}
            >
              Buka NG report <ChevronRight size={13} />
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
