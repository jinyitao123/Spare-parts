package rules

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"spareparts/internal/pg"
)

type Alert struct {
	Rule    string `json:"rule"`
	Level   string `json:"level"` // warning, danger, info
	Message string `json:"message"`
}

// CheckAfterMovement runs R01 (safety stock), R04 (high-value), R05 (frequency anomaly).
func CheckAfterMovement(ctx context.Context, pool *pgxpool.Pool, pos *pg.InventoryPosition, movementType string, equipmentID *string) []Alert {
	var alerts []Alert

	// R01: Safety stock warning
	if a := CheckSafetyStock(pos); a != nil {
		alerts = append(alerts, *a)
	}

	// R04: High-value interception (outbound only)
	if movementType == "OUT" {
		if a := CheckHighValue(pos); a != nil {
			alerts = append(alerts, *a)
		}
	}

	// R05: Frequency anomaly (outbound with equipment)
	if movementType == "OUT" && equipmentID != nil && *equipmentID != "" {
		if a := CheckAbnormalConsumption(ctx, pool, pos.SparePartID, *equipmentID); a != nil {
			alerts = append(alerts, *a)
		}
	}

	return alerts
}

// CheckSafetyStock implements R01.
func CheckSafetyStock(pos *pg.InventoryPosition) *Alert {
	gap := pos.SafetyStock - pos.AvailableQty
	if gap > 0 {
		return &Alert{
			Rule:  "R01",
			Level: "danger",
			Message: fmt.Sprintf("安全库存预警：%s 在 %s 当前可用%d个，安全库存%d个，缺口%d个",
				pos.SparePartName, pos.WarehouseName, pos.AvailableQty, pos.SafetyStock, gap),
		}
	}
	return nil
}

// CheckHighValue implements R04.
func CheckHighValue(pos *pg.InventoryPosition) *Alert {
	if pos.UnitPrice > 2000 {
		return &Alert{
			Rule:  "R04",
			Level: "warning",
			Message: fmt.Sprintf("高价值备件出库提醒：%s 单价%.0f元（>2000元），建议走审批流程并留存旧件",
				pos.SparePartName, pos.UnitPrice),
		}
	}
	return nil
}

// CheckAbnormalConsumption implements R05.
func CheckAbnormalConsumption(ctx context.Context, pool *pgxpool.Pool, partID, equipmentID string) *Alert {
	count, err := pg.CountRecentMovements(ctx, pool, partID, equipmentID, 30)
	if err != nil {
		return nil
	}
	if count >= 3 {
		return &Alert{
			Rule:  "R05",
			Level: "warning",
			Message: fmt.Sprintf("领用频次异常：该设备30天内领用此备件%d次（≥3次），建议安排根因排查", count),
		}
	}
	return nil
}
