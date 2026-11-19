import { api } from './api'

export interface NotificationSettings {
  assy: { low: boolean; high: boolean }
  subAssy: { low: boolean; high: boolean }
  criticalSafety: boolean
}

export interface StockAlert {
  id: string
  title: string
  body: string
  time: string
  tone: 'danger' | 'warning' | 'info'
  kind: 'low' | 'high' | 'critical'
  partNumber: string
  category: 'Assy' | 'Sub Assy'
}

export interface StockAlertSummary {
  total: number
  low: number
  high: number
  critical: number
}

export function getNotificationSettings() {
  return api.get<NotificationSettings>('/settings/notifications')
}

export function saveNotificationSettings(settings: NotificationSettings) {
  return api.put<NotificationSettings>('/settings/notifications', { value: settings })
}

export function getStockAlerts() {
  return api.get<{ alerts: StockAlert[]; summary: StockAlertSummary }>('/settings/notifications/alerts')
}
