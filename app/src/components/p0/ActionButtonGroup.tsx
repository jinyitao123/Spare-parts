import styles from './ActionButtonGroup.module.css'

interface ActionButton {
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
  action?: string
  onClick?: () => void
}

interface Props {
  buttons: ActionButton[]
  onAction?: (action: string) => void
}

export function ActionButtonGroup({ buttons, onAction }: Props) {
  return (
    <div className={styles.group}>
      {buttons.map((btn, i) => (
        <button
          key={i}
          className={`${styles.btn} ${styles[btn.variant ?? 'secondary']}`}
          onClick={() => {
            btn.onClick?.()
            if (onAction) onAction(btn.action ?? btn.label)
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}
