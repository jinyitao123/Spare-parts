package pg

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type InventorySnapshot struct {
	ID                      string  `json:"id"`
	PositionID              string  `json:"position_id"`
	SnapshotMonth           string  `json:"snapshot_month"`
	SnapshotQty             int     `json:"snapshot_qty"`
	SnapshotValue           float64 `json:"snapshot_value"`
	MonthlyConsumption      int     `json:"monthly_consumption"`
	MonthlyConsumptionValue float64 `json:"monthly_consumption_value"`
}

func ListSnapshots(ctx context.Context, pool *pgxpool.Pool, positionID string, months int) ([]InventorySnapshot, error) {
	query := `
		SELECT id, position_id, snapshot_month, snapshot_qty, snapshot_value,
		       monthly_consumption, monthly_consumption_value
		FROM spareparts.inventory_snapshots
		WHERE position_id = $1
		ORDER BY snapshot_month DESC
		LIMIT $2
	`
	if months <= 0 {
		months = 12
	}

	rows, err := pool.Query(ctx, query, positionID, months)
	if err != nil {
		return nil, fmt.Errorf("list snapshots: %w", err)
	}
	defer rows.Close()

	var result []InventorySnapshot
	for rows.Next() {
		var s InventorySnapshot
		if err := rows.Scan(
			&s.ID, &s.PositionID, &s.SnapshotMonth, &s.SnapshotQty, &s.SnapshotValue,
			&s.MonthlyConsumption, &s.MonthlyConsumptionValue,
		); err != nil {
			return nil, fmt.Errorf("scan snapshot: %w", err)
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

// MonthlyValuePoint represents one month's total inventory value.
type MonthlyValuePoint struct {
	Month string  `json:"month"`
	Value float64 `json:"value"`
}

// GetMonthlyValueTrend returns total inventory value per month across all positions.
func GetMonthlyValueTrend(ctx context.Context, pool *pgxpool.Pool, months int) ([]MonthlyValuePoint, error) {
	if months <= 0 {
		months = 12
	}
	rows, err := pool.Query(ctx, `
		SELECT snapshot_month, SUM(snapshot_value) AS total_value
		FROM spareparts.inventory_snapshots
		GROUP BY snapshot_month
		ORDER BY snapshot_month ASC
		LIMIT $1
	`, months)
	if err != nil {
		return nil, fmt.Errorf("get monthly value trend: %w", err)
	}
	defer rows.Close()

	var result []MonthlyValuePoint
	for rows.Next() {
		var p MonthlyValuePoint
		if err := rows.Scan(&p.Month, &p.Value); err != nil {
			return nil, fmt.Errorf("scan monthly value: %w", err)
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

// TopConsumptionItem represents a part's aggregated consumption.
type TopConsumptionItem struct {
	PartID   string  `json:"part_id"`
	PartName string  `json:"part_name"`
	TotalQty int     `json:"total_qty"`
	TotalAmt float64 `json:"total_amount"`
}

// GetTopConsumption returns top N parts by recent out-movement quantity.
func GetTopConsumption(ctx context.Context, pool *pgxpool.Pool, days, limit int) ([]TopConsumptionItem, error) {
	if days <= 0 {
		days = 30
	}
	if limit <= 0 {
		limit = 10
	}
	rows, err := pool.Query(ctx, `
		SELECT p.spare_part_id, sp.name,
		       SUM(m.quantity) AS total_qty,
		       SUM(m.quantity * p.unit_price) AS total_amount
		FROM spareparts.stock_movements m
		JOIN spareparts.inventory_positions p ON p.id = m.position_id
		JOIN spareparts.spare_parts sp ON sp.id = p.spare_part_id
		WHERE m.movement_type = 'OUT'
		  AND m.created_at >= now() - make_interval(days => $1)
		GROUP BY p.spare_part_id, sp.name
		ORDER BY total_qty DESC
		LIMIT $2
	`, days, limit)
	if err != nil {
		return nil, fmt.Errorf("get top consumption: %w", err)
	}
	defer rows.Close()

	var result []TopConsumptionItem
	for rows.Next() {
		var item TopConsumptionItem
		if err := rows.Scan(&item.PartID, &item.PartName, &item.TotalQty, &item.TotalAmt); err != nil {
			return nil, fmt.Errorf("scan top consumption: %w", err)
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

// GetConsumptionTrend returns monthly consumption for a spare part across all positions.
func GetConsumptionTrend(ctx context.Context, pool *pgxpool.Pool, partID string, months int) ([]InventorySnapshot, error) {
	if months <= 0 {
		months = 12
	}

	rows, err := pool.Query(ctx, `
		SELECT s.snapshot_month,
		       SUM(s.snapshot_qty) AS total_qty,
		       SUM(s.snapshot_value) AS total_value,
		       SUM(s.monthly_consumption) AS total_consumption,
		       SUM(s.monthly_consumption_value) AS total_consumption_value
		FROM spareparts.inventory_snapshots s
		JOIN spareparts.inventory_positions p ON p.id = s.position_id
		WHERE p.spare_part_id = $1
		GROUP BY s.snapshot_month
		ORDER BY s.snapshot_month DESC
		LIMIT $2
	`, partID, months)
	if err != nil {
		return nil, fmt.Errorf("get consumption trend: %w", err)
	}
	defer rows.Close()

	var result []InventorySnapshot
	for rows.Next() {
		var s InventorySnapshot
		s.PositionID = partID // reuse field for part ID context
		if err := rows.Scan(
			&s.SnapshotMonth, &s.SnapshotQty, &s.SnapshotValue,
			&s.MonthlyConsumption, &s.MonthlyConsumptionValue,
		); err != nil {
			return nil, fmt.Errorf("scan trend: %w", err)
		}
		result = append(result, s)
	}
	return result, rows.Err()
}
