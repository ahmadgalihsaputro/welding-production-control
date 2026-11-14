import type { Role } from '../types'
import { ALL_ROLES, findLeafByPath, navigation } from '../data/navigation'

const openPaths = new Set(['/settings/profile', '/settings/preferences', '/settings/notifications'])

export function rolesForPath(pathname: string): Role[] {
  if (openPaths.has(pathname)) return ALL_ROLES
  const leaf = findLeafByPath(pathname)
  if (leaf) return leaf.roles
  const direct = navigation.find((group) => group.path === pathname)
  return direct?.roles ?? ALL_ROLES
}

export function canAccess(pathname: string, role: Role): boolean {
  return rolesForPath(pathname).includes(role)
}

export function defaultPathForRole(role: Role): string {
  if (role === 'operator_assy') return '/production/assy-queue'
  if (role === 'operator_sub_assy') return '/production/queue'
  if (role === 'operator_both') return '/production/assy-queue'
  return '/'
}
