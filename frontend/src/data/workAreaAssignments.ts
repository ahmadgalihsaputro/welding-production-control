import { getProductionWorkAreas } from './productionLines'
import type { ProductionWorkArea, Role } from '../types'

const STORAGE_KEY = 'wpc.operator-work-area-assignments.v1'

function readAssignments(): Record<string, string[]> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return {}
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Data penugasan area operator tidak valid.')
  }
  const entries = Object.entries(parsed)
  if (!entries.every(([, ids]) => Array.isArray(ids) && ids.every((id) => typeof id === 'string'))) {
    throw new Error('Daftar area operator harus berisi ID area yang valid.')
  }
  return Object.fromEntries(entries) as Record<string, string[]>
}

function defaultWorkAreaIds(employeeId: string, role: Role): string[] {
  const areas = getProductionWorkAreas(role)
  const employee = employeeId.trim().toUpperCase()
  if (employee === 'OA001') {
    return areas
      .filter((area) => area.line === 'Robot G' && area.type === 'Assy')
      .map((area) => area.id)
  }
  if (employee === 'OS001') {
    return areas
      .filter((area) => area.line === 'Robot G' && area.type === 'Sub Assy')
      .map((area) => area.id)
  }
  return []
}

export function getAssignedProductionWorkAreas(
  employeeId: string,
  role: Role,
): ProductionWorkArea[] {
  const key = employeeId.trim().toUpperCase()
  const saved = readAssignments()
  const ids = Object.prototype.hasOwnProperty.call(saved, key)
    ? saved[key]
    : defaultWorkAreaIds(key, role)
  const areas = getProductionWorkAreas(role)
  const allowed = new Set(areas.map((area) => area.id))
  return ids
    .filter((id) => allowed.has(id))
    .map((id) => areas.find((area) => area.id === id))
    .filter((area): area is ProductionWorkArea => Boolean(area))
}

export function saveProductionWorkAreaAssignments(
  employeeId: string,
  role: Role,
  ids: string[],
): void {
  const key = employeeId.trim().toUpperCase()
  if (!key) throw new Error('Employee ID wajib diisi untuk penugasan area.')
  const allowed = new Set(getProductionWorkAreas(role).map((area) => area.id))
  const uniqueIds = Array.from(new Set(ids))
  if (uniqueIds.some((id) => !allowed.has(id))) {
    throw new Error('Penugasan memuat area yang tidak sesuai dengan role operator.')
  }
  const assignments = readAssignments()
  assignments[key] = uniqueIds
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments))
}

export function readProductionWorkAreaAssignmentIds(
  employeeId: string,
  role: Role,
): string[] {
  return getAssignedProductionWorkAreas(employeeId, role).map((area) => area.id)
}
