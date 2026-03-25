import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ComponentPropsWithoutRef } from 'react'
import { getComponent } from '../registry'
import type { BlockType } from '../../types/agent'
import styles from './TextParagraph.module.css'

interface Props {
  content: string
  onAction?: (action: string) => void
}

/** 剥掉后端附加的元数据（tool_calls 等 HTML comment） */
function clean(text: string): string {
  return text.replace(/\n*<!--[\s\S]*?-->/g, '').trimEnd()
}

/**
 * Custom <code> renderer for react-markdown.
 * When the LLM emits ```component JSON```, we parse the JSON
 * and render the actual registered component instead of a <pre><code>.
 */
function CodeBlock({
  className,
  children,
  onAction,
  ...rest
}: ComponentPropsWithoutRef<'code'> & { onAction?: (action: string) => void }) {
  const isLanguageComponent = className === 'language-component'

  if (isLanguageComponent && typeof children === 'string') {
    try {
      const parsed = JSON.parse(children.trim())
      const blockType = parsed.type as BlockType
      const Component = getComponent(blockType)
      if (Component) {
        const { type: _, ...props } = parsed
        return <Component {...props} onAction={onAction} />
      }
    } catch {
      // fall through to default rendering
    }
  }

  return <code className={className} {...rest}>{children}</code>
}

export function TextParagraph({ content, onAction }: Props) {
  return (
    <div className={styles.text}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // react-markdown v7+ passes code blocks inside <pre> with a nested <code>
          // that has className="language-xxx"
          code: (props) => <CodeBlock {...props} onAction={onAction} />,
          // Unwrap the <pre> wrapper when we render a component instead of code
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {clean(content)}
      </Markdown>
    </div>
  )
}
