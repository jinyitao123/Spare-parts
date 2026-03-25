import { useState } from 'react'
import { useQuery } from '../hooks/useQuery'
import { fetchStaleItems } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function StaleInventory() {
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const { data: staleItems, loading } = useQuery(() => fetchStaleItems(), [])

  const items = staleItems || []
  const totalAmount = items.reduce((s, i) => s + i.amount, 0)
  const totalCount = items.length
  const newThisMonth = items.filter(i => i.staleMonths <= 14).length

  const ageDistribution = [
    { range: '6-12月', count: items.filter(i => i.staleMonths >= 6 && i.staleMonths < 12).length },
    { range: '12-18月', count: items.filter(i => i.staleMonths >= 12 && i.staleMonths < 18).length },
    { range: '18-24月', count: items.filter(i => i.staleMonths >= 18 && i.staleMonths < 24).length },
    { range: '24月以上', count: items.filter(i => i.staleMonths >= 24).length },
  ]

  const disposalCounts: Record<string, number> = {}
  for (const item of items) {
    disposalCounts[item.suggestion] = (disposalCounts[item.suggestion] || 0) + 1
  }
  const disposalSummary = Object.entries(disposalCounts).map(([type, count]) => ({
    type,
    count,
    color: type === '代用匹配' ? 'text-accent' : type === '调拨' ? 'text-success' :
           type === '折价处理' ? 'text-warning' : type === '报废' ? 'text-danger' : 'text-stale',
  }))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">呆滞库存管理</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="text-sm text-text-secondary mb-1">呆滞总金额</div>
          <div className="text-2xl font-semibold text-stale">{(totalAmount / 10000).toFixed(1)} 万元</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="text-sm text-text-secondary mb-1">呆滞件数</div>
          <div className="text-2xl font-semibold">{totalCount} 种</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="text-sm text-text-secondary mb-1">本月新增</div>
          <div className="text-2xl font-semibold">{newThisMonth} 种</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium mb-3">库龄分布</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={ageDistribution} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <YAxis type="category" dataKey="range" tick={{ fontSize: 11 }} stroke="#94A3B8" width={70} />
              <Tooltip />
              <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium mb-3">处置建议汇总</h3>
          <div className="space-y-2.5">
            {disposalSummary.map(d => (
              <div key={d.type} className="flex items-center justify-between text-sm">
                <span className={d.color}>{d.type}</span>
                <span className="font-medium">{d.count}件</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-secondary text-sm">加载中...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg text-text-secondary text-left">
                <th className="px-3 py-2.5 font-medium">备件</th>
                <th className="px-3 py-2.5 font-medium text-center">库存</th>
                <th className="px-3 py-2.5 font-medium text-right">金额</th>
                <th className="px-3 py-2.5 font-medium text-center">库龄</th>
                <th className="px-3 py-2.5 font-medium">✦ 呆滞原因</th>
                <th className="px-3 py-2.5 font-medium">✦ 建议处置</th>
                <th className="px-3 py-2.5 font-medium text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <>
                  <tr
                    key={item.partCode}
                    className={`border-t border-border hover:bg-bg/50 cursor-pointer ${item.isExempt ? '' : 'bg-row-stale'}`}
                    onClick={() => setExpandedCode(expandedCode === item.partCode ? null : item.partCode)}
                  >
                    <td className="px-3 py-2.5">{item.partName}</td>
                    <td className="px-3 py-2.5 text-center">{item.stock}</td>
                    <td className="px-3 py-2.5 text-right">{item.amount.toLocaleString()}元</td>
                    <td className="px-3 py-2.5 text-center">{item.staleMonths}月</td>
                    <td className="px-3 py-2.5">
                      {item.isExempt && <span className="text-accent text-xs">✦ </span>}
                      {item.reason}
                      {item.isExempt && <span className="text-xs text-stale ml-1">(豁免)</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`${
                        item.suggestion === '代用匹配' ? 'text-accent' :
                        item.suggestion === '报废' ? 'text-danger' :
                        item.suggestion === '折价处理' ? 'text-warning' :
                        item.suggestion === '调拨' ? 'text-success' :
                        'text-stale'
                      }`}>
                        {item.suggestion}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-center">
                        {!item.isExempt && (
                          <button className="px-2 py-0.5 text-xs bg-accent text-white rounded hover:bg-accent-light">执行</button>
                        )}
                        <button className="px-2 py-0.5 text-xs border border-border rounded hover:bg-bg">
                          {item.isExempt ? '取消豁免' : '豁免'}
                        </button>
                      </div>
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
