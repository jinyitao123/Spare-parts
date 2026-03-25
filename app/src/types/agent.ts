/** Agent 消息中的组件块类型 */
export type BlockType =
  // P0 — Day-1
  | 'text'            // Markdown 段落
  | 'data-card'       // 数据卡片（标题 + 指标 + 状态标签）
  | 'action-buttons'  // 操作按钮组
  | 'quick-options'   // 快捷选项（胶囊按钮）
  | 'status-bar'      // 库存水位条
  | 'alert-banner'    // 提醒横幅
  // P1 — 首月
  | 'table'           // 嵌入式表格
  | 'bar-chart'       // 柱状图
  | 'line-chart'      // 折线图
  | 'stacked-bar'     // 堆叠条形图
  | 'expand-panel'    // 展开/收起面板

/** 消息中的一个组件块 */
export interface MessageBlock {
  id: string
  type: BlockType
  props: Record<string, unknown>
  /** 流式渲染延迟（ms），用于控制出现节奏 */
  delay?: number
}

/** Agent 消息 */
export interface AgentMessage {
  id: string
  role: 'agent'
  blocks: MessageBlock[]
  timestamp: number
}

/** 用户消息 */
export interface UserMessage {
  id: string
  role: 'user'
  text: string
  timestamp: number
}

export type Message = AgentMessage | UserMessage

/** Agent 上下文 ID — 对应导航项 */
export type AgentContextId =
  | 'workbench'    // 工作台
  | 'warehouse'    // 库房 (Agent-1)
  | 'procurement'  // 采购 (Agent-5)
  | 'stale'        // 呆滞 (Agent-4)
  | 'cockpit'      // 驾驶舱 (Agent-10)
  | 'inventory'    // 盘点（传统）
  | 'ledger'       // 台账（传统）
  | 'sources'      // 数据源管理

/** Agent 定义 */
export interface AgentDefinition {
  id: AgentContextId
  name: string        // 显示名："库存管家"
  navLabel: string    // 导航标签："库房"
  group: 'ai' | 'traditional' | 'system'
  /** Weave backend agent name (if different from id). */
  weaveAgent?: string
}
