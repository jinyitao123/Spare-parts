import { useState, useRef, useEffect } from 'react'
import { useUser } from '../context/UserContext'
import type { UserRole } from '../types/user'
import styles from './TopBar.module.css'

export function TopBar() {
  const { user, switchRole, allUsers } = useUser()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.brandSymbol}>✦</span>
        <span className={styles.brandName}>Weave-spare parts</span>
      </div>

      <div className={styles.right}>
        <div className={styles.notification}>
          🔔
          <span className={styles.badge}>2</span>
        </div>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <div className={styles.userInfo} onClick={() => setShowMenu(!showMenu)}>
            <div className={styles.avatar}>{user.avatar}</div>
            <div>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userRole}>{user.roleName}</div>
            </div>
          </div>

          {showMenu && (
            <div className={styles.roleMenu}>
              {(Object.entries(allUsers) as [UserRole, typeof user][]).map(([role, u]) => (
                <button
                  key={role}
                  className={`${styles.roleItem} ${role === user.role ? styles.roleItemActive : ''}`}
                  onClick={() => { switchRole(role); setShowMenu(false) }}
                >
                  <span className={styles.avatar} style={{ width: 24, height: 24, fontSize: 11 }}>{u.avatar}</span>
                  {u.name} · {u.roleName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
