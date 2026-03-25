package neo

import (
	"context"
	"fmt"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type DB struct {
	Driver neo4j.DriverWithContext
}

func New(ctx context.Context, uri, user, pass string) (*DB, error) {
	driver, err := neo4j.NewDriverWithContext(uri, neo4j.BasicAuth(user, pass, ""))
	if err != nil {
		return nil, fmt.Errorf("create neo4j driver: %w", err)
	}

	if err := driver.VerifyConnectivity(ctx); err != nil {
		driver.Close(ctx)
		return nil, fmt.Errorf("neo4j connectivity: %w", err)
	}

	return &DB{Driver: driver}, nil
}

func (db *DB) Close(ctx context.Context) error {
	return db.Driver.Close(ctx)
}

// Session returns a new session for the default database.
func (db *DB) Session(ctx context.Context) neo4j.SessionWithContext {
	return db.Driver.NewSession(ctx, neo4j.SessionConfig{})
}

// ReadSingle executes a read query and returns all records.
func (db *DB) ReadSingle(ctx context.Context, cypher string, params map[string]any) ([]*neo4j.Record, error) {
	session := db.Session(ctx)
	defer session.Close(ctx)

	result, err := session.Run(ctx, cypher, params)
	if err != nil {
		return nil, err
	}

	return result.Collect(ctx)
}

// Write executes a write query.
func (db *DB) Write(ctx context.Context, cypher string, params map[string]any) error {
	session := db.Session(ctx)
	defer session.Close(ctx)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		_, err := tx.Run(ctx, cypher, params)
		return nil, err
	})
	return err
}
