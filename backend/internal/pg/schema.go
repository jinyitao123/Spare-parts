package pg

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

const ddl = `
CREATE SCHEMA IF NOT EXISTS spareparts;

-- Master data: spare parts catalog
CREATE TABLE IF NOT EXISTS spareparts.spare_parts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    specification TEXT,
    unit TEXT NOT NULL,
    criticality TEXT CHECK (criticality IN ('A','B','C')),
    default_safety_stock INT DEFAULT 2,
    typical_lead_time INT,
    lead_time_variance INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Master data: warehouses
CREATE TABLE IF NOT EXISTS spareparts.warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('PRIMARY','SECONDARY')),
    managed_by TEXT,
    belongs_to_section TEXT,
    has_safety_stock BOOLEAN DEFAULT true,
    target_value NUMERIC(14,2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Master data: equipment
CREATE TABLE IF NOT EXISTS spareparts.equipment (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT,
    status TEXT DEFAULT 'RUNNING' CHECK (status IN ('RUNNING','STOPPED','MAINTENANCE')),
    install_date DATE,
    last_maintenance_date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Core: inventory positions (the "first citizen")
CREATE TABLE IF NOT EXISTS spareparts.inventory_positions (
    id TEXT PRIMARY KEY,
    spare_part_id TEXT NOT NULL REFERENCES spareparts.spare_parts(id),
    warehouse_id TEXT NOT NULL REFERENCES spareparts.warehouses(id),
    current_qty INT NOT NULL DEFAULT 0,
    reserved_qty INT NOT NULL DEFAULT 0,
    unit_price NUMERIC(12,2) NOT NULL,
    safety_stock INT NOT NULL DEFAULT 2,
    last_movement_date DATE,
    last_consumed_date DATE,
    is_stale BOOLEAN DEFAULT false,
    data_source TEXT DEFAULT 'ERP_SYNC' CHECK (data_source IN ('ERP_SYNC','SCAN_REALTIME')),
    data_as_of TIMESTAMPTZ DEFAULT now(),
    UNIQUE (spare_part_id, warehouse_id)
);

-- BOM: equipment uses spare parts
CREATE TABLE IF NOT EXISTS spareparts.equipment_uses (
    equipment_id TEXT NOT NULL REFERENCES spareparts.equipment(id),
    spare_part_id TEXT NOT NULL REFERENCES spareparts.spare_parts(id),
    typical_qty INT DEFAULT 1,
    position_desc TEXT,
    PRIMARY KEY (equipment_id, spare_part_id)
);

-- Transactions: stock movements
CREATE TABLE IF NOT EXISTS spareparts.stock_movements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    position_id TEXT NOT NULL REFERENCES spareparts.inventory_positions(id),
    movement_type TEXT NOT NULL CHECK (movement_type IN ('IN','OUT','RETURN','SCRAP','TRANSFER')),
    movement_reason TEXT CHECK (movement_reason IN ('FAULT_REPAIR','MAINTENANCE','TECH_UPGRADE','PROJECT','SCRAP_RETURN','PURCHASE_ARRIVAL','OTHER')),
    quantity INT NOT NULL CHECK (quantity > 0),
    operator_id TEXT NOT NULL,
    equipment_id TEXT REFERENCES spareparts.equipment(id),
    fault_description TEXT,
    is_agent_verified BOOLEAN DEFAULT false,
    source TEXT DEFAULT 'AGENT' CHECK (source IN ('ERP_SYNC','SCAN','AGENT')),
    related_purchase_order_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movements_position ON spareparts.stock_movements(position_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON spareparts.stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_movements_equipment ON spareparts.stock_movements(equipment_id) WHERE equipment_id IS NOT NULL;

-- Transactions: purchase orders
CREATE TABLE IF NOT EXISTS spareparts.purchase_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    spare_part_id TEXT NOT NULL REFERENCES spareparts.spare_parts(id),
    quantity INT NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    total_amount NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','IN_TRANSIT','RECEIVED','CANCELLED')),
    source TEXT DEFAULT 'AGENT_SUGGESTED' CHECK (source IN ('MANUAL','AGENT_SUGGESTED')),
    urgency TEXT DEFAULT 'NORMAL' CHECK (urgency IN ('NORMAL','URGENT')),
    reason TEXT,
    approved_by TEXT,
    order_date DATE,
    expected_arrival_date DATE,
    actual_arrival_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_part ON spareparts.purchase_orders(spare_part_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON spareparts.purchase_orders(status);

-- Analytics: monthly inventory snapshots
CREATE TABLE IF NOT EXISTS spareparts.inventory_snapshots (
    id TEXT PRIMARY KEY,
    position_id TEXT NOT NULL REFERENCES spareparts.inventory_positions(id),
    snapshot_month TEXT NOT NULL,
    snapshot_qty INT NOT NULL,
    snapshot_value NUMERIC(14,2) NOT NULL,
    monthly_consumption INT NOT NULL DEFAULT 0,
    monthly_consumption_value NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (position_id, snapshot_month)
);
`

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, ddl)
	if err != nil {
		return fmt.Errorf("migrate pg schema: %w", err)
	}
	return nil
}
