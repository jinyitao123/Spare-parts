import { useState } from 'react'
import { useQuery } from '../hooks/useQuery'
import { fetchPurchaseSuggestions } from '../services/api'
import type { PurchaseSuggestion } from '../data/mockData'

const tabs = ['待审批', '已审批', '历史']

export default function Procurement() {
  const [activeTab, setActiveTab] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'agent' as const,
      content: '这批请购建议的总体分析：\n\n建议优先审批变频器和PLC模块——采购周期长，越早下单越安全。'
    }
  ])
  const [chatInput, setChatInput] = useState('')

  const statusMap = ['DRAFT', 'APPROVED', '']
  const { data: suggestions, loading } = useQuery(
    () => fetchPurchaseSuggestions(statusMap[activeTab] || undefined),
    [activeTab]
  )

  const items = suggestions || []

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(p => p.id)))
    }
  }

  const handleChat = () => {
    if (!chatInput.trim()) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user' as const, content: msg }])
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        role: 'agent' as const,
        content: `已收到您的问题"${msg}"，让我为您分析...`
      }])
    }, 600)
  }

  const totalAmount = items.reduce((s, p) => s + p.estimatedAmount, 0)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">采购需求</h1>

      <div className="flex gap-2">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(i); setSelectedIds(new Set()) }}
            className={`px-4 py-1.5 rounded-lg text-sm ${
              activeTab === i ? 'bg-accent text-white' : 'bg-card border border-border text-text-secondary hover:text-text'
            }`}
          >
            {tab}{i === 0 && items.length > 0 ? `(${items.length})` : ''}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="w-[60%] space-y-3">
          <div className="bg-card rounded-xl border border-border p-3 text-sm text-text-secondary flex items-center justify-between">
            <div>
              <span className="font-medium text-text">本批次：2026年3月</span>
              <span className="ml-3">预估总额：<strong className="text-text">{totalAmount.toLocaleString()}元</strong></span>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-text-secondary text-sm">加载中...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg text-text-secondary text-left">
                    <th className="px-3 py-2.5 font-medium w-8">
                      <input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleAll} className="accent-accent" />
                    </th>
                    <th className="px-3 py-2.5 font-medium">备件</th>
                    <th className="px-3 py-2.5 font-medium text-center">建议量</th>
                    <th className="px-3 py-2.5 font-medium text-right">金额</th>
                    <th className="px-3 py-2.5 font-medium text-center">紧急度</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <>
                      <tr
                        key={item.id}
                        className="border-t border-border hover:bg-bg/50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      >
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="accent-accent" />
                        </td>
                        <td className="px-3 py-2.5">{item.partName}</td>
                        <td className="px-3 py-2.5 text-center">{item.suggestedQty}</td>
                        <td className="px-3 py-2.5 text-right">{item.estimatedAmount.toLocaleString()}元</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            item.urgency === 'urgent' ? 'bg-danger/10 text-danger' : 'bg-gray-100 text-text-secondary'
                          }`}>
                            {item.urgency === 'urgent' ? '加急' : '常规'}
                          </span>
                        </td>
                      </tr>
                      {expandedId === item.id && (
                        <tr key={`${item.id}-detail`}>
                          <td colSpan={5} className="p-4 bg-bg/30 border-t border-border">
                            <PurchaseDetail item={item} />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {activeTab === 0 && (
            <div className="flex gap-2">
              <button onClick={toggleAll} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-bg">
                {selectedIds.size === items.length ? '取消全选' : '全选'}
              </button>
              <button className="px-3 py-1.5 text-sm bg-success text-white rounded-lg hover:opacity-90" disabled={selectedIds.size === 0}>
                批量审批（{selectedIds.size}）
              </button>
              <button className="px-3 py-1.5 text-sm bg-danger text-white rounded-lg hover:opacity-90" disabled={selectedIds.size === 0}>
                批量驳回（{selectedIds.size}）
              </button>
            </div>
          )}
        </div>

        <div className="w-[40%] bg-card rounded-xl border border-border flex flex-col h-[560px]">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-accent">✦</span>
              <span className="font-medium text-sm">Agent-5 采购建议师</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                  msg.role === 'user' ? 'bg-accent text-white' : 'bg-gray-100 text-text'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-border flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChat()}
              placeholder="输入你的问题..."
              className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent"
            />
            <button onClick={handleChat} className="bg-accent text-white px-3 py-1.5 rounded-lg text-sm hover:bg-accent-light">
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PurchaseDetail({ item }: { item: PurchaseSuggestion }) {
  const [qty, setQty] = useState(item.suggestedQty)

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-sm">{item.partName} · 请购详情</h3>
      <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
        <div className="text-sm text-accent font-medium mb-1">✦ Agent-5 建议理由：</div>
        <div className="text-xs text-text-secondary whitespace-pre-line">{item.reason}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-text-secondary">
        <div>当前库存：{item.currentStock}个</div>
        <div>安全库存：{item.safetyStock}个</div>
        <div>在途采购：{item.inTransit}个</div>
        <div>采购周期：{item.leadTimeDays}天</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm">
          采购数量：
          <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} min={1}
            className="w-16 mx-1 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" />
          <span className="text-xs text-text-secondary">（Agent建议：{item.suggestedQty}个）</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="px-3 py-1.5 text-sm bg-success text-white rounded-lg hover:opacity-90">✅ 确认</button>
        <button className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-light">✏️ 修改数量后确认</button>
        <button className="px-3 py-1.5 text-sm bg-danger text-white rounded-lg hover:opacity-90">❌ 驳回</button>
      </div>
    </div>
  )
}
