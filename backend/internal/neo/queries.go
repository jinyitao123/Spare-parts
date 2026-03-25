package neo

import (
	"context"
	"fmt"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// Helper functions for extracting typed values from neo4j.Record.Get() results.
func toFloat64(v any) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case int64:
		return float64(val)
	case nil:
		return 0
	default:
		return 0
	}
}

func toInt64(v any) int64 {
	switch val := v.(type) {
	case int64:
		return val
	case float64:
		return int64(val)
	case nil:
		return 0
	default:
		return 0
	}
}

func toString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// --- Pattern P1: Forward Impact Propagation ---
// Given equipment, find all affected positions.

func (db *DB) ForwardImpact(ctx context.Context, equipmentID string) ([]*neo4j.Record, error) {
	return db.ReadSingle(ctx, `
		MATCH (e:Equipment {id: $equipId})-[:USES]->(sp:SparePart)<-[:TRACKS]-(pos:InventoryPosition)
		RETURN sp.id AS part_id, sp.name AS part_name,
		       pos.id AS position_id, pos.currentQty AS current_qty,
		       pos.safetyGap AS safety_gap, pos.inventoryValue AS value,
		       pos.warehouseId AS warehouse_id
		ORDER BY pos.safetyGap DESC
	`, map[string]any{"equipId": equipmentID})
}

// --- Pattern P2: Reverse Root Cause Tracing ---
// Given position, find which equipment consumed it recently.

func (db *DB) ReverseRootCause(ctx context.Context, positionID string, days int) ([]*neo4j.Record, error) {
	if days <= 0 {
		days = 30
	}
	return db.ReadSingle(ctx, `
		MATCH (sm:StockMovement)-[:AFFECTS]->(pos:InventoryPosition {id: $posId})
		WHERE sm.movementType = 'OUT'
		  AND sm.movementDate > date() - duration({days: $days})
		MATCH (sm)-[:CONSUMED_BY]->(e:Equipment)
		RETURN e.id AS equipment_id, e.name AS equipment_name,
		       count(sm) AS freq, sum(sm.quantity) AS total_qty
		ORDER BY freq DESC
	`, map[string]any{"posId": positionID, "days": days})
}

// --- Pattern P3: Path Finding (Substitutes) ---

func (db *DB) FindSubstitutes(ctx context.Context, partID string) ([]*neo4j.Record, error) {
	return db.ReadSingle(ctx, `
		MATCH (s:SparePart {id: $partId})-[r:SUBSTITUTED_BY]->(sub:SparePart)
		OPTIONAL MATCH (sub)<-[:TRACKS]-(pos:InventoryPosition)
		RETURN sub.id AS sub_id, sub.name AS sub_name, sub.specification AS sub_spec,
		       r.compatibility AS compatibility, r.priceDiff AS price_diff,
		       sum(pos.currentQty) AS total_stock
	`, map[string]any{"partId": partID})
}

// FindStaleConsumptionPath: stale part → substitute → equipment consumers
func (db *DB) FindStaleConsumptionPath(ctx context.Context, stalePartID string) ([]*neo4j.Record, error) {
	return db.ReadSingle(ctx, `
		MATCH (stalePart:SparePart {id: $partId})-[:SUBSTITUTED_BY]->(activePart:SparePart)
		      <-[:USES]-(e:Equipment)
		OPTIONAL MATCH (sm:StockMovement)-[:CONSUMED_BY]->(e)
		WHERE sm.movementType = 'OUT'
		  AND sm.movementDate > date() - duration({days: 90})
		RETURN activePart.id AS active_part_id, activePart.name AS active_part_name,
		       e.id AS equipment_id, e.name AS equipment_name,
		       count(sm) AS consumption_90d
		ORDER BY consumption_90d DESC
	`, map[string]any{"partId": stalePartID})
}

// --- Pattern P4: Subgraph Aggregation ---

type WarehouseSummary struct {
	WarehouseID    string  `json:"warehouse_id"`
	WarehouseName  string  `json:"warehouse_name"`
	TotalPositions int     `json:"total_positions"`
	TotalValue     float64 `json:"total_value"`
	StaleValue     float64 `json:"stale_value"`
	RiskCount      int     `json:"risk_count"`
	StaleRatio     float64 `json:"stale_ratio"`
}

func (db *DB) GetWarehouseSummaries(ctx context.Context) ([]WarehouseSummary, error) {
	records, err := db.ReadSingle(ctx, `
		MATCH (w:Warehouse)
		OPTIONAL MATCH (pos:InventoryPosition)-[:LOCATED_IN]->(w)
		RETURN w.id AS wh_id, w.name AS wh_name,
		       count(pos) AS total_positions,
		       coalesce(sum(pos.inventoryValue), 0) AS total_value,
		       coalesce(sum(CASE WHEN pos.isStale THEN pos.inventoryValue ELSE 0 END), 0) AS stale_value,
		       coalesce(sum(CASE WHEN pos.safetyGap > 0 THEN 1 ELSE 0 END), 0) AS risk_count
		ORDER BY total_value DESC
	`, nil)
	if err != nil {
		return nil, fmt.Errorf("warehouse summaries: %w", err)
	}

	var result []WarehouseSummary
	for _, r := range records {
		whID, _ := r.Get("wh_id")
		whName, _ := r.Get("wh_name")
		totalPositionsVal, _ := r.Get("total_positions")
		totalValueVal, _ := r.Get("total_value")
		staleValueVal, _ := r.Get("stale_value")
		riskCountVal, _ := r.Get("risk_count")

		totalValue := toFloat64(totalValueVal)
		staleValue := toFloat64(staleValueVal)
		totalPositions := toInt64(totalPositionsVal)
		riskCount := toInt64(riskCountVal)

		staleRatio := 0.0
		if totalValue > 0 {
			staleRatio = staleValue / totalValue
		}

		result = append(result, WarehouseSummary{
			WarehouseID:    toString(whID),
			WarehouseName:  toString(whName),
			TotalPositions: int(totalPositions),
			TotalValue:     totalValue,
			StaleValue:     staleValue,
			RiskCount:      int(riskCount),
			StaleRatio:     staleRatio,
		})
	}
	return result, nil
}

// QueryInventory queries positions with optional filters via Neo4j graph.
func (db *DB) QueryInventory(ctx context.Context, partID, warehouseID string, staleOnly bool) ([]*neo4j.Record, error) {
	cypher := `
		MATCH (pos:InventoryPosition)-[:TRACKS]->(sp:SparePart)
		MATCH (pos)-[:LOCATED_IN]->(w:Warehouse)
		WHERE 1=1
	`
	params := map[string]any{}

	if partID != "" {
		cypher += ` AND sp.id = $partId`
		params["partId"] = partID
	}
	if warehouseID != "" {
		cypher += ` AND w.id = $whId`
		params["whId"] = warehouseID
	}
	if staleOnly {
		cypher += ` AND pos.isStale = true`
	}

	cypher += `
		RETURN pos.id AS position_id, sp.id AS part_id, sp.name AS part_name,
		       sp.specification AS specification, sp.category AS category,
		       w.id AS warehouse_id, w.name AS warehouse_name, w.level AS warehouse_level,
		       pos.currentQty AS current_qty, pos.availableQty AS available_qty,
		       pos.unitPrice AS unit_price, pos.inventoryValue AS value,
		       pos.safetyStock AS safety_stock, pos.safetyGap AS safety_gap,
		       pos.isStale AS is_stale, pos.lastMovementDate AS last_movement_date
		ORDER BY pos.inventoryValue DESC
	`

	return db.ReadSingle(ctx, cypher, params)
}

// GetStockLevel returns total stock for a part across all warehouses.
func (db *DB) GetStockLevel(ctx context.Context, partID string) ([]*neo4j.Record, error) {
	return db.ReadSingle(ctx, `
		MATCH (pos:InventoryPosition)-[:TRACKS]->(sp:SparePart {id: $partId})
		MATCH (pos)-[:LOCATED_IN]->(w:Warehouse)
		RETURN w.id AS warehouse_id, w.name AS warehouse_name,
		       pos.currentQty AS current_qty, pos.availableQty AS available_qty,
		       pos.safetyStock AS safety_stock, pos.safetyGap AS safety_gap,
		       pos.unitPrice AS unit_price, pos.inventoryValue AS value,
		       pos.isStale AS is_stale
		ORDER BY w.level, w.name
	`, map[string]any{"partId": partID})
}

// GetInventoryHealth returns overall health metrics.
func (db *DB) GetInventoryHealth(ctx context.Context) ([]*neo4j.Record, error) {
	return db.ReadSingle(ctx, `
		MATCH (pos:InventoryPosition)
		RETURN count(pos) AS total_positions,
		       sum(pos.inventoryValue) AS total_value,
		       sum(CASE WHEN pos.isStale THEN pos.inventoryValue ELSE 0 END) AS stale_value,
		       sum(CASE WHEN pos.safetyGap > 0 THEN 1 ELSE 0 END) AS risk_positions,
		       sum(CASE WHEN pos.isStale THEN 1 ELSE 0 END) AS stale_positions
	`, nil)
}

// GetOptimizationCandidates returns positions where currentQty > safetyStock.
func (db *DB) GetOptimizationCandidates(ctx context.Context) ([]*neo4j.Record, error) {
	return db.ReadSingle(ctx, `
		MATCH (pos:InventoryPosition)-[:TRACKS]->(sp:SparePart)
		MATCH (pos)-[:LOCATED_IN]->(w:Warehouse)
		WHERE pos.currentQty > pos.safetyStock
		WITH pos, sp, w,
		     pos.currentQty - pos.safetyStock AS releasableQty,
		     (pos.currentQty - pos.safetyStock) * pos.unitPrice AS releasableValue
		WHERE releasableQty > 0
		RETURN pos.id AS position_id, sp.id AS part_id, sp.name AS part_name,
		       sp.criticality AS criticality,
		       w.id AS warehouse_id, w.name AS warehouse_name,
		       pos.currentQty AS current_qty, pos.safetyStock AS safety_stock,
		       releasableQty AS releasable_qty, releasableValue AS releasable_value,
		       pos.unitPrice AS unit_price
		ORDER BY releasableValue DESC
	`, nil)
}
