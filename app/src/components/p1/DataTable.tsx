import styles from './DataTable.module.css'

interface Column {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
}

interface Props {
  title?: string
  columns: Column[]
  rows: Record<string, unknown>[]
}

export function DataTable({ title, columns, rows }: Props) {
  return (
    <div className={styles.wrapper}>
      {title && <div className={styles.title}>{title}</div>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={styles.th} style={{ textAlign: col.align ?? 'left' }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={styles.tr}>
                {columns.map((col) => (
                  <td key={col.key} className={styles.td} style={{ textAlign: col.align ?? 'left' }}>
                    {String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
