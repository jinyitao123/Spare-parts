import { useState } from 'react'
import { useQuery } from '../hooks/useQuery'
import { fetchInventory, fetchMovements } from '../services/api'

export default function DashboardEngineer() {
  const [inputText, setInputText] = useState('')
  const [completedRecords, setCompletedRecords] = useState<Set<number>>(new Set())

  const { data: invData } = useQuery(() => fetchInventory(), [])
  const { data: movements } = useQuery(() => fetchMovements({ days: 1, movement_type: 'OUT' }), [])

  // Top frequently used parts (by lowest stock / most critical)
  const frequentParts = (invData?.inventory || [])
    .filter(item => ['6205轴承', '温度传感器', 'X型变频器', 'PLC控制模块'].some(n => item.partCode.includes(n) || (invData?.spareParts.find(p => p.code === item.partCode)?.name || '').includes(n)))
    .slice(0, 8)
    .map(item => {
      const part = invData?.spareParts.find(p => p.code === item.partCode)
      return {
        name: part?.name || item.partCode,
        stock: item.stock,
        status: item.stock <= item.safetyStock ? 'critical' : 'sufficient',
      }
    })
    // Dedupe by name
    .filter((v, i, a) => a.findIndex(x => x.name === v.name) === i)

  // Recent OUT movements that may need completion (simulate pending records)
  const pendingRecords = (movements || []).slice(0, 3).map(m => ({
    time: m.datetime,
    part: `${m.partName || m.partCode}×${m.qty}`,
    missing: m.equipment === '—' ? '关联设备未填写' : '领用原因未填写',
    quickOptions: ['1号线', '2号线', '3号线', '其他'],
  }))

  // My parts table from real inventory
  const myParts = (invData?.inventory || [])
    .slice(0, 10)
    .map(item => {
      const part = invData?.spareParts.find(p => p.code === item.partCode)
      const isCritical = item.stock <= item.safetyStock
      return {
        name: part?.name || item.partCode,
        stock: item.stock,
        safety: item.safetyStock,
        status: isCritical ? '临界' : '充足',
        statusColor: isCritical ? 'text-warning' : 'text-success',
      }
    })
    .filter((v, i, a) => a.findIndex(x => x.name === v.name) === i)
    .slice(0, 6)

  const handleComplete = (idx: number) => {
    setCompletedRecords(prev => new Set([...prev, idx]))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">工作台</h1>
        <span className="text-sm text-text-secondary">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>

      {/* Quick issue - Agent-1 */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
          <span className="text-accent">✦</span> 快捷领料（Agent-1 库存管家）
        </h2>
        <div className="mb-4">
          <div className="text-sm text-text-secondary mb-2">需要领料？直接告诉我：</div>
          <div className="flex gap-2">
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder='例如："3号线电机要换轴承"'
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
            <button className="bg-accent text-white px-4 py-2 rounded-lg text-sm hover:bg-accent-light transition-colors">
              发送
            </button>
          </div>
        </div>
        <div>
          <div className="text-sm text-text-secondary mb-2">常用备件快捷入口：</div>
          <div className="flex gap-2 flex-wrap">
            {frequentParts.map(part => (
              <button
                key={part.name}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  part.status === 'critical'
                    ? 'border-warning/50 bg-warning/5 hover:bg-warning/10'
                    : 'border-border bg-bg hover:bg-gray-100'
                }`}
              >
                {part.name}
                <span className={`ml-1.5 ${part.status === 'critical' ? 'text-warning' : 'text-text-secondary'}`}>
                  库存:{part.stock}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pending records */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
          📝 待补全记录（{pendingRecords.length - completedRecords.size}条）
        </h2>
        <div className="divide-y divide-border">
          {pendingRecords.map((record, i) => (
            <div key={i} className={`py-3 ${completedRecords.has(i) ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm">
                  <span className="text-text-secondary">{record.time}</span>
                  <span className="ml-2">领用 {record.part}</span>
                </div>
                {completedRecords.has(i) && (
                  <span className="text-xs text-success">✅ 已补全</span>
                )}
              </div>
              {!completedRecords.has(i) && (
                <>
                  <div className="text-sm text-warning mb-2">❓ {record.missing}</div>
                  <div className="flex gap-2 flex-wrap">
                    {record.quickOptions.map(opt => (
                      <button
                        key={opt}
                        onClick={() => handleComplete(i)}
                        className="px-3 py-1 rounded-lg text-xs border border-accent/30 text-accent bg-accent/5 hover:bg-accent/10 transition-colors"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* My frequently used parts */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2">📦 我的常用备件库存状态</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-secondary text-left">
              <th className="pb-2 font-medium">备件</th>
              <th className="pb-2 font-medium">库存</th>
              <th className="pb-2 font-medium">安全线</th>
              <th className="pb-2 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {myParts.map(part => (
              <tr key={part.name} className="border-t border-border">
                <td className="py-2.5">{part.name}</td>
                <td className="py-2.5">{part.stock}</td>
                <td className="py-2.5">{part.safety}</td>
                <td className={`py-2.5 ${part.statusColor}`}>{part.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
