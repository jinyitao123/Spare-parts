package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"spareparts/internal/mcp"
	"spareparts/internal/pg"
	"spareparts/internal/rules"
)

func registerMovementTools(router *mcp.Router, d *Deps) {
	// Tool 4: execute_movement (WRITE)
	router.Register(mcp.ToolDef{
		Name:        "execute_movement",
		Description: "执行出入库操作。出库(OUT)会扣减库存并触发安全库存/高价值/频次异常检查；入库(IN)会增加库存。",
		InputSchema: mcp.Schema(map[string]any{
			"position_id":      mcp.Prop("string", "库存头寸ID"),
			"movement_type":    mcp.PropEnum("string", "变动类型", []string{"IN", "OUT", "RETURN", "SCRAP", "TRANSFER"}),
			"movement_reason":  mcp.PropEnum("string", "变动原因", []string{"FAULT_REPAIR", "MAINTENANCE", "TECH_UPGRADE", "PROJECT", "SCRAP_RETURN", "PURCHASE_ARRIVAL", "OTHER"}),
			"quantity":         mcp.Prop("integer", "数量（正整数）"),
			"operator_id":      mcp.Prop("string", "操作人ID"),
			"equipment_id":     mcp.Prop("string", "关联设备ID（出库时建议填写）"),
			"fault_description": mcp.Prop("string", "故障描述（出库时建议填写）"),
		}, []string{"position_id", "movement_type", "quantity", "operator_id"}),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			PositionID    string  `json:"position_id"`
			MovementType  string  `json:"movement_type"`
			MovementReason *string `json:"movement_reason"`
			Quantity      int     `json:"quantity"`
			OperatorID    string  `json:"operator_id"`
			EquipmentID   *string `json:"equipment_id"`
			FaultDesc     *string `json:"fault_description"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return mcp.ErrorResult("参数解析失败: " + err.Error())
		}

		if p.Quantity <= 0 {
			return mcp.ErrorResult("数量必须为正整数")
		}

		// Get current position
		pos, err := pg.GetPositionByID(ctx, d.PG, p.PositionID)
		if err != nil {
			return mcp.ErrorResult("头寸不存在: " + err.Error())
		}

		// Validate sufficient stock for outbound
		isOutbound := p.MovementType == "OUT" || p.MovementType == "SCRAP" || p.MovementType == "TRANSFER"
		if isOutbound && pos.CurrentQty < p.Quantity {
			return mcp.ErrorResult(fmt.Sprintf("库存不足：当前%d个，请求出库%d个", pos.CurrentQty, p.Quantity))
		}

		// Determine qty delta
		qtyDelta := p.Quantity
		if isOutbound {
			qtyDelta = -p.Quantity
		}

		// 1. Write to PostgreSQL (authoritative)
		movement, err := pg.CreateMovement(ctx, d.PG, pg.CreateMovementParams{
			PositionID:     p.PositionID,
			MovementType:   p.MovementType,
			MovementReason: p.MovementReason,
			Quantity:       p.Quantity,
			OperatorID:     p.OperatorID,
			EquipmentID:    p.EquipmentID,
			FaultDescription: p.FaultDesc,
			Source:         "AGENT",
		})
		if err != nil {
			return mcp.ErrorResult("创建变动记录失败: " + err.Error())
		}

		// Update position qty in PG
		if err := pg.UpdatePositionQty(ctx, d.PG, p.PositionID, qtyDelta, isOutbound); err != nil {
			return mcp.ErrorResult("更新库存数量失败: " + err.Error())
		}

		// 2. Sync to Neo4j (best-effort)
		reason := ""
		if p.MovementReason != nil {
			reason = *p.MovementReason
		}
		if err := d.Neo.SyncMovementEvent(ctx, movement.ID, p.PositionID, p.EquipmentID, p.MovementType, reason, p.Quantity); err != nil {
			log.Printf("neo4j sync movement failed (non-blocking): %v", err)
		}
		if err := d.Neo.SyncPositionStatus(ctx, d.PG, p.PositionID); err != nil {
			log.Printf("neo4j sync position failed (non-blocking): %v", err)
		}

		// 3. Re-read position for rule checks
		pos, _ = pg.GetPositionByID(ctx, d.PG, p.PositionID)
		alerts := rules.CheckAfterMovement(ctx, d.PG, pos, p.MovementType, p.EquipmentID)

		return mcp.TextResult(map[string]any{
			"success":      true,
			"movement_id":  movement.ID,
			"movement_type": p.MovementType,
			"quantity":     p.Quantity,
			"new_qty":      pos.CurrentQty,
			"safety_gap":   pos.SafetyGap,
			"alerts":       alerts,
		})
	})

	// Tool 5: get_movement_history
	router.Register(mcp.ToolDef{
		Name:        "get_movement_history",
		Description: "查询出入库变动历史记录",
		InputSchema: mcp.Schema(map[string]any{
			"position_id":  mcp.Prop("string", "头寸ID（可选）"),
			"spare_part_id": mcp.Prop("string", "备件编码（可选）"),
			"equipment_id": mcp.Prop("string", "设备ID（可选）"),
			"movement_type": mcp.PropEnum("string", "变动类型（可选）", []string{"IN", "OUT", "RETURN", "SCRAP", "TRANSFER"}),
			"days_back":    mcp.Prop("integer", "查询最近N天（默认30）"),
			"limit":        mcp.Prop("integer", "返回条数上限（默认50）"),
		}, nil),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			PositionID string `json:"position_id"`
			PartID     string `json:"spare_part_id"`
			EquipmentID string `json:"equipment_id"`
			Type       string `json:"movement_type"`
			DaysBack   int    `json:"days_back"`
			Limit      int    `json:"limit"`
		}
		json.Unmarshal(args, &p)
		if p.DaysBack == 0 {
			p.DaysBack = 30
		}
		if p.Limit == 0 {
			p.Limit = 50
		}

		movements, err := pg.ListMovements(ctx, d.PG, pg.MovementFilter{
			PositionID:  p.PositionID,
			PartID:      p.PartID,
			EquipmentID: p.EquipmentID,
			Type:        p.Type,
			DaysBack:    p.DaysBack,
			Limit:       p.Limit,
		})
		if err != nil {
			return mcp.ErrorResult("查询变动历史失败: " + err.Error())
		}

		return mcp.TextResult(map[string]any{
			"count":     len(movements),
			"movements": movements,
		})
	})

	// Tool 15: check_abnormal_consumption
	router.Register(mcp.ToolDef{
		Name:        "check_abnormal_consumption",
		Description: "检查某设备+备件组合的领用频次是否异常（R05：30天内≥3次视为异常）",
		InputSchema: mcp.Schema(map[string]any{
			"spare_part_id": mcp.Prop("string", "备件编码"),
			"equipment_id":  mcp.Prop("string", "设备ID"),
			"days":          mcp.Prop("integer", "检查天数（默认30）"),
		}, []string{"spare_part_id", "equipment_id"}),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			PartID      string `json:"spare_part_id"`
			EquipmentID string `json:"equipment_id"`
			Days        int    `json:"days"`
		}
		json.Unmarshal(args, &p)
		if p.Days == 0 {
			p.Days = 30
		}

		count, err := pg.CountRecentMovements(ctx, d.PG, p.PartID, p.EquipmentID, p.Days)
		if err != nil {
			return mcp.ErrorResult("查询失败: " + err.Error())
		}

		isAbnormal := count >= 3
		return mcp.TextResult(map[string]any{
			"spare_part_id": p.PartID,
			"equipment_id":  p.EquipmentID,
			"days":          p.Days,
			"outbound_count": count,
			"is_abnormal":   isAbnormal,
			"threshold":     3,
			"message": func() string {
				if isAbnormal {
					return fmt.Sprintf("⚠️ 频次异常：%d天内出库%d次（阈值3次），建议排查根因", p.Days, count)
				}
				return fmt.Sprintf("正常：%d天内出库%d次", p.Days, count)
			}(),
		})
	})
}
