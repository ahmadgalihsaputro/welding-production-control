import { usePreferences } from '../../contexts/PreferencesContext'
import type { Tone } from '../../types'
import { Badge } from './Badge'

const statusEn: Record<string, string> = {
  safe: 'Safe',
  empty: 'Empty',
}

interface StatusMeta {
  label: string
  tone: Tone
}

const statusMap: Record<string, StatusMeta> = {
  running: { label: 'Running', tone: 'sky' },
  waiting: { label: 'Waiting', tone: 'neutral' },
  complete: { label: 'Complete', tone: 'success' },
  completed: { label: 'Completed', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  low: { label: 'Low stock', tone: 'danger' },
  safe: { label: 'Aman', tone: 'success' },
  full: { label: 'Full store', tone: 'sky' },
  empty: { label: 'Kosong', tone: 'danger' },
  pending: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  stored: { label: 'Stored', tone: 'success' },
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  online: { label: 'Online', tone: 'success' },
  offline: { label: 'Offline', tone: 'neutral' },
  maintenance: { label: 'Maintenance', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'danger' },
  normal: { label: 'Normal', tone: 'neutral' },
  prepared: { label: 'Prepared', tone: 'sky' },
  picked: { label: 'Picked', tone: 'info' },
  partial: { label: 'Partial', tone: 'warning' },
  received: { label: 'Received', tone: 'success' },
  posted: { label: 'Posted', tone: 'success' },
  void: { label: 'Void', tone: 'danger' },
  success: { label: 'Success', tone: 'success' },
  warning: { label: 'Warning', tone: 'warning' },
  error: { label: 'Error', tone: 'danger' },
  idle: { label: 'Idle', tone: 'warning' },
  low_stock: { label: 'Low stock', tone: 'danger' },
}

interface StatusBadgeProps {
  status: string
  label?: string
  dot?: boolean
}

export function StatusBadge({ status, label, dot = true }: StatusBadgeProps) {
  const { t } = usePreferences()
  const meta = statusMap[status] ?? { label: status, tone: 'neutral' as Tone }
  return (
    <Badge tone={meta.tone} dot={dot}>
      {label ?? t(meta.label, statusEn[status] ?? meta.label)}
    </Badge>
  )
}
