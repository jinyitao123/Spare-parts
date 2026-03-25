package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
)

// ToolFunc handles a tools/call invocation.
type ToolFunc func(ctx context.Context, args json.RawMessage) *ToolCallResult

// Metadata describes the MCP server's business domain for self-description.
type Metadata struct {
	Name        string            `json:"name"`
	DisplayName string            `json:"display_name"`
	Description string            `json:"description"`
	Domain      string            `json:"domain"`
	Icon        string            `json:"icon"`
	SyncMode    string            `json:"sync_mode"`
	Tables      []TableMapping    `json:"tables,omitempty"`
	EnumMaps    []EnumMapping     `json:"enum_maps,omitempty"`
}

// TableMapping describes a source-to-ontology table mapping.
type TableMapping struct {
	Source      string         `json:"source"`
	SourceLabel string        `json:"source_label"`
	Fields      []FieldMapping `json:"fields"`
}

// FieldMapping describes a single field mapping.
type FieldMapping struct {
	Src        string `json:"src"`
	Target     string `json:"target"`
	TargetProp string `json:"target_prop"`
	Type       string `json:"type"` // 直接, 类型转换, 枚举映射, 派生计算
}

// EnumMapping describes enum value mappings.
type EnumMapping struct {
	Name    string            `json:"name"`
	Label   string            `json:"label"`
	Values  map[string]string `json:"values"`
}

// Router dispatches JSON-RPC methods.
type Router struct {
	tools    []ToolDef
	handlers map[string]ToolFunc
	metadata *Metadata
}

func NewRouter() *Router {
	return &Router{
		handlers: make(map[string]ToolFunc),
	}
}

func (r *Router) Register(def ToolDef, handler ToolFunc) {
	r.tools = append(r.tools, def)
	r.handlers[def.Name] = handler
}

// SetMetadata sets the server's self-description metadata.
func (r *Router) SetMetadata(m *Metadata) {
	r.metadata = m
}

func (r *Router) Handle(ctx context.Context, method string, params json.RawMessage) (any, *rpcError) {
	switch method {
	case "tools/list":
		return r.handleList()
	case "tools/call":
		return r.handleCall(ctx, params)
	case "metadata/describe":
		return r.handleDescribe()
	default:
		return nil, &rpcError{Code: -32601, Message: fmt.Sprintf("unknown method: %s", method)}
	}
}

func (r *Router) handleDescribe() (any, *rpcError) {
	if r.metadata == nil {
		return map[string]any{}, nil
	}
	return r.metadata, nil
}

func (r *Router) handleList() (any, *rpcError) {
	return map[string]any{"tools": r.tools}, nil
}

func (r *Router) handleCall(ctx context.Context, params json.RawMessage) (any, *rpcError) {
	var call struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(params, &call); err != nil {
		return nil, &rpcError{Code: -32602, Message: "invalid params"}
	}

	handler, ok := r.handlers[call.Name]
	if !ok {
		return nil, &rpcError{Code: -32602, Message: fmt.Sprintf("unknown tool: %s", call.Name)}
	}

	log.Printf("mcp: tools/call %s", call.Name)
	result := handler(ctx, call.Arguments)
	return result, nil
}
