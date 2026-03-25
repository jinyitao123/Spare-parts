package neo

import (
	"context"
	"fmt"
	"log"
)

var constraints = []string{
	`CREATE CONSTRAINT pos_id IF NOT EXISTS FOR (p:InventoryPosition) REQUIRE p.id IS UNIQUE`,
	`CREATE CONSTRAINT part_id IF NOT EXISTS FOR (s:SparePart) REQUIRE s.id IS UNIQUE`,
	`CREATE CONSTRAINT wh_id IF NOT EXISTS FOR (w:Warehouse) REQUIRE w.id IS UNIQUE`,
	`CREATE CONSTRAINT equip_id IF NOT EXISTS FOR (e:Equipment) REQUIRE e.id IS UNIQUE`,
	`CREATE CONSTRAINT movement_id IF NOT EXISTS FOR (m:StockMovement) REQUIRE m.id IS UNIQUE`,
	`CREATE CONSTRAINT po_id IF NOT EXISTS FOR (po:PurchaseOrder) REQUIRE po.id IS UNIQUE`,
}

var indexes = []string{
	`CREATE INDEX pos_stale IF NOT EXISTS FOR (p:InventoryPosition) ON (p.isStale)`,
	`CREATE INDEX pos_safety_gap IF NOT EXISTS FOR (p:InventoryPosition) ON (p.safetyGap)`,
	`CREATE INDEX part_category IF NOT EXISTS FOR (s:SparePart) ON (s.category)`,
	`CREATE INDEX part_criticality IF NOT EXISTS FOR (s:SparePart) ON (s.criticality)`,
	`CREATE INDEX wh_level IF NOT EXISTS FOR (w:Warehouse) ON (w.level)`,
	`CREATE INDEX movement_date IF NOT EXISTS FOR (m:StockMovement) ON (m.movementDate)`,
	`CREATE INDEX movement_type IF NOT EXISTS FOR (m:StockMovement) ON (m.movementType)`,
	`CREATE INDEX po_status IF NOT EXISTS FOR (po:PurchaseOrder) ON (po.status)`,
}

func (db *DB) Migrate(ctx context.Context) error {
	session := db.Session(ctx)
	defer session.Close(ctx)

	for _, c := range constraints {
		if _, err := session.Run(ctx, c, nil); err != nil {
			return fmt.Errorf("neo4j constraint: %w", err)
		}
	}
	for _, idx := range indexes {
		if _, err := session.Run(ctx, idx, nil); err != nil {
			return fmt.Errorf("neo4j index: %w", err)
		}
	}

	log.Println("neo4j: schema migration complete")
	return nil
}
