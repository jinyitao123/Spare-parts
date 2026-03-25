package tools

import (
	"context"
	"encoding/json"
	"math"

	"spareparts/internal/mcp"
)

func registerOptimizeTools(router *mcp.Router, d *Deps) {
	// Tool 16: get_optimization_plan
	router.Register(mcp.ToolDef{
		Name:        "get_optimization_plan",
		Description: "生成今日库存优化建议：列出所有可降库存的头寸，计算可释放金额，模拟执行后的库存总金额",
		InputSchema: mcp.Schema(map[string]any{}, nil),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		// Get current health
		healthRecords, err := d.Neo.GetInventoryHealth(ctx)
		if err != nil {
			return mcp.ErrorResult("获取库存状态失败: " + err.Error())
		}

		currentTotal := 0.0
		if len(healthRecords) > 0 {
			v, _ := healthRecords[0].Get("total_value")
			currentTotal = toF64(v)
		}

		// Get optimization candidates (P5: shadow graph simulation)
		candidates, err := d.Neo.GetOptimizationCandidates(ctx)
		if err != nil {
			return mcp.ErrorResult("获取优化候选失败: " + err.Error())
		}

		results := recordsToMaps(candidates)

		totalReleasable := 0.0
		partsCount := 0
		var topItems []map[string]any
		var warnings []map[string]any

		for _, r := range results {
			releasableValue := toF64(r["releasable_value"])
			totalReleasable += releasableValue
			partsCount++

			criticality := ""
			if c, ok := r["criticality"].(string); ok {
				criticality = c
			}

			item := map[string]any{
				"part_id":          r["part_id"],
				"part_name":        r["part_name"],
				"warehouse_name":   r["warehouse_name"],
				"current_qty":      r["current_qty"],
				"safety_stock":     r["safety_stock"],
				"releasable_qty":   r["releasable_qty"],
				"releasable_value": releasableValue,
				"criticality":      criticality,
			}

			if criticality == "A" {
				warnings = append(warnings, map[string]any{
					"part_name": r["part_name"],
					"message":   "关键性A级备件，降库存有风险，建议维持当前水位",
				})
			} else {
				topItems = append(topItems, item)
			}
		}

		projectedTotal := currentTotal - totalReleasable
		targetValue := 5600000.0

		return mcp.TextResult(map[string]any{
			"summary": map[string]any{
				"current_total_wan":    math.Round(currentTotal/10000*10) / 10,
				"releasable_total_wan": math.Round(totalReleasable/10000*10) / 10,
				"projected_total_wan":  math.Round(projectedTotal/10000*10) / 10,
				"target_wan":           560.0,
				"gap_after_wan":        math.Round((projectedTotal-targetValue)/10000*10) / 10,
				"parts_count":          partsCount,
			},
			"optimization_items": topItems,
			"warnings":           warnings,
		})
	})
}
