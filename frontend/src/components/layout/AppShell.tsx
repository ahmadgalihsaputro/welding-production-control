import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { usePreferences } from '../../contexts/PreferencesContext'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { ModuleTabs } from './ModuleTabs'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const SIDEBAR_KEY = 'wpc.sidebar'

export function AppShell() {
  const isMobile = useMediaQuery('(max-width: 1180px)')
  const location = useLocation()
  const { preferences } = usePreferences()
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY)
    if (stored) return stored === 'collapsed'
    return !preferences.sidebarDefault
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded')
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  useEffect(() => {
    document.body.style.overflow = mobileOpen && isMobile ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen, isMobile])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleMenuClick = () => {
    if (isMobile) {
      setMobileOpen((open) => !open)
    } else {
      setCollapsed((value) => !value)
    }
  }

  return (
    <div
      className={[
        'app-shell',
        collapsed && !isMobile ? 'is-collapsed' : '',
        mobileOpen && isMobile ? 'is-mobile-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Sidebar
        collapsed={collapsed}
        isMobile={isMobile}
        onExpand={() => setCollapsed(false)}
      />

      {mobileOpen && isMobile && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="app-main">
        <Topbar onMenuClick={handleMenuClick} isMobile={isMobile} />
        <ModuleTabs />
        <Outlet />
      </main>
    </div>
  )
}
