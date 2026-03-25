package neo

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SyncAllStructure syncs all structure-layer nodes and edges from PG to Neo4j.
// Called on startup and when master data changes.
func (db *DB) SyncAllStructure(ctx context.Context, pool *pgxpool.Pool) error {
	if err := db.syncSpareParts(ctx, pool); err != nil {
		return err
	}
	if err := db.syncWarehouses(ctx, pool); err != nil {
		return err
	}
	if err := db.syncEquipment(ctx, pool); err != nil {
		return err
	}
	if err := db.syncPositions(ctx, pool); err != nil {
		return err
	}
	if err := db.syncEquipmentUses(ctx, pool); err != nil {
		return err
	}
	log.Println("neo4j: full structure sync complete")
	return nil
}

func (db *DB) syncSpareParts(ctx context.Context, pool *pgxpool.Pool) error {
	rows, err := pool.Query(ctx, `
		SELECT id, name, category, specification, unit, criticality,
		       default_safety_stock, typical_lead_time, lead_time_variance
		FROM spareparts.spare_parts
	`)
	if err != nil {
		return fmt.Errorf("query spare_parts: %w", err)
	}
	defer rows.Close()

	session := db.Session(ctx)
	defer session.Close(ctx)

	for rows.Next() {
		var id, name, category, unit string
		var specification, criticality *string
		var defaultSafetyStock, typicalLeadTime, leadTimeVariance *int

		if err := rows.Scan(&id, &name, &category, &specification, &unit, &criticality,
			&defaultSafetyStock, &typicalLeadTime, &leadTimeVariance); err != nil {
			return fmt.Errorf("scan spare_part: %w", err)
		}

		_, err := session.Run(ctx, `
			MERGE (s:SparePart {id: $id})
			SET s.name = $name, s.category = $category, s.specification = $specification,
			    s.unit = $unit, s.criticality = $criticality,
			    s.defaultSafetyStock = $defaultSafetyStock,
			    s.typicalLeadTime = $typicalLeadTime,
			    s.leadTimeVariance = $leadTimeVariance
		`, map[string]any{
			"id": id, "name": name, "category": category, "specification": specification,
			"unit": unit, "criticality": criticality, "defaultSafetyStock": defaultSafetyStock,
			"typicalLeadTime": typicalLeadTime, "leadTimeVariance": leadTimeVariance,
		})
		if err != nil {
			return fmt.Errorf("merge SparePart %s: %w", id, err)
		}
	}
	return rows.Err()
}

func (db *DB) syncWarehouses(ctx context.Context, pool *pgxpool.Pool) error {
	rows, err := pool.Query(ctx, `
		SELECT id, name, level, managed_by, belongs_to_section, has_safety_stock, target_value
		FROM spareparts.warehouses
	`)
	if err != nil {
		return fmt.Errorf("query warehouses: %w", err)
	}
	defer rows.Close()

	session := db.Session(ctx)
	defer session.Close(ctx)

	for rows.Next() {
		var id, name, level string
		var managedBy, belongsToSection *string
		var hasSafetyStock bool
		var targetValue *float64

		if err := rows.Scan(&id, &name, &level, &managedBy, &belongsToSection, &hasSafetyStock, &targetValue); err != nil {
			return fmt.Errorf("scan warehouse: %w", err)
		}

		_, err := session.Run(ctx, `
			MERGE (w:Warehouse {id: $id})
			SET w.name = $name, w.level = $level, w.managedBy = $managedBy,
			    w.belongsToSection = $belongsToSection, w.hasSafetyStock = $hasSafetyStock,
			    w.targetValue = $targetValue
		`, map[string]any{
			"id": id, "name": name, "level": level, "managedBy": managedBy,
			"belongsToSection": belongsToSection, "hasSafetyStock": hasSafetyStock,
			"targetValue": targetValue,
		})
		if err != nil {
			return fmt.Errorf("merge Warehouse %s: %w", id, err)
		}
	}
	return rows.Err()
}

func (db *DB) syncEquipment(ctx context.Context, pool *pgxpool.Pool) error {
	rows, err := pool.Query(ctx, `
		SELECT id, name, location, type, status, install_date::text, last_maintenance_date::text
		FROM spareparts.equipment
	`)
	if err != nil {
		return fmt.Errorf("query equipment: %w", err)
	}
	defer rows.Close()

	session := db.Session(ctx)
	defer session.Close(ctx)

	for rows.Next() {
		var id, name, location string
		var eType, status *string
		var installDate, lastMaintenanceDate *string

		if err := rows.Scan(&id, &name, &location, &eType, &status, &installDate, &lastMaintenanceDate); err != nil {
			return fmt.Errorf("scan equipment: %w", err)
		}

		_, err := session.Run(ctx, `
			MERGE (e:Equipment {id: $id})
			SET e.name = $name, e.location = $location, e.type = $type,
			    e.status = $status, e.installDate = $installDate,
			    e.lastMaintenanceDate = $lastMaintenanceDate
		`, map[string]any{
			"id": id, "name": name, "location": location, "type": eType,
			"status": status, "installDate": installDate,
			"lastMaintenanceDate": lastMaintenanceDate,
		})
		if err != nil {
			return fmt.Errorf("merge Equipment %s: %w", id, err)
		}
	}
	return rows.Err()
}

func (db *DB) syncPositions(ctx context.Context, pool *pgxpool.Pool) error {
	rows, err := pool.Query(ctx, `
		SELECT id, spare_part_id, warehouse_id, current_qty, reserved_qty,
		       unit_price, safety_stock, last_movement_date::text, last_consumed_date::text,
		       is_stale, data_source
		FROM spareparts.inventory_positions
	`)
	if err != nil {
		return fmt.Errorf("query positions: %w", err)
	}
	defer rows.Close()

	session := db.Session(ctx)
	defer session.Close(ctx)

	for rows.Next() {
		var id, partID, whID, dataSource string
		var currentQty, reservedQty, safetyStock int
		var unitPrice float64
		var lastMovementDate, lastConsumedDate *string
		var isStale bool

		if err := rows.Scan(&id, &partID, &whID, &currentQty, &reservedQty,
			&unitPrice, &safetyStock, &lastMovementDate, &lastConsumedDate,
			&isStale, &dataSource); err != nil {
			return fmt.Errorf("scan position: %w", err)
		}

		availableQty := currentQty - reservedQty
		safetyGap := safetyStock - availableQty
		inventoryValue := float64(currentQty) * unitPrice

		_, err := session.Run(ctx, `
			MERGE (p:InventoryPosition {id: $id})
			SET p.sparePartId = $partID, p.warehouseId = $whID,
			    p.currentQty = $currentQty, p.reservedQty = $reservedQty,
			    p.availableQty = $availableQty, p.unitPrice = $unitPrice,
			    p.inventoryValue = $inventoryValue,
			    p.safetyStock = $safetyStock, p.safetyGap = $safetyGap,
			    p.isStale = $isStale, p.lastMovementDate = $lastMovementDate,
			    p.lastConsumedDate = $lastConsumedDate, p.dataSource = $dataSource
			WITH p
			MATCH (s:SparePart {id: $partID})
			MERGE (p)-[:TRACKS]->(s)
			WITH p
			MATCH (w:Warehouse {id: $whID})
			MERGE (p)-[:LOCATED_IN]->(w)
		`, map[string]any{
			"id": id, "partID": partID, "whID": whID,
			"currentQty": currentQty, "reservedQty": reservedQty,
			"availableQty": availableQty, "unitPrice": unitPrice,
			"inventoryValue": inventoryValue,
			"safetyStock": safetyStock, "safetyGap": safetyGap,
			"isStale": isStale, "lastMovementDate": lastMovementDate,
			"lastConsumedDate": lastConsumedDate, "dataSource": dataSource,
		})
		if err != nil {
			return fmt.Errorf("merge Position %s: %w", id, err)
		}
	}
	return rows.Err()
}

func (db *DB) syncEquipmentUses(ctx context.Context, pool *pgxpool.Pool) error {
	rows, err := pool.Query(ctx, `
		SELECT equipment_id, spare_part_id, typical_qty, position_desc
		FROM spareparts.equipment_uses
	`)
	if err != nil {
		return fmt.Errorf("query equipment_uses: %w", err)
	}
	defer rows.Close()

	session := db.Session(ctx)
	defer session.Close(ctx)

	for rows.Next() {
		var equipID, partID string
		var typicalQty int
		var positionDesc *string

		if err := rows.Scan(&equipID, &partID, &typicalQty, &positionDesc); err != nil {
			return fmt.Errorf("scan equipment_uses: %w", err)
		}

		_, err := session.Run(ctx, `
			MATCH (e:Equipment {id: $equipID})
			MATCH (s:SparePart {id: $partID})
			MERGE (e)-[r:USES]->(s)
			SET r.typicalQty = $typicalQty, r.position = $positionDesc
		`, map[string]any{
			"equipID": equipID, "partID": partID,
			"typicalQty": typicalQty, "positionDesc": positionDesc,
		})
		if err != nil {
			return fmt.Errorf("merge USES %s->%s: %w", equipID, partID, err)
		}
	}
	return rows.Err()
}

// SyncPositionStatus syncs a single position's status to Neo4j (after movement).
func (db *DB) SyncPositionStatus(ctx context.Context, pool *pgxpool.Pool, positionID string) error {
	var currentQty, reservedQty, safetyStock int
	var unitPrice float64
	var lastMovementDate, lastConsumedDate *string
	var isStale bool

	err := pool.QueryRow(ctx, `
		SELECT current_qty, reserved_qty, unit_price, safety_stock,
		       last_movement_date::text, last_consumed_date::text, is_stale
		FROM spareparts.inventory_positions WHERE id = $1
	`, positionID).Scan(&currentQty, &reservedQty, &unitPrice, &safetyStock,
		&lastMovementDate, &lastConsumedDate, &isStale)
	if err != nil {
		return fmt.Errorf("read position %s: %w", positionID, err)
	}

	availableQty := currentQty - reservedQty
	safetyGap := safetyStock - availableQty
	inventoryValue := float64(currentQty) * unitPrice

	return db.Write(ctx, `
		MATCH (p:InventoryPosition {id: $id})
		SET p.currentQty = $currentQty, p.reservedQty = $reservedQty,
		    p.availableQty = $availableQty, p.unitPrice = $unitPrice,
		    p.inventoryValue = $inventoryValue,
		    p.safetyStock = $safetyStock, p.safetyGap = $safetyGap,
		    p.isStale = $isStale, p.lastMovementDate = $lastMovementDate,
		    p.lastConsumedDate = $lastConsumedDate
	`, map[string]any{
		"id": positionID, "currentQty": currentQty, "reservedQty": reservedQty,
		"availableQty": availableQty, "unitPrice": unitPrice,
		"inventoryValue": inventoryValue, "safetyStock": safetyStock,
		"safetyGap": safetyGap, "isStale": isStale,
		"lastMovementDate": lastMovementDate, "lastConsumedDate": lastConsumedDate,
	})
}

// SyncMovementEvent creates a StockMovement event node in Neo4j with edges.
func (db *DB) SyncMovementEvent(ctx context.Context, movementID, positionID string, equipmentID *string, movementType, movementReason string, quantity int) error {
	cypher := `
		MERGE (m:StockMovement:Event {id: $mID})
		SET m.movementType = $type, m.movementReason = $reason,
		    m.quantity = $qty, m.movementDate = date()
		WITH m
		MATCH (p:InventoryPosition {id: $posID})
		MERGE (m)-[:AFFECTS]->(p)
	`
	params := map[string]any{
		"mID": movementID, "posID": positionID,
		"type": movementType, "reason": movementReason, "qty": quantity,
	}

	if equipmentID != nil && *equipmentID != "" {
		cypher += `
		WITH m
		MATCH (e:Equipment {id: $equipID})
		MERGE (m)-[:CONSUMED_BY]->(e)
		`
		params["equipID"] = *equipmentID
	}

	return db.Write(ctx, cypher, params)
}
