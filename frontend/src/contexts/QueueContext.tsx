import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { usePreferences } from './PreferencesContext'
import { describeApiError } from '../lib/api'
import {
  allocateProductionRequest,
  loadProductionState,
  mapCompletedBox,
  printProductionKanban,
  reorderProductionQueue,
  scanProductionKanban,
  updateQueuePriority,
} from '../lib/productionApi'
import { getShiftNumberAt } from '../data/productionPlanning'
import type {
  CompletedBox,
  ProductionRequest,
  QueueAuditEntry,
  QueueItem,
  QueuePriority,
  QueueType,
  Role,
  ScannedKanban,
  ShiftNumber,
} from '../types'

interface QueueState {
  items: QueueItem[]
  requests: ProductionRequest[]
  completed: CompletedBox[]
  audit: QueueAuditEntry[]
  loading: boolean
  error: string
}

interface QueueContextValue extends QueueState {
  addFromScan: (scan: ScannedKanban) => Promise<{
    ok: boolean
    request?: ProductionRequest
    error?: string
  }>
  allocateRequest: (
    id: string,
    targetShift: ShiftNumber,
    role: Role,
  ) => Promise<{ ok: boolean; item?: QueueItem; generatedSubAssy?: number; error?: string }>
  printKanban: (
    id: string,
    operator: string,
    role: Role,
    shift: ShiftNumber,
    line: string,
  ) => Promise<{
    ok: boolean
    box?: CompletedBox
    totalQty?: number
    completedKanbans?: number
    totalKanbans?: number
    error?: string
  }>
  moveItem: (
    id: string,
    direction: 'up' | 'down',
    role: Role,
    shift: ShiftNumber,
    line: string,
    process?: string,
  ) => Promise<void>
  cyclePriority: (id: string, role: Role, shift: ShiftNumber, line: string) => Promise<void>
  refresh: () => Promise<void>
}

const initialState: QueueState = {
  items: [],
  requests: [],
  completed: [],
  audit: [],
  loading: false,
  error: '',
}

function canOperateQueue(role: Role): boolean {
  return (
    role === 'operator_assy' ||
    role === 'operator_sub_assy' ||
    role === 'operator_both' ||
    role === 'leader'
  )
}

function canOperateType(role: Role, type: QueueType): boolean {
  return (
    role === 'leader' ||
    role === 'operator_both' ||
    (role === 'operator_assy' && type === 'Assy') ||
    (role === 'operator_sub_assy' && type === 'Sub Assy')
  )
}

const QueueContext = createContext<QueueContextValue | null>(null)

export function QueueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { t } = usePreferences()
  const [state, setState] = useState<QueueState>(initialState)
  const itemsRef = useRef<QueueItem[]>([])

  useEffect(() => {
    itemsRef.current = state.items
  }, [state.items])

  const refresh = useCallback(async () => {
    if (!user) {
      setState(initialState)
      return
    }
    setState((current) => ({ ...current, loading: true }))
    try {
      const next = await loadProductionState()
      setState({ ...next, loading: false, error: '' })
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: describeApiError(error, t('Data produksi gagal dimuat.', 'Production data failed to load.')),
      }))
    }
  }, [user, t])

  useEffect(() => {
    if (!user) {
      setState(initialState)
      itemsRef.current = []
      return
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(timer)
  }, [user, refresh])

  const addFromScan = useCallback(
    async (scan: ScannedKanban) => {
      try {
        let sourceShift: ShiftNumber | undefined
        try {
          sourceShift = getShiftNumberAt()
        } catch {
          sourceShift = undefined
        }
        const request = await scanProductionKanban({
          ...scan,
          model: scan.model.replace(/^Model\s+/i, '').split('/')[0].trim(),
          sourceShift,
        })
        await refresh()
        return { ok: true, request }
      } catch (error) {
        return {
          ok: false,
          error: describeApiError(error, t('Kanban gagal masuk antrian.', 'Kanban failed to enter the queue.')),
        }
      }
    },
    [refresh, t],
  )

  const allocateRequest = useCallback(
    async (id: string, targetShift: ShiftNumber, role: Role) => {
      if (role !== 'admin' && role !== 'leader') {
        return { ok: false, error: 'Hanya Admin atau Leader yang dapat membagi permintaan ke shift.' }
      }
      try {
        const before = new Set(itemsRef.current.map((item) => item.id))
        const item = await allocateProductionRequest(id, targetShift)
        const next = await loadProductionState()
        setState({ ...next, loading: false, error: '' })
        const generatedSubAssy = next.items.filter(
          (row) => !before.has(row.id) && row.type === 'Sub Assy' && row.id !== item.id,
        ).length
        return { ok: true, item, generatedSubAssy }
      } catch (error) {
        return {
          ok: false,
          error: describeApiError(error, t('Permintaan gagal dialokasikan.', 'Request failed to allocate.')),
        }
      }
    },
    [t],
  )

  const printKanban = useCallback(
    async (id: string, operator: string, role: Role, shift: ShiftNumber, line: string) => {
      if (!canOperateQueue(role)) {
        return {
          ok: false,
          error:
            role === 'admin'
              ? 'Role Admin hanya dapat memantau dan tidak dapat mencetak kanban.'
              : 'Role ini tidak memiliki izin untuk mencetak kanban.',
        }
      }
      const item = itemsRef.current.find((entry) => entry.id === id)
      if (!item) return { ok: false, error: 'Kanban tidak ditemukan di antrian.' }
      if (!canOperateType(role, item.type)) {
        return { ok: false, error: `Role ini tidak memiliki izin untuk memproduksi ${item.type}.` }
      }
      if (item.line && item.line !== line) {
        return { ok: false, error: `Kanban ini dialokasikan ke ${item.line}, bukan ${line}.` }
      }
      if (item.targetShift && item.targetShift !== shift) {
        return {
          ok: false,
          error: `Kanban ini dialokasikan untuk Shift ${item.targetShift}.`,
        }
      }

      try {
        const result = await printProductionKanban(id, operator)
        const box = mapCompletedBox(result.box)
        await refresh()
        return {
          ok: true,
          box,
          totalQty: result.totalQty,
          completedKanbans: result.completedKanbans,
          totalKanbans: result.totalKanbans,
        }
      } catch (error) {
        return {
          ok: false,
          error: describeApiError(error, t('Kanban gagal dicetak.', 'Kanban failed to print.')),
        }
      }
    },
    [refresh, t],
  )

  const moveItem = useCallback(
    async (
      id: string,
      direction: 'up' | 'down',
      role: Role,
      shift: ShiftNumber,
      line: string,
      process?: string,
    ) => {
      if (!canOperateQueue(role)) return
      const items = itemsRef.current
      const item = items.find((entry) => entry.id === id)
      if (!item || !canOperateType(role, item.type) || item.line !== line || item.targetShift !== shift) {
        return
      }
      const group = items.filter(
        (entry) =>
          entry.type === item.type &&
          entry.line === line &&
          entry.targetShift === shift &&
          (process === undefined || entry.process === process),
      )
      const groupIndex = group.findIndex((entry) => entry.id === id)
      const target = direction === 'up' ? groupIndex - 1 : groupIndex + 1
      if (target < 0 || target >= group.length) return
      const other = group[target]
      const from = items.findIndex((entry) => entry.id === id)
      const to = items.findIndex((entry) => entry.id === other.id)
      const ordered = [...items]
      ;[ordered[from], ordered[to]] = [ordered[to], ordered[from]]

      try {
        await reorderProductionQueue(ordered.map((entry) => entry.id))
        await refresh()
      } catch {
        // Refresh keeps the UI in sync if the backend rejects the new order.
        await refresh()
      }
    },
    [refresh],
  )

  const cyclePriority = useCallback(
    async (id: string, role: Role, shift: ShiftNumber, line: string) => {
      if (!canOperateQueue(role)) return
      const item = itemsRef.current.find((entry) => entry.id === id)
      if (
        !item ||
        !canOperateType(role, item.type) ||
        item.line !== line ||
        item.targetShift !== shift
      ) {
        return
      }
      const next: Record<QueuePriority, QueuePriority> = {
        urgent: 'normal',
        normal: 'low',
        low: 'urgent',
      }
      try {
        await updateQueuePriority(id, next[item.priority])
        await refresh()
      } catch {
        await refresh()
      }
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      ...state,
      addFromScan,
      allocateRequest,
      printKanban,
      moveItem,
      cyclePriority,
      refresh,
    }),
    [state, addFromScan, allocateRequest, printKanban, moveItem, cyclePriority, refresh],
  )

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
}

export function useQueue(): QueueContextValue {
  const context = useContext(QueueContext)
  if (!context) throw new Error('useQueue must be used inside QueueProvider')
  return context
}

