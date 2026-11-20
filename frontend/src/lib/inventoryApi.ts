import { api } from './api'
import type { StockPolicyRecord } from './masterApi'

export type StockItemRecord = StockPolicyRecord

export interface InventoryOverviewRecord {
  totalParts: number
  totalStore: number
  totalBuffer: number
  low: number
  empty: number
  full: number
  bufferPending: number
  ledgerToday: number
  categories: Array<{ category: string; parts: number; store: number; low: number; empty: number }>
}

export interface LedgerEntryRecord {
  id: string
  time: string
  partNumber: string
  type: string
  qty: number
  balance: number
  location: string
  reference: string
  user: string
}

export interface BufferItemRecord {
  id: string
  partNumber: string
  qty: number
  kanban: string
  completedAt: string
  operator: string
  waitingMinutes: number
  status: 'pending' | 'stored'
}

export interface MaterialRequestRecord {
  id: string
  code: string
  kind: string
  partNumber: string
  boxes: number
  pcsPerBox: number
  destination: string
  requester: string
  note: string | null
  status: string
  createdAt: string
}

export function listStock(params?: { category?: string; status?: string; location?: string }) {
  const query = new URLSearchParams()
  if (params?.category) query.set('category', params.category)
  if (params?.status) query.set('status', params.status)
  if (params?.location) query.set('location', params.location)
  const suffix = query.toString() ? `?${query}` : ''
  return api.get<StockItemRecord[]>(`/inventory/stock${suffix}`)
}

export function getInventoryOverview() {
  return api.get<InventoryOverviewRecord>('/inventory/overview')
}

export function listLedger(params?: { partNumber?: string; type?: string; from?: string; to?: string }) {
  const query = new URLSearchParams()
  if (params?.partNumber) query.set('partNumber', params.partNumber)
  if (params?.type) query.set('type', params.type)
  if (params?.from) query.set('from', params.from)
  if (params?.to) query.set('to', params.to)
  const suffix = query.toString() ? `?${query}` : ''
  return api.get<LedgerEntryRecord[]>(`/inventory/ledger${suffix}`)
}

export function adjustStock(input: {
  partNumber: string
  newStore: number
  reason: string
  location?: string
}) {
  return api.post<{ stock: StockItemRecord; ledger: LedgerEntryRecord }>(
    '/inventory/adjustment',
    input,
  )
}

export function listBuffer() {
  return api.get<BufferItemRecord[]>('/inventory/buffer')
}

export function updateBufferStatus(id: string, status: 'pending' | 'stored') {
  return api.patch<BufferItemRecord>(`/inventory/buffer/${encodeURIComponent(id)}/status`, { status })
}

export function listMaterialRequests(params?: { kind?: string; status?: string }) {
  const query = new URLSearchParams()
  if (params?.kind) query.set('kind', params.kind)
  if (params?.status) query.set('status', params.status)
  const suffix = query.toString() ? `?${query}` : ''
  return api.get<MaterialRequestRecord[]>(`/material/requests${suffix}`)
}

export function updateMaterialRequestStatus(id: string, status: string) {
  return api.patch<MaterialRequestRecord>(`/material/requests/${encodeURIComponent(id)}/status`, {
    status,
  })
}

export interface ScanDeviceRecord {
  name: string
  location: string
  pairingCode: string
}

export interface ScanResultRecord {
  destination: 'supplier' | 'assy' | 'sub-assy'
  device: string
  request: MaterialRequestRecord
}

export function listScanDevices() {
  return api.get<ScanDeviceRecord[]>('/scan/devices')
}

export function scanKanban(input: { code: string; pairingCode?: string }) {
  return api.post<ScanResultRecord>('/scan', input)
}

export function getScanPending() {
  return api.get<{ assy: number; subAssy: number; supplier: number }>('/scan/pending')
}
