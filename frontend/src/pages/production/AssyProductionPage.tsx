import {
  ChevronRight,
  ClipboardCheck,
  Flame,
  Info,
  Save,
  ScanLine,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { SectionCard } from '../../components/ui/SectionCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { getProductionDateForShift, getShiftNumberAt } from '../../data/productionPlanning'
import { describeApiError } from '../../lib/api'
import { listParts } from '../../lib/masterApi'
import { listSchedules, loadShiftResults, saveNgResult, saveShiftResult } from '../../lib/productionApi'
import type { ScheduleItem } from '../../types'
import { formatNumber, formatPercent } from '../../lib/utils'

export function AssyProductionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedJobId = searchParams.get('job') ?? ''
  const { user, activeLine, activeWorkArea } = useAuth()
  const { t } = usePreferences()
  const productionLine = user?.productionLine ??
    (activeLine === 'Robot H' ? 'Robot H' : 'Robot G')
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [partProcesses, setPartProcesses] = useState<Record<string, string>>({})
  const [scheduleError, setScheduleError] = useState('')
  const [scheduleLoading, setScheduleLoading] = useState(true)

  const loadSchedules = useCallback(async () => {
    setScheduleLoading(true)
    setScheduleError('')
    try {
      const [items, parts] = await Promise.all([
        listSchedules({ line: productionLine }),
        listParts({ type: 'Assy', line: productionLine }),
      ])
      setSchedules(items)
      setPartProcesses(Object.fromEntries(parts.map((part) => [part.partNumber, part.process])))
    } catch (loadError) {
      setScheduleError(describeApiError(loadError, t('Jadwal Assy gagal dimuat dari database.', 'Assy schedule failed to load from the database.')))
    } finally {
      setScheduleLoading(false)
    }
  }, [productionLine, t])

  useEffect(() => {
    void loadSchedules()
  }, [loadSchedules])

  const lineJobs = useMemo(
    () =>
      schedules.filter(
        (item) =>
          item.line === productionLine &&
          (!activeWorkArea ||
            (activeWorkArea.type === 'Assy' &&
              partProcesses[item.partNumber] === activeWorkArea.process)),
      ),
    [schedules, productionLine, activeWorkArea?.type, activeWorkArea?.process, partProcesses],
  )
  const activeShift = getShiftNumberAt()
  const [jobId, setJobId] = useState(requestedJobId)
  const [ok, setOk] = useState(0)
  const [ng, setNg] = useState(0)
  const [message, setMessage] = useState('')
  const [recordError, setRecordError] = useState('')
  useEffect(() => {
    if (lineJobs.length === 0) {
      setJobId('')
      return
    }
    setJobId((current) =>
      [requestedJobId, current].find((id) => lineJobs.some((job) => job.id === id)) ?? lineJobs[0].id,
    )
  }, [lineJobs, requestedJobId])

  const job = lineJobs.find((item) => item.id === jobId) ?? lineJobs[0]
  const process = activeWorkArea?.process ?? (job ? partProcesses[job.partNumber] : undefined)
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
          setRecordError(describeApiError(error, t('Data hasil shift gagal dibaca.', 'Shift results failed to load.')))
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
      setMessage(t('Tidak ada shift aktif atau area produksi valid. Hasil tidak dapat disimpan.', 'No active shift or valid production area. Results cannot be saved.'))
      return
    }
    if (isAdmin) {
      setMessage(t('Admin hanya dapat memantau; penyimpanan hasil produksi dilakukan operator.', 'Admin can only monitor; production result saving is done by operators.'))
      return
    }
    setMessage(t('Menyimpan hasil shift ke server…', 'Saving shift results to server…'))
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
      setMessage(`${t('Total shift tersimpan', 'Shift total saved')}: ${ok} ${t('OK', 'OK')} ${t('dan', 'and')} ${ng} ${t('NG', 'NG')} ${t('untuk', 'for')} ${job.partNumber}, ${t('Shift', 'Shift')} ${activeShift}.`)
    } catch (error) {
      setMessage(describeApiError(error, t('Hasil shift gagal disimpan.', 'Shift results failed to save.')))
    }
  }

  if (!job) {
    return (
      <div className="page">
        <PageHeader
          eyebrow={t('Production Control', 'Production Control')}
          title={t('Produksi Assy', 'Assy Production')}
          subtitle={t(`Belum ada jadwal Assy yang terdaftar untuk ${productionLine}.`, `No Assy schedule registered for ${productionLine}.`)}
          meta={<span className="page-meta__item"><Flame size={12} /> {productionLine}</span>}
        />
        {scheduleError && <Callout tone="danger" title={t('Jadwal gagal dimuat', 'Schedule failed to load')}>{scheduleError}</Callout>}
        {scheduleLoading ? (
          <Callout tone="info">{t('Memuat jadwal dari database…', 'Loading schedules from the database...')}</Callout>
        ) : (
          <Callout tone="warning" title={t('Jadwal line belum tersedia', 'Line schedule not available')}>
            {t('Tambahkan jadwal untuk line ini di menu Jadwal Assy sebelum memulai produksi.', 'Add a schedule for this line in the Assy Schedule menu before starting production.')}
          </Callout>
        )}
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={() => navigate('/production/schedule')}>
            {t('Buka Jadwal Assy', 'Open Assy Schedule')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('Production Control', 'Production Control')}
        title={t('Produksi Assy', 'Assy Production')}
        subtitle={t('Catat total kumulatif OK/NG satu kali atau saat perlu diperbarui selama shift. Penyelesaian Kanban tetap mengatur progres antrian.', 'Record cumulative OK/NG totals once or when updated during the shift. Kanban completion still drives queue progress.')}
        meta={
          <>
            <span className="page-meta__item">
              <Flame size={12} /> {productionLine}
            </span>
            <span className="page-meta__item">
              <ClipboardCheck size={12} /> {activeShift ? `${t('Shift', 'Shift')} ${activeShift}` : t('Di luar jam shift', 'Outside shift hours')} · {t('Operator', 'Operator')}
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
              {t('Lihat antrian', 'View Queue')}
            </Button>
            <Button variant="primary" onClick={() => navigate('/production/results')}>
              {t('Hasil produksi', 'Production Results')}
            </Button>
          </>
        }
      />

      {scheduleError && <Callout tone="danger" title={t('Jadwal gagal dimuat', 'Schedule failed to load')}>{scheduleError}</Callout>}
      {message && (
        <Callout tone={message.includes(t('tersimpan', 'saved')) ? 'success' : 'warning'}>
          {message}
        </Callout>
      )}
      {recordError && <Callout tone="danger" title={t('Hasil shift gagal dibaca', 'Shift results failed to load')}>{recordError}</Callout>}

      <div className="production-board">
        <div className="stack">
          <section className="card job-hero">
            <div className="job-hero__top">
              <div>
                <span className="page-eyebrow" style={{ marginBottom: 4 }}>
                  {t('Pekerjaan aktif', 'Active Job')}
                </span>
                <h2 className="job-number">{job.partNumber}</h2>
                <p className="job-model">
                  {job.model} · {job.line} · {t('Shift', 'Shift')} {activeShift ?? '—'}
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>

            <div className="job-progress">
              <div className="progress-meta" style={{ marginTop: 0, marginBottom: 6 }}>
                <span>{t('Target', 'Target')} {formatNumber(job.target)} pcs</span>
                <strong className="text-accent">{formatPercent(progress)}</strong>
              </div>
              <ProgressBar value={progress} thick />
            </div>

            <div className="job-counts">
              <div className="job-count job-count--accent">
                <strong>{formatNumber(job.actual)}</strong>
                <span>{t('Actual hari ini', "Today's Actual")}</span>
              </div>
              <div className="job-count">
                <strong>{formatNumber(remaining)}</strong>
                <span>{t('Balance', 'Balance')}</span>
              </div>
              <div className="job-count">
                <strong>{formatNumber(job.target)}</strong>
                <span>{t('Target', 'Target')}</span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">{t('Total hasil shift', 'Shift Total Results')}</h2>
                <p className="section-sub">
                  {t('Isi total kumulatif hasil saat ini. Menyimpan ulang akan memperbarui total, bukan menambahkan angka.', 'Enter the current cumulative totals. Saving again will update the total, not add to it.')}
                </p>
              </div>
              <Badge tone={activeShift ? 'sky' : 'warning'}>
                {activeShift ? `${t('Shift', 'Shift')} ${activeShift}` : t('Di luar jam shift', 'Outside shift hours')}
              </Badge>
            </div>

            <div className="grid grid-2">
            <div className="field">
              <label className="field-label" htmlFor="assy-ok-qty">
                {t('OK Qty', 'OK Qty')} · {job.partNumber} · {t('Shift', 'Shift')} {activeShift ?? '—'}
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
                {t('NG Qty', 'NG Qty')} · {job.partNumber} · {t('Shift', 'Shift')} {activeShift ?? '—'}
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
                {t('Catatan (opsional)', 'Note (optional)')}
              </label>
              <input
                id="assy-note"
                className="input"
                placeholder={t('Contoh: setup awal, ganti jig, atau alasan NG…', 'E.g., initial setup, jig change, or NG reason…')}
              />
            </div>

            <div className="form-actions">
              <Button
                variant="secondary"
                leftIcon={<Save size={15} />}
                onClick={() => void saveShiftTotals()}
                disabled={!activeShift || isAdmin}
              >
                {t('Simpan total shift', 'Save Shift Total')}
              </Button>
              <Button
                variant="primary"
                leftIcon={<ScanLine size={15} />}
                onClick={() => navigate('/production/assy-queue')}
              >
                {t('Lihat antrian / Kanban', 'View Queue / Kanban')}
              </Button>
            </div>

            <p className="field-hint" style={{ marginTop: 10 }}>
              {t('Masukkan jumlah kumulatif OK dan NG untuk shift aktif; tidak perlu input setiap pallet atau box. Aksi Kanban mengubah antrean, sedangkan total hasil shift disimpan terpisah.', 'Enter cumulative OK and NG counts for the active shift; no need to input every pallet or box. Kanban actions change the queue, while shift totals are stored separately.')}
            </p>
          </section>
        </div>

        <div className="stack">
          <SectionCard title={t('Pekerjaan hari ini', "Today's Jobs")} subtitle={t('Pilih PN yang akan dijalankan', 'Select PN to run')}>
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
                        {t('Dipilih', 'Selected')}
                      </Badge>
                    ) : (
                      <StatusBadge status={item.status} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={t('Panduan operator', 'Operator guide')} subtitle={t('Alur singkat per box', 'Short flow per box')}>
            <div className="stack-sm">
              {[
                t('Pilih pekerjaan Assy yang aktif.', 'Select the active Assy job.'),
                t('Selesaikan Kanban; qty OK mengikuti standar packaging.', 'Complete Kanban; OK qty follows the packaging standard.'),
                t('Catat total NG per part number dan shift.', 'Record total NG per part number and shift.'),
                t('Pastikan Kanban sesuai dengan box yang diproduksi.', 'Make sure Kanban matches the box produced.'),
                t('Periksa rekap OK dan NG di menu Hasil Produksi.', 'Check OK and NG totals in the Production Results menu.'),
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
                <Info size={13} /> {t('Jangan membuat Kanban ganda untuk box yang sama.', 'Do not create duplicate Kanban for the same box.')}
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
                  <div className="small strong">{t('NG hari ini', 'NG today')}</div>
                  <div className="tiny muted">Assy {productionLine}</div>
                </div>
              </div>
              <div className="report-value">
                {formatNumber(ng)} <small>pcs</small>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ paddingLeft: 0, marginTop: 8 }}
              onClick={() => navigate('/reports/ng')}
            >
              {t('Buka NG report', 'Open NG report')} <ChevronRight size={13} />
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
