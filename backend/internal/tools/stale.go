package tools

import (
	"context"
	"encoding/json"
	"log"

	"spareparts/internal/mcp"
	"spareparts/internal/pg"
)

func registerStaleTools(router *mcp.Router, d *Deps) {
	// Tool 9: get_stale_items
	router.Register(mcp.ToolDef{
		Name:        "get_stale_items",
		Description: "查询呆滞备件列表（超过阈值天数无出库记录的库存头寸）",
		InputSchema: mcp.Schema(map[string]any{
			"threshold_days": mcp.Prop("integer", "呆滞阈值天数（默认180，生产环境365）"),
		}, nil),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		records, err := d.Neo.QueryInventory(ctx, "", "", true)
		if err != nil {
			return mcp.ErrorResult("查询呆滞备件失败: " + err.Error())
		}

		results := recordsToMaps(records)
		totalValue := 0.0
		for _, r := range results {
			if v, ok := r["value"].(float64); ok {
				totalValue += v
			}
		}

		return mcp.TextResult(map[string]any{
			"count":       len(results),
			"total_value": totalValue,
			"items":       results,
		})
	})

	// Tool 10: mark_stale (WRITE)
	router.Register(mcp.ToolDef{
		Name:        "mark_stale",
		Description: "标记或取消标记库存头寸的呆滞状态",
		InputSchema: mcp.Schema(map[string]any{
			"position_id": mcp.Prop("string", "头寸ID"),
			"is_stale":    mcp.Prop("boolean", "true=标记呆滞，false=取消呆滞"),
		}, []string{"position_id", "is_stale"}),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			PositionID string `json:"position_id"`
			IsStale    bool   `json:"is_stale"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return mcp.ErrorResult("参数解析失败: " + err.Error())
		}

		// Write to PG first
		if err := pg.UpdatePositionStale(ctx, d.PG, p.PositionID, p.IsStale); err != nil {
			return mcp.ErrorResult("更新呆滞状态失败: " + err.Error())
		}

		// Sync to Neo4j
		if err := d.Neo.SyncPositionStatus(ctx, d.PG, p.PositionID); err != nil {
			log.Printf("neo4j sync stale failed (non-blocking): %v", err)
		}

		action := "标记为呆滞"
		if !p.IsStale {
			action = "取消呆滞标记"
		}

		return mcp.TextResult(map[string]any{
			"success":     true,
			"position_id": p.PositionID,
			"is_stale":    p.IsStale,
			"message":     action + "成功",
		})
	})
}
