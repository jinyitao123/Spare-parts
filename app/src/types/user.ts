import type { AgentContextId } from './agent'

export type UserRole = 'section_leader' | 'engineer' | 'warehouse_keeper' | 'manager'

export interface UserProfile {
  name: string
  role: UserRole
  roleName: string
  avatar: string
}

/** 各角色可见的导航项 */
export const roleNavMap: Record<UserRole, AgentContextId[]> = {
  engineer:         ['workbench', 'warehouse'],
  warehouse_keeper: ['workbench', 'warehouse', 'stale', 'inventory', 'ledger'],
  section_leader:   ['workbench', 'warehouse', 'procurement', 'stale', 'cockpit', 'inventory', 'ledger', 'sources'],
  manager:          ['workbench', 'cockpit', 'sources'],
}

/** 各角色的默认 Agent 上下文 */
export const roleDefaultAgent: Record<UserRole, AgentContextId> = {
  engineer: 'workbench',
  warehouse_keeper: 'workbench',
  section_leader: 'workbench',
  manager: 'workbench',
}
