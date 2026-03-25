import { useCallback, useRef } from 'react'
import { streamChat, type SSECallbacks } from '../api'
import { useAgent } from '../context/AgentContext'
import { useUser } from '../context/UserContext'
import { agentForContext } from '../agents/definitions'
import type { AgentContextId, AgentMessage, MessageBlock, UserMessage } from '../types/agent'

let _msgSeq = 0
const uid = () => `msg-${Date.now()}-${++_msgSeq}`
const blkId = () => `blk-${Date.now()}-${++_msgSeq}`

/** localStorage key for persisting session_id per agent context + role. */
const sessionKey = (ctxId: AgentContextId, role: string) => `sp-session:${role}:${ctxId}`

function loadSessionId(ctxId: AgentContextId, role: string): string | undefined {
  try { return localStorage.getItem(sessionKey(ctxId, role)) ?? undefined } catch { return undefined }
}

function saveSessionId(ctxId: AgentContextId, role: string, id: string) {
  try { localStorage.setItem(sessionKey(ctxId, role), id) } catch { /* ignore */ }
}

/**
 * useChat — sends user messages to Weave via SSE and streams back Agent blocks.
 */
export function useChat() {
  const { state, addMessage, upsertMessage, setStreaming } = useAgent()
  const { user } = useUser()
  const abortRef = useRef<AbortController | null>(null)
  const sessionRef = useRef<Partial<Record<string, string>>>({})

  /** Composite key: role + contextId */
  const cacheKey = (ctxId: AgentContextId) => `${user.role}:${ctxId}`

  /** Return the persisted session_id for a context+role, loading from localStorage if needed. */
  const getSessionId = (ctxId: AgentContextId): string | undefined => {
    const ck = cacheKey(ctxId)
    if (!sessionRef.current[ck]) {
      const saved = loadSessionId(ctxId, user.role)
      if (saved) sessionRef.current[ck] = saved
    }
    return sessionRef.current[ck]
  }

  /** Persist a session_id for a context+role. */
  const setSessionId = (ctxId: AgentContextId, id: string) => {
    const ck = cacheKey(ctxId)
    sessionRef.current[ck] = id
    saveSessionId(ctxId, user.role, id)
  }

  /**
   * Core streaming logic. If `silent` is true, no user bubble is shown
   * (used for initial narrative requests).
   */
  const doSend = useCallback((text: string, silent: boolean) => {
    const ctxId = state.activeContext
    const def = agentForContext(ctxId)
    if (!def) return

    // Add user message bubble (unless silent)
    if (!silent) {
      const userMsg: UserMessage = { id: uid(), role: 'user', text, timestamp: Date.now() }
      addMessage(ctxId, userMsg)
    }

    // Prepare agent message (will accumulate blocks via upsert)
    const agentMsgId = uid()
    const blocks: MessageBlock[] = []
    let textBlockId: string | null = null
    let textContent = ''

    const pushAgentSnapshot = () => {
      const msg: AgentMessage = {
        id: agentMsgId,
        role: 'agent',
        blocks: [...blocks],
        timestamp: Date.now(),
      }
      upsertMessage(ctxId, msg)
    }

    // Helper: ensure a text block exists and update its content
    const ensureTextBlock = () => {
      if (!textBlockId) {
        textBlockId = blkId()
        blocks.push({ id: textBlockId, type: 'text', props: { content: textContent } })
      } else {
        const tb = blocks.find(b => b.id === textBlockId)
        if (tb) tb.props = { content: textContent }
      }
    }

    setStreaming(ctxId, true)

    const callbacks: SSECallbacks = {
      onChunk(e) {
        textContent += e.content
        ensureTextBlock()
        pushAgentSnapshot()
      },

      onContentBlock(e) {
        if (e.type === 'component' && e.component_type) {
          // Flush any pending text as its own block before the component
          if (textContent.trim()) {
            ensureTextBlock()
            textBlockId = null
            textContent = ''
          }
          blocks.push({
            id: blkId(),
            type: e.component_type as MessageBlock['type'],
            props: e.props ?? {},
          })
        } else {
          blocks.push({
            id: blkId(),
            type: mapBlockType(e.type, e.format),
            props: { ...e.data, source: e.source, format: e.format },
          })
        }
        pushAgentSnapshot()
      },

      onToolCall(e) {
        // When the LLM calls a tool mid-stream, clear the "正在查询" indicator
        // by starting a fresh text segment after tool completes.
        // For now, show a subtle inline indicator.
        textContent += `\n\n*正在查询 ${e.name}…*`
        ensureTextBlock()
        pushAgentSnapshot()
      },

      onToolResult() {
        // Tool results feed back into the LLM; it will produce follow-up text.
        // Strip the "正在查询" indicator — the LLM response will replace it.
        const marker = textContent.lastIndexOf('\n\n*正在查询')
        if (marker >= 0) {
          textContent = textContent.slice(0, marker)
          ensureTextBlock()
        }
        // Start a new text block for the post-tool response
        textBlockId = null
        textContent = ''
      },

      onDone(e) {
        if (e.session_id) setSessionId(ctxId, e.session_id)
        setStreaming(ctxId, false)
      },

      onYield(e) {
        if (e.session_id) setSessionId(ctxId, e.session_id)
        setStreaming(ctxId, false)
      },

      onError(err) {
        console.error('[useChat] stream error:', err)
        textContent += `\n\n⚠️ 连接中断：${err.message}`
        ensureTextBlock()
        pushAgentSnapshot()
        setStreaming(ctxId, false)
      },
    }

    abortRef.current?.abort()
    abortRef.current = streamChat(
      {
        agent: def.weaveAgent ?? def.id,
        message: text,
        session_id: getSessionId(ctxId),
        stream: true,
      },
      callbacks,
    )
  }, [state.activeContext, addMessage, upsertMessage, setStreaming])

  /** Send a user message (shows user bubble + streams Agent reply). */
  const send = useCallback((text: string) => doSend(text, false), [doSend])

  /** Send a hidden prompt (no user bubble — used for initial narrative). */
  const sendSilent = useCallback((text: string) => doSend(text, true), [doSend])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(state.activeContext, false)
  }, [state.activeContext, setStreaming])

  return { send, sendSilent, cancel, getSessionId }
}

/** Map Weave block types to our component BlockType. */
function mapBlockType(type: string, format?: string): MessageBlock['type'] {
  if (type === 'chart') {
    switch (format) {
      case 'bar': return 'bar-chart'
      case 'line': return 'line-chart'
      case 'stacked-bar': return 'stacked-bar'
      default: return 'bar-chart'
    }
  }
  if (type === 'diagram') return 'text'
  return 'text'
}
