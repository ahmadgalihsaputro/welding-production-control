import { CalendarClock, Clock3, PackageCheck, Split } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { useAuth } from '../../contexts/AuthContext'
import { useQueue } from '../../contexts/QueueContext'
import {
  readShiftConfigs,
  estimateProductionMinutes,
  getProductionResourceKey,
  shiftWorkMinutes,
  type CycleTimeConfig,
} from '../../data/productionPlanning'
import type { ShiftConfig, ShiftNumber } from '../../types'
import { formatNumber } from '../../lib/utils'
import { describeApiError } from '../../lib/api'
import { listParts, type ProductionPartRecord } from '../../lib/masterApi'

interface ShiftPlanningConfig {
  shifts: ShiftConfig[]
  error: string
}

function readShiftPlanningConfig(): ShiftPlanningConfig {
  try {
    return {
      shifts: readShiftConfigs(),
      error: '',
    }
  } catch (error) {
    return {
      shifts: [],
      error: error instanceof Error ? error.message : 'Konfigurasi shift gagal dibaca.',
    }
  }
}

export function ProductionAllocationPage() {
  const { user, activeLine } = useAuth()
  const { requests, items, allocateRequest } = useQueue()
  const [planning] = useState(readShiftPlanningConfig)
  const [message, setMessage] = useState('')
  const [parts, setParts] = useState<ProductionPartRecord[]>([])
  const [cycleError, setCycleError] = useState('')
  const [cycleLoading, setCycleLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const nextParts = await listParts()
        if (active) setParts(nextParts)
      } catch (loadError) {
        if (active) {
          setCycleError(describeApiError(loadError, 'Data cycle time gagal dimuat.'))
        }
      } finally {
        if (active) setCycleLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const cycles = useMemo<CycleTimeConfig[]>(
    () =>
      parts.map((part) => ({
        partNumber: part.partNumber,
        line: part.line as 'Robot G' | 'Robot H',
        type: part.type === 'Sub_Assy' ? 'Sub Assy' : 'Assy',
        process: part.process,
        models: part.models,
        secondsPerPiece: part.cycleTime ?? undefined,
        cycleGroupId: part.cycleGroupId,
      })),
    [parts],
  )

  const partsByNumber = useMemo(
    () => new Map(parts.map((part) => [part.partNumber, part])),
    [parts],
  )

  const pendingRequests = useMemo(
    () => requests.filter(
      (request) =>
        request.status === 'pending' &&
        (activeLine === 'all' || request.line === activeLine),
    ),
    [requests, activeLine],
  )
  const allocatedRequests = requests.filter(
    (request) =>
      request.status === 'allocated' &&
      (activeLine === 'all' || request.line === activeLine),
  )
  const cycleConfigs = new Map(cycles.map((item) => [item.partNumber, item]))
  const cycleTimes = new Map(
    cycles.map((item) => [item.partNumber, item.secondsPerPiece]),
  )
  const shiftOne = planning.shifts.find((item) => item.id === 'sh-1')
  const shiftTwo = planning.shifts.find((item) => item.id === 'sh-2')
  const shiftOneMinutes = shiftOne?.active ? shiftWorkMinutes(shiftOne) : undefined
  const shiftTwoMinutes = shiftTwo?.active ? shiftWorkMinutes(shiftTwo) : undefined
  const itemsForLine = items.filter(
    (item) => activeLine === 'all' || item.line === activeLine,
  )
  const workload = (resourceKey: string, shift: ShiftNumber) => {
    const resourceItems = items.filter((item) => {
      if (item.targetShift !== shift) return false
      const config = cycleConfigs.get(item.partNumber)
      return config && getProductionResourceKey(config) === resourceKey
    })
    let minutes = 0
    let missingCycleTime = 0
    for (const item of resourceItems) {
      const config = cycleConfigs.get(item.partNumber)
      const estimate = estimateProductionMinutes(
        Math.max(item.taken - (item.printedQty ?? 0), 0),
        config?.secondsPerPiece,
      )
      if (estimate === undefined) {
        missingCycleTime += 1
      } else {
        minutes += estimate
      }
    }
    return { minutes, missingCycleTime, count: resourceItems.length }
  }

  const recommendedShifts = new Map<string, ShiftNumber>()
  const projectedLoad = new Map<string, number>()
  for (const item of items) {
    const config = cycleConfigs.get(item.partNumber)
    if (!config || !item.targetShift) continue
    const key = `${getProductionResourceKey(config)}:${item.targetShift}`
    const estimate = estimateProductionMinutes(
      Math.max(item.taken - (item.printedQty ?? 0), 0),
      config.secondsPerPiece,
    )
    if (estimate !== undefined) projectedLoad.set(key, (projectedLoad.get(key) ?? 0) + estimate)
  }
  const handledGroups = new Set<string>()
  for (const request of pendingRequests) {
    const config = cycleConfigs.get(request.partNumber)
    if (!config) continue
    const resourceKey = getProductionResourceKey(config)
    const groupKey = config.cycleGroupId
      ? `${request.line}:${config.cycleGroupId}`
      : request.id
    if (handledGroups.has(groupKey)) continue
    handledGroups.add(groupKey)

    const groupRequests = config.cycleGroupId
      ? pendingRequests.filter((candidate) =>
          candidate.line === request.line &&
          cycleConfigs.get(candidate.partNumber)?.cycleGroupId === config.cycleGroupId)
      : [request]
    const hasCompleteCycleTimes = groupRequests.every(
      (candidate) => cycleConfigs.get(candidate.partNumber)?.secondsPerPiece,
    )
    const allocatedPartnerShifts = config.cycleGroupId
      ? new Set(
          requests
            .filter((candidate) =>
              candidate.status === 'allocated' &&
              candidate.line === request.line &&
              candidate.targetShift !== undefined &&
              cycleConfigs.get(candidate.partNumber)?.cycleGroupId === config.cycleGroupId)
            .map((candidate) => candidate.targetShift)
            .filter((shift): shift is ShiftNumber => shift !== undefined),
        )
      : new Set<ShiftNumber>()
    const allocatedPartnerShift =
      allocatedPartnerShifts.size === 1 ? Array.from(allocatedPartnerShifts)[0] : undefined
    if (allocatedPartnerShifts.size > 1) continue
    if (!hasCompleteCycleTimes && !allocatedPartnerShift) continue
    const groupMinutes = groupRequests.reduce((sum, candidate) => {
      const candidateConfig = cycleConfigs.get(candidate.partNumber)
      return sum + (estimateProductionMinutes(candidate.qty, candidateConfig?.secondsPerPiece) ?? 0)
    }, 0)
    const utilization = (shift: ShiftNumber) => {
      const available = shift === 1 ? shiftOneMinutes : shiftTwoMinutes
      if (!available) return Number.POSITIVE_INFINITY
      return ((projectedLoad.get(`${resourceKey}:${shift}`) ?? 0) + groupMinutes) / available
    }
    if (!shiftOneMinutes && !shiftTwoMinutes && !allocatedPartnerShift) continue
    const suggested: ShiftNumber = allocatedPartnerShift ??
      (!shiftOneMinutes
        ? 2
        : !shiftTwoMinutes
          ? 1
          : utilization(1) <= utilization(2) ? 1 : 2)
    for (const candidate of groupRequests) recommendedShifts.set(candidate.id, suggested)
    const key = `${resourceKey}:${suggested}`
    projectedLoad.set(key, (projectedLoad.get(key) ?? 0) + groupMinutes)
  }

  const resources = cycles
    .filter((config) => activeLine === 'all' || config.line === activeLine)
    .filter((config) =>
      items.some((item) => {
        const itemConfig = cycleConfigs.get(item.partNumber)
        return itemConfig && getProductionResourceKey(itemConfig) === getProductionResourceKey(config)
      }) ||
      pendingRequests.some((request) => {
        const requestConfig = cycleConfigs.get(request.partNumber)
        return requestConfig && getProductionResourceKey(requestConfig) === getProductionResourceKey(config)
      }),
    )
    .reduce<CycleTimeConfig[]>((unique, config) => {
      if (!unique.some((item) =>
        getProductionResourceKey(item) === getProductionResourceKey(config))) unique.push(config)
      return unique
    }, [])

  const handleAllocate = async (id: string, shift: ShiftNumber) => {
    if (!user) return
    setMessage('Mengalokasikan permintaan…')
    const result = await allocateRequest(id, shift, user.role)
    if (!result.ok) {
      setMessage(result.error ?? 'Permintaan gagal dialokasikan.')
      return
    }
    setMessage(
      result.generatedSubAssy
        ? `Assy dan ${result.generatedSubAssy} kebutuhan Sub Assy otomatis masuk antrean Shift ${shift}.`
        : `Permintaan berhasil masuk ke antrean Robot ${(result.item?.line ?? 'Robot G').slice(-1)}, Shift ${shift}.`,
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Production Control · Admin"
        title="Antrian Admin & Alokasi Produksi"
        subtitle="Tinjau hasil scan Collect/Supply, lihat estimasi waktu bila cycle time tersedia, lalu tetapkan shift produksi. Alokasi tidak mencatat hasil produksi atau mencetak kanban."
        meta={
          <span className="page-meta__item">
              <CalendarClock size={12} /> {activeLine === 'all' ? 'Robot G & H' : activeLine} · Shift 1 & 2
          </span>
        }
      />

      <Callout tone="info" title="Permintaan tersusun menurut line produksi">
        PN yang discan masuk ke antrean Admin sesuai mapping Robot G/H. Filter line dan tetapkan
        shift produksi; alokasi Assy juga membuat antrean Sub Assy otomatis berdasarkan BOM aktif.
      </Callout>
      <Callout tone="success" title="Terhubung ke database produksi">
        Permintaan di halaman ini berasal langsung dari scan kanban. Alokasi shift dan antrean
        tersimpan di server, sehingga operator di perangkat lain melihat data yang sama.
      </Callout>

      {planning.error && (
        <Callout tone="danger" title="Konfigurasi shift tidak tersedia">
          {planning.error} Permintaan masih dapat dialokasikan manual setelah konfigurasi diperbaiki.
        </Callout>
      )}
      {cycleError && (
        <Callout tone="danger" title="Data cycle time tidak tersedia">
          {cycleError} Permintaan masih dapat dialokasikan manual tanpa estimasi waktu.
        </Callout>
      )}
      {cycleLoading && <Callout tone="info">Memuat cycle time dari server…</Callout>}
      {message && <Callout tone={message.includes('berhasil') ? 'success' : 'warning'}>{message}</Callout>}

      <div className="kpi-grid">
        <StatCard
          label="Menunggu alokasi"
          value={String(pendingRequests.length)}
          suffix="kanban"
          icon={PackageCheck}
          tone="orange"
          note="Hasil scan Collect/Supply"
        />
        <StatCard
          label="Waktu tersedia Shift 1"
          value={shiftOneMinutes === undefined ? '—' : (shiftOneMinutes / 60).toFixed(1)}
          suffix="jam"
          icon={Clock3}
          tone="sky"
          note={`${shiftOne?.operatorCount ?? 'Manpower belum diatur'} operator · lembur opsional`}
        />
        <StatCard
          label="Waktu tersedia Shift 2"
          value={shiftTwoMinutes === undefined ? '—' : (shiftTwoMinutes / 60).toFixed(1)}
          suffix="jam"
          icon={Clock3}
          tone="green"
          note={`${shiftTwo?.operatorCount ?? 'Manpower belum diatur'} operator · lembur opsional`}
        />
        <StatCard
          label="Sudah dialokasikan"
          value={String(allocatedRequests.length)}
          suffix="kanban"
          icon={Split}
          tone="amber"
          note={`${itemsForLine.length} kanban aktif di line terpilih`}
        />
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Load per proses/sumber daya dan shift</h2>
            <p className="section-sub">
              Proses berbeda tidak dicampur sebagai satu kapasitas. Saran menempatkan beban baru pada
              shift dengan pemakaian kapasitas lebih rendah; pasangan satu grup diarahkan bersama.
            </p>
          </div>
        </div>
        <div className="grid grid-2">
          {resources.map((resource) => {
            const resourceKey = getProductionResourceKey(resource)
            const resourceLabel = resource.cycleGroupId
              ? `${resource.line} · Kelompok ${resource.cycleGroupId} (bergantian)`
              : `${resource.line} · ${resource.type} · ${resource.process}`
            const groupParts = resource.cycleGroupId
              ? cycles.filter((item) =>
                  item.line === resource.line && item.cycleGroupId === resource.cycleGroupId)
              : []
            const groupQuantities = groupParts.map((part) => {
              const queued = items
                .filter((item) => item.partNumber === part.partNumber)
                .reduce(
                  (sum, item) => sum + Math.max(item.taken - (item.printedQty ?? 0), 0),
                  0,
                )
              const pending = pendingRequests
                .filter((request) => request.partNumber === part.partNumber)
                .reduce((sum, request) => sum + request.qty, 0)
              return { partNumber: part.partNumber, quantity: queued + pending }
            })
            const quantities = groupQuantities.map((item) => item.quantity)
            const groupQuantityGap = quantities.length > 1
              ? Math.max(...quantities) - Math.min(...quantities)
              : 0
            return (
            <div className="glass-inset" key={resourceKey} style={{ padding: 14 }}>
              <strong>{resourceLabel}</strong>
              {groupParts.length > 1 && (
                <p className="section-sub" style={{ marginTop: 6 }}>
                  Jumlah sisi: {groupQuantities.map((item) =>
                    `${item.partNumber} ${formatNumber(item.quantity)} pcs`,
                  ).join(' · ')}
                  {groupQuantityGap > 0
                    ? ` · Selisih ${formatNumber(groupQuantityGap)} pcs`
                    : ' · Seimbang'}
                </p>
              )}
              <div className="info-grid" style={{ marginTop: 10 }}>
                {([1, 2] as ShiftNumber[]).map((shift) => {
                  const load = workload(resourceKey, shift)
                  const available = shift === 1 ? shiftOneMinutes : shiftTwoMinutes
                  return (
                    <div className="info-item" key={shift}>
                      <span className="info-label">Shift {shift} · {load.count} item</span>
                      <span className="info-value info-value--strong">
                        {load.missingCycleTime > 0
                          ? `${load.minutes.toFixed(1)} menit terhitung · ${load.missingCycleTime} tanpa cycle time`
                          : available === undefined
                            ? 'Shift tidak aktif'
                            : `${load.minutes.toFixed(1)} / ${available} menit tersedia`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )})}
        </div>
        {cycles.every((item) => item.secondsPerPiece === undefined) && (
          <p className="field-hint" style={{ marginTop: 10 }}>
            Cycle time belum diisi; Admin tetap dapat mengalokasikan manual, tetapi sistem belum dapat membandingkan kapasitas aktual.
          </p>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Permintaan belum dialokasikan</h2>
            <p className="section-sub">
              Satu baris mewakili satu kanban hasil scan. Penetapan shift mempertahankan qty kanban.
            </p>
          </div>
          <div className="row row--wrap">
            <Badge tone="neutral">{pendingRequests.length} menunggu</Badge>
          </div>
        </div>

        {pendingRequests.length > 0 ? (
          <div className="stack-sm">
            {pendingRequests.map((request) => {
              const secondsPerPiece = cycleTimes.get(request.partNumber)
              const estimatedMinutes = estimateProductionMinutes(request.qty, secondsPerPiece)
              const suggestedShift = recommendedShifts.get(request.id)
              const config = cycleConfigs.get(request.partNumber)
              const allocatedGroupShifts = config?.cycleGroupId
                ? new Set(
                    requests
                      .filter((candidate) =>
                        candidate.status === 'allocated' &&
                        candidate.line === request.line &&
                        cycleConfigs.get(candidate.partNumber)?.cycleGroupId === config.cycleGroupId)
                      .map((candidate) => candidate.targetShift)
                      .filter((shift): shift is ShiftNumber => shift !== undefined),
                  )
                : new Set<ShiftNumber>()
              const splitAllocatedGroup = allocatedGroupShifts.size > 1
              const missingGroupCycleTime = Boolean(
                config?.cycleGroupId &&
                  pendingRequests.some((candidate) =>
                    candidate.line === request.line &&
                    cycleConfigs.get(candidate.partNumber)?.cycleGroupId === config.cycleGroupId &&
                    !cycleTimes.get(candidate.partNumber),
                  ),
              )
              const part = partsByNumber.get(request.partNumber)
              const missingBom = false
              return (
                <article className="glass-inset" key={request.id} style={{ padding: 14 }}>
                  <div className="row row--between row--wrap" style={{ gap: 12 }}>
                    <div className="cell-stack">
                      <strong className="mono">{request.partNumber}</strong>
                      <span className="cell-sub">
                        {request.type}
                        {request.process ? ` · ${request.process}` : ''}
                        {' · '}{request.model}
                        {part?.placeholder ? ' · DATA DUMMY' : ''}
                      </span>
                    </div>
                    <div className="row row--wrap">
                      {request.code.startsWith('DEMO-') && <Badge tone="warning">CONTOH</Badge>}
                      <Badge tone="neutral">{request.line}</Badge>
                      <Badge tone={request.type === 'Assy' ? 'sky' : 'orange'}>
                        {request.type}
                      </Badge>
                    </div>
                  </div>

                  <div className="info-grid" style={{ marginTop: 12 }}>
                    <div className="info-item">
                      <span className="info-label">Qty kanban</span>
                      <span className="info-value info-value--strong">
                        {formatNumber(request.qty)} pcs
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Scan masuk</span>
                      <span className="info-value">{request.scannedAt}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Shift Collect/Supply</span>
                      <span className="info-value">
                        {request.sourceShift ? `Shift ${request.sourceShift}` : 'Tidak terdeteksi'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Estimasi kerja</span>
                      <span className="info-value">
                        {estimatedMinutes === undefined
                          ? 'Cycle time belum diatur'
                          : `${estimatedMinutes.toFixed(1)} menit (${secondsPerPiece} s/pcs)`}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Saran pembagian</span>
                      <span className="info-value info-value--strong">
                        {suggestedShift
                          ? `Shift ${suggestedShift}${config?.cycleGroupId ? ' · satu grup mesin' : ''}`
                          : splitAllocatedGroup
                            ? 'Grup mesin sudah terbagi antar shift'
                          : missingGroupCycleTime
                            ? 'Isi cycle time semua item satu grup mesin'
                            : 'Isi cycle time untuk mendapat saran'}
                      </span>
                    </div>
                  </div>

                  {estimatedMinutes === undefined && (
                    <div className="tiny muted" style={{ marginTop: 8 }}>
                      Isi cycle time di Master Data → Cycle Time & Capacity agar estimasi dapat dihitung.
                      Admin masih dapat menetapkan shift secara manual.
                    </div>
                  )}
                  {missingGroupCycleTime && estimatedMinutes !== undefined && (
                    <div className="tiny muted" style={{ marginTop: 8 }}>
                      Lengkapi cycle time untuk setiap item yang berbagi mesin agar saran shift mempertimbangkan seluruh beban.
                    </div>
                  )}
                  {splitAllocatedGroup && (
                    <Callout tone="warning" style={{ marginTop: 10 }}>
                      Item lain dalam kelompok mesin ini sudah dialokasikan ke shift berbeda. Periksa alokasi yang ada sebelum menentukan shift agar jadwal bolak-balik tidak terpecah.
                    </Callout>
                  )}

                  {missingBom && (
                    <Callout tone="warning" style={{ marginTop: 10 }}>
                      BOM Sub Assy belum tersedia. Isi Master Data → BOM agar kebutuhan Sub Assy dibuat saat Assy dialokasikan.
                    </Callout>
                  )}

                  <div className="form-actions">
                    <Button
                      variant="secondary"
                      leftIcon={suggestedShift === 1 ? <Split size={14} /> : undefined}
                      disabled={Boolean(missingBom)}
                      onClick={() => handleAllocate(request.id, 1)}
                    >
                      {suggestedShift === 1 ? 'Saran: Shift 1' : 'Alokasikan ke Shift 1'}
                    </Button>
                    <Button
                      variant="primary"
                      leftIcon={suggestedShift === 2 ? <Split size={14} /> : undefined}
                      disabled={Boolean(missingBom)}
                      onClick={() => handleAllocate(request.id, 2)}
                    >
                      {suggestedShift === 2 ? 'Saran: Shift 2' : 'Alokasikan ke Shift 2'}
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon"><Split size={22} /></div>
            <strong>Tidak ada permintaan menunggu</strong>
            <p>Scan Collect atau Supply berikutnya akan muncul di halaman ini untuk ditinjau Admin.</p>
          </div>
        )}
      </section>

      {allocatedRequests.length > 0 && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Alokasi terbaru</h2>
              <p className="section-sub">Permintaan yang sudah diteruskan ke antrean produksi</p>
            </div>
          </div>
          <div className="stack-sm">
            {allocatedRequests.slice(0, 6).map((request) => (
              <div className="row row--between glass-inset" key={request.id} style={{ padding: 12 }}>
                <span>
                  <strong className="mono">{request.partNumber}</strong>
                  <span className="muted small"> · {request.line} · {formatNumber(request.qty)} pcs · {request.code}</span>
                </span>
                <Badge tone="success">Shift {request.targetShift}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
