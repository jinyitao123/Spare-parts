import type { ReactNode } from 'react'
import styles from './AlertBanner.module.css'

type Signal = 'safe' | 'warn' | 'danger' | 'stale' | 'info'

interface Props {
  signal: Signal
  text?: string
  children?: ReactNode
}

export function AlertBanner({ signal, text, children }: Props) {
  return (
    <div className={`${styles.banner} ${styles[signal]}`}>
      {text ?? children}
    </div>
  )
}
