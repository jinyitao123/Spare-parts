import { useState } from 'react'
import { useQuery } from '../hooks/useQuery'
import { fetchInventory, fetchStockLevel, fetchConsumptionTrend } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const categories = ['全部', '轴承', '变频器', '控制器', '传感器', '密封件', '线缆', '过滤器', '润滑', '电气', '阀门', '气动']

export default function PartsCatalog() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('全部')
  const [expandedCode, setExpandedCode] = useState<string | null>(null)

  const { data, loading } = useQuery(() => fetchInventory(), [])
  const spareParts = data?.spareParts || []

  const filtered = spareParts.filter(p => {
    const matchSearch = !search || p.name.includes(search) || p.code.includes(search) || p.spec.includes(search)
    const matchCat = category === '全部' || p.category === category
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">备件台账</h1>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm hover:bg-accent-light">新增</button>
          <button className="px-3 py-1.5 bg-card border border-border text-text rounded-lg text-sm hover:bg-bg">导入</button>
          <button className="px-3 py-1.5 bg-card border border-border text-text rounded-lg text-sm hover:bg-bg">导出</button>
        </div>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索备件名称/编码/规格"
          className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              category === c ? 'bg-accent text-white' : 'bg-card border border-border text-text-secondary hover:text-text'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-secondary text-sm">加载中...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg text-text-secondary text-left">
                <th className="px-3 py-2.5 font-medium">物料编码</th>
                <th className="px-3 py-2.5 font-medium">名称</th>
                <th className="px-3 py-2.5 font-medium">规格型号</th>
                <th className="px-3 py-2.5 font-medium">分类</th>
                <th className="px-3 py-2.5 font-medium text-right">标准价</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(part => (
                <>
                  <tr
                    key={part.code}
                    onClick={() => setExpandedCode(expandedCode === part.code ? null : part.code)}
                    className="border-t border-border hover:bg-bg/50 cursor-pointer"
                  >
                    <td className="px-3 py-2.5 font-mono text-xs">{part.code}</td>
                    <td className="px-3 py-2.5">{part.name}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{part.spec}</td>
                    <td className="px-3 py-2.5">{part.category}</td>
                    <td className="px-3 py-2.5 text-right">{part.price.toLocaleString()}元</td>
                  </tr>
                  {expandedCode === part.code && (
                    <tr key={`${part.code}-detail`}>
                      <td colSpan={5} className="p-4 bg-bg/30 border-t border-border">
                        <PartDetail code={part.code} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function PartDetail({ code }: { code: string }) {
  const { data: stockData, loading: stockLoading } = useQuery(() => fetchStockLevel(code), [code])
  const { data: trendData } = useQuery(() => fetchConsumptionTrend(code), [code])

  const consumptionData = (trendData?.months || []).map(m => ({
    month: m.month.slice(5) + '月',
    qty: m.consumption,
  }))

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">库存分布</h4>
          {stockLoading ? (
            <div className="text-xs text-text-secondary">加载中...</div>
          ) : (
            <>
              <div className="text-xs text-text-secondary mb-2">全仓合计：{stockData?.total_qty ?? 0} 个</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-secondary">
                    <th className="text-left pb-1 font-medium">库房</th>
                    <th className="text-center pb-1 font-medium">库存</th>
                    <th className="text-center pb-1 font-medium">安全线</th>
                    <th className="text-center pb-1 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {(stockData?.warehouses || []).map(w => (
                    <tr key={w.warehouse_id} className="border-t border-border/50">
                      <td className="py-1.5">{w.warehouse_name}</td>
                      <td className="text-center py-1.5">{w.current_qty}</td>
                      <td className="text-center py-1.5">{w.safety_stock}</td>
                      <td className="text-center py-1.5">
                        {w.is_stale ? '🟣' : w.safety_gap > 0 ? '🔴' : w.safety_gap === 0 ? '⚠️' : '✅'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">消耗趋势（近6月）</h4>
        {consumptionData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={consumptionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <Tooltip />
              <Bar dataKey="qty" fill="#4A90D9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-xs text-text-secondary p-4">暂无消耗数据</div>
        )}
      </div>
    </div>
  )
}
