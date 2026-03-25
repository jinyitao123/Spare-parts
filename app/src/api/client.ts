import { WEAVE_BASE_URL, getToken } from './config'

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = getToken()
  if (t) h['Authorization'] = `Bearer ${t}`
  return h
}

function url(path: string) {
  return `${WEAVE_BASE_URL}/v1${path}`
}

// ── Auth ──────────────────────────────────────────────────────

export async function fetchDevToken(tenant = 'default', userId?: string): Promise<string> {
  const res = await fetch(url('/auth/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant, user_id: userId }),
  })
  if (!res.ok) throw new Error(`auth/token failed: ${res.status}`)
  const data = await res.json()
  return data.token as string
}

// ── Chat (non-streaming) ─────────────────────────────────────

export interface ChatRequest {
  agent: string
  message: string
  session_id?: string
  profile?: string
  stream?: boolean
}

export interface ChatResponse {
  output: string
  stop_reason: string
  session_id: string
  run_id: string
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(url('/chat'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...req, stream: false }),
  })
  if (!res.ok) throw new Error(`chat failed: ${res.status}`)
  return res.json()
}

// ── Sessions ─────────────────────────────────────────────────

export interface SessionInfo {
  id: string
  agent: string
  title: string
  updated_at: string
}

export async function listSessions(agent?: string): Promise<SessionInfo[]> {
  const q = agent ? `?agent=${encodeURIComponent(agent)}` : ''
  const res = await fetch(url(`/sessions${q}`), { headers: headers() })
  if (!res.ok) throw new Error(`listSessions failed: ${res.status}`)
  return res.json()
}

export interface SessionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface SessionDetail {
  id: string
  messages: SessionMessage[]
}

export async function getSession(id: string, agent?: string): Promise<SessionDetail> {
  const q = agent ? `?agent=${encodeURIComponent(agent)}` : ''
  const res = await fetch(url(`/sessions/${id}${q}`), { headers: headers() })
  if (!res.ok) throw new Error(`getSession failed: ${res.status}`)
  return res.json()
}

// ── Health ────────────────────────────────────────────────────

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(url('/health'))
    return res.ok
  } catch {
    return false
  }
}

// ── Data Sources ─────────────────────────────────────────────

export interface SourceTool {
  name: string
  description?: string
}

export interface FieldMapping {
  src: string
  target: string
  target_prop: string
  type: string
}

export interface TableMapping {
  source: string
  source_label: string
  fields?: FieldMapping[]
}

export interface EnumMapping {
  name: string
  label: string
  values: Record<string, string>
}

export interface SourceMeta {
  name: string
  display_name: string
  description: string
  domain: string
  icon: string
  sync_mode: string
  tables?: TableMapping[]
  enum_maps?: EnumMapping[]
}

export interface SourceInfo {
  url: string
  name: string
  status: 'online' | 'offline' | 'unknown'
  latency_ms?: number
  tools: SourceTool[]
  agents: string[]
  stats?: {
    position_count?: number
    part_count?: number
    total_value?: number
    stale_count?: number
    health_score?: number
    warehouses?: Record<string, unknown>
  }
  meta?: SourceMeta
}

export async function listSources(): Promise<SourceInfo[]> {
  const res = await fetch(url('/sources'), { headers: headers() })
  if (!res.ok) throw new Error(`listSources failed: ${res.status}`)
  return res.json()
}

// ── Schedules ───────────────────────────────────────────────

export interface ScheduleConfig {
  source_url: string
  tenant?: string
  display_name?: string
  sync_mode: string
  frequency: string
  time_of_day: string
  strategy: string
  conflict: string
  tables: string[]
  updated_at?: string
}

export async function getSchedule(sourceURL: string): Promise<ScheduleConfig> {
  const res = await fetch(url(`/schedules?source_url=${encodeURIComponent(sourceURL)}`), { headers: headers() })
  if (!res.ok) throw new Error(`getSchedule failed: ${res.status}`)
  return res.json()
}

export async function saveSchedule(sched: ScheduleConfig): Promise<ScheduleConfig> {
  const res = await fetch(url('/schedules'), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(sched),
  })
  if (!res.ok) throw new Error(`saveSchedule failed: ${res.status}`)
  return res.json()
}
