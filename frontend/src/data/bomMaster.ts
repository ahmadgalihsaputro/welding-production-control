import { getProductionPart } from './productionLines'

export interface BomComponent {
  partNumber: string
  quantityPerAssy: number
}

export interface BomDefinition {
  parentPartNumber: string
  components: BomComponent[]
}

const STORAGE_KEY = 'wpc.bom-master.v1'

function isBomComponent(value: unknown): value is BomComponent {
  if (!value || typeof value !== 'object') return false
  const component = value as Record<string, unknown>
  return (
    typeof component.partNumber === 'string' &&
    typeof component.quantityPerAssy === 'number' &&
    Number.isInteger(component.quantityPerAssy) &&
    component.quantityPerAssy > 0
  )
}

function isBomDefinition(value: unknown): value is BomDefinition {
  if (!value || typeof value !== 'object') return false
  const definition = value as Record<string, unknown>
  return (
    typeof definition.parentPartNumber === 'string' &&
    Array.isArray(definition.components) &&
    definition.components.every(isBomComponent)
  )
}

export function readBomDefinitions(): BomDefinition[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every(isBomDefinition)) {
    throw new Error('Data BOM tidak valid. Periksa kembali Master Data → BOM.')
  }
  return parsed
}

export function getBomComponents(parentPartNumber: string): BomComponent[] {
  return (
    readBomDefinitions().find((definition) => definition.parentPartNumber === parentPartNumber)
      ?.components ?? []
  )
}

export function saveBomDefinition(
  parentPartNumber: string,
  components: BomComponent[],
): BomDefinition {
  const parent = getProductionPart(parentPartNumber)
  if (!parent || parent.type !== 'Assy') {
    throw new Error(`PN ${parentPartNumber} bukan part Assy yang terdaftar.`)
  }
  if (components.some((component) => !isBomComponent(component))) {
    throw new Error('Qty Sub Assy per Assy harus berupa bilangan bulat lebih besar dari 0.')
  }
  if (new Set(components.map((component) => component.partNumber)).size !== components.length) {
    throw new Error('PN Sub Assy yang sama tidak boleh dimasukkan lebih dari satu kali.')
  }
  for (const component of components) {
    const part = getProductionPart(component.partNumber)
    if (!part || part.type !== 'Sub Assy') {
      throw new Error(`PN ${component.partNumber} bukan Sub Assy yang terdaftar.`)
    }
  }

  const definition = { parentPartNumber, components }
  const definitions = readBomDefinitions().filter(
    (item) => item.parentPartNumber !== parentPartNumber,
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...definitions, definition]))
  return definition
}

export function removeBomDefinition(parentPartNumber: string): void {
  const definitions = readBomDefinitions().filter(
    (item) => item.parentPartNumber !== parentPartNumber,
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(definitions))
}
