# 备件管理智能平台 Spare Parts Management

> Agent-Native 架构的智能工厂备件管理系统 — AI Agent 驱动工作流，而非辅助侧边栏。

## 项目简介

面向制造业智能工厂的备件全生命周期管理平台。采用 **Agent-as-Narrator** 设计模式：AI Agent 主导叙事和工作流编排，用户通过对话和嵌入式组件完成操作。

**核心能力：**
- 库存实时查询与出入库管理
- 安全库存预警与自动补货建议
- 呆滞备件识别与处置建议
- 库存金额趋势与健康度评分
- 设备-备件关联图谱分析
- 基于规则引擎的异常检测（频次异常、高价值拦截）

## 架构

```
┌──────────────┐     ┌─────────────┐     ┌──────────────────┐     ┌────────────┐
│   Frontend   │────→│  Weave API  │────→│  MCP Tool Server │────→│ PostgreSQL │
│  React 19    │     │   :8080     │     │     :9090        │     │   :5432    │
│  Vite 8      │     │  (Agents)   │     │  JSON-RPC 2.0    │     │  (写权威)   │
│  :5173/8088  │     └─────────────┘     │  18 Tools        │     └────────────┘
│              │──────────────────────────│  Go 1.26         │────→┌────────────┐
│              │   直接调用(非Agent读取)    │                  │     │   Neo4j    │
└──────────────┘                         └──────────────────┘     │   :7687    │
                                                                  │  (图谱加速)  │
                                                                  └────────────┘
```

- **PostgreSQL** — 唯一写权威，存储所有业务数据
- **Neo4j** — 图谱查询加速层，PG→Neo4j 单向同步
- **MCP Protocol** — JSON-RPC 2.0 over HTTP，18 个已注册工具
- **Weave** — Agent 编排平台，管理 5 个 Day-1 Agent

## 目录结构

```
├── app/                 # v2.0 前端（React 19 + Vite 8 + TypeScript）
│   ├── src/
│   │   ├── agents/      # Agent 定义与角色叙事模板
│   │   ├── api/         # Weave 后端通信（chat, SSE streaming）
│   │   ├── canvas/      # AICanvas 主交互画布
│   │   ├── components/  # 组件库（p0: Day-1, p1: Month-1）
│   │   ├── context/     # UserContext(4角色) + AgentContext(会话线程)
│   │   ├── layout/      # TopBar + SideNav + AppShell
│   │   └── types/       # TypeScript 类型定义
│   └── Dockerfile
│
├── backend/             # MCP Tool Server（Go 1.26）
│   ├── cmd/mcpserver/   # 服务入口
│   ├── internal/
│   │   ├── config/      # 环境变量配置
│   │   ├── mcp/         # JSON-RPC 2.0 路由与协议处理
│   │   ├── pg/          # PostgreSQL 连接池、Schema、CRUD
│   │   ├── neo/         # Neo4j 驱动、图谱 Schema、同步
│   │   ├── tools/       # 18 个 MCP 工具实现
│   │   └── rules/       # 业务规则引擎（R01/R04/R05/R07/R08）
│   ├── scripts/         # 数据种子 & Agent 注册脚本
│   ├── docs/            # MCP 工具清单文档
│   └── Dockerfile
│
├── prototype/           # v1.0 原型（已废弃，仅保留参考）
│   └── src/pages/       # 7 个页面连接真实 MCP 后端
│
└── docs/                # 产品设计文档
    ├── 应用交互设计-v2_0.md
    ├── 设计语言规范-v1_0.md
    ├── 业务本体-交付版-v1_0.md
    ├── 本体图谱层设计-v1_0.md
    ├── Agent-Native-设计方案-v1_0.md
    └── ...
```

## 快速开始

### 前置条件

- Node.js 22+
- Go 1.26+
- Docker & Docker Compose
- Weave 平台（部署在 sibling `weave/` 目录）

### 1. 启动全栈服务

```bash
# 在 weave/ 目录下启动所有服务
cd /path/to/weave
docker compose up -d
```

启动后的服务：

| 服务 | 端口 | 说明 |
|------|------|------|
| Weave API | :8080 | Agent 编排后端 |
| Weave Console | :3000 | Agent 管理控制台 |
| Frontend | :8088 | 前端（Docker 部署） |
| MCP Tool Server | :9090 | 备件业务工具服务 |
| PostgreSQL | :5432 | 关系数据库 |
| Neo4j | :7474 / :7687 | 图数据库 |

### 2. 前端开发

```bash
cd app
npm install
npm run dev          # Vite dev server :5173，自动代理 /api → :8080
npm run build        # 生产构建 → dist/
npm run lint         # ESLint 检查
```

### 3. 后端开发

```bash
cd backend

# 本地运行（需要 PG + Neo4j）
PG_URL="postgres://weave:weave@localhost:5432/weave?sslmode=disable" \
NEO4J_URI="bolt://localhost:7687" NEO4J_USER=neo4j NEO4J_PASSWORD=spareparts \
go run ./cmd/mcpserver

# 交叉编译（Apple Silicon → Linux 容器）
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o bin/mcpserver ./cmd/mcpserver

# 灌入演示数据
go run ./scripts/seed.go
```

### 4. 单独重建服务

```bash
cd /path/to/weave

# 重建 MCP 后端
cd /path/to/spare-parts/backend
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o bin/mcpserver ./cmd/mcpserver
cd /path/to/weave && docker compose up -d --build spareparts-mcp

# 重建前端
docker compose up -d --build spare-parts-ui
```

## MCP 工具清单

18 个 JSON-RPC 2.0 工具，分为 5 类：

| 类别 | 工具 | 说明 |
|------|------|------|
| **库存查询** | `query_inventory` | 库存头寸列表（按备件/库房/呆滞过滤） |
| | `get_stock_level` | 某备件全库房水位 |
| | `get_stock_level_detail` | 备件详情 + 关联设备影响 |
| **出入库** | `execute_movement` | 执行出/入/退/报废/调拨（触发规则检查） |
| | `get_movement_history` | 变动历史 |
| | `check_abnormal_consumption` | 频次异常检测 |
| **采购** | `get_purchase_suggestions` | 采购建议列表 |
| | `create_purchase_suggestion` | 创建采购建议 |
| | `approve_purchase` | 审批采购单 |
| **呆滞** | `get_stale_items` | 呆滞备件列表 |
| | `mark_stale` | 标记/取消呆滞 |
| **分析** | `get_inventory_health` | 健康度评分 |
| | `get_warehouse_summary` | 库房金额分布 |
| | `get_consumption_trend` | 备件月度消耗趋势 |
| | `get_monthly_value_trend` | 库存总金额月度趋势 |
| | `get_top_consumption` | 领用量 Top 排名 |
| | `find_substitutes` | 图谱替代件查找 |
| | `get_optimization_plan` | 今日优化建议 |

调用示例：
```bash
curl -s -X POST http://localhost:9090 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_inventory_health","arguments":{}},"id":1}'
```

详见 [backend/docs/mcp-tools.md](backend/docs/mcp-tools.md)

## 角色与 Agent

### 四种用户角色

| 角色 | 标识 | 可见模块 |
|------|------|---------|
| 工段长 | `section_leader` | 工作台、仓库、采购、呆滞、驾驶舱 |
| 设备工程师 | `engineer` | 工作台、仓库 |
| 库管员 | `warehouse_keeper` | 工作台、仓库、呆滞、驾驶舱、盘点、台账 |
| 管理层 | `manager` | 工作台、驾驶舱 |

### 五个 Day-1 Agent

| Agent | 职责 |
|-------|------|
| Agent-1 库存管家 | 出入库操作、安全库存、替代件推荐 |
| Agent-2 金额看板员 | 金额趋势分析、健康度评分、库房分布 |
| Agent-4 呆滞侦探 | 呆滞识别、处置建议、免检标记 |
| Agent-5 采购建议师 | 补货建议、采购审批、到货跟踪 |
| Agent-9a 日频优化 | 每日优化计划、可释放金额计算 |

## 规则引擎

| 规则 | 触发条件 | 逻辑 |
|------|---------|------|
| R01 安全库存预警 | 出库后 | 可用量 < 安全库存 → 预警 |
| R04 高价值拦截 | 出库时 | 单价 > 2000 元 → 警告确认 |
| R05 频次异常 | 出库时 | 同设备+同备件 30 天内 ≥3 次 → 异常 |
| R07 日频优化 | 查询时 | 按消耗速率计算建议库存，释放超额 |
| R08 月度快照 | 定时/手动 | 快照所有头寸当月状态 |

## Neo4j 图模型

三层架构：

- **结构层（稳定）** — Part、Warehouse、Equipment 节点 + STORED_IN、INSTALLED_ON、SUBSTITUTED_BY 关系
- **状态层（属性）** — 节点上的 current_qty、safety_stock、is_stale 等属性
- **事件层（瞬态）** — Movement 节点，90 天 TTL

## 设计语言

- **风格**：Warm Modern AI — 亚麻暖底色 + 赤陶强调色
- **交互**：Agent-as-Narrator，统一画布，嵌入式组件
- **节奏**：呼吸感动画，信息渐进展开

设计规范详见 `docs/` 目录。

## 数据库凭据（开发环境）

| 服务 | 用户 | 密码 | 数据库 |
|------|------|------|-------|
| PostgreSQL | weave | weave | weave |
| Neo4j | neo4j | spareparts | — |

## License

Apache-2.0
