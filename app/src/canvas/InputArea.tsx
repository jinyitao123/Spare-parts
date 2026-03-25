import { useState, type KeyboardEvent } from 'react'
import styles from './InputArea.module.css'

interface QuickOption {
  label: string
  value: string
}

interface Props {
  placeholder?: string
  quickOptions?: QuickOption[]
  onSend: (text: string) => void
  disabled?: boolean
}

export function InputArea({ placeholder = '想问什么都可以…', quickOptions, onSend, disabled }: Props) {
  const [text, setText] = useState('')

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        {quickOptions && quickOptions.length > 0 && (
          <div className={styles.quickRow}>
            {quickOptions.map((opt) => (
              <button
                key={opt.value}
                className={styles.quickOption}
                onClick={() => onSend(opt.value)}
                disabled={disabled}
                style={{
                  height: 28,
                  padding: '0 12px',
                  background: 'var(--ground-washed)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.inputRow}>
          <input
            className={styles.input}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            disabled={disabled}
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={disabled || !text.trim()}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  )
}
