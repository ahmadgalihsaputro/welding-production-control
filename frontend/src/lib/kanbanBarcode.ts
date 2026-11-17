import type { KanbanBarcodePayload, ScannedKanban } from '../types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isKanbanBarcodePayload(value: unknown): value is KanbanBarcodePayload {
  if (!isRecord(value)) return false
  if (
    value.version !== 1 ||
    typeof value.partNumber !== 'string' ||
    typeof value.line !== 'string' ||
    typeof value.qty !== 'number' ||
    !Number.isInteger(value.qty) ||
    value.qty <= 0 ||
    typeof value.operator !== 'string' ||
    (value.shift !== 1 && value.shift !== 2) ||
    typeof value.model !== 'string' ||
    typeof value.storeLocation !== 'string' ||
    (value.kanbanType !== 'KD' && value.kanbanType !== 'Reguler') ||
    (value.partType !== 'Assy' && value.partType !== 'Sub_Assy') ||
    typeof value.process !== 'string' ||
    typeof value.nextProcess !== 'string'
  ) {
    return false
  }
  return true
}

export function parseKanbanBarcode(value: string): KanbanBarcodePayload | null {
  try {
    const decoded: unknown = JSON.parse(value)
    return isKanbanBarcodePayload(decoded) ? decoded : null
  } catch {
    return null
  }
}

export function scannedKanbanFromPayload(
  code: string,
  payload: KanbanBarcodePayload,
): ScannedKanban {
  return {
    code,
    partNumber: payload.partNumber,
    model: payload.model,
    type: payload.partType === 'Assy' ? 'Assy' : 'Sub Assy',
    line: payload.line,
    process: payload.process,
    qty: payload.qty,
  }
}
