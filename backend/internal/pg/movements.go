package pg

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type StockMovement struct {
	ID                    string     `json:"id"`
	PositionID            string     `json:"position_id"`
	MovementType          string     `json:"movement_type"`
	MovementReason        *string    `json:"movement_reason,omitempty"`
	Quantity              int        `json:"quantity"`
	OperatorID            string     `json:"operator_id"`
	EquipmentID           *string    `json:"equipment_id,omitempty"`
	FaultDescription      *string    `json:"fault_description,omitempty"`
	IsAgentVerified       bool       `json:"is_agent_verified"`
	Source                string     `json:"source"`
	RelatedPurchaseOrder  *string    `json:"related_purchase_order_id,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
}

type CreateMovementParams struct {
	PositionID           string  `json:"position_id"`
	MovementType         string  `json:"movement_type"`
	MovementReason       *string `json:"movement_reason,omitempty"`
	Quantity             int     `json:"quantity"`
	OperatorID           string  `json:"operator_id"`
	EquipmentID          *string `json:"equipment_id,omitempty"`
	FaultDescription     *string `json:"fault_description,omitempty"`
	Source               string  `json:"source"`
	RelatedPurchaseOrder *string `json:"related_purchase_order_id,omitempty"`
}

func CreateMovement(ctx context.Context, pool *pgxpool.Pool, p CreateMovementParams) (*StockMovement, error) {
	if p.Source == "" {
		p.Source = "AGENT"
	}

	row := pool.QueryRow(ctx, `
		INSERT INTO spareparts.stock_movements
		  (position_id, movement_type, movement_reason, quantity, operator_id,
		   equipment_id, fault_description, source, related_purchase_order_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, position_id, movement_type, movement_reason, quantity, operator_id,
		          equipment_id, fault_description, is_agent_verified, source,
		          related_purchase_order_id, created_at
	`, p.PositionID, p.MovementType, p.MovementReason, p.Quantity, p.OperatorID,
		p.EquipmentID, p.FaultDescription, p.Source, p.RelatedPurchaseOrder)

	var m StockMovement
	err := row.Scan(
		&m.ID, &m.PositionID, &m.MovementType, &m.MovementReason, &m.Quantity, &m.OperatorID,
		&m.EquipmentID, &m.FaultDescription, &m.IsAgentVerified, &m.Source,
		&m.RelatedPurchaseOrder, &m.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create movement: %w", err)
	}
	return &m, nil
}

type MovementFilter struct {
	PositionID  string
	PartID      string
	EquipmentID string
	Type        string
	DaysBack    int
	Limit       int
}

func ListMovements(ctx context.Context, pool *pgxpool.Pool, f MovementFilter) ([]StockMovement, error) {
	query := `
		SELECT m.id, m.position_id, m.movement_type, m.movement_reason, m.quantity,
		       m.operator_id, m.equipment_id, m.fault_description, m.is_agent_verified,
		       m.source, m.related_purchase_order_id, m.created_at
		FROM spareparts.stock_movements m
	`
	if f.PartID != "" {
		query += ` JOIN spareparts.inventory_positions p ON p.id = m.position_id`
	}
	query += ` WHERE 1=1`

	args := []any{}
	n := 0

	if f.PositionID != "" {
		n++
		query += fmt.Sprintf(" AND m.position_id = $%d", n)
		args = append(args, f.PositionID)
	}
	if f.PartID != "" {
		n++
		query += fmt.Sprintf(" AND p.spare_part_id = $%d", n)
		args = append(args, f.PartID)
	}
	if f.EquipmentID != "" {
		n++
		query += fmt.Sprintf(" AND m.equipment_id = $%d", n)
		args = append(args, f.EquipmentID)
	}
	if f.Type != "" {
		n++
		query += fmt.Sprintf(" AND m.movement_type = $%d", n)
		args = append(args, f.Type)
	}
	if f.DaysBack > 0 {
		n++
		query += fmt.Sprintf(" AND m.created_at >= now() - interval '%d days'", f.DaysBack)
	}

	query += " ORDER BY m.created_at DESC"

	if f.Limit > 0 {
		n++
		query += fmt.Sprintf(" LIMIT $%d", n)
		args = append(args, f.Limit)
	} else {
		query += " LIMIT 100"
	}

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list movements: %w", err)
	}
	defer rows.Close()

	var result []StockMovement
	for rows.Next() {
		var m StockMovement
		if err := rows.Scan(
			&m.ID, &m.PositionID, &m.MovementType, &m.MovementReason, &m.Quantity,
			&m.OperatorID, &m.EquipmentID, &m.FaultDescription, &m.IsAgentVerified,
			&m.Source, &m.RelatedPurchaseOrder, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan movement: %w", err)
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

// CountRecentMovements counts outbound records for same equipment+part in last N days (for R05).
func CountRecentMovements(ctx context.Context, pool *pgxpool.Pool, partID, equipmentID string, days int) (int, error) {
	var count int
	err := pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM spareparts.stock_movements m
		JOIN spareparts.inventory_positions p ON p.id = m.position_id
		WHERE p.spare_part_id = $1
		  AND m.equipment_id = $2
		  AND m.movement_type = 'OUT'
		  AND m.created_at >= now() - make_interval(days => $3)
	`, partID, equipmentID, days).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count recent movements: %w", err)
	}
	return count, nil
}
