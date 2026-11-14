import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Boxes,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Clock3,
  Factory,
  Gauge,
  Hourglass,
  PackageCheck,
  PackageSearch,
  Plus,
  ScanLine,
  Store,
  Target,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart } from '../../components/charts/AreaChart'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { RadialGauge } from '../../components/charts/RadialGauge'
import { WeldingIcon } from '../../components/brand/Logo'
import { Badge } from '../../components/ui/Badge'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tabs } from '../../components/ui/Tabs'
import { Callout } from '../../components/ui/Callout'
import { useAuth } from '../../contexts/AuthContext'
import { useQueue } from '../../contexts/QueueContext'
import { getProductionPart, matchesProductionWorkArea } from '../../data/productionLines'
import {
  isBoxCompletedAfterShiftTotal,
  localDateKey,
  matchesProductionShiftBox,
  readProductionShiftRecords,
} from '../../data/productionLog'
import {
  getProductionDateForShift,
  getShiftNumberAt,
  getShiftProgressAt,
} from '../../data/productionPlanning'
import {
  cumulativeActual,
  cumulativeTarget,
  hourlyActual,
  hourlyLabels,
  hourlyTarget,
  machines,
  materialAlerts,
  productionResults,
  quickActions,
  recentActivities,
  scheduleItems,
  weeklyOutput,
} from '../../data/mock'
import { cn, formatNumber, formatPercent, greeting, todayLabel } from '../../lib/utils'

const quickIcons = {
  scan: ScanLine,
  plus: Plus,
  store: Store,
  request: ClipboardList,
}

const quickRoutes: Record<string, string> = {
  'qa-1': '/material/pickup',
  'qa-2': '/production/assy',
  'qa-3': '/inventory/buffer',
  'qa-4': '/material/request',
}

const alertIcons = {
  danger: TriangleAlert,
  warning: PackageSearch,
  info: Boxes,
}

const alertTones = {
  danger: 'red',
  warning: 'amber',
  info: 'sky',
}

const activityTones: Record<string, string> = {
  production: 'orange',
  material: 'sky',
  inventory: 'green',
  system: 'amber',
}

function loadProductionTotals() {
  try {
    return { records: readProductionShiftRecords(), error: '' }
  } catch (error) {
    return {
      records: [],
      error: error instanceof Error ? error.message : 'Hasil shift gagal dibaca.',
    }
  }
}

export function DashboardPage() {
  const { user, activeLine, activeWorkArea } = useAuth()
  const { items, completed } = useQueue()
  const navigate = useNavigate()
  const [trendView, setTrendView] = useState<'hourly' | 'cumulative'>('hourly')
  const [productionTotals] = useState(loadProductionTotals)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const firstName = user?.name.split(' ')[0] ?? 'Operator'
  const activeShift = getShiftNumberAt(now)
  const shiftProgress = getShiftProgressAt(now)
  const queueType = activeWorkArea?.type ??
    (user?.role === 'operator_sub_assy' ? 'Sub Assy' : 'Assy')
  const dashboardQueue = items.filter(
    (item) =>
      item.type === queueType &&
      (activeWorkArea
        ? matchesProductionWorkArea(activeWorkArea, {
            ...item,
            process: item.process ?? getProductionPart(item.partNumber)?.process,
          })
        : activeLine === 'all' || item.line === activeLine),
  )
  const queuePath = queueType === 'Assy' ? '/production/assy-queue' : '/production/queue'
  const visibleMachines = machines.filter(
    (machine) =>
      (activeWorkArea
        ? machine.line === activeWorkArea.line &&
          machine.processes.includes(
            activeWorkArea.type === 'Assy' ? 'Assy Welding' : 'Sub Assy Welding',
          )
        : activeLine === 'all' || machine.line === activeLine),
  )
  const activeMachineCount = visibleMachines.filter((machine) => machine.status === 'active').length
  const lineLabel = activeWorkArea?.label ?? (activeLine === 'all' ? 'Semua line' : activeLine)
  const todayProductionTotals = productionTotals.records.filter(
    (record) =>
      record.date === (activeShift
        ? getProductionDateForShift(activeShift, now)
        : localDateKey(now)),
  )
  const productionTotalKeys = new Set(
    todayProductionTotals.map((record) =>
      `${record.partNumber}:${record.shift}:${record.line}:${record.process ?? ''}`,
    ),
  )
  const totalForBox = (box: (typeof completed)[number]) =>
    todayProductionTotals.find((record) =>
      matchesProductionShiftBox(box, record) &&
      (record.process ?? '') === (getProductionPart(box.partNumber)?.process ?? ''),
    )
  const allResults = [
    ...productionResults.filter((record) =>
      !productionTotalKeys.has(
        `${record.partNumber}:${record.shift}:${record.line}:${getProductionPart(record.partNumber)?.process ?? ''}`,
      ),
    ),
    ...completed
      .filter((box) => {
        const total = totalForBox(box)
        return !total || isBoxCompletedAfterShiftTotal(box, total)
      })
      .map((box) => ({
      id: box.id,
      partNumber: box.partNumber,
      type: box.type,
      ok: box.qty,
      ng: 0,
      shift: box.shift ?? 1,
      operator: box.operator,
      time: box.completedAt,
      line: box.line ?? 'Robot G',
    })),
    ...todayProductionTotals.map((record) => ({
      id: record.id,
      partNumber: record.partNumber,
      type: record.type,
      ok: record.ok + completed
        .filter((box) =>
          totalForBox(box)?.id === record.id &&
          isBoxCompletedAfterShiftTotal(box, record))
        .reduce((sum, box) => sum + box.qty, 0),
      ng: record.ng,
      shift: record.shift,
      operator: record.operator,
      time: `${record.date} ${record.time}`,
      line: record.line,
    })),
  ]
  const visibleResults = allResults.filter(
    (item) => {
      if (item.type !== queueType) return false
      if (activeWorkArea) {
        const part = getProductionPart(item.partNumber)
        return Boolean(
          part &&
            matchesProductionWorkArea(activeWorkArea, {
              line: part.line,
              type: item.type,
              process: part.process,
            }),
        )
      }
      return activeLine === 'all' || item.line === activeLine
    },
  )
  const visibleSchedule = scheduleItems.filter(
    (item) =>
      (!activeWorkArea || activeWorkArea.type === 'Assy') &&
      (activeLine === 'all' || item.line === activeLine) &&
      (!activeWorkArea ||
        (item.line === activeWorkArea.line &&
          getProductionPart(item.partNumber)?.process === activeWorkArea.process)),
  )
  const dashboardSummary = {
    target: visibleSchedule.reduce((sum, item) => sum + item.target, 0),
    actual: visibleResults.reduce((sum, item) => sum + item.ok, 0),
    ngRate:
      (visibleResults.reduce((sum, item) => sum + item.ng, 0) /
        Math.max(visibleResults.reduce((sum, item) => sum + item.ok + item.ng, 0), 1)) * 100,
    byShift: {
      shift1: visibleResults.filter((item) => item.shift === 1).reduce((sum, item) => sum + item.ok, 0),
      shift2: visibleResults.filter((item) => item.shift === 2).reduce((sum, item) => sum + item.ok, 0),
    },
  }
  const achievement = (dashboardSummary.actual / Math.max(dashboardSummary.target, 1)) * 100
  const hasTarget = visibleSchedule.length > 0
  const hasResults = visibleResults.length > 0
  const targetValues = trendView === 'hourly' ? hourlyTarget : cumulativeTarget
  const actualValues = trendView === 'hourly' ? hourlyActual : cumulativeActual
  const hasTrendData = activeLine === 'Robot G' && !activeWorkArea
  const selectedTargetValues = !hasTrendData
    ? targetValues.map(() => 0)
    : targetValues
  const selectedActualValues = !hasTrendData
    ? actualValues.map(() => 0)
    : actualValues
  const selectedWeeklyOutput = !hasTrendData
    ? weeklyOutput.map((item) => ({ ...item, target: 0, actual: 0 }))
    : weeklyOutput

  return (
    <div className="dashboard">
      {productionTotals.error && (
        <Callout tone="danger" title="Hasil produksi tidak tersedia">
          {productionTotals.error}
        </Callout>
      )}
      <section className="welcome-card card">
        <WeldingIcon size={190} className="welcome-flame" />
        <div className="welcome-card__copy">
          <span className="welcome-card__eyebrow">
            <span className="line-dot" />
            {lineLabel} · {activeShift ? `Shift ${activeShift} · Online` : 'Di luar shift / istirahat'}
          </span>
          <h1>
            {greeting()}, <strong>{firstName}</strong>
          </h1>
          <p>
            Produksi {lineLabel} berjalan sesuai data terpilih. Ada 4 hal yang perlu dicek sebelum
            pergantian shift.
          </p>
          <div className="welcome-meta">
            <span className="meta-chip">
              <CalendarDays size={12} />
              {todayLabel(now)}
            </span>
            <span className="meta-chip">
              <Clock3 size={12} />
              {activeShift ? `Shift ${activeShift}` : 'Tidak ada shift aktif'}
            </span>
            <span className="meta-chip">
              <Factory size={12} />
              {queueType}
            </span>
            <span className="meta-chip">
              <CircleCheck size={12} />
              FSS sync 07:00
            </span>
          </div>
        </div>

        <div className="welcome-card__side">
          <div className="shift-clock">
            <strong>{now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</strong>
            <span>
              {activeShift && shiftProgress !== undefined
                ? `Shift ${activeShift} berjalan · ${Math.round(shiftProgress)}%`
                : 'Di luar jam aktif'}
            </span>
            <ProgressBar
              value={shiftProgress ?? 0}
              thin
              tone="gradient"
              label="Progress shift"
            />
          </div>
          <div className="welcome-quick">
            {quickActions
              .filter((action) => {
                if (user?.role === 'management') return false
                if (user?.role === 'admin' && action.id === 'qa-2') return false
                return true
              })
              .map((action) => {
              const Icon = quickIcons[action.icon as keyof typeof quickIcons] ?? ScanLine
              return (
                <button
                  key={action.id}
                  type="button"
                  className="welcome-quick__item"
                  onClick={() =>
                    navigate(
                      action.id === 'qa-2' && activeWorkArea?.type === 'Sub Assy'
                        ? '/production/sub-assy'
                        : quickRoutes[action.id] ?? '/',
                    )
                  }
                >
                  <Icon size={13} />
                  {action.label}
                </button>
              )
              })}
          </div>
        </div>
      </section>

      <div className="kpi-grid">
        <StatCard
          label={`Target ${queueType}`}
          value={hasTarget ? formatNumber(dashboardSummary.target) : '—'}
          suffix={hasTarget ? 'pcs' : undefined}
          icon={Target}
          tone="orange"
          note={`${activeShift ? `Shift ${activeShift}` : 'Di luar shift'} · ${lineLabel}`}
          spark={selectedTargetValues}
          sparkColor="#f97316"
        />
        <StatCard
          label={`Actual ${queueType}`}
          value={hasResults ? formatNumber(dashboardSummary.actual) : '—'}
          suffix={hasResults ? 'pcs' : undefined}
          icon={PackageCheck}
          tone="sky"
          trend={hasTrendData ? { label: '+12,4%', direction: 'up' } : undefined}
          note="vs kemarin"
          spark={selectedActualValues}
          sparkColor="#38bdf8"
        />
        <StatCard
          label="Achievement"
          value={hasTarget ? formatPercent(achievement) : '—'}
          icon={Gauge}
          tone="green"
          trend={hasTrendData ? { label: '+6,1%', direction: 'up' } : undefined}
          note="vs shift lalu"
          spark={hasTrendData ? cumulativeActual : cumulativeActual.map(() => 0)}
          sparkColor="#10b981"
        />
        <StatCard
          label="Balance Target"
          value={hasTarget ? formatNumber(dashboardSummary.target - dashboardSummary.actual) : '—'}
          suffix={hasTarget ? 'pcs' : undefined}
          icon={Hourglass}
          tone="amber"
          note="Sisa target hari ini"
          spark={hasTrendData ? [340, 330, 315, 290, 270] : [0, 0, 0, 0, 0]}
          sparkColor="#f59e0b"
        />
      </div>

      <div className="dash-main-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">Production achievement</h2>
              <p className="section-sub">Output per jam · {lineLabel} · {activeShift ? `Shift ${activeShift}` : 'semua shift'}</p>
            </div>
            <Tabs
              ariaLabel="Tampilan grafik produksi"
              value={trendView}
              onChange={(value) => setTrendView(value as 'hourly' | 'cumulative')}
              items={[
                { value: 'hourly', label: 'Per jam' },
                { value: 'cumulative', label: 'Kumulatif' },
              ]}
            />
          </div>

          {hasTrendData ? (
            <AreaChart
              labels={hourlyLabels}
              height={400}
              ariaLabel="Grafik target dan actual produksi per jam"
              series={[
                {
                  name: 'Target',
                  color: '#38bdf8',
                  values: selectedTargetValues,
                  area: false,
                  dashed: true,
                },
                { name: 'Actual', color: '#f97316', values: selectedActualValues },
              ]}
            />
          ) : (
            <div className="empty-state" style={{ minHeight: 300 }}>
              <p>Data tren per jam belum tersedia untuk {lineLabel}. Angka produksi di bawah tetap mengikuti data area terpilih.</p>
            </div>
          )}

          <div className="chart-insight-row">
            <div className="chart-insight">
              <span>Peak output</span>
              <strong>{hasTrendData ? '136 pcs' : '—'}</strong>
              <small>{hasTrendData ? '09:00 · Machine A' : 'Belum ada data'}</small>
            </div>
            <div className="chart-insight">
              <span>Lowest output</span>
              <strong>{hasTrendData ? '100 pcs' : '—'}</strong>
              <small>{hasTrendData ? '16:00 · pergantian shift' : 'Belum ada data'}</small>
            </div>
            <div className="chart-insight">
              <span>Rata-rata / jam</span>
              <strong>{hasTrendData ? '124 pcs' : '—'}</strong>
              <small>{hasTrendData ? 'Target 126 pcs' : 'Belum ada data'}</small>
            </div>
          </div>

          <div className="chart-card__foot">
            <div className="chart-summary">
              <div className="chart-summary__item">
                <span>Target</span>
                <strong>{hasTarget ? `${formatNumber(dashboardSummary.target)} pcs` : '—'}</strong>
              </div>
              <div className="chart-summary__item">
                <span>Actual</span>
                <strong>{hasResults ? `${formatNumber(dashboardSummary.actual)} pcs` : '—'}</strong>
              </div>
              <div className="chart-summary__item">
                <span>Gap</span>
                <strong>{hasTarget ? `${formatNumber(dashboardSummary.target - dashboardSummary.actual)} pcs` : '—'}</strong>
              </div>
            </div>
            <Badge tone={hasTarget ? 'success' : 'neutral'} dot>
              {hasTarget
                ? `${formatPercent(achievement)} · ${achievement >= 80 ? 'On track' : 'Perlu perhatian'}`
                : 'Target area belum tersedia'}
            </Badge>
          </div>
        </section>

        <div className="dash-side">
          <section className="card section-card">
            <div className="chart-card__head" style={{ marginBottom: 6 }}>
              <div>
                <h2 className="section-title">Achievement</h2>
                <p className="section-sub">Target vs hasil aktual</p>
              </div>
              <BadgeCheck size={18} className="text-green" />
            </div>

            <div className="achievement-panel">
              {hasTarget ? (
                <RadialGauge value={achievement} size={148} label="Achievement" />
              ) : (
                <div className="empty-state" style={{ minHeight: 148, minWidth: 148 }}>
                  <p>Target area belum tersedia.</p>
                </div>
              )}
              <div className="achievement-facts">
                <div className="fact-row">
                  <span>Target</span>
                  <strong>{hasTarget ? `${formatNumber(dashboardSummary.target)} pcs` : '—'}</strong>
                </div>
                <div className="fact-row">
                  <span>Actual</span>
                  <strong>{hasResults ? `${formatNumber(dashboardSummary.actual)} pcs` : '—'}</strong>
                </div>
                <div className="fact-row">
                  <span>Gap</span>
                  <strong>{hasTarget ? `${formatNumber(dashboardSummary.target - dashboardSummary.actual)} pcs` : '—'}</strong>
                </div>
                <div className="fact-row">
                  <span>NG ratio</span>
                  <strong className="text-green">{hasResults ? formatPercent(dashboardSummary.ngRate, 2) : '—'}</strong>
                </div>
                <div className="fact-row">
                  <span>Downtime</span>
                  <strong>—</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="card section-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Machine status</h2>
                <p className="section-sub">Work center {lineLabel}</p>
              </div>
              <StatusBadge
                status={activeMachineCount > 0 ? 'active' : 'inactive'}
                label={`${activeMachineCount} aktif`}
              />
            </div>

            <div className="machine-list">
              {visibleMachines.map((machine) => (
                <div className="machine-row" key={machine.id}>
                  <span className={`machine-dot machine-dot--${machine.status}`} />
                  <div className="machine-copy">
                    <strong>{machine.name}</strong>
                    <span>{machine.processes.join(' · ')}</span>
                  </div>
                  <span className="machine-load">
                    {machine.status === 'active'
                      ? 'Aktif'
                      : machine.status === 'maintenance'
                        ? 'Maintenance'
                        : 'Nonaktif'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="report-chart-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">Weekly output</h2>
              <p className="section-sub">Target vs actual 6 hari terakhir</p>
            </div>
            <Badge tone="sky">
              {hasResults ? `${formatNumber(dashboardSummary.actual)} pcs hari ini` : 'Belum ada data aktual'}
            </Badge>
          </div>

          {hasTrendData ? (
            <BarChart
              labels={selectedWeeklyOutput.map((item) => item.day)}
              height={246}
              ariaLabel="Grafik output mingguan target dan actual"
              series={[
                {
                  name: 'Target',
                  color: '#38bdf8',
                  values: selectedWeeklyOutput.map((item) => item.target),
                },
                {
                  name: 'Actual',
                  color: '#f97316',
                  values: selectedWeeklyOutput.map((item) => item.actual),
                },
              ]}
            />
          ) : (
            <div className="empty-state" style={{ minHeight: 246 }}>
              <p>Data output mingguan belum tersedia untuk {lineLabel}.</p>
            </div>
          )}
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Distribusi shift</h2>
              <p className="section-sub">Output hari ini per shift</p>
            </div>
            <Clock3 size={17} className="muted" />
          </div>

          {hasResults ? (
            <DonutChart
              data={[
                { label: 'Shift 1', value: dashboardSummary.byShift.shift1, color: '#38bdf8' },
                { label: 'Shift 2', value: dashboardSummary.byShift.shift2, color: '#f97316' },
              ]}
              size={172}
              centerValue={formatNumber(dashboardSummary.actual)}
              centerLabel="pcs output"
            />
          ) : (
            <div className="empty-state" style={{ minHeight: 172 }}>
              <p>Data output per shift belum tersedia untuk {lineLabel}.</p>
            </div>
          )}

          <div className="callout" style={{ marginTop: 14 }}>
            <div className="callout__icon">
              <Activity size={14} />
            </div>
            <div className="callout__copy">
              <strong>Shift 2 bersiap</strong>
              <div>
                Target Shift 2 sebesar {formatNumber(visibleSchedule
                  .filter((item) => item.shift === 2)
                  .reduce((sum, item) => sum + item.target, 0))} pcs. Pastikan Sub Assy Store cukup.
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="dash-bottom-grid">
        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Material alerts</h2>
              <p className="section-sub">Perlu tindakan hari ini</p>
            </div>
            <Badge tone="danger" dot>
              {materialAlerts.length} alert
            </Badge>
          </div>

          <div className="stack-sm">
            {materialAlerts.map((alert) => {
              const Icon = alertIcons[alert.severity]
              return (
                <div className="alert-row" key={alert.id}>
                  <div className={`alert-icon stat-icon--${alertTones[alert.severity]}`}>
                    <Icon size={15} />
                  </div>
                  <div className="alert-copy">
                    <span className="alert-title">{alert.title}</span>
                    <span className="alert-detail">{alert.detail}</span>
                  </div>
                  <span className="alert-count">{alert.count}</span>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 10, paddingLeft: 0 }}
            onClick={() => navigate('/inventory/overview')}
          >
            Lihat inventory <ArrowRight size={13} />
          </button>
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Antrian {queueType}</h2>
              <p className="section-sub">
                {queueType === 'Assy' ? 'Produksi Assy' : 'Urutan replenishment FIFO'}
              </p>
            </div>
            <Badge tone={queueType === 'Assy' ? 'sky' : 'orange'}>
              {dashboardQueue.length} antrian
            </Badge>
          </div>

          <div className="queue-mini-list">
            {dashboardQueue.slice(0, 4).map((item) => (
              <div
                className={cn('queue-mini', item.priority === 'urgent' && 'is-urgent')}
                key={item.id}
              >
                <span className="queue-mini__num">{item.no}</span>
                <div className="queue-mini__copy">
                  <strong>{item.partNumber}</strong>
                  <span>
                    {item.taken} pcs diambil · {item.time}
                  </span>
                </div>
                <StatusBadge status={item.priority} />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm btn-block"
            style={{ marginTop: 10 }}
            onClick={() => navigate(queuePath)}
          >
            Buka antrian <ArrowRight size={13} />
          </button>
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Recent activity</h2>
              <p className="section-sub">Transaksi terakhir hari ini</p>
            </div>
            <Activity size={17} className="muted" />
          </div>

          <div className="timeline">
            {recentActivities.map((activity) => (
              <div className="timeline-item" key={activity.id}>
                <span className={`timeline-dot ${activityTones[activity.type] === 'sky' ? 'timeline-dot--sky' : activityTones[activity.type] === 'green' ? 'timeline-dot--green' : activityTones[activity.type] === 'amber' ? 'timeline-dot--amber' : ''}`} />
                <div>
                  <div className="timeline-head">
                    <span className="timeline-title">{activity.title}</span>
                    <span className="timeline-time">{activity.time}</span>
                  </div>
                  <span className="timeline-text">{activity.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
