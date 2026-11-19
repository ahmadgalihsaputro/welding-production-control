import { api } from './api'

export interface DashboardKpi {
  target: number
  actual: number
  achievement: number
  okToday: number
  ngToday: number
  completedToday: number
  queueWaiting: number
  queueRunning: number
  stockLow: number
  stockEmpty: number
  materialWaiting: number
  bufferPending: number
}

export interface DashboardDay {
  date: string
  ok: number
  ng: number
  target: number
}

export interface DashboardMachine {
  id: string
  code: string
  name: string
  line: string
  processes: string[]
  status: string
}

export interface DashboardQueueItem {
  id: string
  no: number
  partNumber: string
  model: string
  type: string
  line: string | null
  taken: number
  time: string
  priority: string
  status: string
}

export interface DashboardCompletedBox {
  id: string
  partNumber: string
  type: string
  line: string | null
  qty: number
  completedAt: string
  shift: number | null
  operator: string
}

export interface DashboardSchedule {
  id: string
  partNumber: string
  model: string
  target: number
  actual: number
  status: string
  shift: number
  line: string
}

export interface DashboardStockAlert {
  id: string
  partNumber: string
  description: string
  store: number
  buffer: number
  safetyStock: number
  maxStore: number
  status: string
}

export interface DashboardActivity {
  id: string
  title: string
  detail: string
  time: string
  type: string
}

export interface DashboardData {
  generatedAt: string
  line: string
  kpi: DashboardKpi
  daily: DashboardDay[]
  ngPareto: Array<{ partNumber: string; ng: number }>
  queue: DashboardQueueItem[]
  machines: DashboardMachine[]
  schedules: DashboardSchedule[]
  completedBoxes: DashboardCompletedBox[]
  stockAlerts: DashboardStockAlert[]
  materialRequests: unknown[]
  activities: DashboardActivity[]
}

export function getDashboard(line: string) {
  return api.get<DashboardData>(`/dashboard?line=${encodeURIComponent(line)}`)
}
