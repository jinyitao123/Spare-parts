import { mcpCall } from './mcp'
import type { SparePart, InventoryItem, StockMovement, PurchaseSuggestion, StaleItem } from '../data/mockData'

// ===== Inventory =====

interface McpPosition {
  position_id: string
  part_id: string
  part_name: string
  category: string
  specification: string
  warehouse_id: string
  warehouse_name: string
  warehouse_level: string
  current_qty: number
  available_qty: number
  safety_stock: number
  safety_gap: number
  unit_price: number
  value: number
  is_stale: boolean
  last_movement_date: string
}

function positionToInventoryItem(p: McpPosition): InventoryItem {
  const status: InventoryItem['status'] =
    p.is_stale ? 'stale' :
    p.safety_gap > 0 ? 'shortage' :
    p.safety_gap === 0 ? 'critical' :
    'sufficient'

  return {
    partCode: p.part_id,
    warehouse: p.warehouse_name,
    stock: p.current_qty,
    safetyStock: p.safety_stock,
    amount: p.value,
    lastChange: p.last_movement_date || '',
    monthlyUsage: 0, // will be enriched if needed
    status,
    ...(p.is_stale ? { staleMonths: 0 } : {}),
  }
}

function positionsToSpareParts(positions: McpPosition[]): SparePart[] {
  const seen = new Map<string, SparePart>()
  for (const p of positions) {
    if (!seen.has(p.part_id)) {
      seen.set(p.part_id, {
        code: p.part_id,
        name: p.part_name,
        spec: p.specification,
        category: p.category,
        unit: '',
        price: p.unit_price,
        criticality: 'B',
        leadTimeDays: 14,
      })
    }
  }
  return [...seen.values()]
}

export async function fetchInventory(filters?: { warehouse_id?: string; spare_part_id?: string; stale_only?: boolean }) {
  const result = await mcpCall<{ count: number; positions: McpPosition[] }>('query_inventory', filters || {})
  return {
    positions: result.positions,
    inventory: result.positions.map(positionToInventoryItem),
    spareParts: positionsToSpareParts(result.positions),
  }
}

// ===== Stock Level =====

export async function fetchStockLevel(sparePartId: string) {
  return mcpCall<{
    spare_part_id: string
    total_qty: number
    warehouses: Array<{
      warehouse_id: string
      warehouse_name: string
      current_qty: number
      available_qty: number
      safety_stock: number
      safety_gap: number
      unit_price: number
      value: number
      is_stale: boolean
    }>
  }>('get_stock_level', { spare_part_id: sparePartId })
}

// ===== Movements =====

interface McpMovement {
  id: string
  position_id: string
  movement_type: string
  movement_reason: string
  quantity: number
  operator_id: string
  equipment_id: string
  source: string
  created_at: string
  is_agent_verified: boolean
  part_name?: string
  part_code?: string
}

const typeMap: Record<string, StockMovement['type']> = {
  OUT: '出库', IN: '入库', RETURN: '退库', SCRAP: '报废',
}
const reasonMap: Record<string, string> = {
  FAULT_REPAIR: '故障维修', MAINTENANCE: '保养更换', TECH_UPGRADE: '技改',
  PROJECT: '项目实施', SCRAP_RETURN: '报废退换', PURCHASE_ARRIVAL: '采购到货', OTHER: '其他',
}

function movementToFrontend(m: McpMovement): StockMovement {
  return {
    id: m.id.slice(0, 8),
    datetime: m.created_at.replace('T', ' ').slice(0, 16),
    type: typeMap[m.movement_type] || m.movement_type as any,
    partCode: m.part_code || m.position_id.split('_')[1] || '',
    partName: m.part_name || '',
    qty: m.quantity,
    reason: reasonMap[m.movement_reason] || m.movement_reason || '—',
    equipment: m.equipment_id || '—',
    operator: m.operator_id,
    status: 'completed',
  }
}

export async function fetchMovements(filters?: { days?: number; position_id?: string; movement_type?: string }) {
  const result = await mcpCall<{ count: number; movements: McpMovement[] }>('get_movement_history', filters || { days: 30 })
  return result.movements.map(movementToFrontend)
}

// ===== Purchase Suggestions =====

interface McpPurchaseOrder {
  id: string
  spare_part_id: string
  part_name?: string
  quantity: number
  unit_price: number
  total_amount: number
  status: string
  source: string
  urgency: string
  reason: string
  order_date: string
  expected_arrival_date: string
  created_at: string
}

function purchaseToFrontend(po: McpPurchaseOrder): PurchaseSuggestion {
  return {
    id: po.id.slice(0, 8),
    partCode: po.spare_part_id,
    partName: po.part_name || po.spare_part_id,
    suggestedQty: po.quantity,
    estimatedAmount: po.total_amount,
    currentStock: 0,
    safetyStock: 0,
    inTransit: 0,
    reason: po.reason || '常规补货',
    urgency: po.urgency === 'URGENT' ? 'urgent' : 'normal',
    status: po.status === 'DRAFT' ? 'pending' : po.status === 'APPROVED' ? 'approved' : 'pending',
    lastPurchase: po.order_date || '',
    leadTimeDays: 14,
    monthlyConsumption: 0,
  }
}

export async function fetchPurchaseSuggestions(status?: string) {
  const result = await mcpCall<{ count: number; orders: McpPurchaseOrder[] }>('get_purchase_suggestions', status ? { status } : {})
  return result.orders.map(purchaseToFrontend)
}

// ===== Stale Items =====

interface McpStaleItem {
  position_id: string
  part_id: string
  part_name: string
  warehouse_name: string
  current_qty: number
  value: number
  is_stale: boolean
  last_movement_date: string
  days_since_last_movement: number
}

function staleToFrontend(item: McpStaleItem): StaleItem {
  const months = Math.floor(item.days_since_last_movement / 30)
  return {
    partCode: item.part_id,
    partName: item.part_name,
    stock: item.current_qty,
    amount: item.value,
    staleMonths: months,
    reason: months > 24 ? '设备已淘汰' : months > 18 ? '过度采购' : '规格变更',
    suggestion: item.value > 50000 ? '维持不动' : months > 24 ? '报废' : '折价处理',
    isExempt: item.value > 50000,
  }
}

export async function fetchStaleItems(thresholdDays?: number) {
  const result = await mcpCall<{ count: number; items: McpStaleItem[] }>('get_stale_items', thresholdDays ? { threshold_days: thresholdDays } : {})
  return result.items.map(staleToFrontend)
}

// ===== Warehouse Summary =====

export interface WarehouseSummary {
  warehouse_id: string
  warehouse_name: string
  total_positions: number
  total_value: number
  stale_value: number
  risk_count: number
  stale_ratio: number
}

export async function fetchWarehouseSummary() {
  const result = await mcpCall<{ total_value_wan: number; warehouses: WarehouseSummary[] }>('get_warehouse_summary')
  return result
}

// ===== Consumption Trend =====

export async function fetchConsumptionTrend(sparePartId: string) {
  return mcpCall<{ spare_part_id: string; months: Array<{ month: string; consumption: number; consumption_value: number }> }>('get_consumption_trend', { spare_part_id: sparePartId })
}

// ===== Inventory Health =====

export async function fetchInventoryHealth() {
  return mcpCall<{
    health_score: number
    total_value: number
    total_value_wan: number
    target_value_wan: number
    gap_wan: number
    stale_value: number
    stale_ratio: number
    risk_positions: number
    stale_positions: number
    total_positions: number
  }>('get_inventory_health')
}

// ===== Optimization Plan =====

export async function fetchOptimizationPlan() {
  return mcpCall<{
    current_value: number
    projected_value: number
    total_releasable: number
    items: Array<{
      position_id: string
      part_name: string
      warehouse_name: string
      current_qty: number
      suggested_qty: number
      releasable_qty: number
      releasable_value: number
      criticality: string
    }>
    warnings: string[]
  }>('get_optimization_plan')
}

// ===== Monthly Value Trend =====

export async function fetchMonthlyValueTrend(months?: number) {
  return mcpCall<{
    trend: Array<{ month: string; actual: number; target: number }>
  }>('get_monthly_value_trend', months ? { months } : {})
}

// ===== Top Consumption =====

export async function fetchTopConsumption(days?: number, limit?: number) {
  return mcpCall<{
    items: Array<{ part_id: string; part_name: string; total_qty: number; total_amount: number }>
  }>('get_top_consumption', { ...(days ? { days } : {}), ...(limit ? { limit } : {}) })
}

// ===== Stock Level Detail =====

export async function fetchStockLevelDetail(positionId: string) {
  return mcpCall<any>('get_stock_level_detail', { position_id: positionId })
}

// ===== Execute Movement =====

export async function executeMovement(params: {
  position_id: string
  movement_type: string
  quantity: number
  operator_id: string
  movement_reason?: string
  equipment_id?: string
  fault_description?: string
}) {
  return mcpCall<any>('execute_movement', params)
}
