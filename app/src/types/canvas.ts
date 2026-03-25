import type { Message, AgentContextId } from './agent'

/** 对话线程状态 */
export interface ConversationThread {
  agentContextId: AgentContextId
  messages: Message[]
  isStreaming: boolean
}

/**
 * AI 画布全局状态
 * threads key = `${role}:${contextId}`，每个角色×页面各有独立线程
 */
export interface CanvasState {
  /** 当前激活的 Agent 上下文 */
  activeContext: AgentContextId
  /** 对话线程缓存，key 为 threadKey (role:contextId) */
  threads: Record<string, ConversationThread>
}
