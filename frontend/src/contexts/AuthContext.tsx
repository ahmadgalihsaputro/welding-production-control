import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { defaultPathForRole } from '../config/access'
import { isRole } from '../data/accounts'
import { api, ApiError, clearToken, getToken, setToken } from '../lib/api'
import type { ProductionWorkArea, RobotLine, Role, SessionUser } from '../types'

export type ProductionLineFilter = RobotLine | 'all'

interface LoginResult {
  ok: boolean
  error?: string
  destination?: string
  needsWorkArea?: boolean
}

interface ApiWorkArea {
  id: string
  label: string
  line: string
  type: 'Assy' | 'Sub_Assy'
  process: string
}

interface ApiUser {
  id: string
  employeeId: string
  username: string
  name: string
  email: string | null
  role: string
  roleLabel: string
  area: string
  line: string
  initials: string
  status: string
  workAreas: ApiWorkArea[]
}

interface StoredSession {
  user: SessionUser
  apiUser: ApiUser
  workAreaId?: string
}

interface AuthContextValue {
  user: SessionUser | null
  isAuthenticated: boolean
  login: (identifier: string, password: string) => Promise<LoginResult>
  logout: () => void
  hasRole: (...roles: Role[]) => boolean
  activeLine: ProductionLineFilter
  setActiveLine: (line: ProductionLineFilter) => void
  activeWorkArea?: ProductionWorkArea
  workAreas: ProductionWorkArea[]
  pendingWorkAreas: ProductionWorkArea[]
  selectWorkArea: (id: string) => boolean
  setActiveWorkArea: (id: string) => boolean
  cancelWorkAreaSelection: () => void
}

const STORAGE_KEY = 'wpc.session.v2'
const ACTIVE_LINE_KEY = 'wpc.active-production-line.v1'
const AuthContext = createContext<AuthContextValue | null>(null)

function isOperatorRole(role: Role): boolean {
  return role === 'operator_assy' || role === 'operator_sub_assy' || role === 'operator_both'
}

function mapWorkArea(area: ApiWorkArea): ProductionWorkArea {
  return {
    id: area.id,
    label: area.label,
    line: area.line === 'Robot H' ? 'Robot H' : 'Robot G',
    type: area.type === 'Sub_Assy' ? 'Sub Assy' : 'Assy',
    process: area.process,
  }
}

function allowedWorkAreas(apiUser: ApiUser): ProductionWorkArea[] {
  if (!isRole(apiUser.role) || !isOperatorRole(apiUser.role)) return []
  return apiUser.workAreas
    .map(mapWorkArea)
    .filter((area) => {
      if (apiUser.role === 'operator_assy') return area.type === 'Assy'
      if (apiUser.role === 'operator_sub_assy') return area.type === 'Sub Assy'
      return true
    })
}

function lineOf(value: string | undefined): RobotLine {
  return value?.includes('Robot H') ? 'Robot H' : 'Robot G'
}

function toSessionUser(apiUser: ApiUser, workArea?: ProductionWorkArea): SessionUser {
  if (!isRole(apiUser.role)) {
    throw new Error(`Role ${apiUser.role} tidak dikenali oleh aplikasi.`)
  }
  return {
    id: apiUser.id,
    name: apiUser.name,
    username: apiUser.username,
    employeeId: apiUser.employeeId,
    role: apiUser.role,
    roleLabel: apiUser.roleLabel,
    area: apiUser.area,
    line: workArea?.label ?? apiUser.line,
    productionLine: workArea?.line ?? lineOf(apiUser.line),
    productionWorkAreaId: workArea?.id,
    email: apiUser.email ?? '',
    initials: apiUser.initials,
  }
}

function readSession(): StoredSession | null {
  try {
    if (!getToken()) return null
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed?.user?.id || !parsed.apiUser?.id || !isRole(parsed.user.role)) return null
    if (isOperatorRole(parsed.user.role)) {
      const areas = allowedWorkAreas(parsed.apiUser)
      const area =
        areas.find((item) => item.id === parsed.workAreaId) ??
        areas.find((item) => item.id === parsed.user.productionWorkAreaId) ??
        areas[0]
      if (!area) return null
      return {
        ...parsed,
        user: toSessionUser(parsed.apiUser, area),
        workAreaId: area.id,
      }
    }
    return {
      ...parsed,
      user: toSessionUser(parsed.apiUser),
    }
  } catch {
    return null
  }
}

function readActiveLine(): ProductionLineFilter {
  const stored = localStorage.getItem(ACTIVE_LINE_KEY)
  return stored === 'Robot H' || stored === 'all' ? stored : 'Robot G'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(readSession)
  const [adminLine, setAdminLine] = useState<ProductionLineFilter>(readActiveLine)
  const [pendingApiUser, setPendingApiUser] = useState<ApiUser | null>(null)
  const [pendingWorkAreas, setPendingWorkAreas] = useState<ProductionWorkArea[]>([])

  const user = session?.user ?? null
  const apiUser = session?.apiUser
  const workAreas = useMemo(
    () => (apiUser ? allowedWorkAreas(apiUser) : []),
    [apiUser],
  )
  const activeWorkArea = user?.productionWorkAreaId
    ? workAreas.find((area) => area.id === user.productionWorkAreaId)
    : undefined

  useEffect(() => {
    if (!session) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }, [session])

  useEffect(() => {
    const onUnauthorized = () => setSession(null)
    window.addEventListener('wpc:unauthorized', onUnauthorized)
    return () => window.removeEventListener('wpc:unauthorized', onUnauthorized)
  }, [])

  useEffect(() => {
    if (!getToken()) return
    let active = true
    api
      .get<ApiUser>('/auth/me')
      .then((fresh) => {
        if (!active) return
        setSession((current) => {
          if (!current) return current
          const areas = allowedWorkAreas(fresh)
          const selected =
            areas.find((area) => area.id === current.workAreaId) ??
            areas.find((area) => area.id === current.user.productionWorkAreaId)
          const nextUser = isOperatorRole(fresh.role as Role)
            ? selected
              ? toSessionUser(fresh, selected)
              : null
            : toSessionUser(fresh)
          if (!nextUser) return null
          return { user: nextUser, apiUser: fresh, workAreaId: selected?.id }
        })
      })
      .catch((error) => {
        if (!active) return
        if (error instanceof ApiError && error.status === 401) setSession(null)
      })
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (identifier: string, password: string): Promise<LoginResult> => {
    if (!identifier.trim()) {
      return { ok: false, error: 'Masukkan username atau Employee ID.' }
    }
    if (!password) {
      return { ok: false, error: 'Masukkan password terlebih dahulu.' }
    }

    try {
      const result = await api.post<{ token: string; user: ApiUser }>('/auth/login', {
        identifier: identifier.trim(),
        password,
      })
      setToken(result.token)
      const areas = allowedWorkAreas(result.user)
      if (isOperatorRole(result.user.role as Role)) {
        if (areas.length === 0) {
          clearToken()
          return {
            ok: false,
            error: 'Belum ada area kerja yang tersedia untuk role operator ini. Hubungi Admin.',
          }
        }
        setPendingApiUser(result.user)
        setPendingWorkAreas(areas)
        return { ok: true, needsWorkArea: true }
      }
      const nextUser = toSessionUser(result.user)
      setSession({ user: nextUser, apiUser: result.user })
      return { ok: true, destination: defaultPathForRole(nextUser.role) }
    } catch (error) {
      clearToken()
      if (error instanceof ApiError) {
        return {
          ok: false,
          error:
            error.status === 401
              ? 'Kredensial tidak sesuai. Periksa username/Employee ID dan password.'
              : error.message,
        }
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Login gagal. Coba lagi.',
      }
    }
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    setPendingApiUser(null)
    setPendingWorkAreas([])
    clearToken()
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const hasRole = useCallback(
    (...roles: Role[]) => (user ? roles.includes(user.role) : false),
    [user],
  )
  const setActiveLine = useCallback((line: ProductionLineFilter) => {
    setAdminLine(line)
    localStorage.setItem(ACTIVE_LINE_KEY, line)
  }, [])
  const selectWorkArea = useCallback(
    (id: string): boolean => {
      if (!pendingApiUser) return false
      const area = pendingWorkAreas.find((item) => item.id === id)
      if (!area) return false
      setSession({
        user: toSessionUser(pendingApiUser, area),
        apiUser: pendingApiUser,
        workAreaId: area.id,
      })
      setPendingApiUser(null)
      setPendingWorkAreas([])
      return true
    },
    [pendingApiUser, pendingWorkAreas],
  )
  const setActiveWorkArea = useCallback(
    (id: string): boolean => {
      if (!session || !isOperatorRole(session.user.role)) return false
      const area = workAreas.find((item) => item.id === id)
      if (!area) return false
      setSession({
        ...session,
        user: toSessionUser(session.apiUser, area),
        workAreaId: area.id,
      })
      return true
    },
    [session, workAreas],
  )
  const cancelWorkAreaSelection = useCallback(() => {
    setPendingApiUser(null)
    setPendingWorkAreas([])
    clearToken()
  }, [])
  const activeLine: ProductionLineFilter = user?.role === 'admin'
    ? adminLine
    : user && isOperatorRole(user.role)
      ? activeWorkArea?.line ?? user.productionLine ?? 'Robot G'
      : user?.role === 'leader'
        ? (user.line.includes('Robot H') ? 'Robot H' : 'Robot G')
        : 'all'

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      logout,
      hasRole,
      activeLine,
      setActiveLine,
      activeWorkArea,
      workAreas,
      pendingWorkAreas,
      selectWorkArea,
      setActiveWorkArea,
      cancelWorkAreaSelection,
    }),
    [
      user,
      login,
      logout,
      hasRole,
      activeLine,
      setActiveLine,
      activeWorkArea,
      workAreas,
      pendingWorkAreas,
      selectWorkArea,
      setActiveWorkArea,
      cancelWorkAreaSelection,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
