const operatorRoles = new Set(['operator_assy', 'operator_sub_assy', 'operator_both'])

export function isOperatorRole(role: string): boolean {
  return operatorRoles.has(role)
}

interface WorkAreaLike {
  type: string
}

export function workAreaMismatchForRole(
  role: string,
  areas: WorkAreaLike[],
): string | null {
  if (role === 'operator_assy' && areas.some((area) => area.type !== 'Assy')) {
    return 'Operator Assy hanya dapat ditugaskan ke area Assy.'
  }
  if (role === 'operator_sub_assy' && areas.some((area) => area.type !== 'Sub_Assy')) {
    return 'Operator Sub Assy hanya dapat ditugaskan ke area Sub Assy.'
  }
  return null
}

export function nonOperatorAreaMessage(role: string): string | null {
  return isOperatorRole(role) ? null : 'Penugasan area hanya untuk role operator.'
}
