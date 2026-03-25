import type { AgentDefinition } from '../types/agent'

export const agentDefinitions: AgentDefinition[] = [
  // AI 驱动组 — weaveAgent maps to the agent name registered in Weave backend
  { id: 'workbench',   name: '工作台',     navLabel: '工作台',  group: 'ai',  weaveAgent: 'inventory-steward' },
  { id: 'warehouse',   name: '库存管家',   navLabel: '库房',    group: 'ai',  weaveAgent: 'inventory-steward' },
  { id: 'procurement', name: '采购建议师', navLabel: '采购',    group: 'ai',  weaveAgent: 'purchase-advisor' },
  { id: 'stale',       name: '呆滞侦探',   navLabel: '呆滞',    group: 'ai',  weaveAgent: 'stale-detective' },
  { id: 'cockpit',     name: '策略顾问',   navLabel: '驾驶舱',  group: 'ai',  weaveAgent: 'amount-dashboard' },
  // 传统视图组（无 Agent 后端）
  { id: 'inventory',   name: '盘点',       navLabel: '盘点',    group: 'traditional' },
  { id: 'ledger',      name: '台账',       navLabel: '台账',    group: 'traditional' },
  // 系统管理
  { id: 'sources',     name: '数据源管理', navLabel: '数据源',  group: 'system' },
]

export function getAgentDef(id: string): AgentDefinition | undefined {
  return agentDefinitions.find(a => a.id === id)
}

export function agentForContext(id: string): AgentDefinition | undefined {
  return agentDefinitions.find(a => a.id === id)
}
