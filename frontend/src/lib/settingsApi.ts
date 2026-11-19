import { api, downloadFile } from './api'

export interface PrintingSettings {
  autoPrint: boolean
  labelSize: '100x150' | '80x100' | '60x80'
  copies: number
  symbology: 'code128' | 'qr' | 'both'
  dpi: '203' | '300'
}

export function getPrintingSettings() {
  return api.get<PrintingSettings>('/settings/printing')
}

export function savePrintingSettings(settings: PrintingSettings) {
  return api.put<PrintingSettings>('/settings/printing', { value: settings })
}

export interface BackupSettings {
  automatic: boolean
  schedule: string
  retentionDays: number
  lastBackupAt: string | null
}

export interface BackupFile {
  file: string
  size: number
  createdAt: string
}

export function getBackupSettings() {
  return api.get<BackupSettings>('/settings/backup')
}

export function saveBackupSettings(settings: Pick<BackupSettings, 'automatic' | 'schedule' | 'retentionDays'>) {
  return api.put<BackupSettings>('/settings/backup', { value: settings })
}

export function listBackups() {
  return api.get<BackupFile[]>('/settings/backups')
}

export function runBackup() {
  return api.post<BackupFile>('/settings/backup')
}

export function cleanupBackups() {
  return api.post<{ deleted: number; freedBytes: number }>('/settings/backups/cleanup')
}

export function downloadBackup(file: string) {
  return downloadFile(`/settings/backups/${encodeURIComponent(file)}/download`, file)
}
