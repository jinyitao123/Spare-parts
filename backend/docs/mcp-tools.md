# MCP Tool Server - 工具清单

> 服务地址：`http://localhost:9090`
> 协议：JSON-RPC 2.0（`tools/list`、`tools/call`）
> 共 18 个工具，分为 5 类

---

## 一、库存查询（Inventory）

### 1. query_inventory
查询库存头寸列表，支持按备件、库房、呆滞状态过滤。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| spare_part_id | string | 否 | 备件编码 |
| warehouse_id | string | 否 | 库房ID |
| stale_only | boolean | 否 | 仅显示呆滞备件 |

**返回**：`{ count, positions[] }` — 每个 position 包含 position_id、part_id、part_name、category、specification、warehouse_id、warehouse_name、current_qty、available_qty、safety_stock、safety_gap、unit_price、value、is_stale、last_movement_date。

**使用方**：Agent-1、Agent-2、Agent-4、Agent-5、Agent-9a

---

### 2. get_stock_level
查询某备件在所有库房的库存水位。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| spare_part_id | string | **是** | 备件编码 |

**返回**：`{ spare_part_id, total_qty, warehouses[] }` — 每个 warehouse 包含 warehouse_id、warehouse_name、current_qty、available_qty、safety_stock、safety_gap、unit_price、value、is_stale。

**使用方**：Agent-1、Agent-2、Agent-5

---

### 3. get_stock_level_detail
查询某备件的详细库存信息，包括安全库存缺口、呆滞状态、金额，以及关联设备影响范围（图谱 P1 正向影响传播）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| spare_part_id | string | **是** | 备件编码 |

**返回**：`{ spare_part_id, part_name, warehouses[], affected_equipment[] }`

**使用方**：Agent-1、Agent-4、Agent-5、Agent-9a

---

## 二、出入库操作（Movements）

### 4. execute_movement
执行出入库操作。出库(OUT)扣减库存并触发规则检查（R01安全库存/R04高价值/R05频次异常）；入库(IN)增加库存。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| position_id | string | **是** | 库存头寸ID |
| movement_type | enum | **是** | `IN`/`OUT`/`RETURN`/`SCRAP`/`TRANSFER` |
| quantity | integer | **是** | 数量（正整数） |
| operator_id | string | **是** | 操作人ID |
| movement_reason | enum | 否 | `FAULT_REPAIR`/`MAINTENANCE`/`TECH_UPGRADE`/`PROJECT`/`SCRAP_RETURN`/`PURCHASE_ARRIVAL`/`OTHER` |
| equipment_id | string | 否 | 关联设备ID（出库时建议填写） |
| fault_description | string | 否 | 故障描述（出库时建议填写） |

**返回**：`{ movement_id, position_id, new_qty, warnings[], alerts[] }`

**写入流程**：PG 事务写入 → Neo4j 同步（best-effort）→ 规则检查
**触发规则**：R01（安全库存预警）、R04（高价值拦截 >2000元）、R05（频次异常 >=3次/30天）

**使用方**：Agent-1

---

### 5. get_movement_history
查询出入库变动历史记录。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| position_id | string | 否 | 头寸ID |
| spare_part_id | string | 否 | 备件编码 |
| equipment_id | string | 否 | 设备ID |
| movement_type | enum | 否 | `IN`/`OUT`/`RETURN`/`SCRAP`/`TRANSFER` |
| days_back | integer | 否 | 查询最近N天（默认30） |
| limit | integer | 否 | 返回条数上限（默认50） |

**返回**：`{ count, movements[] }`

**使用方**：Agent-1

---

### 6. check_abnormal_consumption
检查某设备+备件组合的领用频次是否异常（R05：30天内 >=3 次视为异常）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| spare_part_id | string | **是** | 备件编码 |
| equipment_id | string | **是** | 设备ID |
| days | integer | 否 | 检查天数（默认30） |

**返回**：`{ spare_part_id, equipment_id, count, is_abnormal, threshold, movements[] }`

**使用方**：Agent-1

---

## 三、采购管理（Procurement）

### 7. get_purchase_suggestions
查询采购建议列表。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | enum | 否 | `DRAFT`/`SUBMITTED`/`APPROVED`/`IN_TRANSIT`/`RECEIVED`/`CANCELLED`（默认DRAFT） |

**返回**：`{ count, orders[] }`

**使用方**：Agent-5

---

### 8. create_purchase_suggestion
创建采购建议（DRAFT状态，需人工审批）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| spare_part_id | string | **是** | 备件编码 |
| quantity | integer | **是** | 建议采购数量 |
| unit_price | number | **是** | 单价 |
| reason | string | **是** | 采购理由 |
| urgency | enum | 否 | `NORMAL`/`URGENT`（默认NORMAL） |

**返回**：`{ order_id, status, spare_part_id, quantity, total_amount }`

**使用方**：Agent-5

---

### 9. approve_purchase
审批采购单（批准或拒绝）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| order_id | string | **是** | 采购单ID |
| action | enum | **是** | `APPROVED`/`CANCELLED` |
| approved_by | string | **是** | 审批人 |

**返回**：`{ order_id, new_status, approved_by }`

**使用方**：Agent-5

---

## 四、呆滞管理（Stale）

### 10. get_stale_items
查询呆滞备件列表（超过阈值天数无出库记录的库存头寸）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| threshold_days | integer | 否 | 呆滞阈值天数（默认180，生产环境365） |

**返回**：`{ count, items[] }` — 每个 item 包含 position_id、part_id、part_name、warehouse_name、current_qty、value、is_stale、last_movement_date、days_since_last_movement。

**使用方**：Agent-4

---

### 11. mark_stale
标记或取消标记库存头寸的呆滞状态。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| position_id | string | **是** | 头寸ID |
| is_stale | boolean | **是** | true=标记呆滞，false=取消呆滞 |

**返回**：`{ position_id, is_stale }`

**写入流程**：PG 更新 → Neo4j 同步

**使用方**：Agent-4

---

## 五、分析与健康度（Analytics & Health）

### 12. get_inventory_health
获取库存整体健康度评分，包括总金额、呆滞率、风险头寸数。无参数。

**返回**：
```json
{
  "health_score": 50.6,
  "total_value": 531234.00,
  "total_value_wan": 53.1,
  "target_value_wan": 40.0,
  "gap_wan": 13.1,
  "stale_value": 89000.00,
  "stale_ratio": 16.8,
  "risk_positions": 5,
  "stale_positions": 3,
  "total_positions": 21
}
```

**评分算法**：100 - 超额惩罚(0-30) - 呆滞惩罚(0-30) - 风险惩罚(0-20)

**使用方**：Agent-2、Agent-4、Agent-9a

---

### 13. get_warehouse_summary
获取各库房金额分布汇总。无参数。

**返回**：`{ total_value_wan, warehouses[] }` — 每个 warehouse 包含 warehouse_id、warehouse_name、total_positions、total_value、stale_value、risk_count、stale_ratio。

**使用方**：Agent-2、Agent-9a

---

### 14. get_consumption_trend
查询某备件的月度消耗趋势（基于库存快照）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| spare_part_id | string | **是** | 备件编码 |
| months | integer | 否 | 查询月数（默认12） |

**返回**：`{ spare_part_id, months, trend[] }` — 每个点包含 snapshot_month、snapshot_qty、snapshot_value、monthly_consumption、monthly_consumption_value。

**使用方**：Agent-5、Agent-9a

---

### 15. get_monthly_value_trend
获取按月汇总的库存总金额趋势（基于库存快照）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| months | integer | 否 | 查询月数（默认12） |

**返回**：
```json
{
  "trend": [
    { "month": "2025-10", "actual": 78.4, "target": 40 },
    { "month": "2025-11", "actual": 77.0, "target": 40 },
    ...
  ]
}
```
单位：万元。

**使用方**：Agent-2、Agent-9a、前端看板

---

### 16. get_top_consumption
获取近N天领用量Top排名（按出库数量降序）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| days | integer | 否 | 统计天数（默认30） |
| limit | integer | 否 | 返回数量（默认10） |

**返回**：
```json
{
  "items": [
    { "part_id": "SP-001", "part_name": "6205轴承", "total_qty": 18, "total_amount": 3600.00 },
    ...
  ]
}
```

**使用方**：Agent-2、前端看板

---

### 17. find_substitutes
查找备件的可替代件（通过图谱 SUBSTITUTED_BY 关系遍历），包括兼容性信息和当前库存。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| spare_part_id | string | **是** | 备件编码 |

**返回**：`{ spare_part_id, substitutes[] }` — 每个替代件包含 substitute_id、name、compatibility、price_diff、available_qty。

**使用方**：Agent-1、Agent-4

---

### 18. get_optimization_plan
生成今日库存优化建议：列出所有可降库存的头寸，计算可释放金额，模拟执行后的库存总金额。无参数。

**返回**：
```json
{
  "current_value": 531234.00,
  "projected_value": 420000.00,
  "total_releasable": 111234.00,
  "items": [
    {
      "position_id": "WH-A_SP-001",
      "part_name": "6205轴承",
      "warehouse_name": "一级库",
      "current_qty": 8,
      "suggested_qty": 3,
      "releasable_qty": 5,
      "releasable_value": 1000.00,
      "criticality": "B"
    }
  ],
  "warnings": ["SP-003 为A类关键备件，降库存需谨慎"]
}
```

**算法**：suggestedQty = ceil(dailyConsumption × leadTime × 1.5)，releasable = max(0, currentQty - suggestedQty)

**使用方**：Agent-9a

---

## Agent 工具权限矩阵

| Agent | 可用工具 |
|-------|---------|
| **Agent-1 库存管家** | query_inventory, get_stock_level, get_stock_level_detail, execute_movement, get_movement_history, check_abnormal_consumption, find_substitutes |
| **Agent-2 金额看板** | query_inventory, get_inventory_health, get_warehouse_summary, get_consumption_trend, get_stock_level, get_monthly_value_trend, get_top_consumption |
| **Agent-4 呆滞侦探** | get_stale_items, mark_stale, query_inventory, get_stock_level_detail, find_substitutes, get_inventory_health |
| **Agent-5 采购建议** | query_inventory, get_stock_level, get_stock_level_detail, get_purchase_suggestions, create_purchase_suggestion, approve_purchase, get_consumption_trend |
| **Agent-9a 日频优化** | query_inventory, get_inventory_health, get_warehouse_summary, get_optimization_plan, get_consumption_trend, get_stock_level_detail, get_monthly_value_trend |

---

## 规则引擎

| 规则 | 触发时机 | 逻辑 |
|------|---------|------|
| **R01** 安全库存预警 | execute_movement 后 | safetyGap = safetyStock - (currentQty - reservedQty)；> 0 则预警 |
| **R03** 呆滞标记 | 月度扫描 / get_stale_items | 无出库记录超过365天（demo 180天） |
| **R04** 高价值拦截 | execute_movement(OUT) | unitPrice > 2000 元时警告 |
| **R05** 频次异常 | execute_movement(OUT) | 同设备+同备件 30天内出库 >= 3次 |
| **R07** 日频优化 | get_optimization_plan | 按消耗速率计算建议安全库存，释放超额 |
| **R08** 月度快照 | 定时 / 手动 | 快照所有头寸当月状态 |

---

## 调用示例

```bash
# 列出所有工具
curl -s -X POST http://localhost:9090 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# 查询库存
curl -s -X POST http://localhost:9090 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"query_inventory","arguments":{}},"id":2}'

# 执行出库
curl -s -X POST http://localhost:9090 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"execute_movement","arguments":{"position_id":"WH-A_SP-001","movement_type":"OUT","quantity":2,"operator_id":"OP-001","equipment_id":"EQ-003","movement_reason":"FAULT_REPAIR"}},"id":3}'

# 获取健康度
curl -s -X POST http://localhost:9090 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_inventory_health","arguments":{}},"id":4}'

# 获取金额趋势
curl -s -X POST http://localhost:9090 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_monthly_value_trend","arguments":{"months":6}},"id":5}'
```
