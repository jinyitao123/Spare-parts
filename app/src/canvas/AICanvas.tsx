import { useEffect, useRef } from 'react'
import { useAgent } from '../context/AgentContext'
import { useUser } from '../context/UserContext'
import { useBoot } from '../hooks/useBoot'
import { useChat } from '../hooks/useChat'
import { getAgentDef, agentForContext } from '../agents/definitions'
import { getInitialNarrative } from '../agents/narratives'
import { getSession } from '../api'
import type { AgentContextId, Message, AgentMessage as AgentMsgType } from '../types/agent'
import { AgentMessage } from './AgentMessage'
import { UserMessage } from './UserMessage'
import { InputArea } from './InputArea'
import styles from './AICanvas.module.css'

/** 各角色×各Agent上下文的初始化提示词模板 */
const rolePrompts: Record<string, Record<string, string>> = {
  warehouse: {
    section_leader:   '请给出今日库存简报：重点关注安全库存缺口、高价值件状态、各工段二级库补货需求。用数据说话，给出需要我决策的事项。',
    engineer:         '请给出与设备维护相关的备件状态：重点关注我负责设备的常用备件库存、近期领用频次是否异常、是否有替代件可用。',
    warehouse_keeper: '请给出今日库房工作概览：待处理的领用申请、需要盘点的库位、安全库存预警、近期到期的备件。',
    manager:          '请给出库存管理摘要：总库存金额及趋势、库存周转率、呆滞占比、与目标金额的差距。',
  },
  procurement: {
    section_leader:   '请给出采购建议汇总：当前有哪些安全库存缺口需要采购、紧急程度、预计金额，以及待我审批的采购单。',
    warehouse_keeper: '请给出采购相关信息：哪些备件需要补货、在途采购单状态、预计到货时间。',
  },
  stale: {
    section_leader:   '请给出呆滞库存分析：呆滞件清单、呆滞金额占比、处置建议优先级排序，以及可释放的金额。',
    warehouse_keeper: '请给出呆滞库存详情：哪些备件超期未用、是否有可代用匹配、建议的处置方式。',
  },
  cockpit: {
    section_leader:   '请给出库存策略总览：当前库存金额vs目标、健康度评分、各维度分析（分类/库房/关键性），以及本周优化建议。',
    manager:          '请给出经营层面的库存分析：总金额趋势、与560万目标的差距、关键风险点、可优化空间，用图表呈现。',
  },
  workbench: {
    section_leader:   '请给出今日工作台简报：需要关注的预警、待处理事项、各Agent的关键发现摘要。',
    engineer:         '请给出今日与我相关的信息：设备备件状态、领用记录、需要关注的异常。',
    warehouse_keeper: '请给出今日工作台概览：待办事项、库存预警、需要处理的流程。',
    manager:          '请给出管理看板：关键指标概览、异常预警、需要决策的事项。',
  },
}

/** 根据角色和Agent上下文生成初始化提示词 */
function buildInitPrompt(roleName: string, name: string, agentName: string, agentId: string, role: string): string {
  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  const specific = rolePrompts[agentId]?.[role]
  const fallback = `请给出今日简报和工作概况。不需要打招呼寒暄，直接给出关键信息。`
  return `用户刚打开${agentName}页面。用户是${roleName}（${name}），今天是${today}。${specific ?? fallback}`
}

/** 判断 user message 是否为 silent init prompt（不应显示给用户） */
function isSilentInitPrompt(content: string): boolean {
  return content.startsWith('用户刚打开') && content.includes('请给出今日简报')
}

let _restoreSeq = 0

/** 将后端 session messages 转为前端 Message 格式 */
function convertSessionMessages(msgs: { role: string; content: string }[]): Message[] {
  const result: Message[] = []
  for (const m of msgs) {
    if (m.role === 'system') continue // 跳过 system prompt
    if (m.role === 'user') {
      if (isSilentInitPrompt(m.content)) continue // 跳过 silent init
      result.push({
        id: `restored-user-${++_restoreSeq}`,
        role: 'user',
        text: m.content,
        timestamp: Date.now(),
      })
    } else if (m.role === 'assistant') {
      // 剥掉后端附加的元数据（HTML comments）
      const content = m.content.replace(/\n*<!--[\s\S]*?-->/g, '').trimEnd()
      if (!content) continue
      const agentMsg: AgentMsgType = {
        id: `restored-agent-${++_restoreSeq}`,
        role: 'agent',
        blocks: [{
          id: `restored-blk-${++_restoreSeq}`,
          type: 'text',
          props: { content },
        }],
        timestamp: Date.now(),
      }
      result.push(agentMsg)
    }
  }
  return result
}

export function AICanvas() {
  const { state, activeThread, addMessage, loadThread } = useAgent()
  const { user } = useUser()
  const backendStatus = useBoot()
  const { send, sendSilent, cancel, getSessionId } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef<Set<string>>(new Set())

  const agentDef = getAgentDef(state.activeContext)
  const isAI = agentDef?.group === 'ai'
  const isOnline = backendStatus === 'online'

  // 首次进入 Agent 上下文时：先尝试恢复 session，没有才初始化
  useEffect(() => {
    const ctxId = state.activeContext
    const key = `${ctxId}-${user.role}-${backendStatus}`
    if (!isAI || initializedRef.current.has(key) || activeThread.messages.length > 0) return
    if (backendStatus === 'checking') return

    initializedRef.current.add(key)

    if (isOnline && agentDef?.weaveAgent) {
      // 尝试从后端恢复历史 session
      const sessionId = getSessionId(ctxId as AgentContextId)
      if (sessionId) {
        restoreSession(ctxId as AgentContextId, sessionId, agentDef.weaveAgent)
      } else {
        // 没有历史 session，发送初始化 prompt
        const prompt = buildInitPrompt(user.roleName, user.name, agentDef.name, agentDef.id, user.role)
        sendSilent(prompt)
      }
    } else {
      const narrative = getInitialNarrative(state.activeContext, user.role)
      if (narrative) addMessage(state.activeContext, narrative)
    }
  }, [state.activeContext, user.role, user.roleName, user.name, backendStatus, isAI, isOnline, agentDef, activeThread.messages.length, addMessage, sendSilent, getSessionId, loadThread])

  async function restoreSession(ctxId: AgentContextId, sessionId: string, weaveAgent: string) {
    try {
      const session = await getSession(sessionId, weaveAgent)
      if (session.messages && session.messages.length > 0) {
        const messages = convertSessionMessages(session.messages)
        if (messages.length > 0) {
          loadThread(ctxId, messages)
          return
        }
      }
    } catch {
      // Session not found or failed to load — fall through to init
    }
    // 恢复失败，发送初始化 prompt
    const def = agentForContext(ctxId)
    if (def) {
      const prompt = buildInitPrompt(user.roleName, user.name, def.name, def.id, user.role)
      sendSilent(prompt)
    }
  }

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeThread.messages])

  function handleSend(text: string) {
    if (isOnline && agentDef?.weaveAgent) {
      send(text)
    } else {
      addMessage(state.activeContext, {
        id: `user-${Date.now()}`,
        role: 'user',
        text,
        timestamp: Date.now(),
      })
      setTimeout(() => {
        addMessage(state.activeContext, {
          id: `agent-${Date.now()}`,
          role: 'agent',
          blocks: [{
            id: `blk-${Date.now()}`,
            type: 'text',
            props: { content: `⚠️ 后端未连接，无法处理请求。请启动 Weave 后端。\n\n你的输入："${text}"` },
          }],
          timestamp: Date.now(),
        })
      }, 300)
    }
  }

  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <>
      <div className={styles.canvas}>
        <div className={styles.header}>
          <div className={styles.agentName}>
            <span className={styles.agentSymbol}>✦</span>
            {agentDef?.name ?? ''}
            {backendStatus === 'checking' && <span className={styles.statusDot} title="连接中…" />}
            {backendStatus === 'online' && <span className={styles.statusDotOnline} title="已连接后端" />}
          </div>
          <span className={styles.dateInfo}>{user.name} · {today}</span>
        </div>

        {activeThread.messages.length === 0 && !activeThread.isStreaming ? (
          <div className={styles.empty}>
            <span className={styles.emptySymbol}>✦</span>
            <span>
              {backendStatus === 'checking' ? '正在连接…' : `${agentDef?.name}准备就绪`}
            </span>
          </div>
        ) : (
          <div className={styles.messages}>
            {activeThread.messages.map((msg) =>
              msg.role === 'agent'
                ? <AgentMessage key={msg.id} message={msg} onAction={handleSend} />
                : <UserMessage key={msg.id} message={msg} />
            )}
            {activeThread.isStreaming && activeThread.messages.length === 0 && (
              <div className={styles.streaming}>
                <span className={styles.agentSymbol}>✦</span>
                <span className={styles.thinkingDots}>正在准备简报</span>
              </div>
            )}
            {activeThread.isStreaming && activeThread.messages.length > 0 && (
              <div className={styles.streaming}>
                <span className={styles.agentSymbol}>✦</span>
                <span className={styles.thinkingDots}>思考中</span>
                <button className={styles.cancelBtn} onClick={cancel}>取消</button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {isAI && (
        <InputArea
          placeholder={`对${agentDef?.name}说点什么…`}
          onSend={handleSend}
          disabled={activeThread.isStreaming}
        />
      )}
    </>
  )
}
