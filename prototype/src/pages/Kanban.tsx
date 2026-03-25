import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar } from 'recharts'
import { useQuery } from '../hooks/useQuery'
import { fetchWarehouseSummary, fetchInventoryHealth, fetchOptimizationPlan, fetchMonthlyValueTrend, fetchTopConsumption } from '../services/api'

export default function Kanban() {
  const { data: whData } = useQuery(() => fetchWarehouseSummary(), [])
  const { data: health } = useQuery(() => fetchInventoryHealth(), [])
  const { data: optPlan } = useQuery(() => fetchOptimizationPlan(), [])
  const { data: trendData } = useQuery(() => fetchMonthlyValueTrend(12), [])
  const { data: topData } = useQuery(() => fetchTopConsumption(30, 3), [])

  const totalWan = whData?.total_value_wan ?? 0
  const targetWan = health?.target_value_wan ?? 40
  const gapWan = Math.max(0, totalWan - targetWan)
  const progressPct = totalWan > 0 ? Math.round(((1 - gapWan / totalWan) * 100)) : 0

  const warehouseDistribution = (whData?.warehouses || []).map(w => ({
    name: w.warehouse_name,
    amount: Math.round(w.total_value / 10000),
  }))

  const monthlyTrend = (trendData?.trend || []).map(t => ({
    month: t.month,
    actual: t.actual,
    target: t.target,
  }))

  const topUsage = (topData?.items || []).map((item, i) => ({
    rank: i + 1,
    name: item.part_name,
    qty: item.total_qty,
    amount: `${item.total_amount.toLocaleString()}元`,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">库存看板</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {['按部门', '按工段', '按工序'].map((v, i) => (
              <button key={v} className={`px-3 py-1 rounded text-xs ${i === 0 ? 'bg-accent text-white' : 'bg-card border border-border text-text-secondary'}`}>
                {v}
              </button>
            ))}
          </div>
          <span className="text-sm text-text-secondary">2026年3月</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">当前金额 vs 目标金额</h3>
          <div className="space-y-3">
            <div className="text-3xl font-bold">{Math.round(totalWan)}万</div>
            <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all" style={{ width: `${Math.min(100, progressPct)}%` }} />
              <div className="absolute inset-y-0 bg-accent/30 rounded-r-full" style={{ left: `${Math.min(100, progressPct)}%`, width: `${Math.max(0, 100 - progressPct)}%` }} />
            </div>
            <div className="flex items-center justify-between text-sm text-text-secondary">
              <span>目标 <strong className="text-warning">{targetWan}万</strong></span>
              <span>差距 <strong className="text-danger">{Math.round(gapWan)}万</strong></span>
            </div>
            <div className="text-sm">
              健康度评分：<strong className="text-accent">{health?.health_score ?? '—'}分</strong>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-2">金额趋势（近12月）</h3>
          <div className="flex gap-4 text-xs text-text-secondary mb-2">
            <span>环比：<strong className="text-success">▼3.2%</strong></span>
            <span>同比：<strong className="text-success">▼12.1%</strong></span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" domain={['auto', 'auto']} />
              <Tooltip formatter={(v: number) => `${v}万`} />
              <ReferenceLine y={targetWan} stroke="#F59E0B" strokeDasharray="5 5" label={{ value: '目标', position: 'right', fontSize: 10, fill: '#F59E0B' }} />
              <Line type="monotone" dataKey="actual" stroke="#4A90D9" strokeWidth={2} dot={{ fill: '#4A90D9', r: 3 }} name="实际" />
              <Line type="monotone" dataKey="target" stroke="#F59E0B" strokeWidth={1} strokeDasharray="5 5" dot={false} name="目标" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-3">本月领用 Top3</h3>
          <div className="space-y-3">
            {topUsage.map(item => (
              <div key={item.rank} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    item.rank === 1 ? 'bg-warning/20 text-warning' : 'bg-gray-100 text-text-secondary'
                  }`}>{item.rank}</span>
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-text-secondary">×{item.qty}</div>
                  </div>
                </div>
                <span className="text-sm font-medium">{item.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-3">各库房金额分布</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={warehouseDistribution} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94A3B8" width={85} />
              <Tooltip formatter={(v: number) => `${v}万`} />
              <Bar dataKey="amount" fill="#4A90D9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <span className="text-accent">✦</span> Agent分析摘要（Agent-2 金额看板员）
        </h3>
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 text-sm text-text-secondary leading-relaxed">
          "3月库存金额环比下降3.2%，连续第3个月下降，趋势良好。主要贡献来自一级库的变频器库存消化（-5.6万）。但二级库A金额环比上升8%，主要因为3号线轴承领用频次异常——建议关注。按当前降速，预计8月可达{targetWan}万目标。"
        </div>
      </div>

      {optPlan?.items?.length && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <span className="text-accent">✦</span> 今日优化建议（Agent-9a 日频优化）
          </h3>
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 text-sm space-y-2">
            <div className="font-medium">
              如果执行以下优化，金额可从{Math.round(optPlan.current_value / 10000)}万降至{Math.round(optPlan.projected_value / 10000)}万
              （-{Math.round(optPlan.total_releasable / 10000)}万）：
            </div>
            <ol className="list-decimal ml-4 text-text-secondary space-y-1">
              {optPlan.items.slice(0, 3).map((item, i) => (
                <li key={i}>
                  {item.part_name}({item.warehouse_name})：{item.current_qty}→{item.suggested_qty}个，释放{' '}
                  <strong className="text-text">{item.releasable_value.toLocaleString()}元</strong>
                </li>
              ))}
              {optPlan.items.length > 3 && (
                <li>其他{optPlan.items.length - 3}种备件：合计释放 <strong className="text-text">
                  {optPlan.items.slice(3).reduce((s, i) => s + i.releasable_value, 0).toLocaleString()}元
                </strong></li>
              )}
            </ol>
            {(optPlan.warnings?.length ?? 0) > 0 && (
              <div className="text-warning text-xs mt-2">
                ⚠️ 风险提示：
                {optPlan.warnings.map((w, i) => <div key={i}>· {w}</div>)}
              </div>
            )}
            <div className="flex gap-3 mt-3">
              <button className="px-4 py-1.5 bg-accent text-white rounded-lg text-sm hover:bg-accent-light">查看完整清单 →</button>
              <button className="px-4 py-1.5 border border-border rounded-lg text-sm hover:bg-bg">导出建议 →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
