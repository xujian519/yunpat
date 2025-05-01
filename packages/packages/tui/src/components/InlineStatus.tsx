/**
 * @file 内嵌状态组件
 * @description 显示在对话区底部的内嵌状态信息，替代右侧固定面板
 *
 * 设计理念：终端宽度有限（80-120 列），不用固定侧边栏浪费空间。
 * 状态信息紧凑地显示在对话区下方。
 */

import React from 'react'
import { Box, Text } from 'ink'
import type { OrchestratorStage, WorkflowState } from '../types/index.js'
import { ICONS } from '../theme.js'

interface InlineStatusProps {
  stage: OrchestratorStage
  intent?: string
  progress: number
  currentAgent?: string
  error?: string
  isConnecting?: boolean
  workflow?: WorkflowState | null
}

/** 状态文字映射 */
const STAGE_LABELS: Record<
  OrchestratorStage | 'connecting',
  { label: string; color: string; icon: string }
> = {
  connecting: { label: '连接中', color: 'yellow', icon: '⟳' },
  idle: { label: '', color: 'gray', icon: '' },
  intent: { label: '意图识别', color: 'cyan', icon: '◎' },
  planning: { label: '规划中', color: 'blue', icon: '◉' },
  processing: { label: '处理中', color: 'yellow', icon: '◐' },
  execution: { label: '执行中', color: 'yellow', icon: '◑' },
  hitl: { label: '等待确认', color: 'magenta', icon: '!' },
  done: { label: '完成', color: 'green', icon: '✓' },
  error: { label: '错误', color: 'red', icon: '✗' },
}

/** 步骤图标 */
const STEP_ICONS: Record<string, { icon: string; color: string }> = {
  pending: { icon: '○', color: 'gray' },
  running: { icon: '●', color: 'yellow' },
  completed: { icon: '✓', color: 'green' },
  failed: { icon: '✗', color: 'red' },
}

export const InlineStatus: React.FC<InlineStatusProps> = ({
  stage,
  intent,
  progress,
  currentAgent,
  error,
  isConnecting = false,
  workflow,
}) => {
  // 空闲且无工作流 → 不显示
  const displayStage = isConnecting ? 'connecting' : stage
  if (displayStage === 'idle' && !workflow) return null

  const style = STAGE_LABELS[displayStage]
  const percent = Math.round(progress * 100)

  const parts: React.ReactNode[] = []

  // ── 主状态行 ──
  if (style.label) {
    parts.push(
      React.createElement(
        Box,
        { key: 'main-status' },
        React.createElement(
          Text,
          { color: style.color, bold: true },
          `${style.icon} ${style.label}`
        ),
        currentAgent ? React.createElement(Text, { dimColor: true }, ` · ${currentAgent}`) : null,
        intent && stage !== 'done'
          ? React.createElement(Text, { dimColor: true }, ` [${intent}]`)
          : null
      )
    )
  }

  // ── 工作流步骤（紧凑横排） ──
  if (workflow && workflow.steps.length > 0) {
    const stepElements: React.ReactNode[] = []
    workflow.steps.forEach((step, i) => {
      const si = STEP_ICONS[step.status] || STEP_ICONS.pending
      if (i > 0)
        stepElements.push(React.createElement(Text, { key: `d${i}`, dimColor: true }, ' → '))
      stepElements.push(
        React.createElement(
          Text,
          { key: `s${i}`, color: si.color, bold: step.status === 'running' },
          si.icon
        )
      )
    })

    parts.push(
      React.createElement(
        Box,
        { key: 'steps' },
        ...stepElements,
        React.createElement(Text, { dimColor: true }, `  ${percent}%`)
      )
    )
  } else if (style.label && progress > 0 && progress < 1) {
    // 无工作流但处理中 → 显示进度条
    const barWidth = 20
    const filled = Math.floor(progress * barWidth)
    parts.push(
      React.createElement(
        Box,
        { key: 'bar' },
        React.createElement(Text, { color: error ? 'red' : 'blue' }, '█'.repeat(filled)),
        React.createElement(Text, { dimColor: true }, '░'.repeat(barWidth - filled)),
        React.createElement(Text, { dimColor: true }, ` ${percent}%`)
      )
    )
  }

  // ── 错误 ──
  if (error) {
    parts.push(
      React.createElement(
        Box,
        { key: 'err' },
        React.createElement(
          Text,
          { color: 'red' },
          `${ICONS.cross} ${error.length > 60 ? error.slice(0, 60) + '…' : error}`
        )
      )
    )
  }

  if (parts.length === 0) return null

  return React.createElement(
    Box,
    { flexDirection: 'column', paddingX: 1, marginTop: 0 },
    React.createElement(Box, null, React.createElement(Text, { dimColor: true }, '─'.repeat(50))),
    ...parts
  )
}
