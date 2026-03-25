import type { ComponentType } from 'react'
import type { BlockType } from '../types/agent'

// P0 components
import { TextParagraph } from './p0/TextParagraph'
import { DataCard } from './p0/DataCard'
import { ActionButtonGroup } from './p0/ActionButtonGroup'
import { QuickOptions } from './p0/QuickOptions'
import { StatusBar } from './p0/StatusBar'
import { AlertBanner } from './p0/AlertBanner'

// P1 components
import { DataTable } from './p1/DataTable'
import { BarChartBlock } from './p1/BarChart'
import { LineChartBlock } from './p1/LineChart'
import { StackedBarChartBlock } from './p1/StackedBarChart'
import { ExpandPanel } from './p1/ExpandPanel'

/**
 * 组件注册表：BlockType -> React 组件
 * 新增组件只需在这里注册，不需要改 Agent 逻辑
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry: Partial<Record<BlockType, ComponentType<any>>> = {
  'text': TextParagraph,
  'data-card': DataCard,
  'action-buttons': ActionButtonGroup,
  'quick-options': QuickOptions,
  'status-bar': StatusBar,
  'alert-banner': AlertBanner,
  'table': DataTable,
  'bar-chart': BarChartBlock,
  'line-chart': LineChartBlock,
  'stacked-bar': StackedBarChartBlock,
  'expand-panel': ExpandPanel,
}

export function getComponent(type: BlockType) {
  return registry[type]
}
