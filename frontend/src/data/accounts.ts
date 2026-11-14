import type { DemoAccount, Role } from '../types'

export const DEMO_PASSWORD = 'wpc123'
const ROLE_OVERRIDES_KEY = 'wpc.account-role-overrides.v1'
const USERS_STORAGE_KEY = 'wpc.users.v1'

function readRoleOverrides(): Record<string, Role> {
  try {
    const raw = localStorage.getItem(ROLE_OVERRIDES_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, role]) => typeof role === 'string' && isRole(role),
      ),
    ) as Record<string, Role>
  } catch {
    return {}
  }
}

export function saveRoleOverride(employeeId: string, role: Role): void {
  const overrides = readRoleOverrides()
  overrides[employeeId.trim().toUpperCase()] = role
  localStorage.setItem(ROLE_OVERRIDES_KEY, JSON.stringify(overrides))
}

export function isAccountActive(employeeId: string): boolean {
  const raw = localStorage.getItem(USERS_STORAGE_KEY)
  if (!raw) return true
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error('Data status akun tidak valid. Hubungi Admin.')
  }
  const account = parsed.find((item) => {
    if (!item || typeof item !== 'object') return false
    const storedEmployeeId = Reflect.get(item, 'employeeId')
    return typeof storedEmployeeId === 'string' &&
      storedEmployeeId.toUpperCase() === employeeId.trim().toUpperCase()
  })
  if (!account) return true
  const status = Reflect.get(account, 'status')
  if (status !== 'active' && status !== 'inactive') {
    throw new Error('Status akun tidak valid. Hubungi Admin.')
  }
  return status === 'active'
}

export const demoAccounts: DemoAccount[] = [
  {
    id: 'u-oa-001',
    name: 'Andri Setiawan',
    username: 'operator.assy',
    employeeId: 'OA001',
    password: DEMO_PASSWORD,
    role: 'operator_assy',
    roleLabel: 'Operator Assy',
    area: 'Welding — Assy Robot G',
    line: 'Robot G — Assy',
    email: 'andri.setiawan@wpc.local',
    initials: 'AS',
  },
  {
    id: 'u-os-001',
    name: 'Rizky Anu',
    username: 'operator.subassy',
    employeeId: 'OS001',
    password: DEMO_PASSWORD,
    role: 'operator_sub_assy',
    roleLabel: 'Operator Sub Assy',
    area: 'Welding — Sub Assy Robot G',
    line: 'Robot G — Sub Assy',
    email: 'rizky.anu@wpc.local',
    initials: 'RA',
  },
  {
    id: 'u-ld-001',
    name: 'Uuk Riyanto',
    username: 'leader',
    employeeId: 'LD001',
    password: DEMO_PASSWORD,
    role: 'leader',
    roleLabel: 'Leader Produksi',
    area: 'Welding — Robot G',
    line: 'Robot G',
    email: 'uuk.riyanto@wpc.local',
    initials: 'UR',
  },
  {
    id: 'u-ad-001',
    name: 'Ahmad Galih',
    username: 'admin',
    employeeId: 'AD001',
    password: DEMO_PASSWORD,
    role: 'admin',
    roleLabel: 'Administrator',
    area: 'IT — Manufacturing System',
    line: 'All lines',
    email: 'ahmad.galih@wpc.local',
    initials: 'AG',
  },
  {
    id: 'u-mg-001',
    name: 'Puji Utomo',
    username: 'management',
    employeeId: 'MG001',
    password: DEMO_PASSWORD,
    role: 'management',
    roleLabel: 'Management',
    area: 'Plant Management',
    line: 'All lines',
    email: 'puji.utomo@wpc.local',
    initials: 'PU',
  },
]

export const roleLabels: Record<Role, string> = {
  operator_assy: 'Operator Assy',
  operator_sub_assy: 'Operator Sub Assy',
  operator_both: 'Operator Assy + Sub Assy',
  leader: 'Leader',
  admin: 'Admin',
  management: 'Management',
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && value in roleLabels
}

export function findAccount(identifier: string, password: string): DemoAccount | undefined {
  const key = identifier.trim().toLowerCase()
  const account = demoAccounts.find(
    (account) =>
      (account.username.toLowerCase() === key ||
        account.employeeId.toLowerCase() === key) &&
      account.password === password,
  )
  if (!account) return undefined

  const role = readRoleOverrides()[account.employeeId.toUpperCase()]
  if (!role) return account
  const line =
    role === 'operator_assy'
      ? 'Robot G — Assy'
      : role === 'operator_sub_assy'
        ? 'Robot G — Sub Assy'
        : role === 'operator_both'
          ? 'Robot G — Assy + Sub Assy'
          : account.line
  return { ...account, role, roleLabel: roleLabels[role], line }
}
