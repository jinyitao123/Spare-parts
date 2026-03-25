import { useRef, useState, useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { UserProfile, UserRole } from '../data/mockData'
import { users } from '../data/mockData'
import AgentChat from './AgentChat'

interface MenuItem {
  key: string;
  label: string;
  path: string;
  icon: string;
  roles: UserRole[];
}

const menuItems: MenuItem[] = [
  { key: 'dashboard', label: '工作台', path: '/', icon: '🏠', roles: ['section_leader', 'engineer', 'warehouse_keeper', 'manager'] },
  { key: 'catalog', label: '备件台账', path: '/catalog', icon: '📋', roles: ['warehouse_keeper', 'section_leader'] },
  { key: 'warehouse', label: '备件库房', path: '/warehouse', icon: '📦', roles: ['section_leader', 'engineer', 'warehouse_keeper'] },
  { key: 'procurement', label: '采购需求', path: '/procurement', icon: '🛒', roles: ['section_leader'] },
  { key: 'stale', label: '呆滞管理', path: '/stale', icon: '📊', roles: ['warehouse_keeper', 'section_leader'] },
  { key: 'kanban', label: '看板', path: '/kanban', icon: '📈', roles: ['section_leader', 'manager'] },
]

interface LayoutProps {
  children: ReactNode;
  user: UserProfile;
  onRoleChange: (role: UserRole) => void;
}

export default function Layout({ children, user, onRoleChange }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const roleButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()

  const visibleMenu = menuItems.filter(m => m.roles.includes(user.role))

  // Close menu on outside click
  useEffect(() => {
    if (!showRoleMenu) return
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        roleButtonRef.current && !roleButtonRef.current.contains(e.target as Node)
      ) {
        setShowRoleMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showRoleMenu])

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-primary text-white h-14 flex items-center px-4 shrink-0 z-20 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center font-bold text-sm">✦</div>
          <span className="font-semibold text-base">备件管理智能平台</span>
          <span className="text-xs text-white/50 ml-1">inocube</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-4">
          {/* Role switcher for demo */}
          <div>
            <button
              ref={roleButtonRef}
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-sm transition-colors"
            >
              <span className="text-accent text-xs">角色切换</span>
              <span>{user.roleName}</span>
              <span className="text-xs">▼</span>
            </button>
          </div>
          {/* Notifications */}
          <button className="relative text-white/80 hover:text-white">
            🔔
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full text-[10px] flex items-center justify-center">3</span>
          </button>
          {/* User avatar */}
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-medium">
            {user.avatar}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`${collapsed ? 'w-[60px]' : 'w-[220px]'} bg-white border-r border-border shrink-0 transition-all duration-200 flex flex-col`}>
          <nav className="flex-1 py-2">
            {visibleMenu.map(item => {
              const active = location.pathname === item.path
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    active ? 'bg-accent/10 text-accent border-r-2 border-accent font-medium' : 'text-text-secondary hover:bg-bg hover:text-text'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </button>
              )
            })}
          </nav>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-3 text-text-secondary hover:text-text text-xs border-t border-border"
          >
            {collapsed ? '»' : '« 收起'}
          </button>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6 bg-bg">
          {children}
        </main>
      </div>

      {/* Agent floating widget */}
      <AgentChat />

      {/* Role switcher dropdown - rendered outside header to avoid stacking context issues */}
      {showRoleMenu && (
        <div
          ref={menuRef}
          className="fixed bg-white text-text rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{
            zIndex: 9999,
            top: roleButtonRef.current ? roleButtonRef.current.getBoundingClientRect().bottom + 4 : 56,
            right: roleButtonRef.current ? window.innerWidth - roleButtonRef.current.getBoundingClientRect().right : 80,
          }}
        >
          {(Object.keys(users) as UserRole[]).map(r => (
            <button
              key={r}
              onClick={() => { onRoleChange(r); setShowRoleMenu(false); navigate('/'); }}
              className={`block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 transition-colors ${r === user.role ? 'text-accent font-medium' : ''}`}
            >
              {users[r].roleName} · {users[r].name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
