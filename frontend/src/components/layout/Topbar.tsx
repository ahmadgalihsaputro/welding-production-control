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
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { useTheme } from '../../contexts/ThemeContext'
import { ConnectionIndicator } from './ConnectionIndicator'
import {
  findGroupByPath,
  findLeafByPath,
  navigationEn,
  visibleNavigation,
} from '../../data/navigation'
import { useClickOutside } from '../../hooks/useClickOutside'
import { getStockAlerts, type StockAlert } from '../../lib/notificationApi'
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
  const { t, formatTime } = usePreferences()
  const location = useLocation()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [lineOpen, setLineOpen] = useState(false)
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('wpc.notifications.read.v1')
      return new Set<string>(raw ? JSON.parse(raw) : [])
    } catch {
      return new Set<string>()
    }
  })
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
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useClickOutside(notifRef, () => setNotifOpen(false), notifOpen)
  useClickOutside(userRef, () => setUserOpen(false), userOpen)
  useClickOutside(lineRef, () => setLineOpen(false), lineOpen)

  useEffect(() => {
    let active = true
    const loadAlerts = () => {
      getStockAlerts()
        .then((result) => {
          if (active) setAlerts(result.alerts)
        })
        .catch(() => {
          if (active) setAlerts([])
        })
    }
    loadAlerts()
    const timer = window.setInterval(loadAlerts, 60_000)
    window.addEventListener('wpc:notifications-updated', loadAlerts)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('wpc:notifications-updated', loadAlerts)
    }
  }, [])

  const group = findGroupByPath(location.pathname)
  const leaf = findLeafByPath(location.pathname)
  const readKey = (alert: StockAlert) => `${alert.id}:${alert.time}`
  const unread = alerts.filter((alert) => !readIds.has(readKey(alert))).length

  const markAllRead = () => {
    const next = new Set([...readIds, ...alerts.map(readKey)])
    localStorage.setItem('wpc.notifications.read.v1', JSON.stringify([...next]))
    setReadIds(next)
  }

  const alertTime = (value: string) => formatTime(value)

  const searchResults = useMemo(() => {
    if (!user || query.trim().length < 1) return []
    const needle = query.toLowerCase()
    return visibleNavigation(user.role)
      .flatMap((navGroup) => {
        const groupLabel = t(navGroup.label, navigationEn[navGroup.label] ?? navGroup.label)
        return navGroup.path
          ? [{ label: groupLabel, path: navGroup.path, group: t('Workspace', 'Workspace') }]
          : (navGroup.items ?? []).map((item) => ({
              label: t(item.label, navigationEn[item.label] ?? item.label),
              path: item.path,
              group: groupLabel,
            }))
      })
      .filter((item) => item.label.toLowerCase().includes(needle))
      .slice(0, 6)
  }, [query, user, t])

  const handleSearchSubmit = () => {
    if (searchResults.length > 0) {
      navigate(searchResults[0].path)
      setQuery('')
      setSearchFocused(false)
      setSearchOpen(false)
    }
  }

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchOpen(false)
      setQuery('')
      setSearchFocused(false)
      return
    }

    setSearchOpen(true)
    window.setTimeout(() => searchInputRef.current?.focus(), 0)
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
          aria-label={isMobile ? t('Buka menu', 'Open menu') : t('Buka atau tutup sidebar', 'Open or close sidebar')}
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
          <span className="topbar__eyebrow">
            {group ? t(group.label, navigationEn[group.label] ?? group.label) : t('Workspace', 'Workspace')}
          </span>
          <span className="topbar__page">
            {leaf
              ? t(leaf.label, navigationEn[leaf.label] ?? leaf.label)
              : location.pathname === '/'
                ? t('Overview', 'Overview')
                : group
                  ? t(group.label, navigationEn[group.label] ?? group.label)
                  : 'WPC'}
          </span>
        </div>

        <div className={cn('topbar__search', searchOpen && 'is-open')} id="topbar-search">
          <Search size={15} className="input-wrap__icon" />
          <input
            ref={searchInputRef}
            className="input"
            type="search"
            placeholder={t('Cari menu…', 'Search menu…')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => window.setTimeout(() => setSearchFocused(false), 160)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSearchSubmit()
              if (event.key === 'Escape') {
                setQuery('')
                setSearchFocused(false)
                setSearchOpen(false)
              }
            }}
            aria-label={t('Pencarian global', 'Global search')}
          />
          <span className="kbd">⌘K</span>

          {searchFocused && query.length > 0 && (
            <div className="search-results popover">
              <div className="popover-head">
                <span className="popover-title">{t('Hasil pencarian', 'Search results')}</span>
                <span className="popover-sub">
                  {searchResults.length} {t('menu', 'menu')}
                </span>
              </div>
              <div className="popover-list">
                {searchResults.length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px 12px' }}>
                    <p>
                      {t('Tidak ada menu yang cocok dengan', 'No menu matches')} “{query}”.
                    </p>
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
                        setSearchOpen(false)
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
            aria-label={t('Pilih line atau robot', 'Select line or robot')}
          >
            <span className="line-dot" />
            <span>
              <small>
                {canChooseLine
                  ? t('Filter line', 'Filter line')
                  : canChooseWorkArea
                    ? t('Area kerja', 'Work area')
                    : t('Line', 'Line')}
              </small>{' '}
              {lineLabel === 'All lines' ? t('All lines', 'All lines') : lineLabel}
            </span>
            {(canChooseLine || canChooseWorkArea) && <ChevronDown size={13} />}
          </button>
          {(canChooseLine || canChooseWorkArea) && lineOpen && (
            <div className="menu">
              <div className="menu-user">
                <strong>
                  {canChooseLine ? t('Filter line', 'Filter line') : t('Pindah area kerja', 'Switch work area')}
                </strong>
                <span>
                  {canChooseLine
                    ? t('Filter data line produksi', 'Filter production line data')
                    : t('Pilih area yang sedang dikerjakan', 'Select the area currently in progress')}
                </span>
              </div>
              {(canChooseLine ? lines : workAreas).map((item) => {
                const isAllLines = item === 'all'
                const rawLabel = typeof item === 'string'
                  ? item === 'all' ? 'All lines' : item
                  : item.label
                const label = rawLabel === 'All lines' ? t('All lines', 'All lines') : rawLabel
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
          className="btn-icon topbar-search-toggle"
          onClick={toggleSearch}
          aria-label={
            searchOpen
              ? t('Tutup pencarian global', 'Close global search')
              : t('Buka pencarian global', 'Open global search')
          }
          aria-expanded={searchOpen}
          aria-controls="topbar-search"
          title={searchOpen ? t('Tutup pencarian', 'Close search') : t('Cari', 'Search')}
        >
          {searchOpen ? <X size={18} /> : <Search size={18} />}
        </button>

        <button
          type="button"
          className="btn-icon theme-toggle"
          onClick={toggleTheme}
          aria-label={
            theme === 'dark'
              ? t('Aktifkan light mode', 'Enable light mode')
              : t('Aktifkan dark mode', 'Enable dark mode')
          }
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {user && <ConnectionIndicator />}

        <div className="popover-anchor" ref={notifRef}>
          <button
            type="button"
            className={cn('btn-icon', notifOpen && 'is-active')}
            onClick={() => {
              setNotifOpen((open) => !open)
              setUserOpen(false)
              setLineOpen(false)
            }}
            aria-label={
              unread > 0
                ? t(`Notifikasi, ${unread} belum dibaca`, `Notifications, ${unread} unread`)
                : t('Notifikasi', 'Notifications')
            }
            aria-expanded={notifOpen}
          >
            <Bell size={18} />
            {unread > 0 && <span className="icon-dot" />}
          </button>

          {notifOpen && (
            <div className="popover">
              <div className="popover-head">
                <div>
                  <div className="popover-title">{t('Notifikasi', 'Notifications')}</div>
                  <div className="popover-sub">{unread} {t('belum dibaca', 'unread')}</div>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  style={{ width: 30, height: 30, borderRadius: 9 }}
                  onClick={markAllRead}
                  aria-label={t('Tandai semua sudah dibaca', 'Mark all as read')}
                >
                  <CheckCheck size={15} />
                </button>
              </div>
              <div className="popover-list">
                {alerts.length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px 12px' }}>
                    <p>{t('Tidak ada notifikasi stok saat ini.', 'No stock notifications right now.')}</p>
                  </div>
                ) : (
                  alerts.map((item) => {
                    const Icon = notificationIcon[item.tone] ?? Info
                    const isUnread = !readIds.has(readKey(item))
                    return (
                      <div
                        className={cn('notification', isUnread && 'is-unread')}
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
                          <span className="notification__time">{alertTime(item.time)}</span>
                        </div>
                        {isUnread && <span className="notification__unread-dot" />}
                      </div>
                    )
                  })
                )}
              </div>
              <div className="popover-footer">
                <Link
                  to="/settings/notifications"
                  className="btn btn-ghost btn-sm btn-block"
                  onClick={() => setNotifOpen(false)}
                >
                  {t('Pengaturan notifikasi', 'Notification settings')}
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
            aria-label={t('Menu akun', 'Account menu')}
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
                {t('Profil Saya', 'My Profile')}
              </Link>
              <Link
                to="/settings/preferences"
                className="menu-item"
                onClick={() => setUserOpen(false)}
              >
                <Settings2 size={15} />
                {t('Preferensi', 'Preferences')}
              </Link>
              <div className="menu-divider" />
              <button
                type="button"
                className="menu-item menu-item--danger"
                onClick={handleLogout}
              >
                <LogOut size={15} />
                {t('Logout', 'Logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
