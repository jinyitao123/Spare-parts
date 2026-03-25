package tools

import (
	"context"
	"encoding/json"

	"spareparts/internal/mcp"
)

func registerGraphTools(router *mcp.Router, d *Deps) {
	// Tool 11: find_substitutes
	router.Register(mcp.ToolDef{
		Name:        "find_substitutes",
		Description: "查找备件的可替代件（通过图谱SUBSTITUTED_BY关系遍历），包括兼容性信息和当前库存",
		InputSchema: mcp.Schema(map[string]any{
			"spare_part_id": mcp.Prop("string", "备件编码"),
		}, []string{"spare_part_id"}),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			PartID string `json:"spare_part_id"`
		}
		json.Unmarshal(args, &p)

		// Direct substitutes (1-hop)
		records, err := d.Neo.FindSubstitutes(ctx, p.PartID)
		if err != nil {
			return mcp.ErrorResult("查找替代件失败: " + err.Error())
		}

		// Also find stale consumption path (stale part can substitute for active part)
		stalePaths, _ := d.Neo.FindStaleConsumptionPath(ctx, p.PartID)

		return mcp.TextResult(map[string]any{
			"spare_part_id":      p.PartID,
			"substitutes":        recordsToMaps(records),
			"stale_consumption_paths": recordsToMaps(stalePaths),
		})
	})
}
