import { useEffect, useState } from 'react'
import { listSources, getSchedule, saveSchedule } from '../api'
import type { SourceInfo, SourceMeta, TableMapping, EnumMapping, ScheduleConfig } from '../api'
import styles from './SourcesPage.module.css'

// ── Helpers for reading source.meta (from MCP self-description) ──

/** Display name: prefer user override → meta.display_name → source.name */
function displayName(s: SourceInfo, overrides?: Record<string, string>) {
  return overrides?.[s.url] || s.meta?.display_name || s.name
}

/** Description: prefer meta.description, fallback to URL */
function displayDesc(s: SourceInfo) {
  return s.meta?.description || s.url
}

/** Icon text: prefer meta.icon, fallback to "DS" */
function displayIcon(s: SourceInfo) {
  return s.meta?.icon || 'DS'
}

/** Sync mode from metadata */
function displaySyncMode(s: SourceInfo) {
  return s.meta?.sync_mode || '—'
}

/** Table labels from metadata */
function displayTables(s: SourceInfo): string[] {
  return s.meta?.tables?.map(t => t.source_label) ?? []
}

function fmtLatency(ms?: number) {
  return ms != null ? `${ms}ms` : '—'
}

// Planned connectors (not yet live — clearly marked, no MCP server yet)

// ── Tab type ──

type Tab = 'dashboard' | 'connectors'

// ── Component ──

export function SourcesPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [selectedSource, setSelectedSource] = useState<SourceInfo | null>(null)
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({})

  useEffect(() => { loadSources() }, [])

  async function loadSources() {
    setLoading(true)
    try {
      const data = await listSources()
      setSources(data)
      setLastRefresh(new Date())
      // Load custom names for each source
      const names: Record<string, string> = {}
      await Promise.all(data.map(async s => {
        try {
          const sched = await getSchedule(s.url)
          if (sched.display_name) names[s.url] = sched.display_name
        } catch { /* ignore */ }
      }))
      setNameOverrides(names)
    } catch { /* offline */ }
    finally { setLoading(false) }
  }

  if (selectedSource) {
    return (
      <div className={styles.page}>
        <ConnectorDetailView source={selectedSource} onBack={() => setSelectedSource(null)} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>数据连接</h1>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'dashboard' ? styles.tabActive : ''}`} onClick={() => setTab('dashboard')}>连接看板</button>
          <button className={`${styles.tab} ${tab === 'connectors' ? styles.tabActive : ''}`} onClick={() => setTab('connectors')}>连接器配置</button>
        </div>
      </div>

      {tab === 'dashboard' && (
        <DashboardView sources={sources} loading={loading} lastRefresh={lastRefresh} onRefresh={loadSources} nameOverrides={nameOverrides} />
      )}
      {tab === 'connectors' && (
        <ConnectorListView sources={sources} loading={loading} onSelect={setSelectedSource} onRefresh={loadSources} nameOverrides={nameOverrides} />
      )}
    </div>
  )
}

// ── Dashboard View ──

function DashboardView({ sources, loading, lastRefresh, onRefresh, nameOverrides }: {
  sources: SourceInfo[]; loading: boolean; lastRefresh: Date | null; onRefresh: () => void; nameOverrides: Record<string, string>
}) {
  const onlineCount = sources.filter(s => s.status === 'online').length
  const totalSources = sources.length

  let totalPositions = 0, totalValue = 0, healthSum = 0, healthCount = 0
  for (const s of sources) {
    if (!s.stats) continue
    if (typeof s.stats.position_count === 'number') totalPositions += s.stats.position_count
    if (typeof s.stats.total_value === 'number') totalValue += s.stats.total_value
    if (typeof s.stats.health_score === 'number') { healthSum += s.stats.health_score; healthCount++ }
  }
  const avgHealth = healthCount > 0 ? Math.round(healthSum / healthCount) : null

  function fmtTime(d: Date | null) {
    if (!d) return '—'
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <>
      <div className={styles.summary}>
        <div className={styles.sumCard}>
          <div className={styles.sumNum}>{loading ? '—' : `${onlineCount}/${totalSources}`}</div>
          <div className={styles.sumLabel}>在线/总数据源</div>
        </div>
        <div className={styles.sumCard}>
          <div className={`${styles.sumNum} ${styles.sumSuccess}`}>{loading ? '—' : totalPositions || '—'}</div>
          <div className={styles.sumLabel}>库存头寸数</div>
        </div>
        <div className={styles.sumCard}>
          <div className={styles.sumNum}>{loading ? '—' : (avgHealth != null ? `${avgHealth}分` : '—')}</div>
          <div className={styles.sumLabel}>库存健康度</div>
        </div>
        <div className={styles.sumCard}>
          <div className={styles.sumNum}>{loading ? '—' : (totalValue > 0 ? `${(totalValue / 10000).toFixed(1)}万` : '—')}</div>
          <div className={styles.sumLabel}>库存总金额</div>
        </div>
      </div>

      {/* Data flow for each live source — labels from meta */}
      {sources.map(source => {
        const isOnline = source.status === 'online'
        const stats = source.stats
        const tables = displayTables(source)

        return (
          <div key={source.url} className={styles.flow}>
            <div className={styles.flowSrc}>
              <div className={styles.flowSrcTitle}>
                <span className={`${styles.dot} ${isOnline ? styles.dotOnline : styles.dotOffline}`} />
                {displayName(source, nameOverrides)}
              </div>
              <div className={styles.flowSrcSub}>
                {tables.length > 0
                  ? tables.map((t, i) => <span key={i}>{t}<br/></span>)
                  : source.url}
              </div>
              <div className={styles.flowStatus}>
                {displaySyncMode(source)} · 延迟 {fmtLatency(source.latency_ms)}
              </div>
            </div>
            <div className={styles.pipe}>
              <div className={styles.pipeLabel}>{source.tools?.length ?? 0} 工具</div>
              <div className={styles.pipeLine} />
              <div className={styles.pipeTime}>
                {isOnline ? <span className={styles.flowLatency}>{fmtLatency(source.latency_ms)}</span> : '离线'}
              </div>
            </div>
            <div className={styles.flowTgt}>
              <div className={styles.flowTgtTitle}>业务本体</div>
              <div className={styles.flowTgtItems}>
                {stats ? (
                  <>
                    备件 {stats.part_count ?? '—'} 种<br/>
                    库存头寸 {stats.position_count ?? '—'} 个<br/>
                    总金额 {typeof stats.total_value === 'number' ? `${(stats.total_value / 10000).toFixed(1)}万` : '—'}<br/>
                    呆滞头寸 {stats.stale_count ?? '—'} 个
                  </>
                ) : <span>暂无统计数据</span>}
              </div>
            </div>
          </div>
        )
      })}


      {/* Probe log */}
      <div className={styles.sep} />
      <div className={styles.logSection}>
        <div className={styles.logHeader}>
          <span className={styles.logTitle}>探测记录</span>
          <button className={styles.refreshBtn} onClick={onRefresh}>{loading ? '探测中…' : '刷新探测'}</button>
        </div>
        {lastRefresh && (
          <div className={styles.logRow}>
            <div className={styles.logTime}>{fmtTime(lastRefresh)}</div>
            <div className={`${styles.logBadge} ${onlineCount === sources.length ? styles.badgeOk : styles.badgeWarn}`}>
              {onlineCount === sources.length ? '全部在线' : `${onlineCount}/${sources.length} 在线`}
            </div>
            <div className={styles.logDetail}>
              {sources.map(s => (
                <span key={s.url}>
                  {displayName(s, nameOverrides)}：{s.status === 'online' ? `在线 ${fmtLatency(s.latency_ms)}` : '离线'}
                  {s.stats?.position_count != null && ` · ${s.stats.position_count} 头寸`}
                  {s.stats?.part_count != null && ` · ${s.stats.part_count} 备件`}
                  <br/>
                </span>
              ))}
              {sources.length === 0 && '暂无已接入的数据源'}
              <div className={styles.logSub}>实时探测 · 通过 MCP JSON-RPC 协议获取工具列表和统计数据</div>
            </div>
          </div>
        )}
        {!lastRefresh && !loading && (
          <div className={styles.logRow}>
            <div className={styles.logTime}>—</div>
            <div className={styles.logDetail}>点击"刷新探测"获取最新数据源状态</div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Connector List View ──

function toolCategory(name: string): string {
  if (name.startsWith('query_') || name.startsWith('get_') || name.startsWith('list_')) return '查询'
  if (name.startsWith('execute_') || name.startsWith('create_') || name.startsWith('approve_')) return '操作'
  if (name.startsWith('check_') || name.startsWith('find_') || name.startsWith('mark_')) return '分析'
  if (name.startsWith('graph_')) return '图谱'
  return '其他'
}

function ConnectorListView({ sources, loading, onSelect, onRefresh, nameOverrides }: {
  sources: SourceInfo[]; loading: boolean; onSelect: (s: SourceInfo) => void; onRefresh: () => Promise<void>; nameOverrides: Record<string, string>
}) {
  const [showTemplates, setShowTemplates] = useState(false)
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const [addingType, setAddingType] = useState<string | null>(null)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [probing, setProbing] = useState(false)
  const [probeError, setProbeError] = useState('')

  function toggleTools(e: React.MouseEvent, url: string) {
    e.stopPropagation()
    setExpandedTools(prev => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  async function handleAddSource() {
    if (!newUrl.trim()) return
    setProbing(true)
    setProbeError('')
    try {
      await onRefresh()
      const fresh = await listSources()
      const match = fresh.find(s => s.url === newUrl.trim() || s.url === newUrl.trim() + '/')
      if (match) {
        // Save custom name if provided
        if (newName.trim()) {
          try {
            const sched = await getSchedule(match.url)
            await saveSchedule({ ...sched, source_url: match.url, display_name: newName.trim() })
          } catch { /* ignore — name save is best-effort */ }
        }
        setAddingType(null)
        setNewUrl('')
        setNewName('')
        onSelect(match)
      } else {
        setProbeError('无法连接到该地址，请确认 MCP 服务已启动且地址正确')
      }
    } catch {
      setProbeError('探测失败，请检查网络连接')
    } finally { setProbing(false) }
  }

  return (
    <>
      <div className={styles.connectorHeader}>
        <span />
        <button className={styles.addBtn} onClick={() => { setShowTemplates(!showTemplates); setAddingType(null) }}>+ 新增数据源</button>
      </div>

      <div className={styles.cards}>
        {sources.map(source => {
          const isOnline = source.status === 'online'
          const stats = source.stats

          return (
            <div key={source.url} className={styles.card} onClick={() => onSelect(source)} style={{ cursor: 'pointer' }}>
              <div className={styles.cardTop}>
                <div className={styles.cardLeft}>
                  <div className={styles.iconBox} style={{ background: 'var(--signal-info-bg)', color: 'var(--signal-info-text)' }}>
                    {displayIcon(source)}
                  </div>
                  <div>
                    <div className={styles.cardName}>{displayName(source, nameOverrides)}</div>
                    <div className={styles.cardDesc}>{displayDesc(source)}</div>
                  </div>
                </div>
                <span className={`${styles.badge} ${isOnline ? styles.badgeOnline : styles.badgeOffline}`}>
                  <span className={`${styles.dot} ${isOnline ? styles.dotOnline : styles.dotOffline}`} />
                  {loading ? '检测中' : (isOnline ? '运行中' : '离线')}
                </span>
              </div>

              {stats && (
                <div className={styles.statsRow}>
                  <div className={styles.statItem}>
                    <span className={styles.statValue}>{stats.part_count ?? '—'}</span>
                    <span className={styles.statLabel}>备件种类</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statValue}>{stats.position_count ?? '—'}</span>
                    <span className={styles.statLabel}>库存头寸</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statValue}>{typeof stats.total_value === 'number' ? `${(stats.total_value / 10000).toFixed(1)}万` : '—'}</span>
                    <span className={styles.statLabel}>库存金额</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statValue}>{typeof stats.health_score === 'number' ? `${Math.round(stats.health_score)}分` : '—'}</span>
                    <span className={styles.statLabel}>健康度</span>
                  </div>
                </div>
              )}

              <div className={styles.cardMeta}>
                <span>延迟：{isOnline ? fmtLatency(source.latency_ms) : '—'}</span>
                <span>工具能力：{source.tools?.length ?? 0} 个</span>
                <span>接入 Agent：{source.agents?.length ?? 0} 个</span>
              </div>

              <div className={styles.cardMaps}>
                {source.agents?.map(a => <span key={a} className={styles.agentTag}>{a}</span>)}
              </div>

              {source.tools && source.tools.length > 0 && (
                <div className={styles.toolsSection}>
                  <button className={styles.toolsToggle} onClick={(e) => toggleTools(e, source.url)}>
                    {expandedTools.has(source.url) ? '收起工具列表' : `展开 ${source.tools.length} 个工具`}
                  </button>
                  {expandedTools.has(source.url) && (
                    <div className={styles.toolsList}>
                      {source.tools.map(tool => (
                        <div key={tool.name} className={styles.toolItem}>
                          <span className={styles.toolCat}>{toolCategory(tool.name)}</span>
                          <span className={styles.toolName}>{tool.name}</span>
                          {tool.description && <span className={styles.toolDesc}>{tool.description}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

      </div>

      {showTemplates && (
        <div className={styles.tmplSection}>
          <div className={styles.tmplTitle}>选择数据源类型</div>
          <div className={styles.tmpls}>
            {[
              { key: 'mcp', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>, color: 'var(--signal-info-text)', name: 'MCP 数据源', desc: '通过 MCP 协议接入任意数据系统', placeholder: 'http://host:port/' },
              { key: 'rest', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v18M3 12h18M7 7l10 10M17 7L7 17"/></svg>, color: '#0F6E56', name: 'REST API', desc: 'HTTP 接口 / Webhook（即将支持）', placeholder: '' },
              { key: 'file', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/></svg>, color: 'var(--text-secondary)', name: '文件导入', desc: 'CSV / Excel / JSON（即将支持）', placeholder: '' },
            ].map(tmpl => (
              <div key={tmpl.key} className={`${styles.tmpl} ${addingType === tmpl.key ? styles.tmplActive : ''}`}
                   onClick={() => tmpl.placeholder ? setAddingType(tmpl.key) : undefined}
                   style={{ cursor: tmpl.placeholder ? 'pointer' : 'not-allowed', opacity: tmpl.placeholder ? 1 : 0.5 }}>
                <div className={styles.tmplIcon} style={{ color: tmpl.color }}>{tmpl.icon}</div>
                <div className={styles.tmplName}>{tmpl.name}</div>
                <div className={styles.tmplDesc}>{tmpl.desc}</div>
              </div>
            ))}
          </div>

          {addingType === 'mcp' && (
            <div className={styles.addForm}>
              <div className={styles.formItem} style={{ flex: 1, minWidth: 200 }}>
                <div className={styles.formLabel}>数据源名称</div>
                <input
                  className={styles.formInput}
                  placeholder="可选，留空则使用 MCP 返回的名称"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.formItem} style={{ flex: 2, minWidth: 300 }}>
                <div className={styles.formLabel}>MCP 服务地址</div>
                <input
                  className={styles.formInput}
                  placeholder="http://host:port/"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSource()}
                />
              </div>
              <button className={styles.btnPrimary} onClick={handleAddSource} disabled={probing || !newUrl.trim()}>
                {probing ? '探测中…' : '探测并添加'}
              </button>
              <button className={styles.btnSecondary} onClick={() => { setAddingType(null); setNewUrl(''); setNewName(''); setProbeError('') }}>取消</button>
              {probeError && <div style={{ color: 'var(--signal-error-text)', fontSize: 13, width: '100%', marginTop: 4 }}>{probeError}</div>}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ── Connector Detail View ──

function ConnectorDetailView({ source: initialSource, onBack }: { source: SourceInfo; onBack: () => void }) {
  const [detailTab, setDetailTab] = useState<'connection' | 'mapping' | 'tools' | 'schedule'>('connection')
  const [source, setSource] = useState(initialSource)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [customName, setCustomName] = useState('')
  const [nameLoaded, setNameLoaded] = useState(false)
  const [nameSaving, setNameSaving] = useState(false)

  useEffect(() => {
    probeSource()
    // Load saved custom name
    getSchedule(initialSource.url).then(s => {
      if (s.display_name) setCustomName(s.display_name)
      setNameLoaded(true)
    }).catch(() => setNameLoaded(true))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function probeSource() {
    setTesting(true)
    setTestResult(null)
    try {
      const fresh = await listSources()
      const match = fresh.find(s => s.url === source.url)
      if (match) {
        setSource(match)
        const toolCount = match.tools?.length ?? 0
        setTestResult({
          ok: match.status === 'online',
          msg: match.status === 'online'
            ? `连接成功 · 延迟 ${fmtLatency(match.latency_ms)} · ${toolCount} 个工具可用`
            : '连接失败 · 服务不可达',
        })
      }
    } catch {
      setTestResult({ ok: false, msg: '探测请求失败' })
    } finally { setTesting(false) }
  }

  async function saveName() {
    if (!customName.trim()) return
    setNameSaving(true)
    try {
      const current = await getSchedule(source.url)
      await saveSchedule({ ...current, source_url: source.url, display_name: customName.trim() })
    } catch { /* ignore */ }
    finally { setNameSaving(false) }
  }

  const isOnline = source.status === 'online'
  const meta = source.meta

  return (
    <>
      <button className={styles.backBtn} onClick={onBack}>← 返回连接器列表</button>

      <div className={styles.detailHeader}>
        <div className={styles.iconBox} style={{ background: 'var(--signal-info-bg)', color: 'var(--signal-info-text)' }}>
          {displayIcon(source)}
        </div>
        <div style={{ flex: 1 }}>
          <input
            className={styles.detailNameInput}
            value={nameLoaded ? (customName || displayName(source)) : '…'}
            onChange={e => setCustomName(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            placeholder={displayName(source)}
            disabled={nameSaving}
          />
          <div className={styles.detailSub}>
            {displayDesc(source)}
            {' · '}
            <span className={isOnline ? styles.flowLatency : ''}>
              {isOnline ? `在线 ${fmtLatency(source.latency_ms)}` : '离线'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.detailTabs}>
        {(['connection', 'mapping', 'tools', 'schedule'] as const).map(t => (
          <button key={t} className={`${styles.detailTab} ${detailTab === t ? styles.detailTabActive : ''}`} onClick={() => setDetailTab(t)}>
            {{ connection: '连接参数', mapping: '字段映射', tools: '工具能力', schedule: '同步调度' }[t]}
          </button>
        ))}
      </div>

      {detailTab === 'connection' && <ConnectionTab source={source} testing={testing} testResult={testResult} onTest={probeSource} />}
      {detailTab === 'mapping' && <MappingTab meta={meta} />}
      {detailTab === 'tools' && <ToolsTab source={source} />}
      {detailTab === 'schedule' && <ScheduleTab sourceUrl={source.url} meta={meta} />}

      <div className={styles.bottomBar}>
        <button className={styles.btnSecondary} onClick={probeSource} disabled={testing}>
          {testing ? '探测中…' : '重新探测'}
        </button>
      </div>
    </>
  )
}

// ── Detail sub-tabs (all driven by source.meta from MCP) ──

function ConnectionTab({ source, testing, testResult, onTest }: {
  source: SourceInfo; testing: boolean; testResult: { ok: boolean; msg: string } | null; onTest: () => void
}) {
  const [url, setUrl] = useState(source.url)
  const isOnline = source.status === 'online'
  const stats = source.stats

  return (
    <div className={styles.detailSection}>
      <div className={styles.secTitle}>MCP 连接</div>
      <div className={styles.formGrid}>
        <div className={styles.formItem}>
          <div className={styles.formLabel}>MCP 地址</div>
          <input className={styles.formInput} value={url} onChange={e => setUrl(e.target.value)} />
        </div>
        <div className={styles.formItem}>
          <div className={styles.formLabel}>协议</div>
          <select className={styles.formInput}>
            <option>JSON-RPC 2.0 / HTTP POST</option>
            <option>JSON-RPC 2.0 / SSE</option>
          </select>
        </div>
        <div className={styles.formItem}>
          <div className={styles.formLabel}>状态</div>
          <div className={styles.formVal}>
            <span className={`${styles.dot} ${isOnline ? styles.dotOnline : styles.dotOffline}`} />
            {' '}{isOnline ? '在线' : '离线'}
            {source.latency_ms != null && <span className={styles.flowLatency}> · {source.latency_ms}ms</span>}
          </div>
        </div>
        <div className={styles.formItem}>
          <div className={styles.formLabel}>业务域</div>
          <div className={styles.formVal}>{source.meta?.domain ?? '—'}</div>
        </div>
      </div>
      <div className={styles.testRow}>
        <button className={styles.testBtn} onClick={onTest} disabled={testing}>
          {testing ? '测试中…' : '测试连接'}
        </button>
        {testResult && (
          <span className={testResult.ok ? styles.testOk : styles.testFail}>{testResult.msg}</span>
        )}
      </div>

      {stats && (
        <>
          <div className={styles.sep} />
          <div className={styles.secTitle}>数据统计（实时探测）</div>
          <div className={styles.formGrid}>
            {stats.part_count != null && <div className={styles.formItem}><div className={styles.formLabel}>备件种类</div><div className={styles.formVal}>{stats.part_count}</div></div>}
            {stats.position_count != null && <div className={styles.formItem}><div className={styles.formLabel}>库存头寸</div><div className={styles.formVal}>{stats.position_count}</div></div>}
            {typeof stats.total_value === 'number' && <div className={styles.formItem}><div className={styles.formLabel}>库存总金额</div><div className={styles.formVal}>¥{stats.total_value.toLocaleString()}</div></div>}
            {stats.stale_count != null && <div className={styles.formItem}><div className={styles.formLabel}>呆滞头寸</div><div className={styles.formVal}>{stats.stale_count}</div></div>}
            {typeof stats.health_score === 'number' && <div className={styles.formItem}><div className={styles.formLabel}>健康度</div><div className={styles.formVal}>{Math.round(stats.health_score)}分</div></div>}
          </div>

          {stats.warehouses && typeof stats.warehouses === 'object' && (
            <>
              <div className={styles.secTitle} style={{ marginTop: 20 }}>库房分布</div>
              <table className={styles.mapTable}>
                <thead><tr><th>库房</th><th>头寸数</th><th>金额</th><th>呆滞比</th></tr></thead>
                <tbody>
                  {((stats.warehouses as Record<string, unknown>).warehouses as Array<Record<string, unknown>> ?? []).map((wh, i) => (
                    <tr key={i}>
                      <td>{String(wh.warehouse_name ?? wh.warehouse_id)}</td>
                      <td>{String(wh.total_positions ?? '—')}</td>
                      <td>{typeof wh.total_value === 'number' ? `¥${wh.total_value.toLocaleString()}` : '—'}</td>
                      <td>{typeof wh.stale_ratio === 'number' ? `${(wh.stale_ratio * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  )
}

function MappingTab({ meta }: { meta?: SourceMeta }) {
  const tables: TableMapping[] = meta?.tables ?? []
  const tablesWithFields = tables.filter((t: TableMapping) => t.fields && t.fields.length > 0)
  const enumMaps: EnumMapping[] = meta?.enum_maps ?? []

  if (tablesWithFields.length === 0 && enumMaps.length === 0) {
    return (
      <div className={styles.detailSection}>
        <div className={styles.secTitle}>字段映射</div>
        <div className={styles.emptyHint}>MCP 服务器未提供字段映射信息</div>
      </div>
    )
  }

  return (
    <div className={styles.detailSection}>
      {tablesWithFields.map((table: TableMapping, ti: number) => (
        <div key={ti} style={{ marginBottom: 24 }}>
          <div className={styles.secTitle}>字段映射 · {table.source_label}</div>
          <table className={styles.mapTable}>
            <thead><tr><th>源字段</th><th></th><th>目标类.属性</th><th>转换</th></tr></thead>
            <tbody>
              {table.fields!.map((f, i) => (
                <tr key={i}>
                  <td className={styles.srcCol}>{f.src}</td>
                  <td className={styles.mapArrow}>→</td>
                  <td>
                    <span className={styles.tgtClass}>{f.target}</span>
                    .<span className={styles.tgtProp}>{f.target_prop}</span>
                  </td>
                  <td>
                    <span className={`${styles.mapType} ${
                      f.type === '直接' ? styles.mapDirect :
                      f.type.includes('转换') || f.type.includes('映射') ? styles.mapConvert :
                      styles.mapDerive
                    }`}>{f.type}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {enumMaps.map((em: EnumMapping, ei: number) => (
        <div key={ei} style={{ marginBottom: 24 }}>
          <div className={styles.secTitle}>枚举映射 · {em.label}</div>
          <table className={styles.mapTable}>
            <thead><tr><th>源值</th><th></th><th>目标值</th></tr></thead>
            <tbody>
              {Object.entries(em.values).map(([src, tgt]: [string, string], i: number) => (
                <tr key={i}>
                  <td className={styles.srcCol}>{src}</td>
                  <td className={styles.mapArrow}>→</td>
                  <td>{tgt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function ToolsTab({ source }: { source: SourceInfo }) {
  const tools = source.tools ?? []
  if (tools.length === 0) {
    return <div className={styles.detailSection}><div className={styles.secTitle}>工具能力</div><div className={styles.emptyHint}>暂无可用工具</div></div>
  }

  const grouped: Record<string, typeof tools> = {}
  for (const tool of tools) {
    const cat = toolCategory(tool.name)
    ;(grouped[cat] ??= []).push(tool)
  }

  return (
    <div className={styles.detailSection}>
      <div className={styles.secTitle}>工具能力 · {tools.length} 个</div>
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div className={styles.toolGroupTitle}>{cat}（{items.length}）</div>
          <div className={styles.toolsList}>
            {items.map(tool => (
              <div key={tool.name} className={styles.toolItem}>
                <span className={styles.toolCat}>{cat}</span>
                <span className={styles.toolName}>{tool.name}</span>
                {tool.description && <span className={styles.toolDesc}>{tool.description}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {source.agents && source.agents.length > 0 && (
        <>
          <div className={styles.secTitle} style={{ marginTop: 20 }}>接入 Agent · {source.agents.length} 个</div>
          <div className={styles.cardMaps}>
            {source.agents.map(a => <span key={a} className={styles.agentTag}>{a}</span>)}
          </div>
        </>
      )}
    </div>
  )
}

function ScheduleTab({ sourceUrl, meta, onSaved }: { sourceUrl: string; meta?: SourceMeta; onSaved?: () => void }) {
  const initMode = meta?.sync_mode === '定时批量' ? 'batch' : meta?.sync_mode?.includes('事件') ? 'event' : 'manual'
  const [syncMode, setSyncMode] = useState(initMode)
  const [freq, setFreq] = useState('daily')
  const [time, setTime] = useState('00:00')
  const [strategy, setStrategy] = useState('full')
  const [conflict, setConflict] = useState('source')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const tables: TableMapping[] = meta?.tables ?? []
  const [selectedTables, setSelectedTables] = useState<string[]>(tables.map(t => t.source))

  // Load saved schedule from backend on mount.
  useEffect(() => {
    getSchedule(sourceUrl).then((s: ScheduleConfig) => {
      if (s.sync_mode) setSyncMode(s.sync_mode)
      if (s.frequency) setFreq(s.frequency)
      if (s.time_of_day) setTime(s.time_of_day)
      if (s.strategy) setStrategy(s.strategy)
      if (s.conflict) setConflict(s.conflict)
      if (s.tables && s.tables.length > 0) setSelectedTables(s.tables)
    }).catch(() => {/* use defaults */}).finally(() => setLoading(false))
  }, [sourceUrl])

  async function handleSave() {
    setSaving(true)
    setSaveMsg('')
    try {
      await saveSchedule({
        source_url: sourceUrl,
        sync_mode: syncMode,
        frequency: freq,
        time_of_day: time,
        strategy,
        conflict,
        tables: selectedTables,
      })
      setSaveMsg('已保存')
      onSaved?.()
    } catch (e: unknown) {
      setSaveMsg('保存失败: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setSaving(false) }
  }

  function toggleTable(src: string) {
    setSelectedTables(prev => prev.includes(src) ? prev.filter(t => t !== src) : [...prev, src])
  }

  if (loading) return <div className={styles.detailSection}><div className={styles.emptyHint}>加载调度配置…</div></div>

  return (
    <div className={styles.detailSection}>
      <div className={styles.secTitle}>同步调度</div>

      <div className={styles.schedRow}>
        <div className={styles.schedLabel}>同步模式</div>
        <div className={styles.radioGroup}>
          <label className={styles.radioItem}><input type="radio" name="mode" checked={syncMode === 'batch'} onChange={() => setSyncMode('batch')} /> 定时批量</label>
          <label className={styles.radioItem}><input type="radio" name="mode" checked={syncMode === 'event'} onChange={() => setSyncMode('event')} /> 事件驱动</label>
          <label className={styles.radioItem}><input type="radio" name="mode" checked={syncMode === 'manual'} onChange={() => setSyncMode('manual')} /> 手动触发</label>
        </div>
      </div>

      {syncMode === 'batch' && (
        <div className={styles.schedRow}>
          <div className={styles.schedLabel}>执行时间</div>
          <div className={styles.formGrid} style={{ flex: 1 }}>
            <div className={styles.formItem}>
              <div className={styles.formLabel}>频率</div>
              <select className={styles.formInput} value={freq} onChange={e => setFreq(e.target.value)}>
                <option value="hourly">每小时</option><option value="daily">每天</option><option value="weekly">每周</option>
              </select>
            </div>
            <div className={styles.formItem}>
              <div className={styles.formLabel}>时间点</div>
              <input className={styles.formInput} type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <div className={styles.schedRow}>
        <div className={styles.schedLabel}>同步策略</div>
        <div className={styles.radioGroup}>
          <label className={styles.radioItem}><input type="radio" name="strategy" checked={strategy === 'full'} onChange={() => setStrategy('full')} /> 全量覆盖</label>
          <label className={styles.radioItem}><input type="radio" name="strategy" checked={strategy === 'incremental'} onChange={() => setStrategy('incremental')} /> 增量追加</label>
        </div>
      </div>

      <div className={styles.schedRow}>
        <div className={styles.schedLabel}>冲突处理</div>
        <div className={styles.radioGroup}>
          <label className={styles.radioItem}><input type="radio" name="conflict" checked={conflict === 'source'} onChange={() => setConflict('source')} /> 以源系统为准</label>
          <label className={styles.radioItem}><input type="radio" name="conflict" checked={conflict === 'local'} onChange={() => setConflict('local')} /> 保留本体值</label>
          <label className={styles.radioItem}><input type="radio" name="conflict" checked={conflict === 'mark'} onChange={() => setConflict('mark')} /> 标记冲突</label>
        </div>
      </div>

      {tables.length > 0 && (
        <>
          <div className={styles.secTitle} style={{ marginTop: 20 }}>源表选择</div>
          <div className={styles.formGrid}>
            {tables.map((tbl: TableMapping, i: number) => (
              <label key={i} className={styles.radioItem}>
                <input type="checkbox" checked={selectedTables.includes(tbl.source)} onChange={() => toggleTable(tbl.source)} /> {tbl.source}（{tbl.source_label}）
              </label>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? '保存中…' : '保存调度配置'}
        </button>
        {saveMsg && <span style={{ fontSize: 13, color: saveMsg.startsWith('已') ? 'var(--signal-success-text)' : 'var(--signal-error-text)' }}>{saveMsg}</span>}
      </div>
    </div>
  )
}
