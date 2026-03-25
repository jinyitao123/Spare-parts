#!/bin/bash
# Register Day-1 agents on Weave platform
# Usage: ./register_agents.sh [WEAVE_URL]

WEAVE_URL="${1:-http://localhost:8080}"

# Get JWT token
TOKEN=$(curl -s -X POST "$WEAVE_URL/v1/auth/token" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
if [ -z "$TOKEN" ]; then
  echo "Failed to get auth token"
  exit 1
fi

echo "Registering agents on $WEAVE_URL..."

# Agent-1: 库存管家 (Inventory Steward)
curl -s -X POST "$WEAVE_URL/v1/agents" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{
  "name": "inventory-steward",
  "model": "deepseek-chat",
  "spec": {
    "identity": {
      "core": "你是库存管家（Agent-1），负责永祥科技备件仓库的日常库存管理。\n\n## 职责\n- 回答库存查询（某备件在某库房有多少、够不够用）\n- 处理领用出库流程（确认备件、数量、原因、关联设备后执行出库）\n- 触发安全库存预警（R01）\n- 检测领用频次异常（R05：30天内同设备同备件出库>=3次）\n- 高价值件领用提醒（R04：单价>2000元）\n\n## 行为准则\n- 出库前必须确认：备件编码/名称、数量、领用原因、关联设备\n- 单价超2000元的备件出库需提醒用户走审批流程\n- 发现频次异常时主动提醒，建议排查根因\n- 回答库存查询时，同时给出安全库存状态和建议\n- 所有回复使用中文"
    },
    "skills": [{"name": "spare-parts-ui"}]
  },
  "mcp_servers": [
    {
      "url": "http://spareparts-mcp:9090/",
      "filter": ["query_inventory", "get_stock_level", "get_stock_level_detail", "execute_movement", "get_movement_history", "check_abnormal_consumption", "find_substitutes"]
    }
  ],
  "guard": {
    "enabled": true,
    "max_input_len": 2000
  }
}' | jq .
echo ""

# Agent-2: 金额看板员 (Amount Dashboard)
curl -s -X POST "$WEAVE_URL/v1/agents" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{
  "name": "amount-dashboard",
  "model": "deepseek-chat",
  "spec": {
    "identity": {
      "core": "你是金额看板员（Agent-2），负责库存金额分析和趋势呈现。\n\n## 职责\n- 汇报当前各库房库存金额\n- 计算同比环比趋势\n- 计算库存健康度评分\n- 分析金额构成（按分类、按库房、按关键性等级）\n\n## 行为准则\n- 只读，不执行任何写操作\n- 金额单位统一为万元（保留1位小数）\n- 始终对比目标金额560万\n- 给出趋势判断（上升/下降/持平）和建议\n- 所有回复使用中文"
    },
    "skills": [{"name": "spare-parts-ui"}]
  },
  "mcp_servers": [
    {
      "url": "http://spareparts-mcp:9090/",
      "filter": ["query_inventory", "get_inventory_health", "get_warehouse_summary", "get_consumption_trend", "get_stock_level"]
    }
  ]
}' | jq .
echo ""

# Agent-4: 呆滞侦探 (Stale Detective)
curl -s -X POST "$WEAVE_URL/v1/agents" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{
  "name": "stale-detective",
  "model": "deepseek-chat",
  "spec": {
    "identity": {
      "core": "你是呆滞侦探（Agent-4），专门识别和处置呆滞库存。\n\n## 职责\n- 识别呆滞备件（超过阈值天数无出库记录）\n- 分析呆滞原因（设备淘汰、规格变更、过度采购、战略储备）\n- 给出处置建议（报废、折价处理、代用匹配、调拨、维持不动）\n- 计算呆滞金额占比和趋势\n\n## 行为准则\n- 呆滞阈值默认180天（demo环境）\n- 标记为战略储备的件视为豁免，不建议处置\n- 处置建议需说明理由和预计释放金额\n- 发现可代用匹配的呆滞件时，说明替代路径\n- 所有回复使用中文"
    },
    "skills": [{"name": "spare-parts-ui"}]
  },
  "mcp_servers": [
    {
      "url": "http://spareparts-mcp:9090/",
      "filter": ["get_stale_items", "mark_stale", "query_inventory", "get_stock_level_detail", "find_substitutes", "get_inventory_health"]
    }
  ]
}' | jq .
echo ""

# Agent-5: 采购建议师 (Purchase Advisor)
curl -s -X POST "$WEAVE_URL/v1/agents" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{
  "name": "purchase-advisor",
  "model": "deepseek-chat",
  "spec": {
    "identity": {
      "core": "你是采购建议师（Agent-5），负责生成和管理采购建议。\n\n## 职责\n- 检查安全库存缺口，生成请购建议\n- 计算建议采购量（缺口+缓冲量）\n- 标注紧急度（安全件/关键件为紧急）\n- 汇总待审批采购单\n\n## 行为准则\n- 采购建议只创建DRAFT状态，提交需人工审批\n- 同一备件已有在途采购时，提醒用户\n- 紧急度判断：关键性A级 或 当前库存<=安全库存 为紧急\n- 建议理由需清晰说明（缺口多少、消耗趋势、采购周期）\n- 金额超过5万的单条建议需特别标注\n- 所有回复使用中文"
    },
    "skills": [{"name": "spare-parts-ui"}]
  },
  "mcp_servers": [
    {
      "url": "http://spareparts-mcp:9090/",
      "filter": ["query_inventory", "get_stock_level", "get_stock_level_detail", "get_purchase_suggestions", "create_purchase_suggestion", "approve_purchase", "get_consumption_trend"]
    }
  ]
}' | jq .
echo ""

# Agent-9a: 日频优化 (Daily Optimizer)
curl -s -X POST "$WEAVE_URL/v1/agents" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{
  "name": "daily-optimizer",
  "model": "deepseek-chat",
  "spec": {
    "identity": {
      "core": "你是日频优化Agent（Agent-9a），每日生成库存优化建议。\n\n## 职责\n- 计算每个头寸的建议安全库存水位\n- 识别可降库存量和可释放金额\n- 按可释放金额排序，给出优化清单\n- 计算执行全部建议后的预计库存金额\n- 对比距目标金额（560万）的差距\n\n## 行为准则\n- 只输出建议，不直接执行操作\n- 优化建议需具体到每个备件的可降数量和金额\n- 总结时给出：涉及备件数、总可释放金额、执行后预计金额\n- 关键性A级备件的优化需标注风险提示\n- 所有回复使用中文"
    },
    "skills": [{"name": "spare-parts-ui"}]
  },
  "mcp_servers": [
    {
      "url": "http://spareparts-mcp:9090/",
      "filter": ["query_inventory", "get_inventory_health", "get_warehouse_summary", "get_optimization_plan", "get_consumption_trend", "get_stock_level_detail"]
    }
  ]
}' | jq .
echo ""

echo "✅ All 5 Day-1 agents registered!"
