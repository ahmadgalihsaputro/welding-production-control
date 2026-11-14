import { getProductionParts } from './productionLines'
import { shifts as defaultShifts } from './mock'
import type {
  ProductionRequest,
  QueueItem,
  ShiftConfig,
  ShiftNumber,
} from '../types'

const SHIFT_CONFIG_KEY = 'wpc.shift-config.v1'
const CYCLE_TIME_KEY = 'wpc.production-cycle-times.v2'
const LEGACY_CYCLE_TIME_KEY = 'wpc.robot-g-cycle-times.v1'
const WORKDAYS_KEY = 'wpc.workdays.v1'
export const workingDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const
const defaultWorkdays = workingDays.slice(0, 6)

export interface CycleTimeConfig {
  partNumber: string
  line: 'Robot G' | 'Robot H'
  type: 'Assy' | 'Sub Assy'
  process: string
  models: string[]
  secondsPerPiece?: number
  cycleGroupId?: string | null
}

function productionCycleTimeDefaults(): CycleTimeConfig[] {
  return getProductionParts().map((item) => ({
    partNumber: item.partNumber,
    line: item.line,
    type: item.type,
    process: item.process,
    models: item.models,
    cycleGroupId:
      item.line === 'Robot H' &&
      item.type === 'Assy' &&
      (item.partNumber === '5312C009' || item.partNumber === '5312C010')
        ? 'RB-H-LR-01'
        : undefined,
  }))
}

export function readCycleTimeConfigs(): CycleTimeConfig[] {
  const baseline = productionCycleTimeDefaults()
  let raw = localStorage.getItem(CYCLE_TIME_KEY)
  if (!raw) {
    raw = localStorage.getItem(LEGACY_CYCLE_TIME_KEY)
    if (raw) {
      try {
        const legacy: unknown = JSON.parse(raw)
          if (!Array.isArray(legacy)) {
            throw new Error('Data cycle time lama tidak valid.')
          }
          const legacyRows = legacy
        const cleaned = legacyRows.filter((row) => {
          if (!row || typeof row !== 'object') return false
          const part = getProductionParts().find(
            (item) => item.partNumber === Reflect.get(row, 'partNumber'),
          )
          const seconds = Reflect.get(row, 'secondsPerPiece')
          const wasFabricatedDefault =
            part?.line === 'Robot G' &&
            part.type === 'Assy' &&
            part.packaging &&
            typeof seconds === 'number' &&
            Math.abs(seconds - 2700 / part.packaging) < 0.0001
          return !wasFabricatedDefault
        })
        localStorage.setItem(CYCLE_TIME_KEY, JSON.stringify(cleaned))
        raw = JSON.stringify(cleaned)
      } catch {
        throw new Error('Data cycle time lama tidak valid. Periksa konfigurasi master cycle time.')
      }
    }
  }
  if (!raw) return baseline
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error('Data cycle time tidak valid. Periksa konfigurasi master cycle time.')
  }
  const saved = new Map<string, { secondsPerPiece?: number; cycleGroupId?: string | null }>()
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue
    const partNumber = Reflect.get(row, 'partNumber')
    const secondsPerPiece = Reflect.get(row, 'secondsPerPiece')
    const cycleGroupId = Reflect.get(row, 'cycleGroupId')
    if (typeof partNumber !== 'string') continue
    saved.set(partNumber, {
      secondsPerPiece:
        typeof secondsPerPiece === 'number' &&
        Number.isFinite(secondsPerPiece) &&
        secondsPerPiece > 0
          ? secondsPerPiece
          : undefined,
      cycleGroupId:
        typeof cycleGroupId === 'string' && cycleGroupId.trim()
          ? cycleGroupId.trim()
          : Reflect.has(row, 'cycleGroupId')
            ? null
            : undefined,
    })
  }
  return baseline.map((item) => {
    const value = saved.get(item.partNumber)
    if (!value) return item
    return {
      ...item,
      secondsPerPiece: value.secondsPerPiece,
      cycleGroupId:
        value.cycleGroupId === undefined ? item.cycleGroupId : value.cycleGroupId,
    }
  })
}

export function saveCycleTimeConfigs(configs: CycleTimeConfig[]): void {
  const grouped = new Map<string, CycleTimeConfig>()
  for (const item of configs) {
    if (
      item.secondsPerPiece !== undefined &&
      (!Number.isFinite(item.secondsPerPiece) || item.secondsPerPiece <= 0)
    ) {
      throw new Error(`Cycle time ${item.partNumber} harus lebih besar dari 0 detik.`)
    }
    if (item.cycleGroupId) {
      const groupId = item.cycleGroupId.trim().toUpperCase()
      if (!groupId) continue
      const existing = grouped.get(`${item.line}:${groupId}`)
      if (
        existing &&
        (existing.type !== item.type || existing.process !== item.process)
      ) {
        throw new Error(
          `Kelompok mesin ${groupId} hanya boleh dipakai pada satu jenis dan proses dalam line yang sama.`,
        )
      }
      grouped.set(`${item.line}:${groupId}`, item)
    }
  }
  localStorage.setItem(
    CYCLE_TIME_KEY,
    JSON.stringify(configs.map((item) => ({
      ...item,
      cycleGroupId: item.cycleGroupId?.trim().toUpperCase() || null,
    }))),
  )
}

export function getCycleTimeSeconds(partNumber: string): number | undefined {
  return readCycleTimeConfigs().find((item) => item.partNumber === partNumber)?.secondsPerPiece
}

export function getProductionResourceKey(
  config: Pick<CycleTimeConfig, 'line' | 'type' | 'process' | 'cycleGroupId'>,
): string {
  return config.cycleGroupId
    ? `${config.line}:group:${config.cycleGroupId}`
    : `${config.line}:${config.type}:${config.process}`
}

export function estimateProductionMinutes(
  quantity: number,
  secondsPerPiece: number | undefined,
): number | undefined {
  if (
    !Number.isFinite(quantity) ||
    quantity < 0 ||
    secondsPerPiece === undefined ||
    !Number.isFinite(secondsPerPiece) ||
    secondsPerPiece <= 0
  ) {
    return undefined
  }
  return (quantity * secondsPerPiece) / 60
}

export function readShiftConfigs(): ShiftConfig[] {
  const raw = localStorage.getItem(SHIFT_CONFIG_KEY)
  if (!raw) return defaultShifts.map((shift) => ({ ...shift }))
  const parsed: unknown = JSON.parse(raw)
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (shift) =>
        shift &&
        typeof shift === 'object' &&
        typeof shift.id === 'string' &&
        typeof shift.name === 'string' &&
        typeof shift.start === 'string' &&
        typeof shift.end === 'string' &&
        typeof shift.breakStart === 'string' &&
        typeof shift.breakEnd === 'string' &&
        typeof shift.active === 'boolean',
    )
  ) {
    throw new Error('Data shift tidak valid. Periksa konfigurasi Shift & Working Hours.')
  }
  validateShiftConfigs(parsed as ShiftConfig[])
  return parsed as ShiftConfig[]
}

export function saveShiftConfigs(configs: ShiftConfig[]): void {
  validateShiftConfigs(configs)
  localStorage.setItem(SHIFT_CONFIG_KEY, JSON.stringify(configs))
}

export function readWorkdays(): string[] {
  const raw = localStorage.getItem(WORKDAYS_KEY)
  if (!raw) return [...defaultWorkdays]
  const parsed: unknown = JSON.parse(raw)
  if (
    !Array.isArray(parsed) ||
    !parsed.every((day) => typeof day === 'string' && workingDays.some((value) => value === day)) ||
    new Set(parsed).size !== parsed.length
  ) {
    throw new Error('Data hari kerja tidak valid. Periksa konfigurasi Shift & Working Hours.')
  }
  return parsed
}

export function saveWorkdays(days: string[]): void {
  if (
    !days.every((day) => workingDays.some((value) => value === day)) ||
    new Set(days).size !== days.length
  ) {
    throw new Error('Daftar hari kerja tidak valid.')
  }
  localStorage.setItem(WORKDAYS_KEY, JSON.stringify(days))
}

function timeInRange(time: number, start: number, end: number): boolean {
  return start < end ? time >= start && time < end : time >= start || time < end
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Format jam tidak valid: ${value}`)
  }
  return hours * 60 + minutes
}

function validateShiftConfigs(configs: ShiftConfig[]): void {
  const active = configs.filter((shift) => shift.active)
  for (const shift of configs) {
    const start = timeToMinutes(shift.start)
    const end = timeToMinutes(shift.end)
    const breakStart = timeToMinutes(shift.breakStart)
    const breakEnd = timeToMinutes(shift.breakEnd)
    if (start === end) throw new Error(`${shift.name}: jam mulai dan selesai tidak boleh sama.`)
    if (
      shift.active &&
      breakStart !== breakEnd &&
      Array.from({ length: 1440 }, (_, minute) => minute).some(
        (minute) =>
          timeInRange(minute, breakStart, breakEnd) &&
          !timeInRange(minute, start, end),
      )
    ) {
      throw new Error(`${shift.name}: jam istirahat harus berada di dalam jam shift.`)
    }
  }
  for (let minute = 0; minute < 1440; minute += 1) {
    const activeCount = active.filter((shift) =>
      timeInRange(minute, timeToMinutes(shift.start), timeToMinutes(shift.end)),
    ).length
    if (activeCount > 1) {
      throw new Error('Jam shift aktif saling tumpang tindih. Sesuaikan jadwal sebelum menyimpan.')
    }
  }
}

export function getShiftNumberAt(date = new Date()): ShiftNumber | undefined {
  const minute = date.getHours() * 60 + date.getMinutes()
  const shifts = readShiftConfigs()
  const shift = shifts.find((item) => {
    if (!item.active) return false
    const start = timeToMinutes(item.start)
    const end = timeToMinutes(item.end)
    if (!timeInRange(minute, start, end)) return false
    if (
      item.breakStart !== item.breakEnd &&
      timeInRange(
        minute,
        timeToMinutes(item.breakStart),
        timeToMinutes(item.breakEnd),
      )
    ) {
      return false
    }

    const workDate = start > end && minute < end
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
      : date
    const dayName = workingDays[(workDate.getDay() + 6) % 7]
    return readWorkdays().includes(dayName)
  })
  if (shift?.id === 'sh-1') return 1
  if (shift?.id === 'sh-2') return 2
  return undefined
}

export function getProductionDateForShift(
  shiftNumber: ShiftNumber,
  date = new Date(),
): string {
  const shift = readShiftConfigs().find((item) => item.id === `sh-${shiftNumber}`)
  if (!shift) return localDateKey(date)
  const minute = date.getHours() * 60 + date.getMinutes()
  const start = timeToMinutes(shift.start)
  const end = timeToMinutes(shift.end)
  const productionDate = start > end && minute < end
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
    : date
  return localDateKey(productionDate)
}

export function getShiftProgressAt(date = new Date()): number | undefined {
  const shiftNumber = getShiftNumberAt(date)
  if (!shiftNumber) return undefined
  const shift = readShiftConfigs().find((item) => item.id === `sh-${shiftNumber}`)
  if (!shift) return undefined

  const currentMinute = date.getHours() * 60 + date.getMinutes()
  const start = timeToMinutes(shift.start)
  const end = timeToMinutes(shift.end)
  const duration = end > start ? end - start : end + 1440 - start
  const elapsed = currentMinute >= start
    ? currentMinute - start
    : currentMinute + 1440 - start
  const breakStart = timeToMinutes(shift.breakStart)
  const breakEnd = timeToMinutes(shift.breakEnd)
  const breakDuration = breakStart === breakEnd
    ? 0
    : breakEnd > breakStart ? breakEnd - breakStart : breakEnd + 1440 - breakStart
  const breakOffset = (breakStart - start + 1440) % 1440
  const elapsedBreak =
    breakDuration > 0 && elapsed >= breakOffset + breakDuration ? breakDuration : 0
  const available = Math.max(duration - breakDuration, 1)
  return Math.min(Math.max(((elapsed - elapsedBreak) / available) * 100, 0), 100)
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftWorkMinutes(shift: ShiftConfig): number {
  const start = timeToMinutes(shift.start)
  const end = timeToMinutes(shift.end)
  const breakStart = timeToMinutes(shift.breakStart)
  const breakEnd = timeToMinutes(shift.breakEnd)
  const duration = end > start ? end - start : end + 24 * 60 - start
  const breakDuration = breakStart === breakEnd
    ? 0
    : breakEnd > breakStart ? breakEnd - breakStart : breakEnd + 24 * 60 - breakStart
  return Math.max(0, duration - breakDuration) + Math.max(0, shift.maxOvertimeMinutes ?? 0)
}

export function buildQueueItemFromRequest(
  request: ProductionRequest,
  targetShift: ShiftNumber,
): QueueItem {
  return {
    id: `q-${request.id}`,
    no: 0,
    partNumber: request.partNumber,
    model: request.model,
    type: request.type,
    line: request.line,
    process: request.process,
    sourceShift: request.sourceShift,
    targetShift,
    kanban: request.code,
    taken: request.qty,
    printedQty: 0,
    printedKanbans: 0,
    stock: 0,
    time: request.scannedAt,
    priority: 'normal',
    status: 'waiting',
  }
}
