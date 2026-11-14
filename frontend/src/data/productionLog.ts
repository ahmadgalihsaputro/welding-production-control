import type {
  CompletedBox,
  NgShiftRecord,
  ProductionShiftRecord,
  QueueType,
  ShiftNumber,
} from '../types'
import { getProductionDateForShift } from './productionPlanning'

const NG_STORAGE_KEY = 'wpc.production-ng-by-shift.v1'
const PRODUCTION_SHIFT_STORAGE_KEY = 'wpc.production-shift-totals.v1'

function isQueueType(value: unknown): value is QueueType {
  return value === 'Assy' || value === 'Sub Assy'
}

function isShiftNumber(value: unknown): value is ShiftNumber {
  return value === 1 || value === 2
}

function isNgShiftRecord(value: unknown): value is NgShiftRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.date === 'string' &&
    typeof record.partNumber === 'string' &&
    isQueueType(record.type) &&
    isShiftNumber(record.shift) &&
    typeof record.ng === 'number' &&
    Number.isInteger(record.ng) &&
    record.ng >= 0 &&
    typeof record.operator === 'string' &&
    typeof record.time === 'string' &&
    typeof record.line === 'string'
  )
}

export function readNgShiftRecords(): NgShiftRecord[] {
  const raw = localStorage.getItem(NG_STORAGE_KEY)
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every(isNgShiftRecord)) {
    throw new Error('Data NG per shift tidak valid. Hubungi Admin untuk memeriksa penyimpanan.')
  }
  return parsed
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export { localDateKey }

function localTime(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

export function saveNgShiftRecord(input: {
  partNumber: string
  type: QueueType
  shift: ShiftNumber
  ng: number
  operator: string
  line: string
}): NgShiftRecord {
  if (!Number.isInteger(input.ng) || input.ng < 0) {
    throw new Error('Qty NG harus berupa bilangan bulat 0 atau lebih.')
  }

  const date = getProductionDateForShift(input.shift)
  const records = readNgShiftRecords()
  const existing = records.find(
    (record) =>
      record.date === date &&
      record.partNumber === input.partNumber &&
      record.shift === input.shift,
  )
  const record: NgShiftRecord = {
    id: existing?.id ?? `ng-${Date.now()}`,
    date,
    partNumber: input.partNumber,
    type: input.type,
    shift: input.shift,
    ng: input.ng,
    operator: input.operator,
    time: localTime(),
    line: input.line,
  }
  const next = existing
    ? records.map((item) => (item.id === existing.id ? record : item))
    : [record, ...records]
  localStorage.setItem(NG_STORAGE_KEY, JSON.stringify(next))
  return record
}

function isProductionShiftRecord(value: unknown): value is ProductionShiftRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.date === 'string' &&
    typeof record.partNumber === 'string' &&
    isQueueType(record.type) &&
    (record.process === undefined || typeof record.process === 'string') &&
    isShiftNumber(record.shift) &&
    typeof record.ok === 'number' &&
    Number.isInteger(record.ok) &&
    record.ok >= 0 &&
    typeof record.ng === 'number' &&
    Number.isInteger(record.ng) &&
    record.ng >= 0 &&
    typeof record.operator === 'string' &&
    typeof record.time === 'string' &&
    (record.updatedAtEpoch === undefined ||
      (typeof record.updatedAtEpoch === 'number' &&
        Number.isFinite(record.updatedAtEpoch))) &&
    typeof record.line === 'string'
  )
}

export function readProductionShiftRecords(): ProductionShiftRecord[] {
  const raw = localStorage.getItem(PRODUCTION_SHIFT_STORAGE_KEY)
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every(isProductionShiftRecord)) {
    throw new Error('Data hasil produksi per shift tidak valid. Hubungi Admin untuk memeriksa penyimpanan.')
  }
  return parsed
}

export function findProductionShiftRecord(
  input: Pick<ProductionShiftRecord, 'partNumber' | 'type' | 'shift' | 'line' | 'process'>,
  date = getProductionDateForShift(input.shift),
): ProductionShiftRecord | undefined {
  return readProductionShiftRecords().find(
    (record) =>
      record.date === date &&
      record.partNumber === input.partNumber &&
      record.type === input.type &&
      record.shift === input.shift &&
      record.line === input.line &&
      record.process === input.process,
  )
}

export function matchesProductionShiftBox(
  box: Pick<CompletedBox, 'date' | 'partNumber' | 'shift' | 'line'>,
  record: ProductionShiftRecord,
): boolean {
  return (
    record.date === (box.date ?? localDateKey()) &&
    record.partNumber === box.partNumber &&
    record.shift === (box.shift ?? 1) &&
    record.line === (box.line ?? 'Robot G')
  )
}

export function isBoxCompletedAfterShiftTotal(
  box: Pick<CompletedBox, 'completedAt' | 'completedAtEpoch'>,
  record: ProductionShiftRecord,
): boolean {
  if (
    typeof box.completedAtEpoch === 'number' &&
    typeof record.updatedAtEpoch === 'number'
  ) {
    return box.completedAtEpoch > record.updatedAtEpoch
  }
  return box.completedAt > record.time
}

export function saveProductionShiftRecord(
  input: Omit<ProductionShiftRecord, 'id' | 'date' | 'time'>,
): ProductionShiftRecord {
  for (const [label, value] of [['OK', input.ok], ['NG', input.ng]] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Qty ${label} harus berupa bilangan bulat 0 atau lebih.`)
    }
  }
  const date = getProductionDateForShift(input.shift)
  const records = readProductionShiftRecords()
  const existing = records.find(
    (record) =>
      record.date === date &&
      record.partNumber === input.partNumber &&
      record.type === input.type &&
      record.shift === input.shift &&
      record.line === input.line &&
      record.process === input.process,
  )
  const record: ProductionShiftRecord = {
    ...input,
    id: existing?.id ?? `production-${Date.now()}`,
    date,
    time: localTime(),
    updatedAtEpoch: Date.now(),
  }
  const next = existing
    ? records.map((item) => (item.id === existing.id ? record : item))
    : [record, ...records]
  localStorage.setItem(PRODUCTION_SHIFT_STORAGE_KEY, JSON.stringify(next))
  return record
}
