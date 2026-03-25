import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  label?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          padding: '8px 12px',
          border: '0.5px solid rgba(155, 44, 44, 0.3)',
          borderRadius: 8,
          fontSize: 12,
          color: '#9B2C2C',
          background: 'rgba(155, 44, 44, 0.05)',
        }}>
          <span style={{ fontWeight: 500 }}>{this.props.label || '组件'}渲染出错</span>
          <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>{this.state.error.message}</span>
        </div>
      )
    }
    return this.props.children
  }
}
