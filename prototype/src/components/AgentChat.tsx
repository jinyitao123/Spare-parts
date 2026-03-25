import { useState } from 'react'

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  card?: {
    title: string;
    items: string[];
    actions: string[];
  };
}

const initialMessages: ChatMessage[] = [
  { role: 'agent', content: '你好！我是 Agent-1 库存管家。需要领料、查库存或其他帮助，随时告诉我。' },
]

const quickActions = ['查库存', '领料', '看金额', '呆滞处理', '采购进度']

export default function AgentChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [hasUnread, setHasUnread] = useState(true)

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg = input.trim()
    setInput('')

    setMessages(prev => [...prev, { role: 'user', content: userMsg }])

    // Simulate agent response
    setTimeout(() => {
      if (userMsg.includes('轴承') || userMsg.includes('领') || userMsg.includes('换')) {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: '好的。3号线电机适配的轴承型号是6205。当前库存2个（安全线）。\n\n检测到本月第3次领用同一备件，频次异常。建议检查3号线电机底座对中情况。',
          card: {
            title: '✦ 领用方案',
            items: [
              '📦 6205-2RS 密封型轴承 × 1',
              '   库位：二级库A-3号架',
              '   单价：180元（比标准型便宜20元）',
              '   💡 此件为呆滞库存（14个月），优先消化',
            ],
            actions: ['确认推荐方案', '选择备选方案', '取消'],
          }
        }])
      } else if (userMsg.includes('库存') || userMsg.includes('查')) {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: '当前二级库-工段A库存概况：\n\n• 6205轴承：2个（⚠️ 临界）\n• 温度传感器：8个（✅ 充足）\n• X型变频器：5个（✅ 充足）\n• PLC模块：2个（⚠️ 临界）\n\n总金额约42万元。有2项临界库存，建议关注补货。'
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: '收到。让我为您查询一下相关信息...\n\n目前系统运行正常，如需具体操作请告诉我备件名称或编码。'
        }])
      }
    }, 800)
  }

  const handleQuickAction = (action: string) => {
    setInput(action)
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'user', content: action }])
      if (action === '查库存') {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: 'agent',
            content: '当前选择的库房总览：\n\n• 总金额：218万\n• 备件种类：156种\n• 呆滞件：12种（占比8%）\n• 低于安全库存：5种\n\n需要查看具体哪个备件的库存？'
          }])
        }, 600)
      } else if (action === '看金额') {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: 'agent',
            content: '当前库存金额情况：\n\n📊 总金额：812万元（环比▼3.2%）\n🎯 目标金额：560万元\n📉 差距：252万元\n\n本月主要变动：\n• X型变频器消化 -5.6万\n• 3号线轴承领用增加 +0.36万\n\n按当前降速，预计8月可达目标。'
          }])
        }, 600)
      } else {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: 'agent',
            content: `已收到"${action}"请求，正在为您整理相关信息...`
          }])
        }, 600)
      }
    }, 100)
  }

  return (
    <>
      {/* Collapsed button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setHasUnread(false); }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-accent hover:bg-accent-light rounded-full shadow-lg flex items-center justify-center text-white text-xl transition-all z-50 hover:scale-105"
        >
          ✦
          {hasUnread && <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-danger rounded-full border-2 border-white" />}
        </button>
      )}

      {/* Expanded chat */}
      {open && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[520px] bg-white rounded-xl shadow-2xl flex flex-col z-50 border border-border overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-accent">✦</span>
                <span className="font-medium text-sm">智能助手</span>
              </div>
              <div className="text-xs text-white/60 mt-0.5">当前：Agent-1 库存管家</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-lg">—</button>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-lg">×</button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-accent text-white' : 'bg-gray-100 text-text'} rounded-lg px-3 py-2 text-sm`}>
                  <div className="whitespace-pre-line">{msg.content}</div>
                  {msg.card && (
                    <div className="mt-2 bg-white rounded-lg border border-accent/30 p-3">
                      <div className="font-medium text-accent text-sm mb-2">{msg.card.title}</div>
                      {msg.card.items.map((item, j) => (
                        <div key={j} className="text-xs text-text leading-relaxed">{item}</div>
                      ))}
                      <div className="flex gap-2 mt-3">
                        {msg.card.actions.map((action, j) => (
                          <button key={j} className={`text-xs px-2.5 py-1.5 rounded ${
                            j === 0 ? 'bg-accent text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                          } transition-colors`}>
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="px-3 py-2 border-t border-border">
            <div className="text-xs text-text-secondary mb-1.5">快捷操作：</div>
            <div className="flex flex-wrap gap-1.5">
              {quickActions.map(action => (
                <button
                  key={action}
                  onClick={() => handleQuickAction(action)}
                  className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t border-border flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="输入你的问题..."
              className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleSend}
              className="bg-accent text-white px-3 py-1.5 rounded-lg text-sm hover:bg-accent-light transition-colors"
            >
              发送
            </button>
          </div>
        </div>
      )}
    </>
  )
}
