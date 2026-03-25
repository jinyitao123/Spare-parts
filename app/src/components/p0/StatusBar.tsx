import styles from './StatusBar.module.css'

interface Props {
  label: string
  current: number
  safety: number
  unit?: string
}

export function StatusBar({ label, current, safety, unit = '' }: Props) {
  const ratio = safety > 0 ? current / safety : 1
  const percent = Math.min(ratio * 100, 100)
  const signal = ratio >= 1.5 ? 'safe' : ratio >= 1 ? 'warn' : 'danger'

  return (
    <div className={styles.statusBar}>
      <span className={styles.label}>{label}</span>
      <div className={styles.barContainer}>
        <div
          className={`${styles.barFill} ${styles[signal]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={styles.values}>
        {current}{unit} / {safety}{unit}
      </span>
    </div>
  )
}
