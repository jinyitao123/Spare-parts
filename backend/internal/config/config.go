package config

import (
	"fmt"
	"os"
)

type Config struct {
	PGURL        string
	Neo4jURI     string
	Neo4jUser    string
	Neo4jPass    string
	Port         string
}

func Load() *Config {
	return &Config{
		PGURL:     env("PG_URL", "postgres://weave:weave@localhost:5432/weave?sslmode=disable"),
		Neo4jURI:  env("NEO4J_URI", "bolt://localhost:7687"),
		Neo4jUser: env("NEO4J_USER", "neo4j"),
		Neo4jPass: env("NEO4J_PASSWORD", "spareparts"),
		Port:      env("PORT", "9090"),
	}
}

func (c *Config) Addr() string {
	return fmt.Sprintf(":%s", c.Port)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
