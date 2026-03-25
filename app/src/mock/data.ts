// 从 prototype 迁移的完整 mock 数据

import type { SparePart, InventoryItem, StockMovement, PurchaseSuggestion, StaleItem } from '../types/domain'

// ===== 备件台账 =====
export const spareParts: SparePart[] = [
  { code: 'BJ-0421', name: '6205轴承', spec: '25×52×15mm', category: '轴承', unit: '个', price: 200, criticality: 'B', leadTimeDays: 14 },
  { code: 'BJ-0422', name: '6205-2RS密封型轴承', spec: '25×52×15mm', category: '轴承', unit: '个', price: 180, criticality: 'B', leadTimeDays: 14 },
  { code: 'BJ-0535', name: 'X型变频器', spec: '380V/5.5kW', category: '变频器', unit: '台', price: 8000, criticality: 'A', leadTimeDays: 30 },
  { code: 'BJ-0891', name: 'PLC模块', spec: 'S7-1500', category: '控制器', unit: '块', price: 82000, criticality: 'A', leadTimeDays: 90 },
  { code: 'BJ-0156', name: '温度传感器', spec: 'PT100/4-20mA', category: '传感器', unit: '个', price: 200, criticality: 'B', leadTimeDays: 7 },
  { code: 'BJ-0233', name: '密封圈', spec: 'DN50/EPDM', category: '密封件', unit: '个', price: 30, criticality: 'C', leadTimeDays: 5 },
  { code: 'BJ-0344', name: '线缆', spec: 'RVV3×2.5', category: '线缆', unit: '米', price: 50, criticality: 'C', leadTimeDays: 3 },
  { code: 'BJ-0455', name: '滤芯', spec: 'HX-160×10', category: '过滤器', unit: '个', price: 150, criticality: 'C', leadTimeDays: 7 },
  { code: 'BJ-0567', name: '轴承油脂', spec: 'SKF LGMT3/1', category: '润滑', unit: '桶', price: 400, criticality: 'C', leadTimeDays: 5 },
  { code: 'BJ-0678', name: '接近开关', spec: 'M12/NPN/10mm', category: '传感器', unit: '个', price: 120, criticality: 'B', leadTimeDays: 7 },
  { code: 'BJ-0789', name: '继电器', spec: '24VDC/10A', category: '电气', unit: '个', price: 85, criticality: 'B', leadTimeDays: 5 },
  { code: 'BJ-0890', name: '旧型PLC模块', spec: 'S7-300/CPU315', category: '控制器', unit: '块', price: 65000, criticality: 'A', leadTimeDays: 120 },
  { code: 'BJ-0901', name: 'Y型阀门', spec: 'DN80/PN16', category: '阀门', unit: '个', price: 1500, criticality: 'B', leadTimeDays: 14 },
  { code: 'BJ-0912', name: '进口PLC模块', spec: 'AB/1756-L72', category: '控制器', unit: '块', price: 80000, criticality: 'A', leadTimeDays: 90 },
  { code: 'BJ-1001', name: '电磁阀', spec: '4V210-08', category: '阀门', unit: '个', price: 280, criticality: 'B', leadTimeDays: 7 },
  { code: 'BJ-1002', name: '气缸', spec: 'SC50×100', category: '气动', unit: '个', price: 350, criticality: 'B', leadTimeDays: 10 },
]

// ===== 库存数据 =====
export const inventory: InventoryItem[] = [
  { partCode: 'BJ-0421', warehouse: '一级总库', stock: 28, safetyStock: 10, amount: 5600, lastChange: '2026-03-19', monthlyUsage: 18, status: 'sufficient' },
  { partCode: 'BJ-0421', warehouse: '二级库A', stock: 2, safetyStock: 2, amount: 400, lastChange: '2026-03-19', monthlyUsage: 6, status: 'critical' },
  { partCode: 'BJ-0421', warehouse: '二级库B', stock: 0, safetyStock: 2, amount: 0, lastChange: '2026-03-15', monthlyUsage: 4, status: 'shortage' },
  { partCode: 'BJ-0421', warehouse: '二级库C', stock: 3, safetyStock: 2, amount: 600, lastChange: '2026-03-18', monthlyUsage: 3, status: 'sufficient' },
  { partCode: 'BJ-0422', warehouse: '一级总库', stock: 1, safetyStock: 2, amount: 180, lastChange: '2026-01-05', monthlyUsage: 0, status: 'stale', staleMonths: 14 },
  { partCode: 'BJ-0535', warehouse: '一级总库', stock: 8, safetyStock: 3, amount: 64000, lastChange: '2026-03-10', monthlyUsage: 3, status: 'sufficient' },
  { partCode: 'BJ-0535', warehouse: '二级库A', stock: 5, safetyStock: 2, amount: 40000, lastChange: '2026-03-18', monthlyUsage: 1, status: 'sufficient' },
  { partCode: 'BJ-0891', warehouse: '一级总库', stock: 2, safetyStock: 2, amount: 164000, lastChange: '2026-02-20', monthlyUsage: 0, status: 'critical' },
  { partCode: 'BJ-0156', warehouse: '一级总库', stock: 15, safetyStock: 5, amount: 3000, lastChange: '2026-03-19', monthlyUsage: 12, status: 'sufficient' },
  { partCode: 'BJ-0156', warehouse: '二级库A', stock: 8, safetyStock: 2, amount: 1600, lastChange: '2026-03-19', monthlyUsage: 4, status: 'sufficient' },
  { partCode: 'BJ-0233', warehouse: '一级总库', stock: 50, safetyStock: 20, amount: 1500, lastChange: '2026-03-17', monthlyUsage: 15, status: 'sufficient' },
  { partCode: 'BJ-0344', warehouse: '一级总库', stock: 200, safetyStock: 50, amount: 10000, lastChange: '2026-03-12', monthlyUsage: 30, status: 'sufficient' },
  { partCode: 'BJ-0455', warehouse: '一级总库', stock: 12, safetyStock: 5, amount: 1800, lastChange: '2026-03-15', monthlyUsage: 4, status: 'sufficient' },
  { partCode: 'BJ-0567', warehouse: '一级总库', stock: 5, safetyStock: 2, amount: 2000, lastChange: '2026-03-01', monthlyUsage: 1, status: 'sufficient' },
  { partCode: 'BJ-0678', warehouse: '一级总库', stock: 10, safetyStock: 3, amount: 1200, lastChange: '2026-03-16', monthlyUsage: 3, status: 'sufficient' },
  { partCode: 'BJ-0789', warehouse: '一级总库', stock: 20, safetyStock: 5, amount: 1700, lastChange: '2026-03-14', monthlyUsage: 4, status: 'sufficient' },
  { partCode: 'BJ-0890', warehouse: '一级总库', stock: 1, safetyStock: 0, amount: 65000, lastChange: '2024-01-15', monthlyUsage: 0, status: 'stale', staleMonths: 28 },
  { partCode: 'BJ-0901', warehouse: '一级总库', stock: 3, safetyStock: 1, amount: 4500, lastChange: '2024-11-20', monthlyUsage: 0, status: 'stale', staleMonths: 16 },
  { partCode: 'BJ-0912', warehouse: '一级总库', stock: 2, safetyStock: 2, amount: 160000, lastChange: '2024-09-10', monthlyUsage: 0, status: 'stale', staleMonths: 18 },
  { partCode: 'BJ-1001', warehouse: '一级总库', stock: 8, safetyStock: 3, amount: 2240, lastChange: '2026-03-18', monthlyUsage: 2, status: 'sufficient' },
  { partCode: 'BJ-1002', warehouse: '一级总库', stock: 6, safetyStock: 2, amount: 2100, lastChange: '2026-03-10', monthlyUsage: 1, status: 'sufficient' },
]

// ===== 出入库记录 =====
export const stockMovements: StockMovement[] = [
  { id: 'M001', datetime: '2026-03-19 14:23', type: '出库', partCode: 'BJ-0421', partName: '6205轴承', qty: 1, reason: '故障维修', equipment: '3号线电机', operator: '张工', status: 'completed' },
  { id: 'M002', datetime: '2026-03-19 09:45', type: '出库', partCode: 'BJ-0156', partName: '温度传感器', qty: 2, reason: '—', equipment: '—', operator: '李工', status: 'pending' },
  { id: 'M003', datetime: '2026-03-18 16:00', type: '入库', partCode: 'BJ-0535', partName: 'X型变频器', qty: 3, reason: '采购到货', equipment: '—', operator: '王管', status: 'completed' },
  { id: 'M004', datetime: '2026-03-18 11:20', type: '退库', partCode: 'BJ-0233', partName: '密封圈', qty: 5, reason: '未使用', equipment: '—', operator: '张工', status: 'completed' },
  { id: 'M005', datetime: '2026-03-18 08:30', type: '出库', partCode: 'BJ-0421', partName: '6205轴承', qty: 2, reason: '保养更换', equipment: '1号线电机', operator: '赵工', status: 'completed' },
  { id: 'M006', datetime: '2026-03-17 15:10', type: '出库', partCode: 'BJ-0535', partName: 'X型变频器', qty: 1, reason: '故障维修', equipment: '2号线主轴', operator: '张工', status: 'completed' },
  { id: 'M007', datetime: '2026-03-17 10:00', type: '入库', partCode: 'BJ-0156', partName: '温度传感器', qty: 10, reason: '采购到货', equipment: '—', operator: '王管', status: 'completed' },
  { id: 'M008', datetime: '2026-03-16 14:50', type: '出库', partCode: 'BJ-0678', partName: '接近开关', qty: 1, reason: '故障维修', equipment: '1号线包装机', operator: '李工', status: 'completed' },
  { id: 'M009', datetime: '2026-03-16 09:20', type: '出库', partCode: 'BJ-0421', partName: '6205轴承', qty: 1, reason: '故障维修', equipment: '3号线电机', operator: '张工', status: 'completed' },
  { id: 'M010', datetime: '2026-03-15 16:30', type: '报废', partCode: 'BJ-0789', partName: '继电器', qty: 3, reason: '老化损坏', equipment: '—', operator: '王管', status: 'completed' },
]

// ===== 采购建议 =====
export const purchaseSuggestions: PurchaseSuggestion[] = [
  { id: 'P001', partCode: 'BJ-0421', partName: '6205轴承', suggestedQty: 10, estimatedAmount: 2000, currentStock: 33, safetyStock: 16, inTransit: 0, reason: '常规补货——本月消耗较大，二级库B已断货', urgency: 'normal', status: 'pending', lastPurchase: '2026-02-01', leadTimeDays: 14, monthlyConsumption: 18 },
  { id: 'P002', partCode: 'BJ-0156', partName: '温度传感器', suggestedQty: 5, estimatedAmount: 1000, currentStock: 23, safetyStock: 9, inTransit: 0, reason: '常规补货', urgency: 'normal', status: 'pending', lastPurchase: '2026-03-10', leadTimeDays: 7, monthlyConsumption: 12 },
  { id: 'P003', partCode: 'BJ-0535', partName: 'X型变频器', suggestedQty: 2, estimatedAmount: 16000, currentStock: 13, safetyStock: 5, inTransit: 0, reason: '3号线故障频次上升，加急备货', urgency: 'urgent', status: 'pending', lastPurchase: '2026-02-15', leadTimeDays: 30, monthlyConsumption: 3 },
  { id: 'P004', partCode: 'BJ-0891', partName: 'PLC模块', suggestedQty: 1, estimatedAmount: 82000, currentStock: 2, safetyStock: 2, inTransit: 0, reason: '当前库存=安全库存，采购周期90天，断货风险较高', urgency: 'urgent', status: 'pending', lastPurchase: '2025-06-01', leadTimeDays: 90, monthlyConsumption: 0.08 },
  { id: 'P005', partCode: 'BJ-0233', partName: '密封圈', suggestedQty: 20, estimatedAmount: 600, currentStock: 50, safetyStock: 20, inTransit: 0, reason: '常规补货', urgency: 'normal', status: 'pending', lastPurchase: '2026-03-01', leadTimeDays: 5, monthlyConsumption: 15 },
  { id: 'P006', partCode: 'BJ-0344', partName: '线缆', suggestedQty: 50, estimatedAmount: 2500, currentStock: 200, safetyStock: 50, inTransit: 0, reason: '常规补货', urgency: 'normal', status: 'pending', lastPurchase: '2026-02-20', leadTimeDays: 3, monthlyConsumption: 30 },
  { id: 'P007', partCode: 'BJ-0455', partName: '滤芯', suggestedQty: 8, estimatedAmount: 1200, currentStock: 12, safetyStock: 5, inTransit: 0, reason: '常规补货', urgency: 'normal', status: 'pending', lastPurchase: '2026-02-10', leadTimeDays: 7, monthlyConsumption: 4 },
  { id: 'P008', partCode: 'BJ-0567', partName: '轴承油脂', suggestedQty: 2, estimatedAmount: 800, currentStock: 5, safetyStock: 2, inTransit: 0, reason: '常规补货', urgency: 'normal', status: 'pending', lastPurchase: '2026-01-15', leadTimeDays: 5, monthlyConsumption: 1 },
]

// ===== 呆滞件 =====
export const staleItems: StaleItem[] = [
  { partCode: 'BJ-0422', partName: '6205-2RS密封型轴承', stock: 1, amount: 180, staleMonths: 14, reason: '规格变更', suggestion: '代用匹配', isExempt: false },
  { partCode: 'BJ-0890', partName: '旧型PLC模块', stock: 1, amount: 65000, staleMonths: 28, reason: '设备已淘汰', suggestion: '报废', isExempt: false },
  { partCode: 'BJ-0901', partName: 'Y型阀门', stock: 3, amount: 4500, staleMonths: 16, reason: '过度采购', suggestion: '折价处理', isExempt: false },
  { partCode: 'BJ-0912', partName: '进口PLC模块', stock: 2, amount: 160000, staleMonths: 18, reason: '战略储备', suggestion: '维持不动', isExempt: true },
  { partCode: 'BJ-1101', partName: '旧型接近开关', stock: 5, amount: 400, staleMonths: 22, reason: '型号升级替代', suggestion: '折价处理', isExempt: false },
  { partCode: 'BJ-1102', partName: '进口密封圈', stock: 8, amount: 1200, staleMonths: 15, reason: '改用国产替代', suggestion: '代用匹配', isExempt: false },
  { partCode: 'BJ-1103', partName: '旧型变频器', stock: 1, amount: 5500, staleMonths: 24, reason: '产线升级淘汰', suggestion: '报废', isExempt: false },
  { partCode: 'BJ-1104', partName: '特种螺栓', stock: 20, amount: 2000, staleMonths: 13, reason: '过度采购', suggestion: '调拨', isExempt: false },
  { partCode: 'BJ-1105', partName: '旧型温控器', stock: 2, amount: 3600, staleMonths: 20, reason: '设备已淘汰', suggestion: '折价处理', isExempt: false },
  { partCode: 'BJ-1106', partName: '备用伺服电机', stock: 1, amount: 18000, staleMonths: 14, reason: '战略储备', suggestion: '维持不动', isExempt: true },
]

// ===== 趋势数据 =====
export const monthlyTrend = [
  { month: '2025-10', actual: 920, target: 560 },
  { month: '2025-11', actual: 895, target: 560 },
  { month: '2025-12', actual: 870, target: 560 },
  { month: '2026-01', actual: 852, target: 560 },
  { month: '2026-02', actual: 839, target: 560 },
  { month: '2026-03', actual: 812, target: 560 },
]

export const monthlyConsumption = [
  { month: '2025-10', amount: 45200 },
  { month: '2025-11', amount: 38600 },
  { month: '2025-12', amount: 52100 },
  { month: '2026-01', amount: 41800 },
  { month: '2026-02', amount: 36500 },
  { month: '2026-03', amount: 23600 },
]

// ===== Helpers =====
export function getPartByCode(code: string): SparePart | undefined {
  return spareParts.find(p => p.code === code)
}
