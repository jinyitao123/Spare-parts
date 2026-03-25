import type { UserMessage as UserMessageType } from '../types/agent'
import styles from './UserMessage.module.css'

interface Props {
  message: UserMessageType
}

export function UserMessage({ message }: Props) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.userMessage}>
        {message.text}
      </div>
    </div>
  )
}
