import { StatusTag } from './StatusTag'
import styles from './DataCard.module.css'

interface Metric {
  label: string
  value: string
  big?: boolean
}

interface Tag {
  text: string
  signal: 'safe' | 'warn' | 'danger' | 'stale' | 'info'
}

interface Props {
  title?: string
  metrics?: Metric[]
  tags?: Tag[]
  children?: React.ReactNode
}

export function DataCard({ title, metrics, tags, children }: Props) {
  return (
    <div className={styles.card}>
      {title && <div className={styles.title}>{title}</div>}

      {metrics && metrics.length > 0 && (
        <div className={styles.metrics}>
          {metrics.map((m, i) => (
            <div key={i} className={styles.metric}>
              <span className={`${styles.metricValue} ${m.big ? styles.bigValue : ''}`}>
                {m.value}
              </span>
              <span className={styles.metricLabel}>{m.label}</span>
            </div>
          ))}
        </div>
      )}

      {tags && tags.length > 0 && (
        <div className={styles.tags}>
          {tags.map((t, i) => (
            <StatusTag key={i} signal={t.signal}>{t.text}</StatusTag>
          ))}
        </div>
      )}

      {children && <div className={styles.body}>{children}</div>}
    </div>
  )
}
