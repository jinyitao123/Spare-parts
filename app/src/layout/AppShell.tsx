import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { SideNav } from './SideNav'
import styles from './AppShell.module.css'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <TopBar />
      <SideNav />
      <main className={styles.main}>
        <div className={styles.canvas}>
          {children}
        </div>
      </main>
    </div>
  )
}
