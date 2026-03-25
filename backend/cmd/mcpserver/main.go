package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"spareparts/internal/config"
	"spareparts/internal/mcp"
	"spareparts/internal/neo"
	"spareparts/internal/pg"
	"spareparts/internal/tools"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := config.Load()

	// Connect PostgreSQL
	log.Println("connecting to PostgreSQL...")
	pool, err := pg.NewPool(ctx, cfg.PGURL)
	if err != nil {
		log.Fatalf("pg: %v", err)
	}
	defer pool.Close()

	// Run PG migrations
	if err := pg.Migrate(ctx, pool); err != nil {
		log.Fatalf("pg migrate: %v", err)
	}
	log.Println("pg: schema migrated")

	// Connect Neo4j
	log.Println("connecting to Neo4j...")
	neoDB, err := neo.New(ctx, cfg.Neo4jURI, cfg.Neo4jUser, cfg.Neo4jPass)
	if err != nil {
		log.Fatalf("neo4j: %v", err)
	}
	defer neoDB.Close(ctx)

	// Run Neo4j migrations
	if err := neoDB.Migrate(ctx); err != nil {
		log.Fatalf("neo4j migrate: %v", err)
	}

	// Sync structure from PG to Neo4j
	log.Println("syncing structure to Neo4j...")
	if err := neoDB.SyncAllStructure(ctx, pool); err != nil {
		log.Fatalf("neo4j sync: %v", err)
	}

	// Build MCP router with all tools
	router := mcp.NewRouter()
	tools.RegisterAll(router, &tools.Deps{PG: pool, Neo: neoDB})

	// Self-description metadata — change this when switching business domains
	router.SetMetadata(&mcp.Metadata{
		Name:        "spareparts-mcp",
		DisplayName: "通威数据中台",
		Description: "PostgreSQL / 即时库存 + 领料出库 + 采购单",
		Domain:      "spare_parts",
		Icon:        "DB",
		SyncMode:    "定时批量",
		Tables: []mcp.TableMapping{
			{
				Source: "spare_parts.instant_inventory", SourceLabel: "即时库存 → 备件 + 库存头寸",
				Fields: []mcp.FieldMapping{
					{Src: "MATNR", Target: "备件", TargetProp: "物料编码 id", Type: "直接"},
					{Src: "MAKTX", Target: "备件", TargetProp: "名称 name", Type: "直接"},
					{Src: "MENGE", Target: "库存头寸", TargetProp: "当前数量 currentQty", Type: "类型转换"},
					{Src: "STPRS", Target: "库存头寸", TargetProp: "入库标准价 unitPrice", Type: "类型转换"},
					{Src: "LGORT", Target: "库存头寸", TargetProp: "库房引用 warehouseRef", Type: "枚举映射"},
					{Src: "MEINS", Target: "备件", TargetProp: "计量单位 unit", Type: "直接"},
				},
			},
			{Source: "spare_parts.material_issue", SourceLabel: "领料出库 → 出入库记录"},
			{Source: "spare_parts.purchase_order", SourceLabel: "采购单 → 采购单"},
		},
		EnumMaps: []mcp.EnumMapping{
			{
				Name: "LGORT", Label: "LGORT → 库房引用",
				Values: map[string]string{
					"WH01": "一级总库",
					"WH02": "二级库-工段A",
					"WH03": "二级库-工段B",
					"WH04": "二级库-工段C",
				},
			},
		},
	})

	// Start HTTP server
	handler := mcp.Handler(router)
	srv := &http.Server{
		Addr:         cfg.Addr(),
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		log.Printf("MCP Tool Server listening on %s", cfg.Addr())
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	srv.Shutdown(shutdownCtx)
}
