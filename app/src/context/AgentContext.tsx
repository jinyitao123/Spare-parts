import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { AgentContextId, Message } from '../types/agent'
import type { CanvasState, ConversationThread } from '../types/canvas'
import { useUser } from './UserContext'

// --- Actions ---
// threadKey is always `${role}:${contextId}`, computed by the provider.
type Action =
  | { type: 'SWITCH_CONTEXT'; contextId: AgentContextId }
  | { type: 'ADD_MESSAGE'; threadKey: string; contextId: AgentContextId; message: Message }
  | { type: 'UPSERT_MESSAGE'; threadKey: string; contextId: AgentContextId; message: Message }
  | { type: 'SET_STREAMING'; threadKey: string; isStreaming: boolean }
  | { type: 'CLEAR_THREAD'; threadKey: string; contextId: AgentContextId }
  | { type: 'LOAD_THREAD'; threadKey: string; contextId: AgentContextId; messages: Message[] }

function getThread(state: CanvasState, threadKey: string, contextId: AgentContextId): ConversationThread {
  return state.threads[threadKey] ?? {
    agentContextId: contextId,
    messages: [],
    isStreaming: false,
  }
}

function reducer(state: CanvasState, action: Action): CanvasState {
  switch (action.type) {
    case 'SWITCH_CONTEXT':
      return { ...state, activeContext: action.contextId }

    case 'ADD_MESSAGE': {
      const thread = getThread(state, action.threadKey, action.contextId)
      return {
        ...state,
        threads: {
          ...state.threads,
          [action.threadKey]: {
            ...thread,
            messages: [...thread.messages, action.message],
          },
        },
      }
    }

    case 'UPSERT_MESSAGE': {
      const thread = getThread(state, action.threadKey, action.contextId)
      const idx = thread.messages.findIndex(m => m.id === action.message.id)
      const msgs = [...thread.messages]
      if (idx >= 0) {
        msgs[idx] = action.message
      } else {
        msgs.push(action.message)
      }
      return {
        ...state,
        threads: {
          ...state.threads,
          [action.threadKey]: { ...thread, messages: msgs },
        },
      }
    }

    case 'SET_STREAMING': {
      const existing = state.threads[action.threadKey]
      if (!existing) return state
      return {
        ...state,
        threads: {
          ...state.threads,
          [action.threadKey]: { ...existing, isStreaming: action.isStreaming },
        },
      }
    }

    case 'CLEAR_THREAD':
      return {
        ...state,
        threads: {
          ...state.threads,
          [action.threadKey]: {
            agentContextId: action.contextId,
            messages: [],
            isStreaming: false,
          },
        },
      }

    case 'LOAD_THREAD':
      return {
        ...state,
        threads: {
          ...state.threads,
          [action.threadKey]: {
            agentContextId: action.contextId,
            messages: action.messages,
            isStreaming: false,
          },
        },
      }

    default:
      return state
  }
}

// --- Context ---
// External API stays unchanged: callers pass contextId, provider adds role internally.
interface AgentContextValue {
  state: CanvasState
  switchContext: (id: AgentContextId) => void
  addMessage: (contextId: AgentContextId, message: Message) => void
  upsertMessage: (contextId: AgentContextId, message: Message) => void
  setStreaming: (contextId: AgentContextId, isStreaming: boolean) => void
  clearThread: (contextId: AgentContextId) => void
  loadThread: (contextId: AgentContextId, messages: Message[]) => void
  activeThread: ConversationThread
}

const AgentCtx = createContext<AgentContextValue>(null!)

export function AgentProvider({ children, defaultContext = 'workbench' }: { children: ReactNode; defaultContext?: AgentContextId }) {
  const [state, dispatch] = useReducer(reducer, {
    activeContext: defaultContext,
    threads: {},
  })

  const { user } = useUser()
  const tk = (ctxId: AgentContextId) => `${user.role}:${ctxId}`

  const activeThread = getThread(state, tk(state.activeContext), state.activeContext)

  return (
    <AgentCtx.Provider value={{
      state,
      switchContext: (id) => dispatch({ type: 'SWITCH_CONTEXT', contextId: id }),
      addMessage: (contextId, message) => dispatch({ type: 'ADD_MESSAGE', threadKey: tk(contextId), contextId, message }),
      upsertMessage: (contextId, message) => dispatch({ type: 'UPSERT_MESSAGE', threadKey: tk(contextId), contextId, message }),
      setStreaming: (contextId, isStreaming) => dispatch({ type: 'SET_STREAMING', threadKey: tk(contextId), isStreaming }),
      clearThread: (contextId) => dispatch({ type: 'CLEAR_THREAD', threadKey: tk(contextId), contextId }),
      loadThread: (contextId, messages) => dispatch({ type: 'LOAD_THREAD', threadKey: tk(contextId), contextId, messages }),
      activeThread,
    }}>
      {children}
    </AgentCtx.Provider>
  )
}

export function useAgent() {
  return useContext(AgentCtx)
}
