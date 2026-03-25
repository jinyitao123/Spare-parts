import styles from './QuickOptions.module.css'

interface Option {
  label: string
  value: string
}

interface Props {
  options: Option[]
  onSelect?: (value: string) => void
  onAction?: (action: string) => void
}

export function QuickOptions({ options, onSelect, onAction }: Props) {
  return (
    <div className={styles.options}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={styles.option}
          onClick={() => {
            onSelect?.(opt.value)
            onAction?.(opt.value)
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
