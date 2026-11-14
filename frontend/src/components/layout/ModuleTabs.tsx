import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { findGroupByPath, visibleNavigation } from '../../data/navigation'

export function ModuleTabs() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) return null

  const group = findGroupByPath(location.pathname)
  if (!group?.items) return null

  const allowed = visibleNavigation(user.role).find((item) => item.id === group.id)
  if (!allowed?.items?.length) return null

  return (
    <nav className="module-tabs" aria-label={`${group.label} navigation`}>
      {allowed.items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) => `module-tab${isActive ? ' is-active' : ''}`}
        >
          {item.label}
          {item.badge && <span className="module-tab__badge">{item.badge}</span>}
        </NavLink>
      ))}
    </nav>
  )
}
