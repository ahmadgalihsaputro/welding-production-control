import { ChevronDown, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  findGroupByPath,
  sectionLabels,
  visibleNavigation,
  type NavGroup,
} from '../../data/navigation'
import { Avatar } from '../ui/Avatar'
import { BrandLockup } from '../brand/Logo'

interface SidebarProps {
  collapsed: boolean
  isMobile: boolean
  onExpand: () => void
}

const order: NavGroup['section'][] = ['main', 'insight', 'admin']

export function Sidebar({ collapsed, isMobile, onExpand }: SidebarProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [openGroups, setOpenGroups] = useState<string[]>([])

  const groups = user ? visibleNavigation(user.role) : []
  const activeGroup = findGroupByPath(location.pathname)

  useEffect(() => {
    if (activeGroup?.items) {
      setOpenGroups((current) =>
        current.includes(activeGroup.id) ? current : [...current, activeGroup.id],
      )
    }
  }, [location.pathname, activeGroup])

  const toggleGroup = (group: NavGroup) => {
    if (collapsed && !isMobile) {
      onExpand()
      setOpenGroups((current) =>
        current.includes(group.id) ? current : [...current, group.id],
      )
      return
    }
    setOpenGroups((current) =>
      current.includes(group.id)
        ? current.filter((id) => id !== group.id)
        : [...current, group.id],
    )
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="app-sidebar glass" aria-label="Main navigation">
      <BrandLockup compact={collapsed && !isMobile} />

      <nav className="nav-scroll">
        {order.map((section) => {
          const sectionGroups = groups.filter((group) => group.section === section)
          if (sectionGroups.length === 0) return null

          return (
            <div className="nav-section" key={section}>
              <div className="nav-label">{sectionLabels[section]}</div>

              {sectionGroups.map((group) => {
                const Icon = group.icon
                const isCurrent = activeGroup?.id === group.id
                const isOpen = openGroups.includes(group.id)

                if (group.path) {
                  return (
                    <NavLink
                      key={group.id}
                      to={group.path}
                      end={group.path === '/'}
                      className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
                      data-tooltip={collapsed && !isMobile ? group.label : undefined}
                    >
                      <span className="nav-icon">
                        <Icon />
                      </span>
                      <span className="nav-copy">{group.label}</span>
                    </NavLink>
                  )
                }

                return (
                  <div
                    key={group.id}
                    className={`nav-group${isCurrent ? ' is-current' : ''}`}
                  >
                    <button
                      type="button"
                      className="nav-item"
                      onClick={() => toggleGroup(group)}
                      aria-expanded={isOpen}
                      data-tooltip={collapsed && !isMobile ? group.label : undefined}
                    >
                      <span className="nav-icon">
                        <Icon />
                      </span>
                      <span className="nav-copy">{group.label}</span>
                      {group.items?.some((item) => item.badge) && (
                        <span className="nav-badge">
                          {group.items.find((item) => item.badge)?.badge}
                        </span>
                      )}
                      <ChevronDown
                        size={14}
                        className={`nav-chevron${isOpen ? ' is-open' : ''}`}
                      />
                    </button>

                    {isOpen && group.items && (
                      <div className="nav-sub">
                        {group.items.map((item) => (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                              `nav-sublink${isActive ? ' is-active' : ''}`
                            }
                          >
                            <span>{item.label}</span>
                            {item.badge && (
                              <span className="nav-badge">{item.badge}</span>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-status">
        <span className="line-dot" />
        <div>
          <strong>Sistem online</strong>
          <span>FSS sync 07:00</span>
        </div>
      </div>

      <div className="sidebar-footer">
        <NavLink to="/settings/profile" className="sidebar-user">
          <Avatar
            initials={user?.initials ?? 'WPC'}
            name={user?.name}
            tone="orange"
            size="sm"
          />
          <div className="sidebar-user__copy">
            <strong>{user?.name}</strong>
            <span>{user?.roleLabel}</span>
          </div>
        </NavLink>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
