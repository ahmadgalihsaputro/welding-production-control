export type Role =
  | 'operator_assy'
  | 'operator_sub_assy'
  | 'operator_both'
  | 'leader'
  | 'admin'
  | 'management'

export type QueueType = 'Assy' | 'Sub Assy'
export type RobotLine = string
export type ShiftNumber = 1 | 2
export type QueuePriority = 'urgent' | 'normal' | 'low'

export interface ProductionWorkArea {
  id: string
  label: string
  line: RobotLine
  type: QueueType
  process: string
  partNumbers: string[]
}

export type Tone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'orange'
  | 'sky'

export type ProdStatus = 'running' | 'waiting' | 'complete' | 'paused'
export type StockStatus = 'safe' | 'low' | 'full' | 'empty'

export interface SessionUser {
  id: string
  name: string
  username: string
  employeeId: string
  role: Role
  roleLabel: string
  area: string
  line: string
  productionLine?: RobotLine
  productionWorkAreaId?: string
  currentShift?: ShiftNumber | null
  shiftMode?: 'rotating' | 'non_shift'
  shiftBase?: ShiftNumber
  shiftAnchorDate?: string | null
  email: string
  phone?: string
  status?: 'active' | 'inactive'
  initials: string
}

export interface DemoAccount extends SessionUser {
  password: string
}

export interface ScheduleItem {
  id: string
  partNumber: string
  model: string
  target: number
  actual: number
  status: ProdStatus
  shift: 1 | 2
  dueTime: string
  line: string
  updatedAt?: string
}

export interface QueueItem {
  id: string
  no: number
  partNumber: string
  model: string
  type: QueueType
  line?: RobotLine
  process?: string
  sourceShift?: ShiftNumber
  targetShift?: ShiftNumber
  kanban: string
  taken: number
  kanbanQuantity?: number
  printedQty?: number
  printedKanbans?: number
  stock: number
  time: string
  priority: QueuePriority
  status: 'waiting' | 'running' | 'complete'
}

export interface CompletedBox {
  id: string
  partNumber: string
  type: QueueType
  line?: RobotLine
  qty: number
  kanban: string
  completedAt: string
  completedAtEpoch?: number
  date?: string
  operator: string
  shift?: ShiftNumber
}

export interface QueueAuditEntry {
  id: string
  time: string
  title: string
  detail: string
  type: QueueType
  line?: RobotLine
  process?: string
}

export interface ScannedKanban {
  code: string
  partNumber: string
  model: string
  type: QueueType
  line?: RobotLine
  process?: string
  qty: number
  sourceShift?: ShiftNumber
}

export interface KanbanBarcodePayload {
  version: 1
  partNumber: string
  line: string
  qty: number
  operator: string
  shift: ShiftNumber
  model: string
  storeLocation: string
  kanbanType: 'KD' | 'Reguler'
  partType: 'Assy' | 'Sub_Assy'
  process: string
  nextProcess: string
}

export interface ProductionRequest extends ScannedKanban {
  id: string
  line: RobotLine
  sourceShift?: ShiftNumber
  scannedAt: string
  status: 'pending' | 'allocated'
  targetShift?: ShiftNumber
}

export interface NgShiftRecord {
  id: string
  date: string
  partNumber: string
  type: QueueType
  shift: ShiftNumber
  ng: number
  operator: string
  time: string
  updatedAtEpoch?: number
  line: string
}

export interface ProductionShiftRecord {
  id: string
  date: string
  partNumber: string
  type: QueueType
  process?: string
  shift: ShiftNumber
  ok: number
  ng: number
  operator: string
  time: string
  line: string
  updatedAtEpoch?: number
}

export interface ProductionResult {
  id: string
  partNumber: string
  type: 'Assy' | 'Sub Assy'
  ok: number
  ng: number
  shift: 1 | 2
  operator: string
  time: string
  line: string
  date?: string
  process?: string
}

export interface MaterialRequest {
  id: string
  code: string
  partNumber: string
  boxes: number
  pcsPerBox: number
  status: 'waiting' | 'prepared' | 'picked' | 'complete'
  destination: string
  createdAt: string
  requester: string
}

export interface ExternalMaterial {
  id: string
  partNumber: string
  source: string
  need: number
  received: number
  requestedAt: string
  status: 'waiting' | 'partial' | 'received'
  priority: 'urgent' | 'normal' | 'low'
}

export interface StockItem {
  id: string
  partNumber: string
  description: string
  category: 'Assy' | 'Sub Assy' | 'Press Part' | 'Bolt/Nut' | 'Child Part'
  store: number
  buffer: number
  safetyStock: number
  maxStore: number
  packaging: number
  location: string
  status: StockStatus
}

export interface BufferItem {
  id: string
  partNumber: string
  qty: number
  kanban: string
  completedAt: string
  operator: string
  waitingMinutes: number
  status: 'pending' | 'stored'
}

export interface LedgerEntry {
  id: string
  time: string
  partNumber: string
  type: 'Opening' | 'Store In' | 'Supply Issue' | 'Collect Pickup' | 'Return Accepted' | 'Adjustment'
  qty: number
  balance: number
  location: string
  reference: string
  user: string
}

export interface MaterialAlert {
  id: string
  title: string
  detail: string
  count: string
  severity: 'danger' | 'warning' | 'info'
  partNumber?: string
}

export interface ActivityItem {
  id: string
  time: string
  title: string
  detail: string
  type: 'production' | 'material' | 'inventory' | 'system'
}

export interface MachineStatus {
  id: string
  name: string
  process: string
  status: 'running' | 'idle' | 'maintenance' | 'offline'
  load: number
  currentPart: string
}

export interface NotificationItem {
  id: string
  title: string
  body: string
  time: string
  unread: boolean
  tone: Tone
}

export interface AppUser {
  id: string
  employeeId: string
  name: string
  role: Role
  area: string
  line: string
  status: 'active' | 'inactive'
  lastLogin: string
  initials: string
}

export interface Device {
  id: string
  name: string
  type: 'Tablet' | 'PC' | 'Scanner' | 'Printer'
  location: string
  assignedTo: string
  status: 'online' | 'offline' | 'maintenance'
  lastSeen: string
  connectionType?: 'wireless' | 'bluetooth' | 'wired'
}

export interface ModelMaster {
  id: string
  code: string
  name: string
  assyParts: number
  subAssyParts: number
  status: 'active' | 'inactive'
  updatedAt: string
}

export interface PartMaster {
  id: string
  partNumber: string
  description: string
  category: 'Assy' | 'Sub Assy' | 'Press Part' | 'Bolt/Nut' | 'Bolt' | 'Nut' | 'Child Part'
  unit: string
  models: string[]
  line?: string
  process?: string
  status: 'active' | 'inactive'
}

export interface MachineMaster {
  id: string
  code: string
  name: string
  line: string
  processes: string[]
  status: 'active' | 'inactive' | 'maintenance'
}

export interface StockPolicy {
  id: string
  partNumber: string
  category: string
  packaging: number
  maxStore: number
  safetyStock: number
  container: string
  updatedAt: string
}

export interface InventoryLocation {
  id: string
  code: string
  name: string
  type: 'Buffer' | 'Store' | 'External' | 'Return'
  line: string
  capacity: number
  status: 'active' | 'inactive'
}

export interface ShiftConfig {
  id: string
  name: string
  start: string
  end: string
  breakStart: string
  breakEnd: string
  active: boolean
  operatorCount?: number
  maxOvertimeMinutes?: number
}

export interface KanbanConfig {
  id: string
  type: string
  prefix: string
  format: string
  fields: string[]
  template: string
  active: boolean
}

export interface TransactionRow {
  id: string
  code: string
  time: string
  partNumber: string
  type: string
  qty: number
  user: string
  location: string
  status: 'posted' | 'pending' | 'void'
}

export interface ChartSeries {
  name: string
  color: string
  values: number[]
  area?: boolean
  dashed?: boolean
}

export interface PermissionRow {
  feature: string
  operator_assy: 'yes' | 'no' | 'limited'
  operator_sub_assy: 'yes' | 'no' | 'limited'
  operator_both: 'yes' | 'no' | 'limited'
  leader: 'yes' | 'no' | 'limited'
  admin: 'yes' | 'no' | 'limited'
  management: 'yes' | 'no' | 'limited'
}

export interface RoutingStep {
  step: number
  process: string
  machine: string
  cycle: number
  status: 'active' | 'inactive'
}

export interface RoutingMaster {
  id: string
  partNumber: string
  model: string
  version: string
  effectiveDate: string
  steps: RoutingStep[]
}
