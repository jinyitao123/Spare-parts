import type { AgentMessage as AgentMessageType } from '../types/agent'
import { MessageRenderer } from './MessageRenderer'
import { ErrorBoundary } from '../components/ErrorBoundary'
import styles from './AgentMessage.module.css'

interface Props {
  message: AgentMessageType
  onAction?: (action: string) => void
}

export function AgentMessage({ message, onAction }: Props) {
  return (
    <div className={styles.agentMessage}>
      <div className={styles.prefix}>
        <span className={styles.symbol}>✦</span>
      </div>
      <div className={styles.blocks}>
        {message.blocks.map((block) => (
          <ErrorBoundary key={block.id} label={block.type}>
            <MessageRenderer block={block} onAction={onAction} />
          </ErrorBoundary>
        ))}
      </div>
    </div>
  )
}
