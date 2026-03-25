import type { ReactNode } from 'react'
import styles from './StatusTag.module.css'

type Signal = 'safe' | 'warn' | 'danger' | 'stale' | 'info'

interface Props {
  signal: Signal
  children: ReactNode
}

export function StatusTag({ signal, children }: Props) {
  return (
    <span className={`${styles.tag} ${styles[signal]}`}>
      {children}
    </span>
  )
}

export function StatusDot({ signal }: { signal: Signal }) {
  return <span className={`${styles.dot} ${styles[signal]}`} />
}
