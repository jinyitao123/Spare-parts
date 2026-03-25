import { useState, useEffect } from 'react'
import { useQuery } from '../hooks/useQuery'
import { fetchInventory, fetchMovements, executeMovement } from '../services/api'
import type { InventoryItem, StockMovement } from '../data/mockData'

const warehouseIds: Record<string, string> = {
  '一级总库': 'WH-PRIMARY',
  '二级库-工段A': 'WH-SEC-A',
  '二级库-工段B': 'WH-SEC-B',
  '二级库-工段C': 'WH-SEC-C',
}
const warehouses = Object.keys(warehouseIds)

const statusIcon = {
  sufficient: '✅',
  critical: '⚠️',
  shortage: '🔴',
  stale: '🟣',
}

type ModalType = 'none' | 'outbound' | 'inbound' | 'return' | 'records'

export default function Warehouse() {
  const [selectedWarehouse, setSelectedWarehouse] = useState('一级总库')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalType>('none')
  const [showAgentPanel, setShowAgentPanel] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([
    { role: 'agent' as const, content: '需要领料或查询？直接告诉我。' }
  ])

  const whId = warehouseIds[selectedWarehouse]
  const { data, loading, refetch } = useQuery(
    () => fetchInventory({ warehouse_id: whId }),
    [whId]
  )

  const positions = data?.positions || []
  const items = (data?.inventory || []).filter(i => {
    if (!search) return true
    const pos = positions.find(p => p.part_id === i.partCode)
    return i.partCode.includes(search) ||
      (pos?.part_name || '').includes(search) ||
      (pos?.specification || '').includes(search)
  })

  const totalAmount = items.reduce((s, i) => s + i.amount, 0)
  const totalTypes = items.length
  const staleCount = items.filter(i => i.status === 'stale').length

  const getPartInfo = (partCode: string) => {
    const pos = positions.find(p => p.part_id === partCode)
    return pos ? { name: pos.part_name, spec: pos.specification } : { name: partCode, spec: '' }
  }

  const handleChat = () => {
    if (!chatInput.trim()) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user' as const, content: msg }])
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        role: 'agent' as const,
        content: `已收到您的查询"${msg}"，正在为您查找...`
      }])
    }, 600)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">备件库房</h1>
      </div>

      <div className="flex gap-2">
        {warehouses.map(w => (
          <button
            key={w}
            onClick={() => setSelectedWarehouse(w)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
              selectedWarehouse === w
                ? 'bg-accent text-white'
                : 'bg-card border border-border text-text-secondary hover:text-text'
            }`}
          >
            {w}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <div className={`${showAgentPanel ? 'w-[60%]' : 'flex-1'} space-y-3 transition-all`}>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索备件名称/编码/规格"
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:border-accent"
              />
            </div>
            <button onClick={() => setModal('outbound')} className="px-3 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-light">出库</button>
            <button onClick={() => setModal('inbound')} className="px-3 py-2 bg-card border border-border text-text rounded-lg text-sm hover:bg-bg">入库</button>
            <button onClick={() => setModal('return')} className="px-3 py-2 bg-card border border-border text-text rounded-lg text-sm hover:bg-bg">退库</button>
            <button onClick={() => setModal('records')} className="px-3 py-2 bg-card border border-border text-text rounded-lg text-sm hover:bg-bg">记录</button>
            <button className="px-3 py-2 bg-card border border-border text-text rounded-lg text-sm hover:bg-bg">导出</button>
            <button onClick={() => setShowAgentPanel(!showAgentPanel)} className="px-3 py-2 bg-accent/10 text-accent rounded-lg text-sm hover:bg-accent/20">
              {showAgentPanel ? '收起Agent' : '✦ Agent'}
            </button>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-text-secondary text-sm">加载中...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg text-text-secondary text-left">
                    <th className="px-3 py-2.5 font-medium">物料编码</th>
                    <th className="px-3 py-2.5 font-medium">备件名称</th>
                    <th className="px-3 py-2.5 font-medium">规格型号</th>
                    <th className="px-3 py-2.5 font-medium text-center">库存</th>
                    <th className="px-3 py-2.5 font-medium text-center">安全库存</th>
                    <th className="px-3 py-2.5 font-medium text-right">金额</th>
                    <th className="px-3 py-2.5 font-medium">末次变动</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const part = getPartInfo(item.partCode)
                    return (
                      <tr
                        key={idx}
                        className={`border-t border-border hover:bg-bg/50 cursor-pointer ${
                          item.status === 'shortage' || item.status === 'critical' ? 'bg-row-danger' :
                          item.status === 'stale' ? 'bg-row-stale' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 font-mono text-xs">{item.partCode}</td>
                        <td className="px-3 py-2.5">{part.name}</td>
                        <td className="px-3 py-2.5 text-text-secondary">{part.spec}</td>
                        <td className="px-3 py-2.5 text-center">
                          {item.stock} {statusIcon[item.status]}
                        </td>
                        <td className="px-3 py-2.5 text-center text-text-secondary">{item.safetyStock}</td>
                        <td className="px-3 py-2.5 text-right">{item.amount.toLocaleString()}元</td>
                        <td className="px-3 py-2.5 text-text-secondary text-xs">{item.lastChange}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>共 {items.length} 条</span>
          </div>
        </div>

        {showAgentPanel && (
          <div className="w-[40%] bg-card rounded-xl border border-border flex flex-col h-[600px]">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-accent">✦</span>
                <span className="font-medium text-sm">Agent-1 库存管家</span>
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
        )}
      </div>

      <div className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-6 text-sm">
        <span>📊 本库汇总：</span>
        <span>总金额 <strong>{(totalAmount / 10000).toFixed(0)}万</strong></span>
        <span className="text-border">│</span>
        <span>备件种类 <strong>{totalTypes}</strong></span>
        <span className="text-border">│</span>
        <span>呆滞件 <strong className="text-stale">{staleCount}</strong>（占比{totalTypes > 0 ? ((staleCount / totalTypes) * 100).toFixed(0) : 0}%）</span>
      </div>

      {modal !== 'none' && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40" onClick={() => setModal('none')}>
          <div className="bg-card rounded-xl shadow-2xl w-[480px] max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            {modal === 'outbound' && <OutboundForm positions={positions} warehouse={selectedWarehouse} onClose={() => { setModal('none'); refetch() }} />}
            {modal === 'inbound' && <InboundForm onClose={() => { setModal('none'); refetch() }} />}
            {modal === 'return' && <ReturnForm onClose={() => { setModal('none'); refetch() }} />}
            {modal === 'records' && <RecordsView onClose={() => setModal('none')} />}
          </div>
        </div>
      )}
    </div>
  )
}

function OutboundForm({ positions, warehouse, onClose }: { positions: any[]; warehouse: string; onClose: () => void }) {
  const [code, setCode] = useState('BJ-0421')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const [equipment, setEquipment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const pos = positions.find(p => p.part_id === code)
  const reasons = ['故障维修', '保养更换', '技改', '项目实施', '报废退换', '其他']
  const reasonMap: Record<string, string> = {
    '故障维修': 'FAULT_REPAIR', '保养更换': 'MAINTENANCE', '技改': 'TECH_UPGRADE',
    '项目实施': 'PROJECT', '报废退换': 'SCRAP_RETURN', '其他': 'OTHER',
  }

  const handleSubmit = async () => {
    if (!pos) return
    setSubmitting(true)
    setError('')
    try {
      await executeMovement({
        position_id: pos.position_id,
        movement_type: 'OUT',
        quantity: qty,
        operator_id: '当前用户',
        movement_reason: reasonMap[reason] || 'OTHER',
        equipment_id: equipment || undefined,
      })
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-base font-semibold mb-4">出库登记</h2>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-text-secondary mb-1 block">扫码 / 输入物料编码：</label>
          <div className="flex gap-2">
            <input value={code} onChange={e => setCode(e.target.value)} className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
            <button className="px-3 py-2 bg-bg border border-border rounded-lg text-sm">扫码 📷</button>
          </div>
        </div>
        {pos && (
          <>
            <div className="text-sm">备件名称：<strong>{pos.part_name}</strong>（自动填充）</div>
            <div className="text-sm">当前库存：<strong>{pos.current_qty}</strong></div>
            <div>
              <label className="text-sm text-text-secondary mb-1 block">出库数量：</label>
              <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} min={1} className="w-24 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-sm text-text-secondary mb-1 block">领用原因：</label>
              <div className="flex gap-2 flex-wrap">
                {reasons.map(r => (
                  <button key={r} onClick={() => setReason(r)} className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${reason === r ? 'bg-accent text-white border-accent' : 'border-border hover:bg-bg'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-text-secondary mb-1 block">关联设备（可选）：</label>
              <input value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="搜索设备..." className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
            </div>
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
              <div className="text-sm text-accent font-medium mb-1">✦ Agent提示：</div>
              <div className="text-xs text-text-secondary space-y-0.5">
                <div>此备件单价{pos.unit_price}元 {pos.unit_price < 2000 ? '< 2000元' : '≥ 2000元，需审批'}</div>
                <div>库存{pos.current_qty > pos.safety_stock ? '充足 ✅' : '⚠️ 接近安全线'}</div>
              </div>
            </div>
          </>
        )}
        {error && <div className="text-sm text-danger">{error}</div>}
      </div>
      <div className="flex justify-end gap-3 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-bg">取消</button>
        <button onClick={handleSubmit} disabled={submitting || !pos} className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-light disabled:opacity-50">
          {submitting ? '提交中...' : '确认出库'}
        </button>
      </div>
    </div>
  )
}

function InboundForm({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-5">
      <h2 className="text-base font-semibold mb-4">入库登记</h2>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-text-secondary mb-1 block">物料编码：</label>
          <input defaultValue="BJ-0535" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
        </div>
        <div className="text-sm">备件名称：<strong>X型变频器</strong></div>
        <div>
          <label className="text-sm text-text-secondary mb-1 block">入库数量：</label>
          <input type="number" defaultValue={3} min={1} className="w-24 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="text-sm text-text-secondary mb-1 block">入库原因：</label>
          <div className="flex gap-2 flex-wrap">
            {['采购到货', '调拨入库', '退库返还', '其他'].map(r => (
              <button key={r} className="px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-bg">{r}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-bg">取消</button>
        <button onClick={onClose} className="px-4 py-2 text-sm bg-success text-white rounded-lg hover:opacity-90">确认入库</button>
      </div>
    </div>
  )
}

function ReturnForm({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-5">
      <h2 className="text-base font-semibold mb-4">退库登记</h2>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-text-secondary mb-1 block">物料编码：</label>
          <input defaultValue="BJ-0233" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
        </div>
        <div className="text-sm">备件名称：<strong>密封圈</strong></div>
        <div>
          <label className="text-sm text-text-secondary mb-1 block">退库数量：</label>
          <input type="number" defaultValue={5} min={1} className="w-24 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="text-sm text-text-secondary mb-1 block">退库原因：</label>
          <input defaultValue="未使用" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-bg">取消</button>
        <button onClick={onClose} className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-light">确认退库</button>
      </div>
    </div>
  )
}

function RecordsView({ onClose }: { onClose: () => void }) {
  const [typeFilter, setTypeFilter] = useState('全部')
  const types = ['全部', '出库', '入库', '退库', '报废']

  const typeMap: Record<string, string> = { '出库': 'OUT', '入库': 'IN', '退库': 'RETURN', '报废': 'SCRAP' }
  const args = typeFilter !== '全部' ? { movement_type: typeMap[typeFilter], days: 30 } : { days: 30 }
  const { data: movements, loading } = useQuery(() => fetchMovements(args), [typeFilter])

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">出入库记录</h2>
        <button className="text-sm text-accent hover:text-accent-light">导出Excel</button>
      </div>
      <div className="flex gap-2 mb-3">
        {types.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1 rounded text-xs ${typeFilter === t ? 'bg-accent text-white' : 'bg-bg text-text-secondary hover:text-text'}`}>
            {t}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="p-4 text-center text-text-secondary text-sm">加载中...</div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-secondary text-left bg-bg">
              <th className="px-2 py-2 font-medium">时间</th>
              <th className="px-2 py-2 font-medium">类型</th>
              <th className="px-2 py-2 font-medium">备件</th>
              <th className="px-2 py-2 font-medium">数量</th>
              <th className="px-2 py-2 font-medium">原因</th>
              <th className="px-2 py-2 font-medium">操作人</th>
            </tr>
          </thead>
          <tbody>
            {(movements || []).map(m => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-2 py-2">{m.datetime}</td>
                <td className="px-2 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    m.type === '出库' ? 'bg-danger/10 text-danger' :
                    m.type === '入库' ? 'bg-success/10 text-success' :
                    m.type === '退库' ? 'bg-accent/10 text-accent' :
                    'bg-gray-100 text-text-secondary'
                  }`}>{m.type}</span>
                </td>
                <td className="px-2 py-2">{m.partName || m.partCode}</td>
                <td className="px-2 py-2">{m.qty}</td>
                <td className="px-2 py-2">{m.reason}</td>
                <td className="px-2 py-2">{m.operator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex justify-end mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-bg">关闭</button>
      </div>
    </div>
  )
}
