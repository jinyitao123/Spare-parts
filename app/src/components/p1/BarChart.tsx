import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import styles from './Chart.module.css'

interface Series {
  key: string
  label: string
  color?: string
}

interface Props {
  title?: string
  data: Record<string, unknown>[]
  xKey: string
  series: Series[]
}

const COLORS = ['#D4714A', '#1A56A0', '#2D6A2D', '#8B5E0A', '#6B4DC4', '#9B2C2C']

export function BarChartBlock({ title, data, xKey, series }: Props) {
  return (
    <div className={styles.wrapper}>
      {title && <div className={styles.title}>{title}</div>}
      <ResponsiveContainer width="100%" height={240}>
        <ReBarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: '#6B6560' }} />
          <YAxis tick={{ fontSize: 12, fill: '#6B6560' }} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid var(--border-default)', fontSize: 13 }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color ?? COLORS[i % COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}
