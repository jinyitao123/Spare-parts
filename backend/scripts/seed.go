// +build ignore

package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	ctx := context.Background()
	pgURL := os.Getenv("PG_URL")
	if pgURL == "" {
		pgURL = "postgres://weave:weave@localhost:5432/weave?sslmode=disable"
	}

	pool, err := pgxpool.New(ctx, pgURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	// Run schema first
	if _, err := pool.Exec(ctx, schemaDDL); err != nil {
		log.Fatalf("schema: %v", err)
	}
	log.Println("schema created")

	// Seed spare parts
	for _, q := range spareParts {
		if _, err := pool.Exec(ctx, q); err != nil {
			log.Printf("spare_part: %v", err)
		}
	}
	log.Println("spare_parts seeded")

	// Seed warehouses
	for _, q := range warehouses {
		if _, err := pool.Exec(ctx, q); err != nil {
			log.Printf("warehouse: %v", err)
		}
	}
	log.Println("warehouses seeded")

	// Seed equipment
	for _, q := range equipment {
		if _, err := pool.Exec(ctx, q); err != nil {
			log.Printf("equipment: %v", err)
		}
	}
	log.Println("equipment seeded")

	// Seed positions
	for _, q := range positions {
		if _, err := pool.Exec(ctx, q); err != nil {
			log.Printf("position: %v", err)
		}
	}
	log.Println("positions seeded")

	// Seed equipment_uses
	for _, q := range equipmentUses {
		if _, err := pool.Exec(ctx, q); err != nil {
			log.Printf("equipment_uses: %v", err)
		}
	}
	log.Println("equipment_uses seeded")

	// Seed stock movements
	for _, q := range movements {
		if _, err := pool.Exec(ctx, q); err != nil {
			log.Printf("movement: %v", err)
		}
	}
	log.Println("movements seeded")

	// Seed purchase orders
	for _, q := range purchaseOrders {
		if _, err := pool.Exec(ctx, q); err != nil {
			log.Printf("purchase: %v", err)
		}
	}
	log.Println("purchases seeded")

	// Seed snapshots — generate for ALL positions
	seedSnapshots(ctx, pool)
	log.Println("snapshots seeded")

	fmt.Println("✅ Seed complete!")
}

const schemaDDL = `
CREATE SCHEMA IF NOT EXISTS spareparts;

CREATE TABLE IF NOT EXISTS spareparts.spare_parts (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
    specification TEXT, unit TEXT NOT NULL,
    criticality TEXT CHECK (criticality IN ('A','B','C')),
    default_safety_stock INT DEFAULT 2, typical_lead_time INT,
    lead_time_variance INT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spareparts.warehouses (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('PRIMARY','SECONDARY')),
    managed_by TEXT, belongs_to_section TEXT,
    has_safety_stock BOOLEAN DEFAULT true,
    target_value NUMERIC(14,2), created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spareparts.equipment (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT NOT NULL,
    type TEXT, status TEXT DEFAULT 'RUNNING',
    install_date DATE, last_maintenance_date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spareparts.inventory_positions (
    id TEXT PRIMARY KEY, spare_part_id TEXT NOT NULL REFERENCES spareparts.spare_parts(id),
    warehouse_id TEXT NOT NULL REFERENCES spareparts.warehouses(id),
    current_qty INT NOT NULL DEFAULT 0, reserved_qty INT NOT NULL DEFAULT 0,
    unit_price NUMERIC(12,2) NOT NULL, safety_stock INT NOT NULL DEFAULT 2,
    last_movement_date DATE, last_consumed_date DATE,
    is_stale BOOLEAN DEFAULT false,
    data_source TEXT DEFAULT 'ERP_SYNC',
    data_as_of TIMESTAMPTZ DEFAULT now(),
    UNIQUE (spare_part_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS spareparts.equipment_uses (
    equipment_id TEXT NOT NULL REFERENCES spareparts.equipment(id),
    spare_part_id TEXT NOT NULL REFERENCES spareparts.spare_parts(id),
    typical_qty INT DEFAULT 1, position_desc TEXT,
    PRIMARY KEY (equipment_id, spare_part_id)
);

CREATE TABLE IF NOT EXISTS spareparts.stock_movements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    position_id TEXT NOT NULL REFERENCES spareparts.inventory_positions(id),
    movement_type TEXT NOT NULL, movement_reason TEXT,
    quantity INT NOT NULL CHECK (quantity > 0),
    operator_id TEXT NOT NULL, equipment_id TEXT REFERENCES spareparts.equipment(id),
    fault_description TEXT, is_agent_verified BOOLEAN DEFAULT false,
    source TEXT DEFAULT 'AGENT', related_purchase_order_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spareparts.purchase_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    spare_part_id TEXT NOT NULL REFERENCES spareparts.spare_parts(id),
    quantity INT NOT NULL, unit_price NUMERIC(12,2) NOT NULL,
    total_amount NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    status TEXT NOT NULL DEFAULT 'DRAFT', source TEXT DEFAULT 'AGENT_SUGGESTED',
    urgency TEXT DEFAULT 'NORMAL', reason TEXT, approved_by TEXT,
    order_date DATE, expected_arrival_date DATE, actual_arrival_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spareparts.inventory_snapshots (
    id TEXT PRIMARY KEY, position_id TEXT NOT NULL REFERENCES spareparts.inventory_positions(id),
    snapshot_month TEXT NOT NULL, snapshot_qty INT NOT NULL,
    snapshot_value NUMERIC(14,2) NOT NULL,
    monthly_consumption INT NOT NULL DEFAULT 0,
    monthly_consumption_value NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (position_id, snapshot_month)
);
`

var spareParts = []string{
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0421', '6205轴承', '25×52×15mm', '轴承', '个', 'B', 2, 14) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0422', '6205-2RS密封型轴承', '25×52×15mm', '轴承', '个', 'B', 2, 14) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0535', 'X型变频器', '380V/5.5kW', '变频器', '台', 'A', 3, 30) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0891', 'PLC模块', 'S7-1500', '控制器', '块', 'A', 2, 90) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0156', '温度传感器', 'PT100/4-20mA', '传感器', '个', 'B', 2, 7) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0233', '密封圈', 'DN50/EPDM', '密封件', '个', 'C', 2, 5) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0344', '线缆', 'RVV3×2.5', '线缆', '米', 'C', 2, 3) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0455', '滤芯', 'HX-160×10', '过滤器', '个', 'C', 2, 7) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0567', '轴承油脂', 'SKF LGMT3/1', '润滑', '桶', 'C', 2, 5) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0678', '接近开关', 'M12/NPN/10mm', '传感器', '个', 'B', 2, 7) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0789', '继电器', '24VDC/10A', '电气', '个', 'B', 2, 5) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0890', '旧型PLC模块', 'S7-300/CPU315', '控制器', '块', 'A', 0, 120) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0901', 'Y型阀门', 'DN80/PN16', '阀门', '个', 'B', 1, 14) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-0912', '进口PLC模块', 'AB/1756-L72', '控制器', '块', 'A', 2, 90) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-1001', '电磁阀', '4V210-08', '阀门', '个', 'B', 2, 7) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.spare_parts (id, name, specification, category, unit, criticality, default_safety_stock, typical_lead_time) VALUES ('BJ-1002', '气缸', 'SC50×100', '气动', '个', 'B', 2, 10) ON CONFLICT (id) DO NOTHING`,
}

var warehouses = []string{
	`INSERT INTO spareparts.warehouses (id, name, level, managed_by, has_safety_stock, target_value) VALUES ('WH-PRIMARY', '一级总库', 'PRIMARY', '工段长', true, 5600000) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.warehouses (id, name, level, managed_by, belongs_to_section, has_safety_stock) VALUES ('WH-SEC-A', '二级库-工段A', 'SECONDARY', '库管员', '工段A', false) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.warehouses (id, name, level, managed_by, belongs_to_section, has_safety_stock) VALUES ('WH-SEC-B', '二级库-工段B', 'SECONDARY', '库管员', '工段B', false) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.warehouses (id, name, level, managed_by, belongs_to_section, has_safety_stock) VALUES ('WH-SEC-C', '二级库-工段C', 'SECONDARY', '库管员', '工段C', false) ON CONFLICT (id) DO NOTHING`,
}

var equipment = []string{
	`INSERT INTO spareparts.equipment (id, name, location, type, status) VALUES ('EQ-L1-MOTOR', '1号线电机', '1号线', '电机', 'RUNNING') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.equipment (id, name, location, type, status) VALUES ('EQ-L2-SPINDLE', '2号线主轴', '2号线', '主轴', 'RUNNING') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.equipment (id, name, location, type, status) VALUES ('EQ-L3-MOTOR', '3号线电机', '3号线', '电机', 'RUNNING') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.equipment (id, name, location, type, status) VALUES ('EQ-L1-PACK', '1号线包装机', '1号线', '包装机', 'RUNNING') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.equipment (id, name, location, type, status) VALUES ('EQ-L2-CONV', '2号线传送带', '2号线', '传送带', 'RUNNING') ON CONFLICT (id) DO NOTHING`,
}

var positions = []string{
	// BJ-0421 6205轴承 (4 warehouses)
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, last_consumed_date) VALUES ('WH-PRIMARY_BJ-0421', 'BJ-0421', 'WH-PRIMARY', 28, 200, 10, '2026-03-19', '2026-03-19') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, last_consumed_date, data_source) VALUES ('WH-SEC-A_BJ-0421', 'BJ-0421', 'WH-SEC-A', 2, 200, 2, '2026-03-19', '2026-03-19', 'SCAN_REALTIME') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, last_consumed_date, data_source) VALUES ('WH-SEC-B_BJ-0421', 'BJ-0421', 'WH-SEC-B', 0, 200, 2, '2026-03-15', '2026-03-15', 'SCAN_REALTIME') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, last_consumed_date, data_source) VALUES ('WH-SEC-C_BJ-0421', 'BJ-0421', 'WH-SEC-C', 3, 200, 2, '2026-03-18', '2026-03-18', 'SCAN_REALTIME') ON CONFLICT (id) DO NOTHING`,
	// BJ-0422 stale
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, is_stale) VALUES ('WH-PRIMARY_BJ-0422', 'BJ-0422', 'WH-PRIMARY', 1, 180, 2, '2025-01-05', true) ON CONFLICT (id) DO NOTHING`,
	// BJ-0535 X型变频器
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, last_consumed_date) VALUES ('WH-PRIMARY_BJ-0535', 'BJ-0535', 'WH-PRIMARY', 8, 8000, 3, '2026-03-10', '2026-03-10') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, last_consumed_date, data_source) VALUES ('WH-SEC-A_BJ-0535', 'BJ-0535', 'WH-SEC-A', 5, 8000, 2, '2026-03-18', '2026-03-18', 'SCAN_REALTIME') ON CONFLICT (id) DO NOTHING`,
	// BJ-0891 PLC
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date) VALUES ('WH-PRIMARY_BJ-0891', 'BJ-0891', 'WH-PRIMARY', 2, 82000, 2, '2026-02-20') ON CONFLICT (id) DO NOTHING`,
	// BJ-0156 温度传感器
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, last_consumed_date) VALUES ('WH-PRIMARY_BJ-0156', 'BJ-0156', 'WH-PRIMARY', 15, 200, 5, '2026-03-19', '2026-03-19') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, last_consumed_date, data_source) VALUES ('WH-SEC-A_BJ-0156', 'BJ-0156', 'WH-SEC-A', 8, 200, 2, '2026-03-19', '2026-03-19', 'SCAN_REALTIME') ON CONFLICT (id) DO NOTHING`,
	// BJ-0233 密封圈
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, last_consumed_date) VALUES ('WH-PRIMARY_BJ-0233', 'BJ-0233', 'WH-PRIMARY', 50, 30, 20, '2026-03-17', '2026-03-17') ON CONFLICT (id) DO NOTHING`,
	// BJ-0344 线缆
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date) VALUES ('WH-PRIMARY_BJ-0344', 'BJ-0344', 'WH-PRIMARY', 200, 50, 50, '2026-03-12') ON CONFLICT (id) DO NOTHING`,
	// BJ-0455 滤芯
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, last_consumed_date) VALUES ('WH-PRIMARY_BJ-0455', 'BJ-0455', 'WH-PRIMARY', 12, 150, 5, '2026-03-15', '2026-03-15') ON CONFLICT (id) DO NOTHING`,
	// BJ-0567 轴承油脂
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date) VALUES ('WH-PRIMARY_BJ-0567', 'BJ-0567', 'WH-PRIMARY', 5, 400, 2, '2026-03-01') ON CONFLICT (id) DO NOTHING`,
	// BJ-0678 接近开关
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, last_consumed_date) VALUES ('WH-PRIMARY_BJ-0678', 'BJ-0678', 'WH-PRIMARY', 10, 120, 3, '2026-03-16', '2026-03-16') ON CONFLICT (id) DO NOTHING`,
	// BJ-0789 继电器
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date) VALUES ('WH-PRIMARY_BJ-0789', 'BJ-0789', 'WH-PRIMARY', 20, 85, 5, '2026-03-14') ON CONFLICT (id) DO NOTHING`,
	// Stale items
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, is_stale) VALUES ('WH-PRIMARY_BJ-0890', 'BJ-0890', 'WH-PRIMARY', 1, 65000, 0, '2024-01-15', true) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, is_stale) VALUES ('WH-PRIMARY_BJ-0901', 'BJ-0901', 'WH-PRIMARY', 3, 1500, 1, '2024-11-20', true) ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, is_stale) VALUES ('WH-PRIMARY_BJ-0912', 'BJ-0912', 'WH-PRIMARY', 2, 80000, 2, '2024-09-10', true) ON CONFLICT (id) DO NOTHING`,
	// BJ-1001 电磁阀
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date, last_consumed_date) VALUES ('WH-PRIMARY_BJ-1001', 'BJ-1001', 'WH-PRIMARY', 8, 280, 3, '2026-03-18', '2026-03-18') ON CONFLICT (id) DO NOTHING`,
	// BJ-1002 气缸
	`INSERT INTO spareparts.inventory_positions (id, spare_part_id, warehouse_id, current_qty, unit_price, safety_stock, last_movement_date) VALUES ('WH-PRIMARY_BJ-1002', 'BJ-1002', 'WH-PRIMARY', 6, 350, 2, '2026-03-10') ON CONFLICT (id) DO NOTHING`,
}

var equipmentUses = []string{
	// 3号线电机 uses 6205轴承, 温度传感器, 密封圈
	`INSERT INTO spareparts.equipment_uses (equipment_id, spare_part_id, typical_qty, position_desc) VALUES ('EQ-L3-MOTOR', 'BJ-0421', 2, '主轴承') ON CONFLICT DO NOTHING`,
	`INSERT INTO spareparts.equipment_uses (equipment_id, spare_part_id, typical_qty, position_desc) VALUES ('EQ-L3-MOTOR', 'BJ-0156', 1, '外壳温度') ON CONFLICT DO NOTHING`,
	`INSERT INTO spareparts.equipment_uses (equipment_id, spare_part_id, typical_qty, position_desc) VALUES ('EQ-L3-MOTOR', 'BJ-0233', 2, '端盖密封') ON CONFLICT DO NOTHING`,
	// 1号线电机 uses 6205轴承, 温度传感器
	`INSERT INTO spareparts.equipment_uses (equipment_id, spare_part_id, typical_qty, position_desc) VALUES ('EQ-L1-MOTOR', 'BJ-0421', 2, '主轴承') ON CONFLICT DO NOTHING`,
	`INSERT INTO spareparts.equipment_uses (equipment_id, spare_part_id, typical_qty, position_desc) VALUES ('EQ-L1-MOTOR', 'BJ-0156', 1, '外壳温度') ON CONFLICT DO NOTHING`,
	// 2号线主轴 uses X型变频器
	`INSERT INTO spareparts.equipment_uses (equipment_id, spare_part_id, typical_qty, position_desc) VALUES ('EQ-L2-SPINDLE', 'BJ-0535', 1, '变频驱动') ON CONFLICT DO NOTHING`,
	// 1号线包装机 uses 接近开关, 继电器
	`INSERT INTO spareparts.equipment_uses (equipment_id, spare_part_id, typical_qty, position_desc) VALUES ('EQ-L1-PACK', 'BJ-0678', 2, '位置检测') ON CONFLICT DO NOTHING`,
	`INSERT INTO spareparts.equipment_uses (equipment_id, spare_part_id, typical_qty, position_desc) VALUES ('EQ-L1-PACK', 'BJ-0789', 4, '控制继电器') ON CONFLICT DO NOTHING`,
	// 2号线传送带 uses 6205轴承, 接近开关
	`INSERT INTO spareparts.equipment_uses (equipment_id, spare_part_id, typical_qty, position_desc) VALUES ('EQ-L2-CONV', 'BJ-0421', 4, '滚筒轴承') ON CONFLICT DO NOTHING`,
	`INSERT INTO spareparts.equipment_uses (equipment_id, spare_part_id, typical_qty, position_desc) VALUES ('EQ-L2-CONV', 'BJ-0678', 3, '位置检测') ON CONFLICT DO NOTHING`,
}

var movements = []string{
	`INSERT INTO spareparts.stock_movements (id, position_id, movement_type, movement_reason, quantity, operator_id, equipment_id, created_at) VALUES ('M001', 'WH-SEC-A_BJ-0421', 'OUT', 'FAULT_REPAIR', 1, 'zhang', 'EQ-L3-MOTOR', '2026-03-19 14:23:00+08') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.stock_movements (id, position_id, movement_type, quantity, operator_id, created_at) VALUES ('M002', 'WH-PRIMARY_BJ-0156', 'OUT', 2, 'li', '2026-03-19 09:45:00+08') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.stock_movements (id, position_id, movement_type, movement_reason, quantity, operator_id, created_at) VALUES ('M003', 'WH-PRIMARY_BJ-0535', 'IN', 'PURCHASE_ARRIVAL', 3, 'wang', '2026-03-18 16:00:00+08') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.stock_movements (id, position_id, movement_type, movement_reason, quantity, operator_id, created_at) VALUES ('M004', 'WH-PRIMARY_BJ-0233', 'RETURN', 'OTHER', 5, 'zhang', '2026-03-18 11:20:00+08') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.stock_movements (id, position_id, movement_type, movement_reason, quantity, operator_id, equipment_id, created_at) VALUES ('M005', 'WH-PRIMARY_BJ-0421', 'OUT', 'MAINTENANCE', 2, 'zhao', 'EQ-L1-MOTOR', '2026-03-18 08:30:00+08') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.stock_movements (id, position_id, movement_type, movement_reason, quantity, operator_id, equipment_id, created_at) VALUES ('M006', 'WH-PRIMARY_BJ-0535', 'OUT', 'FAULT_REPAIR', 1, 'zhang', 'EQ-L2-SPINDLE', '2026-03-17 15:10:00+08') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.stock_movements (id, position_id, movement_type, movement_reason, quantity, operator_id, created_at) VALUES ('M007', 'WH-PRIMARY_BJ-0156', 'IN', 'PURCHASE_ARRIVAL', 10, 'wang', '2026-03-17 10:00:00+08') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.stock_movements (id, position_id, movement_type, movement_reason, quantity, operator_id, equipment_id, created_at) VALUES ('M008', 'WH-PRIMARY_BJ-0678', 'OUT', 'FAULT_REPAIR', 1, 'li', 'EQ-L1-PACK', '2026-03-16 14:50:00+08') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.stock_movements (id, position_id, movement_type, movement_reason, quantity, operator_id, equipment_id, created_at) VALUES ('M009', 'WH-SEC-A_BJ-0421', 'OUT', 'FAULT_REPAIR', 1, 'zhang', 'EQ-L3-MOTOR', '2026-03-16 09:20:00+08') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.stock_movements (id, position_id, movement_type, movement_reason, quantity, operator_id, created_at) VALUES ('M010', 'WH-PRIMARY_BJ-0789', 'SCRAP', 'OTHER', 3, 'wang', '2026-03-15 16:30:00+08') ON CONFLICT (id) DO NOTHING`,
}

var purchaseOrders = []string{
	`INSERT INTO spareparts.purchase_orders (id, spare_part_id, quantity, unit_price, urgency, reason, source) VALUES ('P001', 'BJ-0421', 10, 200, 'NORMAL', '常规补货——本月消耗较大，二级库B已断货', 'AGENT_SUGGESTED') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.purchase_orders (id, spare_part_id, quantity, unit_price, urgency, reason, source) VALUES ('P002', 'BJ-0156', 5, 200, 'NORMAL', '常规补货', 'AGENT_SUGGESTED') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.purchase_orders (id, spare_part_id, quantity, unit_price, urgency, reason, source) VALUES ('P003', 'BJ-0535', 2, 8000, 'URGENT', '3号线故障频次上升，加急备货', 'AGENT_SUGGESTED') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.purchase_orders (id, spare_part_id, quantity, unit_price, urgency, reason, source) VALUES ('P004', 'BJ-0891', 1, 82000, 'URGENT', '当前库存=安全库存，采购周期90天，断货风险较高', 'AGENT_SUGGESTED') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.purchase_orders (id, spare_part_id, quantity, unit_price, urgency, reason, source) VALUES ('P005', 'BJ-0233', 20, 30, 'NORMAL', '常规补货', 'AGENT_SUGGESTED') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.purchase_orders (id, spare_part_id, quantity, unit_price, urgency, reason, source) VALUES ('P006', 'BJ-0344', 50, 50, 'NORMAL', '常规补货', 'AGENT_SUGGESTED') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.purchase_orders (id, spare_part_id, quantity, unit_price, urgency, reason, source) VALUES ('P007', 'BJ-0455', 8, 150, 'NORMAL', '常规补货', 'AGENT_SUGGESTED') ON CONFLICT (id) DO NOTHING`,
	`INSERT INTO spareparts.purchase_orders (id, spare_part_id, quantity, unit_price, urgency, reason, source) VALUES ('P008', 'BJ-0567', 2, 400, 'NORMAL', '常规补货', 'AGENT_SUGGESTED') ON CONFLICT (id) DO NOTHING`,
}

// seedSnapshots generates 6 months of snapshot data for all inventory positions.
// Total value trend: ~920万 → 895万 → 870万 → 852万 → 839万 → current (~531420).
// Each position gets a proportional share based on its current value.
func seedSnapshots(ctx context.Context, pool *pgxpool.Pool) {
	months := []string{"2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"}
	// Scaling factors: declining from ~1.73x to 1.0x current value over 6 months
	// Produces trend: ~92万 → 85万 → 78万 → 72万 → 62万 → 53万
	scales := []float64{1.73, 1.60, 1.47, 1.35, 1.17, 1.0}

	// Monthly consumption as fraction of stock
	consumptionRates := []float64{0.15, 0.12, 0.18, 0.13, 0.11, 0.10}

	// Read all positions
	rows, err := pool.Query(ctx, `SELECT id, current_qty, unit_price FROM spareparts.inventory_positions`)
	if err != nil {
		log.Printf("snapshot: query positions: %v", err)
		return
	}
	defer rows.Close()

	type pos struct {
		id       string
		qty      int
		price    float64
	}
	var positions []pos
	for rows.Next() {
		var p pos
		if err := rows.Scan(&p.id, &p.qty, &p.price); err != nil {
			log.Printf("snapshot: scan: %v", err)
			continue
		}
		positions = append(positions, p)
	}

	for _, p := range positions {
		for i, m := range months {
			snapQty := int(float64(p.qty) * scales[i])
			if snapQty < 0 {
				snapQty = 0
			}
			snapValue := float64(snapQty) * p.price
			consumption := int(float64(snapQty) * consumptionRates[i])
			consumptionValue := float64(consumption) * p.price
			snapID := fmt.Sprintf("%s_%s", p.id, m)

			_, err := pool.Exec(ctx, `
				INSERT INTO spareparts.inventory_snapshots
					(id, position_id, snapshot_month, snapshot_qty, snapshot_value,
					 monthly_consumption, monthly_consumption_value)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
				ON CONFLICT (id) DO UPDATE SET
					snapshot_qty = $4, snapshot_value = $5,
					monthly_consumption = $6, monthly_consumption_value = $7
			`, snapID, p.id, m, snapQty, snapValue, consumption, consumptionValue)
			if err != nil {
				log.Printf("snapshot %s: %v", snapID, err)
			}
		}
	}
}
