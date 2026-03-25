import { useUser } from '../context/UserContext'
import { useAgent } from '../context/AgentContext'
import { agentDefinitions } from '../agents/definitions'
import { roleNavMap } from '../types/user'
import type { AgentContextId } from '../types/agent'
import styles from './SideNav.module.css'

export function SideNav() {
  const { user } = useUser()
  const { state, switchContext } = useAgent()

  const visibleIds = roleNavMap[user.role]
  const aiItems = agentDefinitions.filter(d => d.group === 'ai' && visibleIds.includes(d.id))
  const tradItems = agentDefinitions.filter(d => d.group === 'traditional' && visibleIds.includes(d.id))
  const sysItems = agentDefinitions.filter(d => d.group === 'system' && visibleIds.includes(d.id))

  function handleClick(id: AgentContextId) {
    switchContext(id)
  }

  return (
    <nav className={styles.sidenav}>
      <div className={styles.group}>
        {aiItems.map(item => (
          <button
            key={item.id}
            className={`${styles.navItem} ${state.activeContext === item.id ? styles.navItemActive : ''}`}
            onClick={() => handleClick(item.id)}
          >
            {item.navLabel}
          </button>
        ))}
      </div>

      {tradItems.length > 0 && (
        <>
          <div className={styles.divider} />
          <div className={styles.group}>
            {tradItems.map(item => (
              <button
                key={item.id}
                className={`${styles.navItem} ${state.activeContext === item.id ? styles.navItemActive : ''}`}
                onClick={() => handleClick(item.id)}
              >
                {item.navLabel}
              </button>
            ))}
          </div>
        </>
      )}

      {sysItems.length > 0 && (
        <>
          <div className={styles.spacer} />
          <div className={styles.divider} />
          <div className={styles.group}>
            {sysItems.map(item => (
              <button
                key={item.id}
                className={`${styles.navItem} ${state.activeContext === item.id ? styles.navItemActive : ''}`}
                onClick={() => handleClick(item.id)}
              >
                {item.navLabel}
              </button>
            ))}
          </div>
        </>
      )}
    </nav>
  )
}
