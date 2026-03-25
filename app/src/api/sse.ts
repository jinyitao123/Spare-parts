/**
 * SSE stream client — connects to Weave's POST /v1/chat with stream:true
 * and parses the event stream (chunk, content_block, tool_call, tool_result, yield, done).
 */
import { WEAVE_BASE_URL, getToken } from './config'
import type { ChatRequest } from './client'

// ── SSE Event Types ──────────────────────────────────────────

export interface ChunkEvent {
  content: string
}

export interface ContentBlockEvent {
  type: string    // "chart" | "diagram" | "component"
  format?: string // "mermaid" | "svg" | "bar" | "line" ...
  source?: string
  data?: Record<string, unknown>
  // Component blocks (type="component")
  component_type?: string
  props?: Record<string, unknown>
}

export interface ToolCallEvent {
  name: string
  args: string
  read_only?: boolean
}

export interface ToolResultEvent {
  name: string
  content: string
  status: 'success' | 'error'
}

export interface YieldEvent {
  run_id: string
  session_id: string
  prompt: string
  yield_type?: string
}

export interface DoneEvent {
  session_id: string
  output?: string
  stop_reason?: string
  run_id?: string
  error?: string
}

export interface SSECallbacks {
  onChunk?: (e: ChunkEvent) => void
  onContentBlock?: (e: ContentBlockEvent) => void
  onToolCall?: (e: ToolCallEvent) => void
  onToolResult?: (e: ToolResultEvent) => void
  onYield?: (e: YieldEvent) => void
  onDone?: (e: DoneEvent) => void
  onError?: (err: Error) => void
}

// ── Stream Chat ──────────────────────────────────────────────

/**
 * Opens a streaming chat connection to Weave.
 * Returns an AbortController so the caller can cancel.
 */
export function streamChat(req: ChatRequest, callbacks: SSECallbacks): AbortController {
  const controller = new AbortController()

  const run = async () => {
    const token = getToken()
    const res = await fetch(`${WEAVE_BASE_URL}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...req, stream: true }),
      signal: controller.signal,
    })

    if (!res.ok) {
      callbacks.onError?.(new Error(`stream chat failed: ${res.status}`))
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      callbacks.onError?.(new Error('no response body'))
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse SSE lines
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // keep incomplete line

      let currentEvent = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          const raw = line.slice(6)
          try {
            const data = JSON.parse(raw)
            dispatch(currentEvent, data, callbacks)
          } catch {
            // non-JSON data line, ignore
          }
          currentEvent = ''
        }
        // empty line = event boundary, already handled
      }
    }
  }

  run().catch((err) => {
    if (err.name !== 'AbortError') {
      callbacks.onError?.(err)
    }
  })

  return controller
}

function dispatch(event: string, data: unknown, cb: SSECallbacks) {
  switch (event) {
    case 'chunk':
      cb.onChunk?.(data as ChunkEvent)
      break
    case 'content_block':
      cb.onContentBlock?.(data as ContentBlockEvent)
      break
    case 'tool_call':
      cb.onToolCall?.(data as ToolCallEvent)
      break
    case 'tool_result':
      cb.onToolResult?.(data as ToolResultEvent)
      break
    case 'yield':
      cb.onYield?.(data as YieldEvent)
      break
    case 'done':
      cb.onDone?.(data as DoneEvent)
      break
  }
}
