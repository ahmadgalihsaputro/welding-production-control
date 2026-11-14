import { api } from './api'
import type {
  CompletedBox,
  NgShiftRecord,
  ProductionRequest,
  ProductionShiftRecord,
  QueueAuditEntry,
  QueueItem,
  QueuePriority,
  QueueType,
  RobotLine,
  ScannedKanban,
  ShiftNumber,
} from '../types'

export interface ApiQueueItem {
  id: string
  no: number
  partNumber: string
  model: string
  type: 'Assy' | 'Sub_Assy'
  line: string | null
  process: string | null
  sourceShift: number | null
  targetShift: number | null
  kanban: string
  taken: number
  printedQty: number
  printedKanbans: number
  stock: number
  time: string
  priority: string
  status: string
}

export interface ApiProductionRequest {
  id: string
  code: string
  partNumber: string
  model: string
  type: 'Assy' | 'Sub_Assy'
  line: string
  process: string | null
  qty: number
  sourceShift: number | null
  scannedAt: string
  status: 'pending' | 'allocated'
  targetShift: number | null
}

export interface ApiCompletedBox {
  id: string
  partNumber: string
  type: 'Assy' | 'Sub_Assy'
  line: string | null
  qty: number
  kanban: string
  completedAt: string
  completedAtEpoch: number | string | null
  date: string | null
  operator: string
  shift: number | null
}

export interface ApiAuditLog {
  id: string
  time: string
  title: string
  detail: string
  type: string
  line: string | null
  process: string | null
}

export interface ApiProductionShiftRecord {
  id: string
  date: string
  partNumber: string
  type: 'Assy' | 'Sub_Assy'
  process: string | null
  shift: number
  ok: number
  ng: number
  operator: string
  time: string
  line: string
  updatedAtEpoch: number | string | null
}

export interface ApiNgShiftRecord {
  id: string
  date: string
  partNumber: string
  type: 'Assy' | 'Sub_Assy'
  shift: number
  ng: number
  operator: string
  time: string
  line: string
  updatedAtEpoch: number | string | null
}

export interface ApiPrintResult {
  ok: boolean
  box: ApiCompletedBox
  totalQty: number
  completedKanbans: number
  totalKanbans: number
  printedQty: number
}

function toUiType(type: 'Assy' | 'Sub_Assy'): QueueType {
  return type === 'Assy' ? 'Assy' : 'Sub Assy'
}

export function toApiType(type: QueueType): 'Assy' | 'Sub_Assy' {
  return type === 'Assy' ? 'Assy' : 'Sub_Assy'
}

function toUiLine(line: string | null | undefined): RobotLine {
  return line?.includes('Robot H') ? 'Robot H' : 'Robot G'
}

function toShift(value: number | null | undefined): ShiftNumber | undefined {
  return value === 2 ? 2 : value === 1 ? 1 : undefined
}

function timeOf(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function renumberQueue(items: QueueItem[]): QueueItem[] {
  const counters: Record<string, number> = {}
  return items.map((item) => {
    const key = `${item.line ?? 'Robot G'}:${item.type}:${item.targetShift ?? 'unassigned'}`
    counters[key] = (counters[key] ?? 0) + 1
    return { ...item, no: counters[key] }
  })
}

export function mapQueueItem(item: ApiQueueItem): QueueItem {
  return {
    id: item.id,
    no: item.no,
    partNumber: item.partNumber,
    model: item.model,
    type: toUiType(item.type),
    line: toUiLine(item.line),
    process: item.process ?? undefined,
    sourceShift: toShift(item.sourceShift),
    targetShift: toShift(item.targetShift),
    kanban: item.kanban,
    taken: item.taken,
    printedQty: item.printedQty,
    printedKanbans: item.printedKanbans,
    stock: item.stock,
    time: timeOf(item.time),
    priority: (['urgent', 'normal', 'low'] as string[]).includes(item.priority)
      ? (item.priority as QueuePriority)
      : 'normal',
    status: item.status === 'running' ? 'running' : item.status === 'complete' ? 'complete' : 'waiting',
  }
}

export function mapRequest(item: ApiProductionRequest): ProductionRequest {
  return {
    id: item.id,
    code: item.code,
    partNumber: item.partNumber,
    model: item.model,
    type: toUiType(item.type),
    line: toUiLine(item.line),
    process: item.process ?? undefined,
    qty: item.qty,
    sourceShift: toShift(item.sourceShift),
    scannedAt: timeOf(item.scannedAt),
    status: item.status,
    targetShift: toShift(item.targetShift),
  }
}

export function mapCompletedBox(box: ApiCompletedBox): CompletedBox {
  return {
    id: box.id,
    partNumber: box.partNumber,
    type: toUiType(box.type),
    line: toUiLine(box.line),
    qty: box.qty,
    kanban: box.kanban,
    completedAt: timeOf(box.completedAt),
    completedAtEpoch:
      box.completedAtEpoch === null ? undefined : Number(box.completedAtEpoch),
    date: box.date ?? undefined,
    operator: box.operator,
    shift: toShift(box.shift),
  }
}

export function mapAudit(entry: ApiAuditLog): QueueAuditEntry {
  return {
    id: entry.id,
    time: timeOf(entry.time),
    title: entry.title,
    detail: entry.detail,
    type: toUiType(entry.type === 'Sub_Assy' ? 'Sub_Assy' : 'Assy'),
    line: entry.line ? toUiLine(entry.line) : undefined,
    process: entry.process ?? undefined,
  }
}

export function mapProductionShiftRecord(record: ApiProductionShiftRecord): ProductionShiftRecord {
  return {
    id: record.id,
    date: record.date,
    partNumber: record.partNumber,
    type: toUiType(record.type),
    process: record.process ?? undefined,
    shift: record.shift === 2 ? 2 : 1,
    ok: record.ok,
    ng: record.ng,
    operator: record.operator,
    time: record.time,
    line: record.line,
    updatedAtEpoch:
      record.updatedAtEpoch === null ? undefined : Number(record.updatedAtEpoch),
  }
}

export function mapNgShiftRecord(record: ApiNgShiftRecord): NgShiftRecord {
  return {
    id: record.id,
    date: record.date,
    partNumber: record.partNumber,
    type: toUiType(record.type),
    shift: record.shift === 2 ? 2 : 1,
    ng: record.ng,
    operator: record.operator,
    time: record.time,
    line: record.line,
    updatedAtEpoch:
      record.updatedAtEpoch === null ? undefined : Number(record.updatedAtEpoch),
  }
}

export async function loadProductionState() {
  const [requests, queue, completed, audit] = await Promise.all([
    api.get<ApiProductionRequest[]>('/production/requests'),
    api.get<ApiQueueItem[]>('/production/queue'),
    api.get<ApiCompletedBox[]>('/report/completed-boxes'),
    api.get<ApiAuditLog[]>('/production/audit'),
  ])
  return {
    requests: requests.map(mapRequest),
    items: renumberQueue(queue.map(mapQueueItem)),
    completed: completed.map(mapCompletedBox),
    audit: audit.map(mapAudit),
  }
}

export async function scanProductionKanban(scan: ScannedKanban): Promise<ProductionRequest> {
  const created = await api.post<ApiProductionRequest>('/production/requests/scan', {
    code: scan.code.trim().toUpperCase(),
    partNumber: scan.partNumber.trim().toUpperCase(),
    model: scan.model,
    type: toApiType(scan.type),
    qty: scan.qty,
    process: scan.process,
    sourceShift: scan.sourceShift,
  })
  return mapRequest(created)
}

export async function allocateProductionRequest(
  id: string,
  targetShift: ShiftNumber,
): Promise<QueueItem> {
  const result = await api.post<{ ok: boolean; item: ApiQueueItem }>(
    `/production/requests/${id}/allocate`,
    { targetShift },
  )
  return mapQueueItem(result.item)
}

export async function printProductionKanban(id: string, operator: string): Promise<ApiPrintResult> {
  return api.post<ApiPrintResult>(`/production/queue/${id}/print`, { operator })
}

export async function updateQueuePriority(id: string, priority: QueuePriority): Promise<void> {
  await api.patch(`/production/queue/${id}`, { priority })
}

export async function reorderProductionQueue(ids: string[]): Promise<void> {
  await api.put('/production/queue/order', { ids })
}

export async function loadShiftResults(params?: {
  date?: string
  line?: string
  type?: QueueType
}): Promise<ProductionShiftRecord[]> {
  const query = new URLSearchParams()
  if (params?.date) query.set('date', params.date)
  if (params?.line) query.set('line', params.line)
  if (params?.type) query.set('type', toApiType(params.type))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const records = await api.get<ApiProductionShiftRecord[]>(`/production/results${suffix}`)
  return records.map(mapProductionShiftRecord)
}

export async function loadNgRecords(params?: {
  date?: string
  line?: string
}): Promise<NgShiftRecord[]> {
  const query = new URLSearchParams()
  if (params?.date) query.set('date', params.date)
  if (params?.line) query.set('line', params.line)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const records = await api.get<ApiNgShiftRecord[]>(`/production/ng${suffix}`)
  return records.map(mapNgShiftRecord)
}

export async function saveShiftResult(input: {
  date: string
  partNumber: string
  type: QueueType
  shift: ShiftNumber
  ok: number
  ng: number
  line: string
  process?: string
}): Promise<ProductionShiftRecord> {
  const record = await api.post<ApiProductionShiftRecord>('/production/results', {
    ...input,
    type: toApiType(input.type),
  })
  return mapProductionShiftRecord(record)
}

export async function saveNgResult(input: {
  date: string
  partNumber: string
  type: QueueType
  shift: ShiftNumber
  ng: number
  line: string
}): Promise<NgShiftRecord> {
  const record = await api.post<ApiNgShiftRecord>('/production/ng', {
    ...input,
    type: toApiType(input.type),
  })
  return mapNgShiftRecord(record)
}
