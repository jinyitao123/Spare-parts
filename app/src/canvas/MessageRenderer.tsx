import type { MessageBlock } from '../types/agent'
import { getComponent } from '../components/registry'

interface Props {
  block: MessageBlock
  onAction?: (action: string) => void
}

export function MessageRenderer({ block, onAction }: Props) {
  const Component = getComponent(block.type)

  if (!Component) {
    return (
      <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
        [未注册的组件: {block.type}]
      </div>
    )
  }

  return <Component {...block.props} onAction={onAction} />
}
