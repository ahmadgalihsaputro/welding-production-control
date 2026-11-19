import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Clock3,
  Flame,
  ListOrdered,
  PackageSearch,
  Play,
  Printer,
  Timer,
  TriangleAlert,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import askaLogo from '../../assets/aska_icon.png'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { useQueue } from '../../contexts/QueueContext'
import { formatNumber } from '../../lib/utils'
import {
  getProductionPart,
  matchesProductionWorkArea,
} from '../../data/productionLines'
import { getShiftNumberAt } from '../../data/productionPlanning'
import { parseKanbanBarcode } from '../../lib/kanbanBarcode'
import type { CompletedBox, QueueType, RobotLine } from '../../types'

interface ProductionQueuePageProps {
  type: QueueType
}

const copy: Record<
  QueueType,
  { titleId: string; titleEn: string; subtitleId: string; subtitleEn: string; productionPath: string; device: string }
> = {
  Assy: {
    titleId: 'Antrian Produksi Assy',
    titleEn: 'Assy Production Queue',
    subtitleId: 'Daftar box Assy yang siap dikerjakan operator Assy. Print kanban berarti menyelesaikan produksi 1 pallet/box.',
    subtitleEn: 'List of Assy boxes ready for Assy operators. Printing a kanban completes the production of 1 pallet/box.',
    productionPath: '/production/assy',
    device: 'Tablet Assy Line 01',
  },
  'Sub Assy': {
    titleId: 'Antrian Replenishment Sub Assy',
    titleEn: 'Sub Assy Replenishment Queue',
    subtitleId: 'Antrean box Sub Assy dari pengambilan Supply. Print kanban berarti menyelesaikan produksi 1 pallet/box.',
    subtitleEn: 'Sub Assy box queue from Supply picking. Printing a kanban completes the production of 1 pallet/box.',
    productionPath: '/production/sub-assy',
    device: 'Tablet Sub Assy 02',
  },
}

export function ProductionQueuePage({ type }: ProductionQueuePageProps) {
  const navigate = useNavigate()
  const { user, activeLine, activeWorkArea } = useAuth()
  const { t } = usePreferences()
  const { items, audit, printKanban, moveItem, cyclePriority } = useQueue()
  const isAdmin = user?.role === 'admin'
  const userLine: RobotLine = user?.productionLine ??
    (user?.line.includes('Robot H') ? 'Robot H' : 'Robot G')
  const activeShift = user?.shiftMode
    ? user.currentShift ?? undefined
    : getShiftNumberAt()
  const canOperateQueue = Boolean(
    user &&
      user.role !== 'admin' &&
      activeShift &&
      (activeWorkArea?.type === type || user.role === 'leader'),
  )
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'warning'>('warning')
  const [printedBox, setPrintedBox] = useState<CompletedBox | null>(null)
  const [processFilter, setProcessFilter] = useState(t('Semua proses', 'All Processes'))
  useEffect(() => {
    if (!printedBox) return
    document.body.classList.add('printing-kanban')
    return () => document.body.classList.remove('printing-kanban')
  }, [printedBox])
  useEffect(() => {
    setProcessFilter(t('Semua proses', 'All Processes'))
  }, [activeLine, activeWorkArea?.id, t])

  const queue = items.filter(
    (item) =>
      item.type === type &&
      (isAdmin
        ? activeLine === 'all' || item.line === activeLine
        : (activeWorkArea
          ? matchesProductionWorkArea(activeWorkArea, {
              ...item,
              process: item.process ?? getProductionPart(item.partNumber)?.process,
            })
          : item.line === userLine) &&
          activeShift !== undefined &&
          item.targetShift === activeShift),
  )
  const visibleQueue =
    type === 'Sub Assy' && processFilter !== t('Semua proses', 'All Processes')
      ? queue.filter((item) => item.process === processFilter)
      : queue
  const urgent = queue.filter((item) => item.priority === 'urgent').length
  const totalTaken = queue.reduce(
    (sum, item) => sum + Math.max(item.taken - (item.printedQty ?? 0), 0),
    0,
  )
  const entries = audit
    .filter((entry) => {
      if (entry.type !== type) return false
      if (isAdmin) return activeLine === 'all' || entry.line === activeLine
      return activeWorkArea
        ? matchesProductionWorkArea(activeWorkArea, {
            line: entry.line,
            type: entry.type,
            process: entry.process,
          })
        : entry.line === userLine
    })
    .slice(0, 6)
  const meta = copy[type]
  const reorderProcess =
    processFilter === t('Semua proses', 'All Processes')
      ? activeWorkArea?.process
      : processFilter

  const handlePrint = async (id: string) => {
    if (!user || !activeShift) return
    setMessageTone('warning')
    setMessage(t('Mencetak kanban dan menyimpan hasil ke server…', 'Printing kanban and saving the result to the server…'))
    const result = await printKanban(id, user.name, user.role, activeShift, userLine)
    if (!result.ok || !result.box) {
      setMessage(result.error ?? t('Kanban tidak ditemukan di antrian.', 'Kanban not found in the queue.'))
      return
    }
    if (!parseKanbanBarcode(result.box.kanban)) {
      setMessage(t('Kanban tersimpan, tetapi payload barcode yang diterima tidak valid.', 'Kanban saved, but the received barcode payload is invalid.'))
      return
    }
    setPrintedBox(result.box)
    setMessageTone('success')
    setMessage(
      `${t('Kanban', 'Kanban')} ${result.box.partNumber} ${t('berhasil dicetak', 'printed successfully')} (${result.completedKanbans}/${result.totalKanbans}). ${result.box.qty} pcs ${t('tercatat sebagai OK.', 'recorded as OK.')}`,
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('Production Control', 'Production Control')}
        title={t(meta.titleId, meta.titleEn)}
        subtitle={
          isAdmin
            ? t(
                `Mode pemantauan: lihat progres antrean ${activeLine === 'all' ? 'semua robot' : activeLine} ${type}. Admin tidak dapat mencetak kanban atau mengubah antrean.`,
                `Monitoring mode: view the queue progress for ${activeLine === 'all' ? 'all robots' : activeLine} ${type}. Admin cannot print kanban or change the queue.`,
              )
            : t(meta.subtitleId, meta.subtitleEn)
        }
        meta={
          <>
            <span className="page-meta__item">
              <Flame size={12} /> {isAdmin ? (activeLine === 'all' ? t('Semua robot', 'All Robots') : activeLine) : activeWorkArea?.label ?? userLine} — {type}{!isAdmin && activeShift ? ` · ${t('Shift', 'Shift')} ${activeShift}` : ''}
            </span>
            <span className="page-meta__item">
              <ListOrdered size={12} /> {canOperateQueue ? t('Urutan bisa diatur operator', 'Order can be adjusted by operator') : t('Mode pemantauan', 'Monitoring mode')}
            </span>
            <span className="page-meta__item">
              <Clock3 size={12} /> {t('Update', 'Update')} {queue[0]?.time ?? '—'}
            </span>
          </>
        }
        actions={canOperateQueue && (
          <Button
            variant="primary"
            leftIcon={<Play size={15} />}
            onClick={() => navigate(meta.productionPath)}
          >
            {t('Mulai produksi', 'Start Production')}
          </Button>
        )}
      />

      {isAdmin && (
        <Callout tone="info" title={t('Akses Admin: pemantauan saja', 'Admin Access: Monitoring Only')}>
          {t(
            'Anda dapat melihat status dan progres produksi, tetapi tidak dapat mencetak kanban, mengubah prioritas, atau mengatur urutan antrean.',
            'You can view production status and progress, but cannot print kanban, change priority, or adjust the queue order.',
          )}
        </Callout>
      )}
      {!isAdmin && !activeShift && (
        <Callout tone="warning" title={t('User Non-shift', 'Non-shift User')}>
          {t(
            'Akun ini tidak sedang dijadwalkan pada Shift 1 atau Shift 2. Aksi produksi dinonaktifkan.',
            'This account is not scheduled for Shift 1 or Shift 2. Production actions are disabled.',
          )}
        </Callout>
      )}

      {message && <Callout tone={messageTone}>{message}</Callout>}

      {printedBox && (() => {
        const payload = parseKanbanBarcode(printedBox.kanban)
        if (!payload) return null
        return (
          <section className="card kanban-printable">
            <div className="section-head kanban-print-actions">
              <div>
                <h2 className="section-title">{t('Kanban siap dicetak', 'Kanban Ready to Print')}</h2>
                <p className="section-sub">{t('QR memuat semua data Kanban dan tidak memakai nomor cetak unik.', 'The QR contains all Kanban data and does not use a unique print number.')}</p>
              </div>
              <div className="row">
                <Button variant="secondary" onClick={() => setPrintedBox(null)}>{t('Tutup', 'Close')}</Button>
                <Button variant="primary" leftIcon={<Printer size={14} />} onClick={() => window.print()}>{t('Cetak label', 'Print Label')}</Button>
              </div>
            </div>
            <div className="kanban-print-label">
              <div className="kanban-print-label__header">
                <img src={askaLogo} alt="ASKA" />
                <strong>WPC · KANBAN</strong>
                <span>{payload.kanbanType} · {payload.partType === 'Sub_Assy' ? 'Sub Assy' : payload.partType}</span>
              </div>
              <h2>{payload.partNumber}</h2>
              <p>{payload.model} · {payload.line}</p>
              <div className="kanban-print-label__details">
                <div><span>Qty</span><strong>{payload.qty} pcs</strong></div>
                <div><span>Operator</span><strong>{payload.operator}</strong></div>
                <div><span>Shift</span><strong>Shift {payload.shift}</strong></div>
                <div><span>Store Location</span><strong>{payload.storeLocation}</strong></div>
                <div><span>Process</span><strong>{payload.process}</strong></div>
                <div><span>Next Process</span><strong>{payload.nextProcess}</strong></div>
              </div>
              <div className="kanban-print-label__qr">
                <QRCodeSVG value={printedBox.kanban} size={180} level="M" />
                <small>{t('Scan untuk membaca seluruh payload Kanban', 'Scan to read the entire Kanban payload')}</small>
              </div>
            </div>
          </section>
        )
      })()}

      <div className="kpi-grid">
        <StatCard
          label={t('Antrian aktif', 'Active Queue')}
          value={String(queue.length)}
          suffix="box"
          icon={ListOrdered}
          tone="orange"
          note={t('Menunggu dikerjakan', 'Waiting to be processed')}
        />
        <StatCard
          label={t('Prioritas urgent', 'Urgent Priority')}
          value={String(urgent)}
          suffix="box"
          icon={TriangleAlert}
          tone="red"
          note={t('Perlu didahulukan', 'Needs to be prioritized')}
        />
        <StatCard
          label={t('Total qty', 'Total Qty')}
          value={formatNumber(totalTaken)}
          suffix="pcs"
          icon={PackageSearch}
          tone="sky"
          note={t('Siap produksi', 'Ready for production')}
        />
        <StatCard
          label={t('Kanban tercetak', 'Printed Kanban')}
          value={String(queue.reduce((sum, item) => sum + (item.printedKanbans ?? 0), 0))}
          suffix={t('box', 'box')}
          icon={Timer}
          tone="amber"
          note={t('Dari database produksi', 'From the production database')}
        />
      </div>

      <div className="row row--wrap">
        {type === 'Sub Assy' && (
          <div className="field" style={{ maxWidth: 260 }}>
            <label className="field-label" htmlFor="sub-assy-process-filter">{t('Line proses', 'Process Line')}</label>
            <select
              id="sub-assy-process-filter"
              className="select"
              value={processFilter}
              onChange={(event) => setProcessFilter(event.target.value)}
            >
              <option value={t('Semua proses', 'All Processes')}>{t('Semua proses', 'All Processes')}</option>
              {Array.from(new Set(queue.map((item) => item.process).filter((process): process is string => Boolean(process))))
                .sort((a, b) => a.localeCompare(b))
                .map((process) => (
                <option key={process} value={process}>{process}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {visibleQueue.length > 0 ? (
        <div className="queue-cards">
          {visibleQueue.map((item, index) => {
            const kanbanQuantity = item.kanbanQuantity
            const remainingQty = Math.max(item.taken - (item.printedQty ?? 0), 0)
            const stockRatio = (item.stock / Math.max(remainingQty, 1)) * 100
            const totalKanbans = kanbanQuantity ? Math.ceil(item.taken / kanbanQuantity) : 0
            const nextKanbanQty = kanbanQuantity
              ? Math.min(kanbanQuantity, remainingQty)
              : undefined
            return (
              <article
                key={item.id}
                className={`queue-card${item.priority === 'urgent' ? ' is-urgent' : ''}`}
              >
                <div className="queue-card__head">
                  <div>
                    <h3>{item.partNumber}</h3>
                    <span>
                      {item.line} · {item.model} · {type} · {t('Antrian', 'Queue')} #{item.no}
                      {item.targetShift && ` · Shift ${item.targetShift}`}
                      {item.process && ` · ${item.process}`}
                    </span>
                  </div>
                  <StatusBadge status={item.priority} />
                </div>

                <div className="queue-card__metrics">
                  <div>
                    <span>{t('Sisa pesanan', 'Remaining Order')}</span>
                    <strong>{formatNumber(remainingQty)} pcs</strong>
                  </div>
                  <div>
                    <span>{t('Kanban tercetak', 'Printed Kanban')}</span>
                    <strong>{item.printedKanbans ?? 0}/{totalKanbans}</strong>
                  </div>
                  <div>
                    <span>{t('Qty / Kanban', 'Qty / Kanban')}</span>
                    <strong>{kanbanQuantity ? `${kanbanQuantity} pcs` : t('Belum diatur', 'Not set')}</strong>
                  </div>
                </div>

                <div>
                  <div className="progress-meta" style={{ marginTop: 0, marginBottom: 5 }}>
                    <span>{t('Stok vs sisa pesanan', 'Stock vs remaining order')}</span>
                    <span>{stockRatio.toFixed(0)}%</span>
                  </div>
                  <ProgressBar
                    value={Math.min(stockRatio, 100)}
                    tone={item.priority === 'urgent' ? 'orange' : 'sky'}
                    thin
                  />
                </div>

                {canOperateQueue && (
                  <div className="queue-adjust">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="grow"
                      leftIcon={<ArrowUpDown size={13} />}
                      onClick={() => {
                        if (user && activeShift) {
                          void cyclePriority(item.id, user.role, activeShift, userLine)
                        }
                      }}
                      title={t('Ubah prioritas antrian', 'Change queue priority')}
                    >
                      {t('Prioritas', 'Priority')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void moveItem(
                          item.id,
                          'up',
                          user?.role ?? 'admin',
                          activeShift ?? 1,
                          userLine,
                          reorderProcess ?? item.process,
                        )
                      }
                      disabled={index === 0}
                      title={t('Naikkan urutan', 'Move up')}
                      aria-label={t('Naikkan urutan', 'Move up')}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void moveItem(
                          item.id,
                          'down',
                          user?.role ?? 'admin',
                          activeShift ?? 1,
                          userLine,
                          reorderProcess ?? item.process,
                        )
                      }
                      disabled={index === visibleQueue.length - 1}
                      title={t('Turunkan urutan', 'Move down')}
                      aria-label={t('Turunkan urutan', 'Move down')}
                    >
                      <ArrowDown size={14} />
                    </Button>
                  </div>
                )}

                {canOperateQueue && (
                  <Button
                    variant="primary"
                    size="sm"
                    block
                    leftIcon={<Printer size={14} />}
                    disabled={!nextKanbanQty}
                    onClick={() => void handlePrint(item.id)}
                  >
                    {nextKanbanQty
                      ? `${t('Cetak Kanban', 'Print Kanban')} ${Math.min((item.printedKanbans ?? 0) + 1, totalKanbans)}/${totalKanbans} · ${nextKanbanQty} pcs`
                      : `${t('Qty Kanban', 'Kanban Qty')} ${item.partNumber} ${t('belum diatur', 'not set')}`}
                  </Button>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <section className="card">
          <div className="empty-state">
            <div className="empty-state__icon">
              <ListOrdered size={22} />
            </div>
            <strong>{t('Antrian', 'Queue')} {type} {t('kosong', 'empty')}</strong>
            <p>
              {queue.length === 0
                ? t(
                    `Belum ada box yang menunggu. Antrian akan terisi otomatis saat Supply melakukan scan kanban ${type}.`,
                    `No boxes waiting yet. The queue will fill automatically when Supply scans the ${type} kanban.`,
                  )
                : t(
                    `Tidak ada antrian Sub Assy untuk line proses ${processFilter}.`,
                    `No Sub Assy queue for process line ${processFilter}.`,
                  )}
            </p>
          </div>
        </section>
      )}

      <div className="grid grid-2">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{t('Riwayat perubahan antrian', 'Queue Change History')}</h2>
              <p className="section-sub">
                {t('Aktivitas terbaru', 'Recent activity')} · {activeWorkArea?.label ?? (activeLine === 'all' ? t('semua line', 'all lines') : activeLine)}
              </p>
            </div>
            <Badge tone="neutral">{entries.length} {t('aktivitas', 'activities')}</Badge>
          </div>

          {entries.length > 0 ? (
            <div className="timeline">
              {entries.map((entry) => (
                <div className="timeline-item" key={entry.id}>
                  <span className="timeline-dot timeline-dot--sky" />
                  <div>
                    <div className="timeline-head">
                      <span className="timeline-title">{entry.title}</span>
                      <span className="timeline-time">{entry.time}</span>
                    </div>
                    <span className="timeline-text">{entry.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span className="small muted">
              {t('Belum ada perubahan. Scan Supply dan penyesuaian urutan akan tercatat di sini.', 'No changes yet. Supply scans and order adjustments will be recorded here.')}
            </span>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">{t('Aturan antrean', 'Queue Rules')} {type}</h2>
                <p className="section-sub">
                  {isAdmin ? t('Mode pemantauan saja', 'Monitoring only') : t('Print = selesai produksi', 'Print = production complete')}
                </p>
              </div>
            </div>

            <div className="stack">
            <Callout
              tone="info"
              title={isAdmin ? t('Informasi progres produksi', 'Production Progress Info') : t('Print kanban = selesai 1 box', 'Print kanban = 1 box complete')}
            >
              {isAdmin
                ? t(
                    'Operator yang berwenang mencetak kanban untuk menyelesaikan produksi per box. Admin hanya memantau progresnya.',
                    'Authorized operators print kanban to complete production per box. Admin only monitors progress.',
                  )
                : t(
                    'Satu klik Print mencetak kanban, menyelesaikan produksi 1 pallet/box, dan mencatat qty standar sebagai OK.',
                    'One click on Print prints the kanban, completes production of 1 pallet/box, and records standard qty as OK.',
                  )}
              </Callout>
              {!isAdmin && (
                <Callout tone="warning" title={t('Operator boleh menyesuaikan', 'Operator may adjust')}>
              {t(
                'Urutan dan prioritas antrian dapat diubah operator sesuai kebutuhan. Setiap perubahan tercatat pada riwayat di samping.',
                'Queue order and priority can be adjusted by the operator as needed. Every change is recorded in the history next to it.',
              )}
                </Callout>
              )}
              <div className="glass-inset" style={{ padding: 14 }}>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">{t('Operator', 'Operator')}</span>
                    <span className="info-value info-value--strong">{user?.name ?? t('Operator', 'Operator')}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">{t('Device', 'Device')}</span>
                    <span className="info-value">{meta.device}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">{t('Line', 'Line')}</span>
                    <span className="info-value">
                      {isAdmin ? (activeLine === 'all' ? t('Semua robot', 'All Robots') : activeLine) : userLine} — {type}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">{t('Akses', 'Access')}</span>
                    <span className="info-value">
                      {isAdmin ? t('Pemantauan saja', 'Monitoring only') : `${t('Aksi antrian', 'Queue Actions')} ${type}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
