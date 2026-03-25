import type { AgentMessage, AgentContextId } from '../types/agent'
import type { UserRole } from '../types/user'

let _id = 0
function uid() { return `init-${++_id}` }

/** 工段长 — 工作台 */
function workbenchSectionLeader(): AgentMessage {
  return {
    id: uid(), role: 'agent', timestamp: Date.now(),
    blocks: [
      { id: uid(), type: 'text', props: { content: '早上好王段长。以下是今日的库存管理概况：' } },
      {
        id: uid(), type: 'data-card', props: {
          title: '目标达成',
          metrics: [
            { label: '当前库存总额', value: '812万', big: true },
            { label: '目标', value: '560万' },
            { label: '已释放', value: '38万' },
            { label: '达标进度', value: '15.1%' },
            { label: '预计达标', value: '9月' },
          ],
          tags: [{ text: '目标可达', signal: 'safe' }],
        },
      },
      { id: uid(), type: 'text', props: { content: '今日有 **3 件事**需要你关注：' } },
      // (alert banners are integrated into the data cards below)
      {
        id: uid(), type: 'data-card', props: {
          title: '❶ 采购审批',
          metrics: [
            { label: '待审批', value: '8条' },
            { label: '预估总额', value: '4.2万' },
          ],
          tags: [{ text: '紧急', signal: 'danger' }],
        },
      },
      { id: uid(), type: 'text', props: { content: '其中2条是3号线故障驱动的加急采购。建议优先审批PLC模块和变频器——采购周期长。' } },
      {
        id: uid(), type: 'action-buttons', props: {
          buttons: [
            { label: '去审批 →', variant: 'primary' },
            { label: '看汇总', variant: 'ghost' },
          ],
        },
      },
      {
        id: uid(), type: 'data-card', props: {
          title: '❷ 异常信号',
          tags: [{ text: '注意', signal: 'warn' }],
        },
      },
      { id: uid(), type: 'alert-banner', props: { signal: 'warn', text: '3号线电机本月第4次更换轴承，频次明显异常。' } },
      { id: uid(), type: 'text', props: { content: '不像正常损耗，更像系统性故障。如果根因解决，轴承消耗回到正常水平（月均1.5个），每月可节省约400元，年化4,800元。' } },
      {
        id: uid(), type: 'action-buttons', props: {
          buttons: [
            { label: '安排排查 →', variant: 'secondary' },
            { label: '了解更多', variant: 'ghost' },
          ],
        },
      },
      {
        id: uid(), type: 'data-card', props: {
          title: '❸ 今日优化机会',
          metrics: [
            { label: '可释放金额', value: '4.8万' },
            { label: '涉及备件', value: '23种' },
          ],
          tags: [{ text: '建议', signal: 'safe' }],
        },
      },
      { id: uid(), type: 'text', props: { content: '前3名：\n- X型变频器 8→3个，释放 25,000元\n- 6205轴承（一级库）30→12个，释放 3,600元\n- 通用密封圈 50→20个，释放 1,500元\n\n如果全部执行 → 812万降至764万' } },
      {
        id: uid(), type: 'action-buttons', props: {
          buttons: [
            { label: '查看完整清单 →', variant: 'secondary' },
            { label: '打开推演面板 →', variant: 'ghost' },
          ],
        },
      },
    ],
  }
}

/** 工程师 — 工作台 */
function workbenchEngineer(): AgentMessage {
  return {
    id: uid(), role: 'agent', timestamp: Date.now(),
    blocks: [
      { id: uid(), type: 'text', props: { content: '早上好张工。你有2条待补全记录，以及常用备件状态：' } },
      {
        id: uid(), type: 'data-card', props: {
          title: '待补全',
        },
      },
      { id: uid(), type: 'text', props: { content: '昨天 14:23 · 6205轴承 ×1 · 领用原因未填' } },
      {
        id: uid(), type: 'quick-options', props: {
          options: [
            { label: '3号线电机故障', value: '3号线电机故障' },
            { label: '其他设备', value: '其他设备' },
            { label: '保养更换', value: '保养更换' },
            { label: '跳过', value: '跳过' },
          ],
        },
      },
      { id: uid(), type: 'text', props: { content: '昨天 09:45 · 温度传感器 ×2 · 关联设备未填' } },
      {
        id: uid(), type: 'quick-options', props: {
          options: [
            { label: '1号线', value: '1号线' },
            { label: '2号线', value: '2号线' },
            { label: '3号线', value: '3号线' },
            { label: '其他', value: '其他' },
          ],
        },
      },
      {
        id: uid(), type: 'data-card', props: {
          title: '常用备件',
        },
      },
      { id: uid(), type: 'status-bar', props: { label: '6205轴承', current: 2, safety: 2 } },
      { id: uid(), type: 'status-bar', props: { label: '温度传感器', current: 8, safety: 2 } },
      { id: uid(), type: 'status-bar', props: { label: 'X型变频器', current: 5, safety: 2 } },
      { id: uid(), type: 'status-bar', props: { label: 'PLC模块', current: 2, safety: 2 } },
    ],
  }
}

/** 库房 — Agent-1 初始叙事 */
function warehouseNarrative(): AgentMessage {
  return {
    id: uid(), role: 'agent', timestamp: Date.now(),
    blocks: [
      { id: uid(), type: 'text', props: { content: '当前查看：**二级库A · 工段甲**' } },
      {
        id: uid(), type: 'data-card', props: {
          title: '库房状态速览',
          metrics: [
            { label: '备件种类', value: '86' },
            { label: '总金额', value: '58万' },
            { label: '低于安全线', value: '3种' },
            { label: '呆滞', value: '5种' },
          ],
        },
      },
      { id: uid(), type: 'text', props: { content: '有 **3 个**需要注意的情况：' } },
      { id: uid(), type: 'alert-banner', props: { signal: 'danger', text: '3种备件低于安全线，需要关注。' } },
      { id: uid(), type: 'status-bar', props: { label: '6205轴承', current: 2, safety: 2 } },
      { id: uid(), type: 'status-bar', props: { label: '密封圈', current: 1, safety: 2 } },
      { id: uid(), type: 'status-bar', props: { label: '连接线缆', current: 0, safety: 2 } },
      { id: uid(), type: 'text', props: { content: '密封圈和线缆已触发采购预警，Agent-5已生成请购建议。' } },
      {
        id: uid(), type: 'action-buttons', props: {
          buttons: [{ label: '查看请购建议 →', variant: 'secondary' }],
        },
      },
      {
        id: uid(), type: 'data-card', props: {
          title: '呆滞提醒',
          tags: [{ text: '呆滞', signal: 'stale' }],
        },
      },
      { id: uid(), type: 'text', props: { content: '5种备件呆滞（>12月无消耗），合计金额 2.3万\n其中2种有替代匹配机会（Agent-3已确认兼容）' } },
      {
        id: uid(), type: 'action-buttons', props: {
          buttons: [{ label: '查看呆滞详情 →', variant: 'ghost' }],
        },
      },
      { id: uid(), type: 'text', props: { content: '需要领料、查库存、或者其他操作？直接告诉我。' } },
      {
        id: uid(), type: 'quick-options', props: {
          options: [
            { label: '领料', value: '领料' },
            { label: '查某个备件', value: '查备件' },
            { label: '查看全部库存', value: '全部库存' },
            { label: '今日出入库记录', value: '今日记录' },
          ],
        },
      },
    ],
  }
}

/** 采购 — Agent-5 */
function procurementNarrative(): AgentMessage {
  return {
    id: uid(), role: 'agent', timestamp: Date.now(),
    blocks: [
      { id: uid(), type: 'text', props: { content: '3月第2批请购建议已准备好。' } },
      {
        id: uid(), type: 'data-card', props: {
          title: '批次总览',
          metrics: [
            { label: '建议条数', value: '8条' },
            { label: '总额', value: '4.26万' },
            { label: '生成时间', value: '3月18日' },
          ],
        },
      },
      { id: uid(), type: 'text', props: { content: '建议优先处理加急项——PLC模块和变频器采购周期长，越早下单到货越快。' } },
      {
        id: uid(), type: 'data-card', props: {
          title: '❶ PLC模块 ×1',
          metrics: [
            { label: '金额', value: '82,000元' },
            { label: '当前库存', value: '2个=安全线' },
            { label: '采购周期', value: '90天' },
          ],
          tags: [{ text: '紧急', signal: 'danger' }],
        },
      },
      { id: uid(), type: 'text', props: { content: '当前库存2个=安全线，可用量为0。一旦消耗1个，到下次补货之前只剩1个兜底。\n\n不买的风险：未来6月断货概率 12%\n买了之后：库存恢复到3个，可支撑约36个月' } },
      {
        id: uid(), type: 'action-buttons', props: {
          buttons: [
            { label: '批准', variant: 'primary' },
            { label: '驳回', variant: 'secondary' },
            { label: '有疑问，问一下', variant: 'ghost' },
          ],
        },
      },
      {
        id: uid(), type: 'data-card', props: {
          title: '❷ X型变频器 ×2',
          metrics: [
            { label: '金额', value: '16,000元' },
            { label: '近3月月均', value: '1台（历史0.5台）' },
          ],
          tags: [{ text: '建议', signal: 'warn' }],
        },
      },
      { id: uid(), type: 'text', props: { content: '消耗加速纯粹是3号线的问题。建议批准采购的同时，安排3号线电气检查。如果根因解决，后续采购量可减半。' } },
      {
        id: uid(), type: 'action-buttons', props: {
          buttons: [
            { label: '批准', variant: 'primary' },
            { label: '驳回', variant: 'secondary' },
            { label: '有疑问，问一下', variant: 'ghost' },
          ],
        },
      },
      {
        id: uid(), type: 'data-card', props: {
          title: '❸-❽ 其他6条常规补货',
          metrics: [{ label: '合计', value: '6,600元' }],
        },
      },
      {
        id: uid(), type: 'action-buttons', props: {
          buttons: [
            { label: '全部批准（8条 · 4.2万）', variant: 'primary' },
            { label: '仅批准紧急+建议项（3条 · 2.6万）', variant: 'secondary' },
            { label: '逐条已处理完毕，提交 →', variant: 'ghost' },
          ],
        },
      },
    ],
  }
}

/** 呆滞 — Agent-4 */
function staleNarrative(): AgentMessage {
  return {
    id: uid(), role: 'agent', timestamp: Date.now(),
    blocks: [
      { id: uid(), type: 'text', props: { content: '当前呆滞库存概况：' } },
      {
        id: uid(), type: 'data-card', props: {
          title: '呆滞总览',
          metrics: [
            { label: '呆滞总金额', value: '86万' },
            { label: '备件种类', value: '47种' },
            { label: '占总库存', value: '10.6%' },
            { label: '本月新增', value: '3种 +1.2万' },
          ],
        },
      },
      { id: uid(), type: 'text', props: { content: '最有价值的3个处置机会：' } },
      {
        id: uid(), type: 'data-card', props: {
          title: '❶ 旧型PLC控制板 ×1',
          metrics: [
            { label: '金额', value: '65,000元' },
            { label: '呆滞', value: '28个月' },
          ],
          tags: [{ text: '建议报废', signal: 'danger' }],
        },
      },
      { id: uid(), type: 'text', props: { content: '对应的旧型PLC柜已于去年6月淘汰换代。新型PLC柜使用不同型号控制板，此件永远不会被消耗。\n\n退回供应商可回收约30%（~19,500元）。' } },
      {
        id: uid(), type: 'action-buttons', props: {
          buttons: [
            { label: '执行退回供应商', variant: 'primary' },
            { label: '执行报废', variant: 'secondary' },
            { label: '暂不处理', variant: 'ghost' },
          ],
        },
      },
      {
        id: uid(), type: 'data-card', props: {
          title: '❷ 6205-2RS密封轴承 ×1',
          metrics: [
            { label: '金额', value: '180元' },
            { label: '呆滞', value: '14个月' },
          ],
          tags: [{ text: '可代用消化', signal: 'stale' }],
        },
      },
      { id: uid(), type: 'text', props: { content: '此件可替代6205标准型轴承，完全兼容，更便宜20元。3号线电机消耗轴承频率高，预计1-2周内消化。\n\n已通知Agent-1：下次3号线领用轴承时优先推荐此件。' } },
      {
        id: uid(), type: 'action-buttons', props: {
          buttons: [
            { label: '确认消化策略', variant: 'secondary' },
            { label: '不参与消化', variant: 'ghost' },
          ],
        },
      },
    ],
  }
}

/** 驾驶舱 — Agent-10 */
function cockpitNarrative(): AgentMessage {
  return {
    id: uid(), role: 'agent', timestamp: Date.now(),
    blocks: [
      { id: uid(), type: 'text', props: { content: '库存策略概览：' } },
      {
        id: uid(), type: 'data-card', props: {
          title: '目标达成',
          metrics: [
            { label: '当前库存总额', value: '812万', big: true },
            { label: '目标', value: '560万' },
            { label: '已释放', value: '38万' },
            { label: '达标进度', value: '15.1%' },
          ],
          tags: [{ text: '目标可达', signal: 'safe' }],
        },
      },
      { id: uid(), type: 'text', props: { content: '**库存结构透视：**\n\n812万的库存结构是健康的——活库存312万和安全储备186万合计498万，这是维持生产运转的底线，不应触碰。\n\n真正需要关注的是另外314万：\n- **可优化过剩 228万**：主要集中在轴承类（92万）和通用传感器类（68万），采购周期短、替代件多、消耗稳定\n- **呆滞沉淀 86万**：其中32万是已淘汰设备配套件，28万是过度采购结果\n\n可释放空间 314万 > 需释放 252万，**目标可达**。' } },
      {
        id: uid(), type: 'data-card', props: {
          title: '达标路径',
          metrics: [
            { label: '规划周期', value: '4月-9月' },
            { label: '置信度', value: '75%' },
          ],
        },
      },
      { id: uid(), type: 'text', props: { content: '- **4月** 780万：处置呆滞（淘汰设备配套件报废）\n- **5月** 735万：优化C类备件安全库存\n- **6月** 727万：缓冲月（3号线大保养）\n- **7月** 689万：优化B类备件\n- **8月** 647万：呆滞代用匹配+折价\n- **9月** 592万：A类安全库存精调' } },
      { id: uid(), type: 'alert-banner', props: { signal: 'warn', text: '6月3号线大保养是路径最大风险点。建议5月底备足保养件。' } },
      {
        id: uid(), type: 'data-card', props: {
          title: '上月决策回溯',
          metrics: [
            { label: '采购决策', value: '7条确认 · 1条驳回' },
          ],
          tags: [
            { text: '精准5条', signal: 'safe' },
            { text: '偏多2条', signal: 'warn' },
            { text: '驳回正确', signal: 'safe' },
          ],
        },
      },
      { id: uid(), type: 'text', props: { content: '发现：密封圈和轴承油脂存在过度采购模式——低频消耗件（月消耗<1）的采购系数偏高。已建议Agent-5调整计算参数。预计每月可节省约1,400元采购支出。' } },
      {
        id: uid(), type: 'action-buttons', props: {
          buttons: [
            { label: '查看完整路径 →', variant: 'secondary' },
            { label: '查看回溯报告 →', variant: 'ghost' },
            { label: '打开推演面板 →', variant: 'ghost' },
          ],
        },
      },
    ],
  }
}

/** 库管员 — 工作台 */
function workbenchWarehouseKeeper(): AgentMessage {
  return {
    id: uid(), role: 'agent', timestamp: Date.now(),
    blocks: [
      { id: uid(), type: 'text', props: { content: '早上好李管。今日出入库汇总和库存状态：' } },
      {
        id: uid(), type: 'data-card', props: {
          title: '今日出入库',
          metrics: [
            { label: '出库', value: '3笔' },
            { label: '入库', value: '1笔' },
            { label: '待处理', value: '1笔' },
          ],
        },
      },
      { id: uid(), type: 'alert-banner', props: { signal: 'warn', text: '温度传感器 ×2 出库未补全信息（领用原因和设备关联缺失），已提醒李工补全。' } },
      { id: uid(), type: 'status-bar', props: { label: '6205轴承（二级库A）', current: 2, safety: 2 } },
      { id: uid(), type: 'status-bar', props: { label: '密封圈', current: 1, safety: 2 } },
      { id: uid(), type: 'status-bar', props: { label: '连接线缆', current: 0, safety: 2 } },
      {
        id: uid(), type: 'quick-options', props: {
          options: [
            { label: '查看全部库存', value: '全部库存' },
            { label: '今日出入库明细', value: '今日明细' },
            { label: '盘点提醒', value: '盘点' },
          ],
        },
      },
    ],
  }
}

/** 管理层 — 工作台 = 驾驶舱 */
function workbenchManager(): AgentMessage {
  return cockpitNarrative()
}

// --- 路由表 ---
type NarrativeFactory = () => AgentMessage

const narratives: Record<string, NarrativeFactory> = {
  'workbench:section_leader': workbenchSectionLeader,
  'workbench:engineer': workbenchEngineer,
  'workbench:warehouse_keeper': workbenchWarehouseKeeper,
  'workbench:manager': workbenchManager,
  'warehouse:section_leader': warehouseNarrative,
  'warehouse:engineer': warehouseNarrative,
  'warehouse:warehouse_keeper': warehouseNarrative,
  'procurement:section_leader': procurementNarrative,
  'stale:section_leader': staleNarrative,
  'stale:warehouse_keeper': staleNarrative,
  'cockpit:section_leader': cockpitNarrative,
  'cockpit:manager': cockpitNarrative,
}

export function getInitialNarrative(contextId: AgentContextId, role: UserRole): AgentMessage | null {
  const key = `${contextId}:${role}`
  const factory = narratives[key]
  return factory ? factory() : null
}
