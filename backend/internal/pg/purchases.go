package pg

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PurchaseOrder struct {
	ID                  string     `json:"id"`
	SparePartID         string     `json:"spare_part_id"`
	Quantity            int        `json:"quantity"`
	UnitPrice           float64    `json:"unit_price"`
	TotalAmount         float64    `json:"total_amount"`
	Status              string     `json:"status"`
	Source              string     `json:"source"`
	Urgency             string     `json:"urgency"`
	Reason              *string    `json:"reason,omitempty"`
	ApprovedBy          *string    `json:"approved_by,omitempty"`
	OrderDate           *time.Time `json:"order_date,omitempty"`
	ExpectedArrivalDate *time.Time `json:"expected_arrival_date,omitempty"`
	ActualArrivalDate   *time.Time `json:"actual_arrival_date,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`

	// Joined
	SparePartName string `json:"spare_part_name,omitempty"`
}

type CreatePurchaseParams struct {
	SparePartID string  `json:"spare_part_id"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	Urgency     string  `json:"urgency"`
	Reason      string  `json:"reason"`
	Source      string  `json:"source"`
}

func CreatePurchaseOrder(ctx context.Context, pool *pgxpool.Pool, p CreatePurchaseParams) (*PurchaseOrder, error) {
	if p.Source == "" {
		p.Source = "AGENT_SUGGESTED"
	}
	if p.Urgency == "" {
		p.Urgency = "NORMAL"
	}

	row := pool.QueryRow(ctx, `
		INSERT INTO spareparts.purchase_orders
		  (spare_part_id, quantity, unit_price, urgency, reason, source)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, spare_part_id, quantity, unit_price, total_amount, status,
		          source, urgency, reason, approved_by, order_date,
		          expected_arrival_date, actual_arrival_date, created_at, updated_at
	`, p.SparePartID, p.Quantity, p.UnitPrice, p.Urgency, p.Reason, p.Source)

	var po PurchaseOrder
	err := row.Scan(
		&po.ID, &po.SparePartID, &po.Quantity, &po.UnitPrice, &po.TotalAmount, &po.Status,
		&po.Source, &po.Urgency, &po.Reason, &po.ApprovedBy, &po.OrderDate,
		&po.ExpectedArrivalDate, &po.ActualArrivalDate, &po.CreatedAt, &po.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create purchase order: %w", err)
	}
	return &po, nil
}

func ListPurchaseOrders(ctx context.Context, pool *pgxpool.Pool, status string) ([]PurchaseOrder, error) {
	query := `
		SELECT po.id, po.spare_part_id, po.quantity, po.unit_price, po.total_amount, po.status,
		       po.source, po.urgency, po.reason, po.approved_by, po.order_date,
		       po.expected_arrival_date, po.actual_arrival_date, po.created_at, po.updated_at,
		       sp.name
		FROM spareparts.purchase_orders po
		JOIN spareparts.spare_parts sp ON sp.id = po.spare_part_id
		WHERE 1=1
	`
	args := []any{}
	if status != "" {
		query += " AND po.status = $1"
		args = append(args, status)
	}
	query += " ORDER BY po.created_at DESC LIMIT 100"

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list purchase orders: %w", err)
	}
	defer rows.Close()

	var result []PurchaseOrder
	for rows.Next() {
		var po PurchaseOrder
		if err := rows.Scan(
			&po.ID, &po.SparePartID, &po.Quantity, &po.UnitPrice, &po.TotalAmount, &po.Status,
			&po.Source, &po.Urgency, &po.Reason, &po.ApprovedBy, &po.OrderDate,
			&po.ExpectedArrivalDate, &po.ActualArrivalDate, &po.CreatedAt, &po.UpdatedAt,
			&po.SparePartName,
		); err != nil {
			return nil, fmt.Errorf("scan purchase order: %w", err)
		}
		result = append(result, po)
	}
	return result, rows.Err()
}

func UpdatePurchaseStatus(ctx context.Context, pool *pgxpool.Pool, id, status, approvedBy string) error {
	_, err := pool.Exec(ctx, `
		UPDATE spareparts.purchase_orders
		SET status = $2, approved_by = $3, updated_at = now()
		WHERE id = $1
	`, id, status, approvedBy)
	return err
}
