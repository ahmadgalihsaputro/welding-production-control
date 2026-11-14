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
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { useQueue } from '../../contexts/QueueContext'
import { formatNumber } from '../../lib/utils'
import { stockPolicies } from '../../data/mock'
import {
  getProductionPart,
  getProductionParts,
  matchesProductionWorkArea,
} from '../../data/productionLines'
import { getShiftNumberAt } from '../../data/productionPlanning'
import type { QueueType, RobotLine } from '../../types'

// Helper: Get standard packaging qty from stockPolicies
function getPackagingQty(partNumber: string): number | undefined {
  const policy = stockPolicies.find((p) => p.partNumber === partNumber)
  return policy?.packaging ?? getProductionPart(partNumber)?.packaging
}

interface ProductionQueuePageProps {
  type: QueueType
}

const copy: Record<
  QueueType,
  { title: string; subtitle: string; productionPath: string; device: string }
> = {
  Assy: {
    title: 'Antrian Produksi Assy',
    subtitle:
      'Daftar box Assy yang siap dikerjakan operator Assy. Print kanban berarti menyelesaikan produksi 1 pallet/box.',
    productionPath: '/production/assy',
    device: 'Tablet Assy Line 01',
  },
  'Sub Assy': {
    title: 'Antrian Replenishment Sub Assy',
    subtitle:
      'Antrean box Sub Assy dari pengambilan Supply. Print kanban berarti menyelesaikan produksi 1 pallet/box.',
    productionPath: '/production/sub-assy',
    device: 'Tablet Sub Assy 02',
  },
}

export function ProductionQueuePage({ type }: ProductionQueuePageProps) {
  const navigate = useNavigate()
  const { user, activeLine, activeWorkArea } = useAuth()
  const { items, audit, printKanban, moveItem, cyclePriority } = useQueue()
  const isAdmin = user?.role === 'admin'
  const userLine: RobotLine = user?.productionLine ??
    (user?.line.includes('Robot H') ? 'Robot H' : 'Robot G')
  const activeShift = getShiftNumberAt()
  const canOperateQueue = Boolean(
    user &&
      user.role !== 'admin' &&
      activeShift &&
      (activeWorkArea?.type === type || user.role === 'leader'),
  )
  const [message, setMessage] = useState('')
  const [processFilter, setProcessFilter] = useState('Semua proses')
  useEffect(() => {
    setProcessFilter('Semua proses')
  }, [activeLine, activeWorkArea?.id])

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
    type === 'Sub Assy' && processFilter !== 'Semua proses'
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
    processFilter === 'Semua proses'
      ? activeWorkArea?.process
      : processFilter

  const handlePrint = async (id: string) => {
    if (!user || !activeShift) return
    setMessage('Mencetak kanban dan menyimpan hasil ke server…')
    const result = await printKanban(id, user.name, user.role, activeShift, userLine)
    if (!result.ok || !result.box) {
      setMessage(result.error ?? 'Kanban tidak ditemukan di antrian.')
      return
    }
    setMessage(
      `Kanban ${result.box.kanban} berhasil dicetak (${result.completedKanbans}/${result.totalKanbans}). ${result.box.qty} pcs ${result.box.partNumber} tercatat sebagai OK.`,
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Production Control"
        title={meta.title}
        subtitle={
          isAdmin
            ? `Mode pemantauan: lihat progres antrean ${activeLine === 'all' ? 'semua robot' : activeLine} ${type}. Admin tidak dapat mencetak kanban atau mengubah antrean.`
            : meta.subtitle
        }
        meta={
          <>
            <span className="page-meta__item">
              <Flame size={12} /> {isAdmin ? (activeLine === 'all' ? 'Semua robot' : activeLine) : activeWorkArea?.label ?? userLine} — {type}{!isAdmin && activeShift ? ` · Shift ${activeShift}` : ''}
            </span>
            <span className="page-meta__item">
              <ListOrdered size={12} /> {canOperateQueue ? 'Urutan bisa diatur operator' : 'Mode pemantauan'}
            </span>
            <span className="page-meta__item">
              <Clock3 size={12} /> Update {queue[0]?.time ?? '—'}
            </span>
          </>
        }
        actions={canOperateQueue && (
          <Button
            variant="primary"
            leftIcon={<Play size={15} />}
            onClick={() => navigate(meta.productionPath)}
          >
            Mulai produksi
          </Button>
        )}
      />

      {isAdmin && (
        <Callout tone="info" title="Akses Admin: pemantauan saja">
          Anda dapat melihat status dan progres produksi, tetapi tidak dapat mencetak kanban,
          mengubah prioritas, atau mengatur urutan antrean.
        </Callout>
      )}
      {!isAdmin && !activeShift && (
        <Callout tone="warning" title="Di luar jam shift">
          Waktu sekarang tidak berada pada jam kerja Shift 1 atau Shift 2. Aksi produksi dinonaktifkan.
        </Callout>
      )}

      {message && <Callout tone={message.includes('berhasil dicetak') ? 'success' : 'warning'}>{message}</Callout>}

      <div className="kpi-grid">
        <StatCard
          label="Antrian aktif"
          value={String(queue.length)}
          suffix="box"
          icon={ListOrdered}
          tone="orange"
          note="Menunggu dikerjakan"
        />
        <StatCard
          label="Prioritas urgent"
          value={String(urgent)}
          suffix="box"
          icon={TriangleAlert}
          tone="red"
          note="Perlu didahulukan"
        />
        <StatCard
          label="Total qty"
          value={formatNumber(totalTaken)}
          suffix="pcs"
          icon={PackageSearch}
          tone="sky"
          note="Siap produksi"
        />
        <StatCard
          label="Rata-rata tunggu"
          value={type === 'Assy' ? '18' : '27'}
          suffix="mnt"
          icon={Timer}
          tone="amber"
          note="Sejak masuk antrian"
        />
      </div>

      <div className="row row--wrap">
        {type === 'Sub Assy' && (
          <div className="field" style={{ maxWidth: 260 }}>
            <label className="field-label" htmlFor="sub-assy-process-filter">Line proses</label>
            <select
              id="sub-assy-process-filter"
              className="select"
              value={processFilter}
              onChange={(event) => setProcessFilter(event.target.value)}
            >
              <option>Semua proses</option>
              {Array.from(new Set(
                getProductionParts('Sub Assy')
                  .filter((part) => isAdmin
                    ? activeLine === 'all' || part.line === activeLine
                    : activeWorkArea
                      ? activeWorkArea.type === 'Sub Assy' &&
                        part.line === activeWorkArea.line &&
                        part.process === activeWorkArea.process
                      : part.line === userLine)
                  .map((part) => part.process),
              )).map((process) => (
                <option key={process} value={process}>{process}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {visibleQueue.length > 0 ? (
        <div className="queue-cards">
          {visibleQueue.map((item, index) => {
            const packagingQty = getPackagingQty(item.partNumber)
            const remainingQty = Math.max(item.taken - (item.printedQty ?? 0), 0)
            const stockRatio = (item.stock / Math.max(remainingQty, 1)) * 100
            const totalKanbans = packagingQty ? Math.ceil(item.taken / packagingQty) : 0
            const nextKanbanQty = packagingQty
              ? Math.min(packagingQty, remainingQty)
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
                      {item.line} · {item.model} · {type} · Antrian #{item.no}
                      {item.targetShift && ` · Shift ${item.targetShift}`}
                      {item.process && ` · ${item.process}`}
                    </span>
                  </div>
                  <StatusBadge status={item.priority} />
                </div>

                <div className="queue-card__metrics">
                  <div>
                    <span>Sisa pesanan</span>
                    <strong>{formatNumber(remainingQty)} pcs</strong>
                  </div>
                  <div>
                    <span>Kanban tercetak</span>
                    <strong>{item.printedKanbans ?? 0}/{totalKanbans}</strong>
                  </div>
                  <div>
                    <span>Kanban order</span>
                    <strong className="mono">{item.kanban}</strong>
                  </div>
                </div>

                <div>
                  <div className="progress-meta" style={{ marginTop: 0, marginBottom: 5 }}>
                    <span>Stok vs sisa pesanan</span>
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
                      title="Ubah prioritas antrian"
                    >
                      Prioritas
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
                      title="Naikkan urutan"
                      aria-label="Naikkan urutan"
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
                      title="Turunkan urutan"
                      aria-label="Turunkan urutan"
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
                      ? `Cetak Kanban ${Math.min((item.printedKanbans ?? 0) + 1, totalKanbans)}/${totalKanbans} · ${nextKanbanQty} pcs`
                      : `Standar packaging ${item.partNumber} belum diatur`}
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
            <strong>Antrian {type} kosong</strong>
            <p>
              {queue.length === 0
                ? `Belum ada box yang menunggu. Antrian akan terisi otomatis saat Supply melakukan scan kanban ${type}.`
                : `Tidak ada antrian Sub Assy untuk line proses ${processFilter}.`}
            </p>
          </div>
        </section>
      )}

      <div className="grid grid-2">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Riwayat perubahan antrian</h2>
              <p className="section-sub">Aktivitas terbaru · {activeWorkArea?.label ?? (activeLine === 'all' ? 'semua line' : activeLine)}</p>
            </div>
            <Badge tone="neutral">{entries.length} aktivitas</Badge>
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
              Belum ada perubahan. Scan Supply dan penyesuaian urutan akan tercatat di sini.
            </span>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Aturan antrean {type}</h2>
                <p className="section-sub">
                  {isAdmin ? 'Mode pemantauan saja' : 'Print = selesai produksi'}
                </p>
              </div>
            </div>

            <div className="stack">
            <Callout
              tone="info"
              title={isAdmin ? 'Informasi progres produksi' : 'Print kanban = selesai 1 box'}
            >
              {isAdmin
                ? 'Operator yang berwenang mencetak kanban untuk menyelesaikan produksi per box. Admin hanya memantau progresnya.'
                : 'Satu klik Print mencetak kanban, menyelesaikan produksi 1 pallet/box, dan mencatat qty standar sebagai OK.'}
              </Callout>
              {!isAdmin && (
                <Callout tone="warning" title="Operator boleh menyesuaikan">
              Urutan dan prioritas antrian dapat diubah operator sesuai kebutuhan. Setiap
              perubahan tercatat pada riwayat di samping.
                </Callout>
              )}
              <div className="glass-inset" style={{ padding: 14 }}>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Operator</span>
                    <span className="info-value info-value--strong">{user?.name ?? 'Operator'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Device</span>
                    <span className="info-value">{meta.device}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Line</span>
                    <span className="info-value">
                      {isAdmin ? (activeLine === 'all' ? 'Semua robot' : activeLine) : userLine} — {type}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Akses</span>
                    <span className="info-value">
                      {isAdmin ? 'Pemantauan saja' : `Aksi antrian ${type}`}
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
