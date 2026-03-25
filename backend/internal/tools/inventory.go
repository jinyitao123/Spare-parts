package tools

import (
	"context"
	"encoding/json"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"

	"spareparts/internal/mcp"
)

// recordsToMaps converts neo4j records to []map[string]any for JSON serialization.
func recordsToMaps(records []*neo4j.Record) []map[string]any {
	var result []map[string]any
	for _, r := range records {
		m := make(map[string]any)
		for _, key := range r.Keys {
			val, _ := r.Get(key)
			m[key] = val
		}
		result = append(result, m)
	}
	return result
}

func registerInventoryTools(router *mcp.Router, d *Deps) {
	// Tool 1: query_inventory
	router.Register(mcp.ToolDef{
		Name:        "query_inventory",
		Description: "查询库存头寸列表，支持按备件、库房、呆滞状态过滤",
		InputSchema: mcp.Schema(map[string]any{
			"spare_part_id": mcp.Prop("string", "备件编码（可选）"),
			"warehouse_id":  mcp.Prop("string", "库房ID（可选）"),
			"stale_only":    mcp.Prop("boolean", "仅显示呆滞备件（可选）"),
		}, nil),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			PartID      string `json:"spare_part_id"`
			WarehouseID string `json:"warehouse_id"`
			StaleOnly   bool   `json:"stale_only"`
		}
		json.Unmarshal(args, &p)

		records, err := d.Neo.QueryInventory(ctx, p.PartID, p.WarehouseID, p.StaleOnly)
		if err != nil {
			return mcp.ErrorResult("查询库存失败: " + err.Error())
		}

		results := recordsToMaps(records)
		return mcp.TextResult(map[string]any{
			"count":     len(results),
			"positions": results,
		})
	})

	// Tool 2: get_stock_level
	router.Register(mcp.ToolDef{
		Name:        "get_stock_level",
		Description: "查询某备件在所有库房的库存水位",
		InputSchema: mcp.Schema(map[string]any{
			"spare_part_id": mcp.Prop("string", "备件编码"),
		}, []string{"spare_part_id"}),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			PartID string `json:"spare_part_id"`
		}
		json.Unmarshal(args, &p)

		records, err := d.Neo.GetStockLevel(ctx, p.PartID)
		if err != nil {
			return mcp.ErrorResult("查询库存水位失败: " + err.Error())
		}

		results := recordsToMaps(records)
		totalQty := 0
		for _, r := range results {
			if qty, ok := r["current_qty"].(int64); ok {
				totalQty += int(qty)
			}
		}

		return mcp.TextResult(map[string]any{
			"spare_part_id": p.PartID,
			"total_qty":     totalQty,
			"warehouses":    results,
		})
	})

	// Tool 3: get_stock_level_detail
	router.Register(mcp.ToolDef{
		Name:        "get_stock_level_detail",
		Description: "查询某备件的详细库存信息，包括安全库存缺口、呆滞状态、金额，以及关联设备影响范围",
		InputSchema: mcp.Schema(map[string]any{
			"spare_part_id": mcp.Prop("string", "备件编码"),
		}, []string{"spare_part_id"}),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			PartID string `json:"spare_part_id"`
		}
		json.Unmarshal(args, &p)

		// Stock levels per warehouse
		stockRecords, err := d.Neo.GetStockLevel(ctx, p.PartID)
		if err != nil {
			return mcp.ErrorResult("查询失败: " + err.Error())
		}

		// Forward impact: which equipment uses this part (P1)
		impactRecords, _ := d.Neo.ReadSingle(ctx, `
			MATCH (e:Equipment)-[:USES]->(sp:SparePart {id: $partId})
			RETURN e.id AS equipment_id, e.name AS equipment_name, e.location AS location
		`, map[string]any{"partId": p.PartID})

		return mcp.TextResult(map[string]any{
			"spare_part_id":    p.PartID,
			"stock_by_warehouse": recordsToMaps(stockRecords),
			"used_by_equipment":  recordsToMaps(impactRecords),
		})
	})
}

