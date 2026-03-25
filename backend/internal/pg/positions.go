package pg

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type InventoryPosition struct {
	ID               string     `json:"id"`
	SparePartID      string     `json:"spare_part_id"`
	WarehouseID      string     `json:"warehouse_id"`
	CurrentQty       int        `json:"current_qty"`
	ReservedQty      int        `json:"reserved_qty"`
	UnitPrice        float64    `json:"unit_price"`
	SafetyStock      int        `json:"safety_stock"`
	LastMovementDate *time.Time `json:"last_movement_date,omitempty"`
	LastConsumedDate *time.Time `json:"last_consumed_date,omitempty"`
	IsStale          bool       `json:"is_stale"`
	DataSource       string     `json:"data_source"`
	DataAsOf         time.Time  `json:"data_as_of"`

	// Joined fields (populated by queries)
	SparePartName string  `json:"spare_part_name,omitempty"`
	Specification string  `json:"specification,omitempty"`
	Category      string  `json:"category,omitempty"`
	WarehouseName string  `json:"warehouse_name,omitempty"`
	WarehouseLevel string `json:"warehouse_level,omitempty"`

	// Derived
	AvailableQty   int     `json:"available_qty"`
	InventoryValue float64 `json:"inventory_value"`
	SafetyGap      int     `json:"safety_gap"`
}

func (p *InventoryPosition) ComputeDerived() {
	p.AvailableQty = p.CurrentQty - p.ReservedQty
	p.InventoryValue = float64(p.CurrentQty) * p.UnitPrice
	p.SafetyGap = p.SafetyStock - p.AvailableQty
}

func GetPositionByID(ctx context.Context, pool *pgxpool.Pool, id string) (*InventoryPosition, error) {
	row := pool.QueryRow(ctx, `
		SELECT p.id, p.spare_part_id, p.warehouse_id, p.current_qty, p.reserved_qty,
		       p.unit_price, p.safety_stock, p.last_movement_date, p.last_consumed_date,
		       p.is_stale, p.data_source, p.data_as_of,
		       sp.name, sp.specification, sp.category,
		       w.name, w.level
		FROM spareparts.inventory_positions p
		JOIN spareparts.spare_parts sp ON sp.id = p.spare_part_id
		JOIN spareparts.warehouses w ON w.id = p.warehouse_id
		WHERE p.id = $1
	`, id)

	var pos InventoryPosition
	err := row.Scan(
		&pos.ID, &pos.SparePartID, &pos.WarehouseID, &pos.CurrentQty, &pos.ReservedQty,
		&pos.UnitPrice, &pos.SafetyStock, &pos.LastMovementDate, &pos.LastConsumedDate,
		&pos.IsStale, &pos.DataSource, &pos.DataAsOf,
		&pos.SparePartName, &pos.Specification, &pos.Category,
		&pos.WarehouseName, &pos.WarehouseLevel,
	)
	if err != nil {
		return nil, fmt.Errorf("get position %s: %w", id, err)
	}
	pos.ComputeDerived()
	return &pos, nil
}

type PositionFilter struct {
	SparePartID string
	WarehouseID string
	IsStale     *bool
	GapOnly     bool // only positions with safetyGap > 0
}

func ListPositions(ctx context.Context, pool *pgxpool.Pool, f PositionFilter) ([]InventoryPosition, error) {
	query := `
		SELECT p.id, p.spare_part_id, p.warehouse_id, p.current_qty, p.reserved_qty,
		       p.unit_price, p.safety_stock, p.last_movement_date, p.last_consumed_date,
		       p.is_stale, p.data_source, p.data_as_of,
		       sp.name, sp.specification, sp.category,
		       w.name, w.level
		FROM spareparts.inventory_positions p
		JOIN spareparts.spare_parts sp ON sp.id = p.spare_part_id
		JOIN spareparts.warehouses w ON w.id = p.warehouse_id
		WHERE 1=1
	`
	args := []any{}
	n := 0

	if f.SparePartID != "" {
		n++
		query += fmt.Sprintf(" AND p.spare_part_id = $%d", n)
		args = append(args, f.SparePartID)
	}
	if f.WarehouseID != "" {
		n++
		query += fmt.Sprintf(" AND p.warehouse_id = $%d", n)
		args = append(args, f.WarehouseID)
	}
	if f.IsStale != nil {
		n++
		query += fmt.Sprintf(" AND p.is_stale = $%d", n)
		args = append(args, *f.IsStale)
	}
	if f.GapOnly {
		query += " AND (p.safety_stock - (p.current_qty - p.reserved_qty)) > 0"
	}

	query += " ORDER BY p.id"

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list positions: %w", err)
	}
	defer rows.Close()

	var result []InventoryPosition
	for rows.Next() {
		var pos InventoryPosition
		if err := rows.Scan(
			&pos.ID, &pos.SparePartID, &pos.WarehouseID, &pos.CurrentQty, &pos.ReservedQty,
			&pos.UnitPrice, &pos.SafetyStock, &pos.LastMovementDate, &pos.LastConsumedDate,
			&pos.IsStale, &pos.DataSource, &pos.DataAsOf,
			&pos.SparePartName, &pos.Specification, &pos.Category,
			&pos.WarehouseName, &pos.WarehouseLevel,
		); err != nil {
			return nil, fmt.Errorf("scan position: %w", err)
		}
		pos.ComputeDerived()
		result = append(result, pos)
	}
	return result, rows.Err()
}

func UpdatePositionQty(ctx context.Context, pool *pgxpool.Pool, id string, qtyDelta int, isOutbound bool) error {
	query := `
		UPDATE spareparts.inventory_positions
		SET current_qty = current_qty + $2,
		    last_movement_date = CURRENT_DATE,
		    data_as_of = now()
	`
	if isOutbound {
		query += `, last_consumed_date = CURRENT_DATE`
	}
	query += ` WHERE id = $1`

	tag, err := pool.Exec(ctx, query, id, qtyDelta)
	if err != nil {
		return fmt.Errorf("update position qty: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("position %s not found", id)
	}
	return nil
}

func UpdatePositionStale(ctx context.Context, pool *pgxpool.Pool, id string, isStale bool) error {
	_, err := pool.Exec(ctx,
		`UPDATE spareparts.inventory_positions SET is_stale = $2, data_as_of = now() WHERE id = $1`,
		id, isStale)
	return err
}
