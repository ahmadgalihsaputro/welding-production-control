import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Info,
  LogOut,
  Menu,
  Moon,
  PackageSearch,
  Search,
  Settings2,
  Sun,
  UserRound,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { ConnectionIndicator } from './ConnectionIndicator'
import { notifications } from '../../data/mock'
import { findGroupByPath, findLeafByPath, visibleNavigation } from '../../data/navigation'
import { useClickOutside } from '../../hooks/useClickOutside'
import { cn } from '../../lib/utils'
import { WeldingIcon } from '../brand/Logo'
import { Avatar } from '../ui/Avatar'

interface TopbarProps {
  onMenuClick: () => void
  isMobile: boolean
}

const notificationIcon = {
  danger: AlertTriangle,
  warning: PackageSearch,
  success: CheckCircle2,
  info: Info,
  neutral: Info,
  orange: Info,
  sky: Info,
}

const toneToStat: Record<string, string> = {
  danger: 'red',
  warning: 'amber',
  success: 'green',
  info: 'sky',
  neutral: 'sky',
  orange: 'orange',
  sky: 'sky',
}

const lines = ['Robot G', 'Robot H', 'all'] as const

export function Topbar({ onMenuClick, isMobile }: TopbarProps) {
  const {
    user,
    logout,
    activeLine,
    setActiveLine,
    activeWorkArea,
    workAreas,
    setActiveWorkArea,
  } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [lineOpen, setLineOpen] = useState(false)
  const [readAll, setReadAll] = useState(false)
  const canChooseLine = user?.role === 'admin'
  const canChooseWorkArea =
    user?.role === 'operator_assy' ||
    user?.role === 'operator_sub_assy' ||
    user?.role === 'operator_both'
  const lineLabel = canChooseLine
    ? activeLine === 'all' ? 'All lines' : activeLine
    : activeWorkArea?.label ?? user?.line ?? '—'

  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)

  useClickOutside(notifRef, () => setNotifOpen(false), notifOpen)
  useClickOutside(userRef, () => setUserOpen(false), userOpen)
  useClickOutside(lineRef, () => setLineOpen(false), lineOpen)

  const group = findGroupByPath(location.pathname)
  const leaf = findLeafByPath(location.pathname)
  const unread = readAll ? 0 : notifications.filter((item) => item.unread).length

  const searchResults = useMemo(() => {
    if (!user || query.trim().length < 1) return []
    const needle = query.toLowerCase()
    return visibleNavigation(user.role)
      .flatMap((navGroup) =>
        navGroup.path
          ? [{ label: navGroup.label, path: navGroup.path, group: 'Workspace' }]
          : (navGroup.items ?? []).map((item) => ({
              label: item.label,
              path: item.path,
              group: navGroup.label,
            })),
      )
      .filter((item) => item.label.toLowerCase().includes(needle))
      .slice(0, 6)
  }, [query, user])

  const handleSearchSubmit = () => {
    if (searchResults.length > 0) {
      navigate(searchResults[0].path)
      setQuery('')
      setSearchFocused(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="topbar glass">
      <div className="topbar__left">
        <button
          type="button"
          className="btn-icon hamburger"
          onClick={onMenuClick}
          aria-label={isMobile ? 'Buka menu' : 'Buka atau tutup sidebar'}
        >
          <Menu size={19} />
        </button>

        <div className="mobile-brand">
          <span className="brand-mark">
            <WeldingIcon size={18} />
          </span>
          <strong>WPC</strong>
        </div>

        <div className="topbar__title">
          <span className="topbar__eyebrow">{group?.label ?? 'Workspace'}</span>
          <span className="topbar__page">
            {leaf?.label ?? (location.pathname === '/' ? 'Overview' : group?.label ?? 'WPC')}
          </span>
        </div>

        <div className="topbar__search">
          <Search size={15} className="input-wrap__icon" />
          <input
            className="input"
            type="search"
            placeholder="Cari menu, PN, Kanban…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => window.setTimeout(() => setSearchFocused(false), 160)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSearchSubmit()
              if (event.key === 'Escape') {
                setQuery('')
                setSearchFocused(false)
              }
            }}
            aria-label="Pencarian global"
          />
          <span className="kbd">⌘K</span>

          {searchFocused && query.length > 0 && (
            <div className="search-results popover">
              <div className="popover-head">
                <span className="popover-title">Hasil pencarian</span>
                <span className="popover-sub">{searchResults.length} menu</span>
              </div>
              <div className="popover-list">
                {searchResults.length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px 12px' }}>
                    <p>Tidak ada menu yang cocok dengan “{query}”.</p>
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      type="button"
                      className="search-result"
                      key={result.path}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        navigate(result.path)
                        setQuery('')
                        setSearchFocused(false)
                      }}
                    >
                      <span>
                        <strong>{result.label}</strong>
                        <small>{result.group}</small>
                      </span>
                      <Search size={13} />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="topbar__actions">
        <div className="popover-anchor" ref={lineRef}>
          <button
            type="button"
            className="line-chip"
            onClick={() => {
              if (!canChooseLine && !canChooseWorkArea) return
              setLineOpen((open) => !open)
              setNotifOpen(false)
              setUserOpen(false)
            }}
            aria-expanded={canChooseLine || canChooseWorkArea ? lineOpen : undefined}
            aria-disabled={!canChooseLine && !canChooseWorkArea}
            aria-label="Pilih line atau robot"
          >
            <span className="line-dot" />
            <span>
              <small>{canChooseLine ? 'Filter line' : canChooseWorkArea ? 'Area kerja' : 'Line'}</small> {lineLabel}
            </span>
            {(canChooseLine || canChooseWorkArea) && <ChevronDown size={13} />}
          </button>
          {(canChooseLine || canChooseWorkArea) && lineOpen && (
            <div className="menu">
              <div className="menu-user">
                <strong>{canChooseLine ? 'Filter line' : 'Pindah area kerja'}</strong>
                <span>{canChooseLine ? 'Filter data line produksi' : 'Pilih area yang sedang dikerjakan'}</span>
              </div>
              {(canChooseLine ? lines : workAreas).map((item) => {
                const isAllLines = item === 'all'
                const label = typeof item === 'string'
                  ? item === 'all' ? 'All lines' : item
                  : item.label
                const key = typeof item === 'string' ? item : item.id
                return (
                <button
                  key={key}
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    if (typeof item === 'string') setActiveLine(item)
                      else if (setActiveWorkArea(item.id)) {
                        const onAssyProduction = location.pathname.startsWith('/production/assy')
                        const onSubAssyProduction =
                          location.pathname === '/production/queue' ||
                          location.pathname.startsWith('/production/sub-assy')
                        if (onAssyProduction && item.type !== 'Assy') {
                          navigate('/production/queue')
                        } else if (onSubAssyProduction && item.type === 'Assy') {
                          navigate('/production/assy-queue')
                        }
                      }
                    setLineOpen(false)
                  }}
                >
                  <span className={cn('line-dot', isAllLines && 'is-muted')} />
                  {label}
                </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn-icon theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Aktifkan light mode' : 'Aktifkan dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {user?.role === 'admin' && <ConnectionIndicator />}

        <div className="popover-anchor" ref={notifRef}>
          <button
            type="button"
            className={cn('btn-icon', notifOpen && 'is-active')}
            onClick={() => {
              setNotifOpen((open) => !open)
              setUserOpen(false)
              setLineOpen(false)
            }}
            aria-label={`Notifikasi${unread > 0 ? `, ${unread} belum dibaca` : ''}`}
            aria-expanded={notifOpen}
          >
            <Bell size={18} />
            {unread > 0 && <span className="icon-dot" />}
          </button>

          {notifOpen && (
            <div className="popover">
              <div className="popover-head">
                <div>
                  <div className="popover-title">Notifikasi</div>
                  <div className="popover-sub">{unread} belum dibaca</div>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  style={{ width: 30, height: 30, borderRadius: 9 }}
                  onClick={() => setReadAll(true)}
                  aria-label="Tandai semua sudah dibaca"
                >
                  <CheckCheck size={15} />
                </button>
              </div>
              <div className="popover-list">
                {notifications.map((item) => {
                  const Icon = notificationIcon[item.tone] ?? Info
                  return (
                    <div
                      className={cn('notification', !readAll && item.unread && 'is-unread')}
                      key={item.id}
                    >
                      <div
                        className={`notification__icon stat-icon--${
                          toneToStat[item.tone] ?? 'sky'
                        }`}
                      >
                        <Icon size={15} />
                      </div>
                      <div className="notification__body">
                        <span className="notification__title">{item.title}</span>
                        <span className="notification__text">{item.body}</span>
                        <span className="notification__time">{item.time}</span>
                      </div>
                      {!readAll && item.unread && <span className="notification__unread-dot" />}
                    </div>
                  )
                })}
              </div>
              <div className="popover-footer">
                <Link
                  to="/settings/notifications"
                  className="btn btn-ghost btn-sm btn-block"
                  onClick={() => setNotifOpen(false)}
                >
                  Pengaturan notifikasi
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="topbar__divider" />

        <div className="popover-anchor" ref={userRef}>
          <button
            type="button"
            className="topbar-user"
            onClick={() => {
              setUserOpen((open) => !open)
              setNotifOpen(false)
              setLineOpen(false)
            }}
            aria-expanded={userOpen}
            aria-label="Menu akun"
          >
            <Avatar
              initials={user?.initials ?? 'WPC'}
              name={user?.name}
              tone="orange"
              size="sm"
            />
            <span className="topbar-user__copy">
              <strong>{user?.name}</strong>
              <span>{user?.roleLabel}</span>
            </span>
            <ChevronDown size={13} className="muted" />
          </button>

          {userOpen && (
            <div className="menu">
              <div className="menu-user">
                <strong>{user?.name}</strong>
                <span>{user?.employeeId} • {user?.roleLabel}</span>
              </div>
              <Link
                to="/settings/profile"
                className="menu-item"
                onClick={() => setUserOpen(false)}
              >
                <UserRound size={15} />
                My Profile
              </Link>
              <Link
                to="/settings/preferences"
                className="menu-item"
                onClick={() => setUserOpen(false)}
              >
                <Settings2 size={15} />
                Preferences
              </Link>
              <div className="menu-divider" />
              <button
                type="button"
                className="menu-item menu-item--danger"
                onClick={handleLogout}
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
