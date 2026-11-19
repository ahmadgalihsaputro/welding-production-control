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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart } from '../../components/charts/AreaChart'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { RadialGauge } from '../../components/charts/RadialGauge'
import { WeldingIcon } from '../../components/brand/Logo'
import { Badge } from '../../components/ui/Badge'
import { Callout } from '../../components/ui/Callout'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tabs } from '../../components/ui/Tabs'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { quickActions } from '../../data/mock'
import { getShiftNumberAt, getShiftProgressAt } from '../../data/productionPlanning'
import { describeApiError } from '../../lib/api'
import { getDashboard, type DashboardData } from '../../lib/dashboardApi'
import { cn, formatNumber, formatPercent, greeting } from '../../lib/utils'

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

const hourlyLabels = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00']

function cumulative(values: number[]) {
  let sum = 0
  return values.map((value) => (sum += value))
}

export function DashboardPage() {
  const { user, activeLine, activeWorkArea } = useAuth()
  const { t, locale, formatDate, formatTime } = usePreferences()
  const navigate = useNavigate()
  const [trendView, setTrendView] = useState<'hourly' | 'cumulative'>('hourly')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => new Date())

  const dashboardLine = activeWorkArea?.line ?? activeLine
  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDashboard(await getDashboard(dashboardLine))
    } catch (loadError) {
      setError(describeApiError(loadError, t('Data dashboard gagal dimuat.', 'Dashboard data failed to load.')))
    } finally {
      setLoading(false)
    }
  }, [dashboardLine, t])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const data = dashboard
  const kpi = data?.kpi
  const firstName = user?.name.split(' ')[0] ?? 'Operator'
  const activeShift = getShiftNumberAt(now)
  const shiftProgress = getShiftProgressAt(now)
  const queueType = activeWorkArea?.type ??
    (user?.role === 'operator_sub_assy' ? 'Sub Assy' : 'Assy')
  const queuePath = queueType === 'Assy' ? '/production/assy-queue' : '/production/queue'
  const lineLabel = activeWorkArea?.label ?? (activeLine === 'all' ? t('Semua line', 'All lines') : activeLine)

  const machines = useMemo(
    () => data?.machines ?? [],
    [data],
  )
  const activeMachineCount = machines.filter((machine) => machine.status === 'active').length

  const daily = data?.daily ?? []
  const weeklyLabels = daily.map((day) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(`${day.date}T00:00:00`)),
  )

  const boxes = data?.completedBoxes ?? []
  const hourlyActualValues = hourlyLabels.map((label) =>
    boxes.filter((box) => formatTime(box.completedAt).slice(0, 2) === label.slice(0, 2))
      .reduce((sum, box) => sum + box.qty, 0),
  )
  const hourlyTargetValues = kpi && kpi.target > 0
    ? hourlyLabels.map(() => Math.round(kpi.target / hourlyLabels.length))
    : hourlyLabels.map(() => 0)
  const targetValues = trendView === 'hourly' ? hourlyTargetValues : cumulative(hourlyTargetValues)
  const actualValues = trendView === 'hourly' ? hourlyActualValues : cumulative(hourlyActualValues)
  const hasTrendData = boxes.length > 0

  const shiftActual = {
    shift1: boxes.filter((box) => box.shift === 1).reduce((sum, box) => sum + box.qty, 0),
    shift2: boxes.filter((box) => box.shift === 2).reduce((sum, box) => sum + box.qty, 0),
  }
  const shift2Target = (data?.schedules ?? [])
    .filter((item) => item.shift === 2)
    .reduce((sum, item) => sum + item.target, 0)

  const hasTarget = (kpi?.target ?? 0) > 0
  const hasResults = (kpi?.actual ?? 0) > 0 || (kpi?.completedToday ?? 0) > 0
  const achievement = kpi?.achievement ?? 0
  const ngRate = kpi && kpi.actual + kpi.ngToday > 0
    ? (kpi.ngToday / (kpi.actual + kpi.ngToday)) * 100
    : 0

  const stockAlerts = data?.stockAlerts ?? []
  const queue = data?.queue ?? []
  const activities = data?.activities ?? []

  return (
    <div className="dashboard">
      {error && (
        <Callout tone="danger" title={t('Data dashboard tidak tersedia', 'Dashboard data unavailable')}>
          {error}
        </Callout>
      )}
      {loading && !data && <Callout tone="info">{t('Memuat data dashboard dari database…', 'Loading dashboard data from the database...')}</Callout>}
      <section className="welcome-card card">
        <WeldingIcon size={190} className="welcome-flame" />
        <div className="welcome-card__copy">
          <span className="welcome-card__eyebrow">
            <span className="line-dot" />
            {lineLabel} · {activeShift ? `Shift ${activeShift} · Online` : t('Di luar shift / istirahat', 'Outside shift / break')}
          </span>
          <h1>
            {t(greeting(), 'Hello')}, <strong>{firstName}</strong>
          </h1>
          <p>
            {t('Produksi', 'Production')} {lineLabel}{' '}
            {t('berjalan sesuai data database terpilih. Ada 4 hal yang perlu dicek sebelum pergantian shift.', 'is running according to the selected database data. There are 4 things to check before the shift change.')}
          </p>
          <div className="welcome-meta">
            <span className="meta-chip">
              <CalendarDays size={12} />
              {formatDate(now)}
            </span>
            <span className="meta-chip">
              <Clock3 size={12} />
              {activeShift ? `Shift ${activeShift}` : t('Tidak ada shift aktif', 'No active shift')}
            </span>
            <span className="meta-chip">
              <Factory size={12} />
              {queueType}
            </span>
            <span className="meta-chip">
              <CircleCheck size={12} />
              {t('Database', 'Database')} · {kpi ? formatNumber(kpi.completedToday) : '—'} pcs
            </span>
          </div>
        </div>

        <div className="welcome-card__side">
          <div className="shift-clock">
            <strong>{formatTime(now)}</strong>
            <span>
              {activeShift && shiftProgress !== undefined
                ? `Shift ${activeShift} ${t('berjalan', 'in progress')} · ${Math.round(shiftProgress)}%`
                : t('Di luar jam aktif', 'Outside active hours')}
            </span>
            <ProgressBar
              value={shiftProgress ?? 0}
              thin
              tone="gradient"
              label={t('Progress shift', 'Shift progress')}
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
          label={`${t('Target', 'Target')} ${queueType}`}
          value={hasTarget ? formatNumber(kpi!.target) : '—'}
          suffix={hasTarget ? 'pcs' : undefined}
          icon={Target}
          tone="orange"
          note={`${activeShift ? `Shift ${activeShift}` : t('Di luar shift', 'Outside shift')} · ${lineLabel}`}
          spark={targetValues}
          sparkColor="#f97316"
        />
        <StatCard
          label={`Actual ${queueType}`}
          value={hasResults ? formatNumber(kpi!.actual + kpi!.completedToday) : '—'}
          suffix={hasResults ? 'pcs' : undefined}
          icon={PackageCheck}
          tone="sky"
          note={t('dari database', 'from database')}
          spark={actualValues}
          sparkColor="#38bdf8"
        />
        <StatCard
          label="Achievement"
          value={hasTarget ? formatPercent(achievement) : '—'}
          icon={Gauge}
          tone="green"
          note={t('dari target database', 'from database target')}
          spark={cumulative(actualValues)}
          sparkColor="#10b981"
        />
        <StatCard
          label="Balance Target"
          value={hasTarget ? formatNumber(kpi!.target - kpi!.actual - kpi!.completedToday) : '—'}
          suffix={hasTarget ? 'pcs' : undefined}
          icon={Hourglass}
          tone="amber"
          note={t('Sisa target hari ini', 'Remaining target today')}
          spark={cumulative(hourlyTargetValues.map((value, index) => value - hourlyActualValues[index]))}
          sparkColor="#f59e0b"
        />
      </div>

      <div className="dash-main-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">{t('Production achievement', 'Production achievement')}</h2>
              <p className="section-sub">{t('Output per jam', 'Output per hour')} · {lineLabel} · {activeShift ? `Shift ${activeShift}` : t('semua shift', 'all shifts')}</p>
            </div>
            <Tabs
              ariaLabel={t('Tampilan grafik produksi', 'Production chart view')}
              value={trendView}
              onChange={(value) => setTrendView(value as 'hourly' | 'cumulative')}
              items={[
                { value: 'hourly', label: t('Per jam', 'Hourly') },
                { value: 'cumulative', label: t('Kumulatif', 'Cumulative') },
              ]}
            />
          </div>

          {hasTrendData ? (
            <AreaChart
              labels={hourlyLabels}
              height={400}
              ariaLabel={t('Grafik target dan actual produksi per jam', 'Hourly production target and actual chart')}
              series={[
                {
                  name: 'Target',
                  color: '#38bdf8',
                  values: targetValues,
                  area: false,
                  dashed: true,
                },
                { name: 'Actual', color: '#f97316', values: actualValues },
              ]}
            />
          ) : (
            <div className="empty-state" style={{ minHeight: 300 }}>
              <p>{t('Belum ada box selesai untuk grafik per jam pada', 'No completed boxes for the hourly chart on')} {lineLabel}. {t('Angka produksi di bawah tetap mengikuti data database.', 'The production figures below still follow database data.')}</p>
            </div>
          )}

          <div className="chart-insight-row">
            <div className="chart-insight">
              <span>{t('Peak output', 'Peak output')}</span>
              <strong>{hasTrendData ? `${Math.max(...hourlyActualValues)} pcs` : '—'}</strong>
              <small>{hasTrendData ? `${hourlyLabels[hourlyActualValues.indexOf(Math.max(...hourlyActualValues))]}` : t('Belum ada data', 'No data yet')}</small>
            </div>
            <div className="chart-insight">
              <span>{t('Lowest output', 'Lowest output')}</span>
              <strong>{hasTrendData ? `${Math.min(...hourlyActualValues)} pcs` : '—'}</strong>
              <small>{hasTrendData ? `${hourlyLabels[hourlyActualValues.indexOf(Math.min(...hourlyActualValues))]}` : t('Belum ada data', 'No data yet')}</small>
            </div>
            <div className="chart-insight">
              <span>{t('Rata-rata / jam', 'Average / hour')}</span>
              <strong>{hasTrendData ? `${Math.round(hourlyActualValues.reduce((a, b) => a + b, 0) / hourlyLabels.length)} pcs` : '—'}</strong>
              <small>{hasTarget ? `${t('Target', 'Target')} ${formatNumber(Math.round(kpi!.target / hourlyLabels.length))} pcs` : t('Belum ada data', 'No data yet')}</small>
            </div>
          </div>

          <div className="chart-card__foot">
            <div className="chart-summary">
              <div className="chart-summary__item">
                <span>Target</span>
                <strong>{hasTarget ? `${formatNumber(kpi!.target)} pcs` : '—'}</strong>
              </div>
              <div className="chart-summary__item">
                <span>Actual</span>
                <strong>{hasResults ? `${formatNumber(kpi!.actual + kpi!.completedToday)} pcs` : '—'}</strong>
              </div>
              <div className="chart-summary__item">
                <span>Gap</span>
                <strong>{hasTarget ? `${formatNumber(kpi!.target - kpi!.actual - kpi!.completedToday)} pcs` : '—'}</strong>
              </div>
            </div>
            <Badge tone={hasTarget ? 'success' : 'neutral'} dot>
              {hasTarget
                ? `${formatPercent(achievement)} · ${achievement >= 80 ? 'On track' : t('Perlu perhatian', 'Needs attention')}`
                : t('Target area belum tersedia', 'Area target not yet available')}
            </Badge>
          </div>
        </section>

        <div className="dash-side">
          <section className="card section-card">
            <div className="chart-card__head" style={{ marginBottom: 6 }}>
              <div>
                <h2 className="section-title">Achievement</h2>
                <p className="section-sub">{t('Target vs hasil aktual', 'Target vs actual results')}</p>
              </div>
              <BadgeCheck size={18} className="text-green" />
            </div>

            <div className="achievement-panel">
              {hasTarget ? (
                <RadialGauge value={achievement} size={148} label="Achievement" />
              ) : (
                <div className="empty-state" style={{ minHeight: 148, minWidth: 148 }}>
                  <p>{t('Target area belum tersedia.', 'Area target not yet available.')}</p>
                </div>
              )}
              <div className="achievement-facts">
                <div className="fact-row">
                  <span>Target</span>
                  <strong>{hasTarget ? `${formatNumber(kpi!.target)} pcs` : '—'}</strong>
                </div>
                <div className="fact-row">
                  <span>Actual</span>
                  <strong>{hasResults ? `${formatNumber(kpi!.actual + kpi!.completedToday)} pcs` : '—'}</strong>
                </div>
                <div className="fact-row">
                  <span>Gap</span>
                  <strong>{hasTarget ? `${formatNumber(kpi!.target - kpi!.actual - kpi!.completedToday)} pcs` : '—'}</strong>
                </div>
                <div className="fact-row">
                  <span>NG ratio</span>
                  <strong className="text-green">{hasResults ? formatPercent(ngRate, 2) : '—'}</strong>
                </div>
                <div className="fact-row">
                  <span>{t('Antrian', 'Queue')}</span>
                  <strong>{kpi ? kpi.queueWaiting + kpi.queueRunning : '—'}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="card section-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">{t('Machine status', 'Machine status')}</h2>
                <p className="section-sub">{t('Work center', 'Work center')} {lineLabel}</p>
              </div>
              <StatusBadge
                status={activeMachineCount > 0 ? 'active' : 'inactive'}
                label={`${activeMachineCount} ${t('aktif', 'active')}`}
              />
            </div>

            <div className="machine-list">
              {machines.map((machine) => (
                <div className="machine-row" key={machine.id}>
                  <span className={`machine-dot machine-dot--${machine.status}`} />
                  <div className="machine-copy">
                    <strong>{machine.name}</strong>
                    <span>{machine.processes.length > 0 ? machine.processes.join(' · ') : machine.code}</span>
                  </div>
                  <span className="machine-load">
                    {machine.status === 'active'
                      ? t('Aktif', 'Active')
                      : machine.status === 'maintenance'
                        ? t('Maintenance', 'Maintenance')
                        : t('Nonaktif', 'Inactive')}
                  </span>
                </div>
              ))}
              {machines.length === 0 && (
                <div className="empty-state" style={{ padding: 16 }}>
                  <p>{t('Belum ada mesin untuk area ini.', 'No machines for this area yet.')}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="report-chart-grid">
        <section className="card chart-card">
          <div className="chart-card__head">
            <div>
              <h2 className="section-title">{t('Weekly output', 'Weekly output')}</h2>
              <p className="section-sub">{t('Target vs actual 7 hari terakhir dari database', 'Target vs actual for the last 7 days from the database')}</p>
            </div>
            <Badge tone="sky">
              {hasResults ? `${formatNumber(kpi!.actual + kpi!.completedToday)} ${t('pcs hari ini', 'pcs today')}` : t('Belum ada data aktual', 'No actual data yet')}
            </Badge>
          </div>

          {daily.some((day) => day.ok > 0 || day.target > 0) ? (
            <BarChart
              labels={weeklyLabels}
              height={246}
              ariaLabel={t('Grafik output mingguan target dan actual', 'Weekly output target and actual chart')}
              series={[
                {
                  name: 'Target',
                  color: '#38bdf8',
                  values: daily.map((item) => item.target),
                },
                {
                  name: 'Actual',
                  color: '#f97316',
                  values: daily.map((item) => item.ok),
                },
              ]}
            />
          ) : (
            <div className="empty-state" style={{ minHeight: 246 }}>
              <p>{t('Data output mingguan belum tersedia untuk', 'Weekly output data is not yet available for')} {lineLabel}.</p>
            </div>
          )}
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{t('Distribusi shift', 'Shift distribution')}</h2>
              <p className="section-sub">{t('Output hari ini per shift', 'Today\'s output per shift')}</p>
            </div>
            <Clock3 size={17} className="muted" />
          </div>

          {hasTrendData ? (
            <DonutChart
              data={[
                { label: 'Shift 1', value: shiftActual.shift1, color: '#38bdf8' },
                { label: 'Shift 2', value: shiftActual.shift2, color: '#f97316' },
              ]}
              size={172}
              centerValue={formatNumber(shiftActual.shift1 + shiftActual.shift2)}
              centerLabel="pcs output"
            />
          ) : (
            <div className="empty-state" style={{ minHeight: 172 }}>
              <p>{t('Data output per shift belum tersedia untuk', 'Output data per shift is not yet available for')} {lineLabel}.</p>
            </div>
          )}

          <div className="callout" style={{ marginTop: 14 }}>
            <div className="callout__icon">
              <Activity size={14} />
            </div>
            <div className="callout__copy">
              <strong>{t('Shift 2 bersiap', 'Shift 2 preparing')}</strong>
              <div>
                {t('Target Shift 2 sebesar', 'Shift 2 target is')} {formatNumber(shift2Target)} {t('pcs dari jadwal database.', 'pcs from the database schedule.')}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="dash-bottom-grid">
        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{t('Material alerts', 'Material alerts')}</h2>
              <p className="section-sub">{t('Perlu tindakan hari ini', 'Needs action today')}</p>
            </div>
            <Badge tone="danger" dot>
              {stockAlerts.length} alert
            </Badge>
          </div>

          <div className="stack-sm">
            {stockAlerts.map((alert) => {
              const severity = alert.status === 'empty' ? 'danger' : alert.status === 'low' ? 'warning' : 'info'
              const Icon = alertIcons[severity]
              return (
                <div className="alert-row" key={alert.id}>
                  <div className={`alert-icon stat-icon--${alertTones[severity]}`}>
                    <Icon size={15} />
                  </div>
                  <div className="alert-copy">
                    <span className="alert-title">{alert.partNumber}</span>
                    <span className="alert-detail">{alert.description} · {alert.store} / {alert.safetyStock}</span>
                  </div>
                  <span className="alert-count">{alert.status}</span>
                </div>
              )
            })}
            {stockAlerts.length === 0 && (
              <div className="empty-state" style={{ padding: 16 }}>
                <p>{t('Tidak ada alert stok.', 'No stock alerts.')}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 10, paddingLeft: 0 }}
            onClick={() => navigate('/inventory/overview')}
          >
            {t('Lihat inventory', 'View inventory')} <ArrowRight size={13} />
          </button>
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{t('Antrian', 'Queue')} {queueType}</h2>
              <p className="section-sub">
                {queueType === 'Assy' ? t('Produksi Assy', 'Assy Production') : t('Urutan replenishment FIFO', 'FIFO replenishment order')}
              </p>
            </div>
            <Badge tone={queueType === 'Assy' ? 'sky' : 'orange'}>
              {queue.length} {t('antrian', 'in queue')}
            </Badge>
          </div>

          <div className="queue-mini-list">
            {queue.slice(0, 4).map((item) => (
              <div
                className={cn('queue-mini', item.priority === 'urgent' && 'is-urgent')}
                key={item.id}
              >
                <span className="queue-mini__num">{item.no}</span>
                <div className="queue-mini__copy">
                  <strong>{item.partNumber}</strong>
                  <span>
                    {item.taken} {t('pcs diambil', 'pcs taken')} · {item.time}
                  </span>
                </div>
                <StatusBadge status={item.priority} />
              </div>
            ))}
            {queue.length === 0 && (
              <div className="empty-state" style={{ padding: 16 }}>
                <p>{t('Antrian kosong.', 'Queue is empty.')}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm btn-block"
            style={{ marginTop: 10 }}
            onClick={() => navigate(queuePath)}
          >
            {t('Buka antrian', 'Open queue')} <ArrowRight size={13} />
          </button>
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">{t('Recent activity', 'Recent activity')}</h2>
              <p className="section-sub">{t('Aktivitas terakhir dari database', 'Latest activity from the database')}</p>
            </div>
            <Activity size={17} className="muted" />
          </div>

          <div className="timeline">
            {activities.map((activity) => (
              <div className="timeline-item" key={activity.id}>
                <span className={`timeline-dot ${activityTones[activity.type] === 'sky' ? 'timeline-dot--sky' : activityTones[activity.type] === 'green' ? 'timeline-dot--green' : activityTones[activity.type] === 'amber' ? 'timeline-dot--amber' : ''}`} />
                <div>
                  <div className="timeline-head">
                    <span className="timeline-title">{activity.title}</span>
                    <span className="timeline-time">{formatTime(activity.time)}</span>
                  </div>
                  <span className="timeline-text">{activity.detail}</span>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <div className="empty-state" style={{ padding: 16 }}>
                <p>{t('Belum ada aktivitas.', 'No activity yet.')}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
