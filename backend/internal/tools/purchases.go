package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"spareparts/internal/mcp"
	"spareparts/internal/pg"
)

func registerPurchaseTools(router *mcp.Router, d *Deps) {
	// Tool 6: get_purchase_suggestions
	router.Register(mcp.ToolDef{
		Name:        "get_purchase_suggestions",
		Description: "查询采购建议列表（待审批的采购单）",
		InputSchema: mcp.Schema(map[string]any{
			"status": mcp.PropEnum("string", "状态过滤（可选，默认DRAFT）", []string{"DRAFT", "SUBMITTED", "APPROVED", "IN_TRANSIT", "RECEIVED", "CANCELLED"}),
		}, nil),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			Status string `json:"status"`
		}
		json.Unmarshal(args, &p)
		if p.Status == "" {
			p.Status = "DRAFT"
		}

		orders, err := pg.ListPurchaseOrders(ctx, d.PG, p.Status)
		if err != nil {
			return mcp.ErrorResult("查询采购单失败: " + err.Error())
		}

		totalAmount := 0.0
		for _, o := range orders {
			totalAmount += o.TotalAmount
		}

		return mcp.TextResult(map[string]any{
			"count":        len(orders),
			"total_amount": totalAmount,
			"orders":       orders,
		})
	})

	// Tool 7: create_purchase_suggestion (WRITE)
	router.Register(mcp.ToolDef{
		Name:        "create_purchase_suggestion",
		Description: "创建采购建议（DRAFT状态，需人工审批）",
		InputSchema: mcp.Schema(map[string]any{
			"spare_part_id": mcp.Prop("string", "备件编码"),
			"quantity":      mcp.Prop("integer", "建议采购数量"),
			"unit_price":    mcp.Prop("number", "单价"),
			"urgency":       mcp.PropEnum("string", "紧急度", []string{"NORMAL", "URGENT"}),
			"reason":        mcp.Prop("string", "采购理由"),
		}, []string{"spare_part_id", "quantity", "unit_price", "reason"}),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			PartID   string  `json:"spare_part_id"`
			Quantity int     `json:"quantity"`
			Price    float64 `json:"unit_price"`
			Urgency  string  `json:"urgency"`
			Reason   string  `json:"reason"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return mcp.ErrorResult("参数解析失败: " + err.Error())
		}

		// Check for existing in-transit PO
		existing, _ := pg.ListPurchaseOrders(ctx, d.PG, "IN_TRANSIT")
		for _, o := range existing {
			if o.SparePartID == p.PartID {
				return mcp.ErrorResult(fmt.Sprintf("该备件已有在途采购单（%s），在途数量%d，请先确认是否仍需采购", o.ID, o.Quantity))
			}
		}

		po, err := pg.CreatePurchaseOrder(ctx, d.PG, pg.CreatePurchaseParams{
			SparePartID: p.PartID,
			Quantity:    p.Quantity,
			UnitPrice:   p.Price,
			Urgency:     p.Urgency,
			Reason:      p.Reason,
			Source:       "AGENT_SUGGESTED",
		})
		if err != nil {
			return mcp.ErrorResult("创建采购建议失败: " + err.Error())
		}

		return mcp.TextResult(map[string]any{
			"success":      true,
			"order_id":     po.ID,
			"status":       po.Status,
			"total_amount": po.TotalAmount,
			"message":      "采购建议已创建（DRAFT状态），等待工段长审批",
		})
	})

	// Tool 8: approve_purchase (WRITE)
	router.Register(mcp.ToolDef{
		Name:        "approve_purchase",
		Description: "审批采购单（批准或拒绝）",
		InputSchema: mcp.Schema(map[string]any{
			"order_id":    mcp.Prop("string", "采购单ID"),
			"action":      mcp.PropEnum("string", "审批动作", []string{"APPROVED", "CANCELLED"}),
			"approved_by": mcp.Prop("string", "审批人"),
		}, []string{"order_id", "action", "approved_by"}),
	}, func(ctx context.Context, args json.RawMessage) *mcp.ToolCallResult {
		var p struct {
			OrderID    string `json:"order_id"`
			Action     string `json:"action"`
			ApprovedBy string `json:"approved_by"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return mcp.ErrorResult("参数解析失败: " + err.Error())
		}

		if err := pg.UpdatePurchaseStatus(ctx, d.PG, p.OrderID, p.Action, p.ApprovedBy); err != nil {
			return mcp.ErrorResult("审批失败: " + err.Error())
		}

		return mcp.TextResult(map[string]any{
			"success":  true,
			"order_id": p.OrderID,
			"status":   p.Action,
			"message":  fmt.Sprintf("采购单已%s", map[string]string{"APPROVED": "批准", "CANCELLED": "拒绝"}[p.Action]),
		})
	})
}
