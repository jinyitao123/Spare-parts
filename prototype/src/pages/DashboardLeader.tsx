import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { UserRole } from '../data/mockData'
import { useQuery } from '../hooks/useQuery'
import { fetchWarehouseSummary, fetchInventoryHealth, fetchMonthlyValueTrend, fetchTopConsumption, fetchPurchaseSuggestions, fetchStaleItems, fetchOptimizationPlan } from '../services/api'

interface Props {
  role: UserRole;
}

export default function DashboardLeader({ role }: Props) {
  const { data: whData } = useQuery(() => fetchWarehouseSummary(), [])
  const { data: health } = useQuery(() => fetchInventoryHealth(), [])
  const { data: trendData } = useQuery(() => fetchMonthlyValueTrend(6), [])
  const { data: topData } = useQuery(() => fetchTopConsumption(30, 3), [])
  const { data: pendingPOs } = useQuery(() => fetchPurchaseSuggestions('DRAFT'), [])
  const { data: staleItems } = useQuery(() => fetchStaleItems(), [])
  const { data: optPlan } = useQuery(() => fetchOptimizationPlan(), [])

  const totalWan = whData?.total_value_wan ?? 0
  const targetWan = health?.target_value_wan ?? 40
  const gapWan = Math.max(0, totalWan - targetWan)
  const staleWan = (whData?.warehouses || []).reduce((s: number, w: any) => s + w.stale_value, 0) / 10000

  const statsCards = [
    { label: '当前库存', value: `${Math.round(totalWan)} 万元`, sub: `健康度 ${health?.health_score ?? '—'}分`, color: 'text-accent' },
    { label: '目标金额', value: `${targetWan} 万元`, sub: `差距${Math.round(gapWan)}万`, color: 'text-warning' },
    { label: '本月领用', value: topData?.items?.length ? `${((topData.items as any[]).reduce((s: number, i: any) => s + i.total_amount, 0) / 10000).toFixed(1)} 万元` : '— 万元', sub: '', color: 'text-success' },
    { label: '呆滞金额', value: `${staleWan.toFixed(0)} 万元`, sub: `占比${totalWan > 0 ? ((staleWan / totalWan) * 100).toFixed(1) : 0}%`, color: 'text-stale' },
  ]

  const monthlyTrend = (trendData?.trend || []).map(t => ({
    month: t.month,
    actual: t.actual,
    target: t.target,
  }))

  const topUsage = (topData?.items || []).map((item: any, i: number) => ({
    rank: i + 1,
    name: item.part_name,
    qty: item.total_qty,
    amount: `${item.total_amount.toLocaleString()}元`,
  }))

  const todos = [
    ...(pendingPOs && pendingPOs.length > 0 ? [{
      priority: 'danger' as const,
      icon: '\u{1F534}',
      agent: 'Agent-5 采购建议师',
      title: '采购审批',
      desc: `${pendingPOs.length}条请购建议待审批`,
      action: '去审批',
      link: '/procurement',
    }] : []),
    ...(optPlan?.items?.length ? [{
      priority: 'success' as const,
      icon: '\u{1F7E2}',
      agent: 'Agent-9a 日频优化',
      title: '今日优化建议',
      desc: `今日可优化释放${Math.round(optPlan.total_releasable / 10000)}万，涉及${optPlan.items.length}种备件`,
      action: '查看建议清单',
      link: '/kanban',
      isAgent: true,
    }] : []),
    ...(staleItems && staleItems.length > 0 ? [{
      priority: 'stale' as const,
      icon: '\u{1F7E3}',
      agent: 'Agent-4 呆滞侦探',
      title: '呆滞处置',
      desc: `${staleItems.length}件呆滞备件待处置`,
      action: '查看处置方案',
      link: '/stale',
    }] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">工作台</h1>
        <span className="text-sm text-text-secondary">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {statsCards.map((card, i) => (
          <div key={i} className="bg-card rounded-xl p-4 border border-border hover:shadow-md transition-shadow cursor-pointer">
            <div className="text-sm text-text-secondary mb-1">{card.label}</div>
            <div className="text-2xl font-semibold mb-1">{card.value}</div>
            <div className={`text-xs ${card.color}`}>{card.sub}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-base font-medium mb-3 flex items-center gap-2">
          <span>⚡</span> 待处理事项
        </h2>
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {todos.map((todo, i) => (
            <div key={i} className="p-4 hover:bg-bg/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{todo.icon}</span>
                    <span className="font-medium text-sm">{todo.title}</span>
                    <span className="text-xs text-text-secondary">（{todo.agent}）</span>
                    {todo.isAgent && <span className="text-accent text-xs">✦</span>}
                  </div>
                  <div className="text-sm text-text-secondary ml-6">{todo.desc}</div>
                  {todo.detail && <div className="text-sm text-text-secondary ml-6">{todo.detail}</div>}
                </div>
                <a href={todo.link} className="text-sm text-accent hover:text-accent-light flex items-center gap-1 shrink-0 ml-4">
                  {todo.action} →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">📋 本月领用 Top3</h3>
          <div className="space-y-3">
            {topUsage.map(item => (
              <div key={item.rank} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    item.rank === 1 ? 'bg-warning/20 text-warning' : 'bg-gray-100 text-text-secondary'
                  }`}>{item.rank}</span>
                  <span className="text-sm">{item.name} ×{item.qty}</span>
                </div>
                <span className="text-sm text-text-secondary">{item.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">📈 库存金额趋势（近6月）</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" domain={['auto', 'auto']} />
              <Tooltip formatter={(v: number) => `${v}万`} />
              <ReferenceLine y={targetWan} stroke="#F59E0B" strokeDasharray="5 5" label={{ value: `目标${targetWan}万`, position: 'right', fontSize: 10, fill: '#F59E0B' }} />
              <Line type="monotone" dataKey="actual" stroke="#4A90D9" strokeWidth={2} dot={{ fill: '#4A90D9', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
