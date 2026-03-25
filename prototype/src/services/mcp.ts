const MCP_URL = import.meta.env.VITE_MCP_URL || 'http://localhost:9090'

let rpcId = 0

export async function mcpCall<T = any>(toolName: string, args: Record<string, any> = {}): Promise<T> {
  const res = await fetch(MCP_URL + '/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: args },
      id: ++rpcId,
    }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message || 'RPC error')
  const result = json.result
  if (result.isError) {
    const text = result.content?.[0]?.text || 'Unknown error'
    throw new Error(text)
  }
  const text = result.content?.[0]?.text
  return text ? JSON.parse(text) : result
}
