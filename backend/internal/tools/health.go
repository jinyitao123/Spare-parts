package tools

import (
	"context"
	"encoding/json"
	"math"

	"spareparts/internal/mcp"
	"spareparts/internal/pg"
)

func registerHealthTools(router *mcp.Router, d *Deps) {
	// Tool 13: get_inventory_health
	router.Register(mcp.ToolDef{
		Name:        "get_inventory_health",
		Description: "获取库存整体健康度评分，包括总金额、呆滞率、风险头寸数",
		InputSchema: mcp.Schema(map[string]any{}, nil),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		records, err := d.Neo.GetInventoryHealth(ctx)
		if err != nil {
			return mcp.ErrorResult("获取健康度失败: " + err.Error())
		}

		if len(records) == 0 {
			return mcp.ErrorResult("无库存数据")
		}

		r := records[0]
		totalValue, _ := r.Get("total_value")
		staleValue, _ := r.Get("stale_value")
		riskPositions, _ := r.Get("risk_positions")
		totalPositions, _ := r.Get("total_positions")
		stalePositions, _ := r.Get("stale_positions")

		tv := toF64(totalValue)
		sv := toF64(staleValue)
		targetValue := 400000.0 // 40万 target

		staleRatio := 0.0
		if tv > 0 {
			staleRatio = sv / tv
		}

		// Health score: 100 - penalty
		// Penalty: distance from target + stale ratio + risk ratio
		distancePenalty := math.Min(30, math.Max(0, (tv-targetValue)/targetValue*30))
		stalePenalty := math.Min(30, staleRatio*100)
		riskPenalty := math.Min(20, toF64(riskPositions)/math.Max(1, toF64(totalPositions))*100)
		score := math.Max(0, 100-distancePenalty-stalePenalty-riskPenalty)

		return mcp.TextResult(map[string]any{
			"health_score":    math.Round(score*10) / 10,
			"total_value":     tv,
			"total_value_wan": math.Round(tv/10000*10) / 10,
			"target_value_wan": 40.0,
			"gap_wan":         math.Round((tv-targetValue)/10000*10) / 10,
			"stale_value":     sv,
			"stale_ratio":     math.Round(staleRatio*1000) / 10,
			"risk_positions":  toI64(riskPositions),
			"stale_positions": toI64(stalePositions),
			"total_positions": toI64(totalPositions),
		})
	})

	// Tool 14: get_warehouse_summary
	router.Register(mcp.ToolDef{
		Name:        "get_warehouse_summary",
		Description: "获取各库房金额分布汇总（总金额、呆滞金额、风险头寸数）",
		InputSchema: mcp.Schema(map[string]any{}, nil),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		summaries, err := d.Neo.GetWarehouseSummaries(ctx)
		if err != nil {
			return mcp.ErrorResult("获取库房汇总失败: " + err.Error())
		}

		totalValue := 0.0
		for _, s := range summaries {
			totalValue += s.TotalValue
		}

		return mcp.TextResult(map[string]any{
			"total_value_wan": math.Round(totalValue/10000*10) / 10,
			"warehouses":      summaries,
		})
	})

	// Tool 12: get_consumption_trend
	router.Register(mcp.ToolDef{
		Name:        "get_consumption_trend",
		Description: "查询某备件的月度消耗趋势（基于库存快照）",
		InputSchema: mcp.Schema(map[string]any{
			"spare_part_id": mcp.Prop("string", "备件编码"),
			"months":        mcp.Prop("integer", "查询月数（默认12）"),
		}, []string{"spare_part_id"}),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			PartID string `json:"spare_part_id"`
			Months int    `json:"months"`
		}
		json.Unmarshal(args, &p)

		trend, err := pg.GetConsumptionTrend(ctx, d.PG, p.PartID, p.Months)
		if err != nil {
			return mcp.ErrorResult("查询消耗趋势失败: " + err.Error())
		}

		return mcp.TextResult(map[string]any{
			"spare_part_id": p.PartID,
			"months":        len(trend),
			"trend":         trend,
		})
	})

	// Tool 17: get_monthly_value_trend
	router.Register(mcp.ToolDef{
		Name:        "get_monthly_value_trend",
		Description: "获取按月汇总的库存总金额趋势（基于库存快照）",
		InputSchema: mcp.Schema(map[string]any{
			"months": mcp.Prop("integer", "查询月数（默认12）"),
		}, nil),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			Months int `json:"months"`
		}
		json.Unmarshal(args, &p)

		trend, err := pg.GetMonthlyValueTrend(ctx, d.PG, p.Months)
		if err != nil {
			return mcp.ErrorResult("查询金额趋势失败: " + err.Error())
		}

		// Convert to wan (万)
		type TrendPoint struct {
			Month  string  `json:"month"`
			Actual float64 `json:"actual"`
			Target float64 `json:"target"`
		}
		points := make([]TrendPoint, len(trend))
		for i, t := range trend {
			points[i] = TrendPoint{
				Month:  t.Month,
				Actual: math.Round(t.Value/10000*10) / 10,
				Target: 40,
			}
		}

		return mcp.TextResult(map[string]any{
			"trend": points,
		})
	})

	// Tool 18: get_top_consumption
	router.Register(mcp.ToolDef{
		Name:        "get_top_consumption",
		Description: "获取近N天领用量Top排名（按出库数量降序）",
		InputSchema: mcp.Schema(map[string]any{
			"days":  mcp.Prop("integer", "统计天数（默认30）"),
			"limit": mcp.Prop("integer", "返回数量（默认10）"),
		}, nil),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			Days  int `json:"days"`
			Limit int `json:"limit"`
		}
		json.Unmarshal(args, &p)

		items, err := pg.GetTopConsumption(ctx, d.PG, p.Days, p.Limit)
		if err != nil {
			return mcp.ErrorResult("查询领用排名失败: " + err.Error())
		}

		return mcp.TextResult(map[string]any{
			"items": items,
		})
	})
}

func toF64(v any) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case int64:
		return float64(val)
	default:
		return 0
	}
}

func toI64(v any) int64 {
	switch val := v.(type) {
	case int64:
		return val
	case float64:
		return int64(val)
	default:
		return 0
	}
}
