export interface SparePart {
  code: string
  name: string
  spec: string
  category: string
  unit: string
  price: number
  criticality: 'A' | 'B' | 'C'
  leadTimeDays: number
}

export interface InventoryItem {
  partCode: string
  warehouse: string
  stock: number
  safetyStock: number
  amount: number
  lastChange: string
  monthlyUsage: number
  status: 'sufficient' | 'critical' | 'shortage' | 'stale'
  staleMonths?: number
}

export interface StockMovement {
  id: string
  datetime: string
  type: '出库' | '入库' | '退库' | '报废'
  partCode: string
  partName: string
  qty: number
  reason: string
  equipment: string
  operator: string
  status: 'completed' | 'pending'
}

export interface PurchaseSuggestion {
  id: string
  partCode: string
  partName: string
  suggestedQty: number
  estimatedAmount: number
  currentStock: number
  safetyStock: number
  inTransit: number
  reason: string
  urgency: 'normal' | 'urgent'
  status: 'pending' | 'approved' | 'rejected'
  lastPurchase: string
  leadTimeDays: number
  monthlyConsumption: number
}

export interface StaleItem {
  partCode: string
  partName: string
  stock: number
  amount: number
  staleMonths: number
  reason: string
  suggestion: string
  isExempt: boolean
}
