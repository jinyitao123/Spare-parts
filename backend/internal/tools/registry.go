package tools

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"spareparts/internal/mcp"
	"spareparts/internal/neo"
)

// Deps holds shared dependencies for all tools.
type Deps struct {
	PG  *pgxpool.Pool
	Neo *neo.DB
}

// RegisterAll registers all 16 tools on the router.
func RegisterAll(router *mcp.Router, d *Deps) {
	registerInventoryTools(router, d)
	registerMovementTools(router, d)
	registerPurchaseTools(router, d)
	registerStaleTools(router, d)
	registerHealthTools(router, d)
	registerGraphTools(router, d)
	registerOptimizeTools(router, d)
}
