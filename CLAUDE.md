# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Spare Parts Management AI-Native Platform (备件管理智能平台) for Yongxiang Technology smart factory. Agent-Native architecture where AI agents narrate the workflow, not assist from a sidebar.

## Repository Layout

```
app/           → v2.0 frontend (React 19 + Vite 8 + TypeScript)
backend/       → MCP Tool Server (Go 1.26, pgx/v5, neo4j-go-driver/v5)
docs/          → Design specs (interaction design v2.0, design language v1.0, ontology, graph schema)
prototype/     → ABANDONED v1.0 prototype — do NOT use as reference for new code
```

Docker Compose lives in the sibling `weave/` repo at `/Users/jinyitao/Desktop/weave/docker-compose.yml`.

## Build & Run

### Frontend (`app/`)
```bash
cd app && npm install
npm run dev          # Vite dev server :5173, proxies /api → localhost:8080
npm run build        # tsc -b && vite build → dist/
npm run lint         # eslint
```

### Backend (`backend/`)
```bash
# Cross-compile for Docker (Apple Silicon → Linux container)
cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o bin/mcpserver ./cmd/mcpserver

# Run locally (needs PG + Neo4j)
PG_URL="postgres://weave:weave@localhost:5432/weave?sslmode=disable" \
NEO4J_URI="bolt://localhost:7687" NEO4J_USER=neo4j NEO4J_PASSWORD=spareparts \
go run ./cmd/mcpserver

# Seed demo data
cd backend && go run ./scripts/seed.go
```

### Docker Compose (full stack)
```bash
cd /Users/jinyitao/Desktop/weave
docker compose up -d                    # all 6 services
docker compose up -d --build spareparts-mcp  # rebuild MCP server only
docker compose up -d --build spare-parts-ui  # rebuild frontend only
```

### Ports
| Service | Port |
|---------|------|
| Weave API | :8080 |
| Weave Console | :3000 |
| Frontend (compose) | :8088 |
| Frontend (dev) | :5173 |
| MCP Tool Server | :9090 |
| PostgreSQL | :5432 |
| Neo4j Browser / Bolt | :7474 / :7687 |

## Architecture

```
Browser → Weave API (:8080) → Agents → MCP Tool Server (:9090) → PG + Neo4j
          ↑                                                        ↑
     Frontend (:5173/8088)                              PG = write authority
     also calls MCP directly                            Neo4j = graph read acceleration
     for non-agent reads                                PG→Neo4j one-way sync
```

### MCP Protocol
JSON-RPC 2.0 over HTTP POST to `:9090/`. Two methods: `tools/list` and `tools/call`. 18 registered tools documented in `backend/docs/mcp-tools.md`. CORS enabled (Access-Control-Allow-Origin: *).

### Backend Packages (`backend/internal/`)
- `config/` — env-based config (PG_URL, NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, PORT)
- `mcp/` — JSON-RPC 2.0 router, HTTP handler, tool type definitions
- `pg/` — PostgreSQL pool, schema migrations, CRUD for positions/movements/purchases/snapshots
- `neo/` — Neo4j driver, graph schema, Cypher queries, PG→Neo4j structure sync
- `tools/` — 18 MCP tool implementations (inventory, movement, purchase, stale, health, graph, optimize)
- `rules/` — Business rules engine (R01 safety stock, R04 high-value, R05 frequency anomaly)

### Frontend Architecture (`app/src/`)
- `agents/` — Agent definitions (7 agents) and role-based narrative prompts
- `api/` — Weave backend client (chat, sessions, auth, SSE streaming)
- `canvas/` — AICanvas: the main interaction surface (Agent as narrator pattern)
- `context/` — UserContext (4 roles) + AgentContext (conversation threads per role×context)
- `components/p0/` — Day-1 components (data-card, action-buttons, quick-options, status-bar, alert-banner)
- `components/p1/` — Month-1 components (table, charts, expand-panel)
- `types/` — Domain types: agent.ts (BlockType, MessageBlock), canvas.ts, user.ts, domain.ts

### Neo4j Graph Model
Three layers: Structure (stable nodes: Part, Warehouse, Equipment + relationships), Status (properties on nodes), Event (Movement nodes, 90-day TTL). Synced from PG on server startup and after write operations.

### Roles
- `section_leader` (工段长) — workbench, warehouse, procurement, stale, cockpit
- `engineer` (设备工程师) — workbench, warehouse
- `warehouse_keeper` (库管员) — workbench, warehouse, stale, cockpit, inventory, ledger
- `manager` (管理层) — workbench, cockpit

## Design Source of Truth

- Interaction design: `docs/应用交互设计-v2_0.md`
- Design language: `docs/设计语言规范-v1_0.md` (warm modern AI: linen warmth, terracotta accent, breathing rhythm)
- Business ontology: `docs/业务本体-交付版-v1_0.md`
- Graph schema: `docs/本体图谱层设计-v1_0.md`
- Agent architecture: `docs/Agent-Native-设计方案-v1_0.md`

## Key Conventions

- Backend tool names use snake_case (`query_inventory`, `execute_movement`)
- Frontend API layer (`app/src/api/`) talks to Weave; for direct MCP calls use the pattern in `prototype/src/services/mcp.ts`
- PG schema lives under `spareparts` schema (not public)
- All PG date fields must be cast to `::text` when scanning into Go strings (pgx binary format issue)
- Backend Dockerfile copies a pre-built binary — always rebuild binary before `docker compose build`
- Neo4j credentials: neo4j / spareparts
- PG credentials: weave / weave / database weave
