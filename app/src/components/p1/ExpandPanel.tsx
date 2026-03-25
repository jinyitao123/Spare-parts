import { useState } from 'react'
import styles from './ExpandPanel.module.css'

interface Props {
  title: string
  content: string
  defaultOpen?: boolean
}

export function ExpandPanel({ title, content, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={styles.panel}>
      <button className={styles.header} onClick={() => setOpen(!open)}>
        <span className={styles.title}>{title}</span>
        <span className={styles.arrow}>{open ? '\u25B4' : '\u25BE'}</span>
      </button>
      {open && (
        <div className={styles.body}>
          {content}
        </div>
      )}
    </div>
  )
}
