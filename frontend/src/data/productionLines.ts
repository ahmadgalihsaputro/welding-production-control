import { robotGComposition } from './robotGComposition'
import type { ProductionWorkArea, QueueType, RobotLine, Role } from '../types'

export interface ProductionPart {
  partNumber: string
  line: RobotLine
  type: QueueType
  process: string
  models: string[]
  packaging?: number
  placeholder?: boolean
}

const STORAGE_KEY = 'wpc.production-line-parts.v1'

const robotGParts = new Map<string, ProductionPart>()

for (const assy of robotGComposition) {
  const assyPart = robotGParts.get(assy.partNumber)
  if (assyPart) {
    assyPart.models.push(assy.model)
  } else {
    robotGParts.set(assy.partNumber, {
      partNumber: assy.partNumber,
      line: 'Robot G',
      type: 'Assy',
      process: 'RB.G',
      models: [assy.model],
      packaging: assy.packaging,
    })
  }

  for (const subAssy of assy.subAssemblies) {
    const subAssyPart = robotGParts.get(subAssy.partNumber)
    if (subAssyPart) {
      if (!subAssyPart.models.includes(assy.model)) subAssyPart.models.push(assy.model)
    } else {
      robotGParts.set(subAssy.partNumber, {
        partNumber: subAssy.partNumber,
        line: 'Robot G',
        type: 'Sub Assy',
        process: subAssy.process,
        models: [assy.model],
        packaging: subAssy.packaging,
      })
    }
  }
}

export const robotHDummyParts: ProductionPart[] = [
  {
    partNumber: '5312C009',
    line: 'Robot H',
    type: 'Assy',
    process: 'RB.H',
    models: ['DUMMY'],
    placeholder: true,
  },
  {
    partNumber: '5312C010',
    line: 'Robot H',
    type: 'Assy',
    process: 'RB.H',
    models: ['DUMMY'],
    placeholder: true,
  },
]

const defaultProductionParts: ProductionPart[] = [
  ...robotGParts.values(),
  ...robotHDummyParts,
]

function isProductionPart(value: unknown): value is ProductionPart {
  if (!value || typeof value !== 'object') return false
  const part = value as Record<string, unknown>
  return (
    typeof part.partNumber === 'string' &&
    (part.line === 'Robot G' || part.line === 'Robot H') &&
    (part.type === 'Assy' || part.type === 'Sub Assy') &&
    typeof part.process === 'string' &&
    Array.isArray(part.models) &&
    part.models.every((model) => typeof model === 'string') &&
    (part.packaging === undefined ||
      (typeof part.packaging === 'number' &&
        Number.isInteger(part.packaging) &&
        part.packaging > 0))
  )
}

export function readProductionParts(): ProductionPart[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultProductionParts
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every(isProductionPart)) {
    throw new Error('Master mapping PN dan line tidak valid. Periksa Master Data → Part Number.')
  }
  const overrides = new Map(parsed.map((part) => [part.partNumber, part]))
  const defaults = defaultProductionParts.map(
    (part) => overrides.get(part.partNumber) ?? part,
  )
  const known = new Set(defaultProductionParts.map((part) => part.partNumber))
  return [...defaults, ...parsed.filter((part) => !known.has(part.partNumber))]
}

export function getProductionPart(partNumber: string): ProductionPart | undefined {
  return readProductionParts().find((part) => part.partNumber === partNumber)
}

export function getProductionParts(type?: QueueType): ProductionPart[] {
  const parts = readProductionParts()
  return type ? parts.filter((part) => part.type === type) : parts
}

export function getProductionWorkAreas(role: Role): ProductionWorkArea[] {
  const allowedTypes: QueueType[] =
    role === 'operator_assy'
      ? ['Assy']
      : role === 'operator_sub_assy'
        ? ['Sub Assy']
        : role === 'operator_both'
          ? ['Assy', 'Sub Assy']
          : []
  const areas = new Map<string, ProductionWorkArea>()

  for (const part of getProductionParts()) {
    if (!allowedTypes.includes(part.type)) continue
    const id = `${part.line}:${part.type}:${part.process}`
    if (areas.has(id)) continue
    areas.set(id, {
      id,
      label: part.type === 'Assy'
        ? `${part.line} · Assy`
        : `${part.line} · ${part.process}`,
      line: part.line,
      type: part.type,
      process: part.process,
    })
  }

  return Array.from(areas.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export function matchesProductionWorkArea(
  workArea: ProductionWorkArea,
  item: { line?: RobotLine; type: QueueType; process?: string },
): boolean {
  return (
    item.line === workArea.line &&
    item.type === workArea.type &&
    (!item.process || item.process === workArea.process)
  )
}

export function saveProductionPart(part: ProductionPart): ProductionPart {
  const normalized: ProductionPart = {
    ...part,
    partNumber: part.partNumber.trim().toUpperCase(),
    process: part.process.trim(),
    models: Array.from(new Set(part.models.map((model) => model.trim()).filter(Boolean))),
    placeholder: false,
  }
  if (!normalized.partNumber) throw new Error('Part number wajib diisi.')
  if (!normalized.process) throw new Error('Line proses wajib diisi.')
  if (normalized.models.length === 0) throw new Error('Minimal satu model wajib diisi.')
  if (
    normalized.packaging !== undefined &&
    (!Number.isInteger(normalized.packaging) || normalized.packaging <= 0)
  ) {
    throw new Error('Standard packaging harus berupa bilangan bulat lebih besar dari 0.')
  }

  const parts = readProductionParts()
  const next = new Map(parts.map((item) => [item.partNumber, item]))
  next.set(normalized.partNumber, normalized)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next.values())))
  return normalized
}
