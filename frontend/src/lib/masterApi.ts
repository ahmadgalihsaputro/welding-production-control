import { api } from './api'
import type { Role } from '../types'

export type UserStatus = 'active' | 'inactive'
export type WorkAreaType = 'Assy' | 'Sub_Assy'

export interface RoleOption {
  role: Role
  label: string
}

export interface WorkAreaSummary {
  id: string
  label: string
  line: string
  type: WorkAreaType
  process: string
}

export interface WorkAreaUserRef {
  userId: string
  workAreaId: string
  user: {
    id: string
    name: string
    employeeId: string
    role: Role
  }
}

export interface WorkAreaRecord extends WorkAreaSummary {
  users: WorkAreaUserRef[]
}

export interface MasterUserWorkArea {
  userId: string
  workAreaId: string
  workArea: WorkAreaSummary
}

export interface MasterUser {
  id: string
  employeeId: string
  username: string
  name: string
  email: string | null
  role: Role
  roleLabel: string
  area: string
  line: string
  status: UserStatus
  initials: string
  lastLogin: string | null
  createdAt: string
  updatedAt: string
  workAreas: MasterUserWorkArea[]
}

export interface CreateUserInput {
  employeeId: string
  username: string
  name: string
  email?: string
  password: string
  role: Role
  area: string
  line: string
  initials?: string
  status?: UserStatus
  workAreaIds: string[]
}

export interface UpdateUserInput {
  name?: string
  email?: string | null
  role?: Role
  area?: string
  line?: string
  initials?: string
  status?: UserStatus
  password?: string
  workAreaIds?: string[]
}

export interface WorkAreaInput {
  label: string
  line: string
  type: WorkAreaType
  process: string
}

export function listRoles() {
  return api.get<RoleOption[]>('/users/roles')
}

export function listUsers() {
  return api.get<MasterUser[]>('/users')
}

export function createUser(input: CreateUserInput) {
  return api.post<MasterUser>('/users', input)
}

export function updateUser(id: string, input: UpdateUserInput) {
  return api.patch<MasterUser>(`/users/${encodeURIComponent(id)}`, input)
}

export function deleteUser(id: string) {
  return api.delete<{ ok: boolean }>(`/users/${encodeURIComponent(id)}`)
}

export function listWorkAreas() {
  return api.get<WorkAreaRecord[]>('/master/work-areas')
}

export function createWorkArea(input: WorkAreaInput) {
  return api.post<WorkAreaSummary>('/master/work-areas', input)
}

export function updateWorkArea(id: string, input: Partial<WorkAreaInput>) {
  return api.patch<WorkAreaSummary>(
    `/master/work-areas/${encodeURIComponent(id)}`,
    input,
  )
}

export function deleteWorkArea(id: string) {
  return api.delete<{ ok: boolean }>(`/master/work-areas/${encodeURIComponent(id)}`)
}

export type MasterStatus = 'active' | 'inactive'
export type PartType = 'Assy' | 'Sub_Assy'

export interface ProductionPartRecord {
  partNumber: string
  line: string
  type: PartType
  process: string
  models: string[]
  packaging: number | null
  maxStore: number | null
  cycleTime: number | null
  cycleGroupId: string | null
  placeholder: boolean
  status: MasterStatus
  createdAt: string
  updatedAt: string
}

export interface PartInput {
  partNumber: string
  line: string
  type: PartType
  process: string
  models: string[]
  packaging?: number | null
  maxStore?: number | null
  cycleTime?: number | null
  cycleGroupId?: string | null
  placeholder?: boolean
  status?: MasterStatus
}

export type UpdatePartInput = Partial<Omit<PartInput, 'partNumber'>>

export interface ProductionModelBase {
  id: string
  code: string
  name: string
  status: MasterStatus
  createdAt: string
  updatedAt: string
}

export interface ProductionModelRecord extends ProductionModelBase {
  assyParts: number
  subAssyParts: number
}

export interface ModelInput {
  code: string
  name: string
  status?: MasterStatus
}

export interface StockPolicyRecord {
  id: string
  partNumber: string
  description: string
  category: string
  store: number
  buffer: number
  safetyStock: number
  maxStore: number
  packaging: number
  location: string
  status: 'safe' | 'low' | 'full' | 'empty'
}

export function listParts(params?: {
  type?: PartType
  line?: string
  status?: MasterStatus
  search?: string
}) {
  const query = new URLSearchParams()
  if (params?.type) query.set('type', params.type)
  if (params?.line) query.set('line', params.line)
  if (params?.status) query.set('status', params.status)
  if (params?.search) query.set('search', params.search)
  const suffix = query.toString()
  return api.get<ProductionPartRecord[]>(`/master/parts${suffix ? `?${suffix}` : ''}`)
}

export function createPart(input: PartInput) {
  return api.post<ProductionPartRecord>('/master/parts', input)
}

export function updatePart(partNumber: string, input: UpdatePartInput) {
  return api.patch<ProductionPartRecord>(
    `/master/parts/${encodeURIComponent(partNumber)}`,
    input,
  )
}

export function deletePart(partNumber: string) {
  return api.delete<{ ok: boolean }>(
    `/master/parts/${encodeURIComponent(partNumber)}`,
  )
}

export function listModels() {
  return api.get<ProductionModelRecord[]>('/master/models')
}

export function createModel(input: ModelInput) {
  return api.post<ProductionModelBase>('/master/models', input)
}

export function updateModel(
  id: string,
  input: { name?: string; status?: MasterStatus },
) {
  return api.patch<ProductionModelBase>(`/master/models/${encodeURIComponent(id)}`, input)
}

export function deleteModel(id: string) {
  return api.delete<{ ok: boolean }>(`/master/models/${encodeURIComponent(id)}`)
}

export interface BomComponentRecord {
  id: string
  parentPartNumber: string
  componentPartNumber: string
  quantityPerAssy: number
  createdAt: string
  updatedAt: string
  source: 'production' | 'stock'
  description: string | null
  category: string | null
  type: PartType | null
  line: string | null
  process: string | null
  partStatus: MasterStatus | null
}

export interface BomParentResponse {
  parentPartNumber: string
  parent: ProductionPartRecord
  components: BomComponentRecord[]
}

export function listBom(parentPartNumber?: string) {
  const query = parentPartNumber
    ? `?parentPartNumber=${encodeURIComponent(parentPartNumber)}`
    : ''
  return api.get<BomComponentRecord[]>(`/master/bom${query}`)
}

export function getBom(parentPartNumber: string) {
  return api.get<BomParentResponse>(
    `/master/bom/${encodeURIComponent(parentPartNumber)}`,
  )
}

export function addBomComponent(
  parentPartNumber: string,
  input: { partNumber: string; quantityPerAssy: number },
) {
  return api.post<BomComponentRecord>(
    `/master/bom/${encodeURIComponent(parentPartNumber)}`,
    input,
  )
}

export function updateBomComponent(
  parentPartNumber: string,
  componentPartNumber: string,
  quantityPerAssy: number,
) {
  return api.patch<BomComponentRecord>(
    `/master/bom/${encodeURIComponent(parentPartNumber)}/${encodeURIComponent(componentPartNumber)}`,
    { quantityPerAssy },
  )
}

export function deleteBomComponent(
  parentPartNumber: string,
  componentPartNumber: string,
) {
  return api.delete<{ ok: boolean }>(
    `/master/bom/${encodeURIComponent(parentPartNumber)}/${encodeURIComponent(componentPartNumber)}`,
  )
}

export type MachineStatus = 'active' | 'inactive' | 'maintenance'

export interface MachineRecord {
  id: string
  code: string
  name: string
  line: string
  processes: string[]
  status: MachineStatus
  createdAt: string
  updatedAt: string
}

export interface MachineInput {
  code: string
  name: string
  line: string
  processes: string[]
  status?: MachineStatus
}

export function listMachines() {
  return api.get<MachineRecord[]>('/master/machines')
}

export function createMachine(input: MachineInput) {
  return api.post<MachineRecord>('/master/machines', input)
}

export function updateMachine(
  id: string,
  input: Partial<Omit<MachineInput, 'code'>>,
) {
  return api.patch<MachineRecord>(`/master/machines/${encodeURIComponent(id)}`, input)
}

export function deleteMachine(id: string) {
  return api.delete<{ ok: boolean }>(`/master/machines/${encodeURIComponent(id)}`)
}

export interface RoutingStepRecord {
  step: number
  process: string
  machine: string
  cycle: number
  status: MasterStatus
}

export interface RoutingRecord {
  id: string
  partNumber: string
  model: string
  version: string
  effectiveDate: string
  steps: RoutingStepRecord[]
  status: MasterStatus
  createdAt: string
  updatedAt: string
}

export interface RoutingInput {
  partNumber: string
  model: string
  version: string
  effectiveDate: string
  steps: RoutingStepRecord[]
  status?: MasterStatus
}

export function listRoutings(params?: { partNumber?: string }) {
  const query = params?.partNumber
    ? `?partNumber=${encodeURIComponent(params.partNumber)}`
    : ''
  return api.get<RoutingRecord[]>(`/master/routings${query}`)
}

export function createRouting(input: RoutingInput) {
  return api.post<RoutingRecord>('/master/routings', input)
}

export function updateRouting(id: string, input: Partial<RoutingInput>) {
  return api.patch<RoutingRecord>(`/master/routings/${encodeURIComponent(id)}`, input)
}

export function deleteRouting(id: string) {
  return api.delete<{ ok: boolean }>(`/master/routings/${encodeURIComponent(id)}`)
}

export interface StockPolicyRecord {
  id: string
  partNumber: string
  description: string
  category: string
  store: number
  buffer: number
  safetyStock: number
  maxStore: number
  packaging: number
  location: string
  status: 'safe' | 'low' | 'full' | 'empty'
  createdAt: string
  updatedAt: string
}

export interface StockPolicyInput {
  partNumber: string
  description: string
  category: string
  packaging: number
  maxStore: number
  safetyStock: number
  location: string
}

export type UpdateStockPolicyInput = Partial<
  Omit<StockPolicyInput, 'partNumber'>
>

export function listStockPolicy(params?: { category?: string }) {
  const query = params?.category
    ? `?category=${encodeURIComponent(params.category)}`
    : ''
  return api.get<StockPolicyRecord[]>(`/master/stock-policy${query}`)
}

export function createStockPolicy(input: StockPolicyInput) {
  return api.post<StockPolicyRecord>('/master/stock-policy', input)
}

export function updateStockPolicy(
  partNumber: string,
  input: UpdateStockPolicyInput,
) {
  return api.patch<StockPolicyRecord>(
    `/master/stock-policy/${encodeURIComponent(partNumber)}`,
    input,
  )
}

export function deleteStockPolicy(partNumber: string) {
  return api.delete<{ ok: boolean }>(
    `/master/stock-policy/${encodeURIComponent(partNumber)}`,
  )
}
