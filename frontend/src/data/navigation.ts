import {
  BarChart3,
  Boxes,
  Database,
  Factory,
  LayoutDashboard,
  Settings2,
  Truck,
  UsersRound,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '../types'

export const ALL_ROLES: Role[] = [
  'operator_assy',
  'operator_sub_assy',
  'operator_both',
  'leader',
  'admin',
  'management',
]

export interface NavLeaf {
  label: string
  path: string
  roles: Role[]
  badge?: string
}

export interface NavGroup {
  id: string
  label: string
  icon: LucideIcon
  section: 'main' | 'insight' | 'admin'
  path?: string
  roles?: Role[]
  items?: NavLeaf[]
  badge?: string
}

const assyQueueRoles: Role[] = ['operator_assy', 'operator_both', 'leader', 'admin']
const subAssyQueueRoles: Role[] = ['operator_sub_assy', 'operator_both', 'leader', 'admin']
const assyProductionRoles: Role[] = ['operator_assy', 'operator_both', 'leader']
const subAssyProductionRoles: Role[] = ['operator_sub_assy', 'operator_both', 'leader']
const productionRoles: Role[] = [
  'operator_assy',
  'operator_sub_assy',
  'operator_both',
  'leader',
  'admin',
]
const materialRoles: Role[] = ['leader', 'admin']
const inventoryRoles: Role[] = ['leader', 'admin']

export const navigation: NavGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    section: 'main',
    path: '/',
    roles: ALL_ROLES,
  },
  {
    id: 'production',
    label: 'Production Control',
    icon: Factory,
    section: 'main',
    roles: productionRoles,
    items: [
      {
        label: 'Jadwal Assy',
        path: '/production/schedule',
        roles: ['operator_assy', 'operator_both', 'leader', 'admin', 'management'],
      },
      {
        label: 'Antrian Assy',
        path: '/production/assy-queue',
        roles: assyQueueRoles,
        badge: '2',
      },
      { label: 'Produksi Assy', path: '/production/assy', roles: assyProductionRoles },
      {
        label: 'Antrian Sub Assy',
        path: '/production/queue',
        roles: subAssyQueueRoles,
        badge: '4',
      },
      {
        label: 'Antrian Admin / Alokasi',
        path: '/production/allocation',
        roles: ['admin'],
      },
      {
        label: 'Produksi Sub Assy',
        path: '/production/sub-assy',
        roles: subAssyProductionRoles,
      },
      {
        label: 'Hasil Produksi',
        path: '/production/results',
        roles: [
          'operator_assy',
          'operator_sub_assy',
          'operator_both',
          'leader',
          'admin',
          'management',
        ],
      },
    ],
  },
  {
    id: 'material',
    label: 'Material Control',
    icon: Truck,
    section: 'main',
    roles: materialRoles,
    items: [
      {
        label: 'Permintaan Material',
        path: '/material/request',
        roles: materialRoles,
        badge: '3',
      },
      { label: 'Pengambilan Supply', path: '/material/pickup', roles: materialRoles },
      { label: 'Pengembalian Material', path: '/material/return', roles: materialRoles },
      { label: 'Scan Pickup Assy', path: '/material/assy-pickup', roles: materialRoles },
      {
        label: 'External Material',
        path: '/material/external',
        roles: materialRoles,
        badge: '2',
      },
      { label: 'Penerimaan Material', path: '/material/receiving', roles: materialRoles },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory Control',
    icon: Warehouse,
    section: 'main',
    roles: inventoryRoles,
    items: [
      { label: 'Stock Overview', path: '/inventory/overview', roles: inventoryRoles },
      { label: 'Production Buffer', path: '/inventory/buffer', roles: inventoryRoles },
      { label: 'Assy Store', path: '/inventory/assy-store', roles: inventoryRoles },
      { label: 'Sub Assy Store', path: '/inventory/sub-assy-store', roles: inventoryRoles },
      { label: 'Mutasi Stok', path: '/inventory/ledger', roles: inventoryRoles },
      {
        label: 'Stock Adjustment',
        path: '/inventory/adjustment',
        roles: ['leader', 'admin'],
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    section: 'insight',
    roles: ['leader', 'admin', 'management'],
    items: [
      {
        label: 'Production Report',
        path: '/reports/production',
        roles: ['leader', 'admin', 'management'],
      },
      {
        label: 'Inventory Report',
        path: '/reports/inventory',
        roles: ['leader', 'admin', 'management'],
      },
      {
        label: 'Material Usage',
        path: '/reports/material-usage',
        roles: ['leader', 'admin', 'management'],
      },
      { label: 'NG Report', path: '/reports/ng', roles: ['leader', 'admin', 'management'] },
      {
        label: 'Transaction Report',
        path: '/reports/transactions',
        roles: ['leader', 'admin', 'management'],
      },
    ],
  },
  {
    id: 'master',
    label: 'Master Data',
    icon: Database,
    section: 'admin',
    roles: ['leader', 'admin'],
    items: [
      { label: 'Model', path: '/master/models', roles: ['leader', 'admin'] },
      { label: 'Part Number', path: '/master/parts', roles: ['leader', 'admin'] },
      { label: 'BOM', path: '/master/bom', roles: ['leader', 'admin'] },
      { label: 'Cycle Time & Capacity', path: '/master/cycle-time', roles: ['admin'] },
      { label: 'Machine', path: '/master/machines', roles: ['admin'] },
      { label: 'Packaging & Policy', path: '/master/stock-policy', roles: ['leader', 'admin'] },
      { label: 'Inventory Location', path: '/master/locations', roles: ['admin'] },
      { label: 'Shift & Working Hours', path: '/master/shifts', roles: ['admin'] },
      { label: 'Kanban Configuration', path: '/master/kanban', roles: ['admin'] },
      { label: 'Work Area', path: '/master/work-areas', roles: ['admin'] },
    ],
  },
  {
    id: 'users',
    label: 'User Management',
    icon: UsersRound,
    section: 'admin',
    roles: ['admin'],
    items: [
      { label: 'User List', path: '/users/list', roles: ['admin'] },
      { label: 'Roles & Permissions', path: '/users/roles', roles: ['admin'] },
      { label: 'Device Management', path: '/users/devices', roles: ['admin'] },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings2,
    section: 'admin',
    roles: ALL_ROLES,
    items: [
      { label: 'My Profile', path: '/settings/profile', roles: ALL_ROLES },
      { label: 'Application Preferences', path: '/settings/preferences', roles: ALL_ROLES },
      { label: 'Notifications', path: '/settings/notifications', roles: ALL_ROLES },
      { label: 'FSS Integration', path: '/settings/integration', roles: ['admin'] },
      { label: 'Barcode & Printing', path: '/settings/printing', roles: ['leader', 'admin'] },
      { label: 'Security', path: '/settings/security', roles: ['admin'] },
      { label: 'Backup & Maintenance', path: '/settings/backup', roles: ['admin'] },
    ],
  },
]

export const sectionLabels: Record<NavGroup['section'], string> = {
  main: 'Workspace',
  insight: 'Insight',
  admin: 'Administration',
}

export function isLeafAllowed(leaf: NavLeaf, role: Role): boolean {
  return leaf.roles.includes(role)
}

export function isGroupAllowed(group: NavGroup, role: Role): boolean {
  if (group.path) return group.roles?.includes(role) ?? false
  return group.items?.some((item) => item.roles.includes(role)) ?? false
}

export function visibleNavigation(role: Role): NavGroup[] {
  return navigation
    .filter((group) => isGroupAllowed(group, role))
    .map((group) => ({
      ...group,
      items: group.items?.filter((item) => item.roles.includes(role)),
    }))
}

export function findLeafByPath(pathname: string): NavLeaf | undefined {
  for (const group of navigation) {
    const leaf = group.items?.find((item) => item.path === pathname)
    if (leaf) return leaf
  }
  return undefined
}

export function findGroupByPath(pathname: string): NavGroup | undefined {
  return navigation.find(
    (group) =>
      group.path === pathname || group.items?.some((item) => item.path === pathname),
  )
}
