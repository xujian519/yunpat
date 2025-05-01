/**
 * @file 状态面板组件
 * @description 执行状态显示 + 工作流步骤进度
 */

import React from 'react'
import { Box, Text } from 'ink'
import type { OrchestratorStage, WorkflowState } from '../types/index.js'

interface StatusPanelProps {
  stage: OrchestratorStage
  intent?: string
  progress: number
  currentAgent?: string
  error?: string
  isConnecting?: boolean
  workflow?: WorkflowState | null
  turnCount?: number
}

/** 状态样式映射 */
const STAGE_STYLES: Record<
  OrchestratorStage | 'connecting',
  { label: string; color: string; icon: string }
> = {
  connecting: { label: '连接中', color: 'yellow', icon: '⟳' },
  idle: { label: '空闲', color: 'gray', icon: '○' },
  intent: { label: '意图识别', color: 'cyan', icon: '◎' },
  planning: { label: '任务规划', color: 'blue', icon: '◉' },
  processing: { label: '处理中', color: 'yellow', icon: '◐' },
  execution: { label: '执行中', color: 'yellow', icon: '◑' },
  hitl: { label: '等待确认', color: 'magenta', icon: '!' },
  done: { label: '完成', color: 'green', icon: '✓' },
  error: { label: '错误', color: 'red', icon: '✗' },
}

/** 进度条宽度 */
const PROGRESS_BAR_WIDTH = 22

/** 步骤状态图标 */
const STEP_ICONS: Record<string, { icon: string; color: string }> = {
  pending: { icon: '○', color: 'gray' },
  running: { icon: '●', color: 'yellow' },
  completed: { icon: '✓', color: 'green' },
  failed: { icon: '✗', color: 'red' },
  waiting_hitl: { icon: '!', color: 'magenta' },
}

/** 截断过长文本 */
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

export const StatusPanel: React.FC<StatusPanelProps> = ({
  stage,
  intent,
  progress,
  currentAgent,
  error,
  isConnecting = false,
  workflow,
  turnCount = 0,
}) => {
  const displayStage: OrchestratorStage | 'connecting' = isConnecting ? 'connecting' : stage
  const style = STAGE_STYLES[displayStage]

  const filled = Math.floor(progress * PROGRESS_BAR_WIDTH)
  const empty = PROGRESS_BAR_WIDTH - filled
  const percent = Math.round(progress * 100)

  const getProgressColor = () => {
    if (error) return 'red'
    if (progress >= 1) return 'green'
    return 'blue'
  }

  const elements: React.ReactNode[] = []

  // ═══ 状态 ═══
  elements.push(
    React.createElement(
      Box,
      { marginBottom: 1, key: 'stage' },
      React.createElement(Text, { color: style.color, bold: true }, `${style.icon} ${style.label}`)
    )
  )

  // ═══ 意图 ═══
  if (intent) {
    elements.push(
      React.createElement(
        Box,
        { key: 'intent', marginBottom: 1 },
        React.createElement(Text, { dimColor: true }, '意图: '),
        React.createElement(Text, { color: 'cyan' }, truncate(intent, 16))
      )
    )
  }

  // ═══ 当前 Agent ═══
  if (currentAgent) {
    elements.push(
      React.createElement(
        Box,
        { key: 'agent', marginBottom: 1 },
        React.createElement(Text, { dimColor: true }, '代理: '),
        React.createElement(Text, { color: 'yellow' }, truncate(currentAgent, 16))
      )
    )
  }

  // ═══ 对话轮次 ═══
  if (turnCount > 0) {
    elements.push(
      React.createElement(
        Box,
        { key: 'turn', marginBottom: 1 },
        React.createElement(Text, { dimColor: true }, '轮次: '),
        React.createElement(Text, { color: 'gray' }, `${turnCount}`)
      )
    )
  }

  // ═══ 工作流步骤进度 ═══
  if (workflow && workflow.steps.length > 0) {
    elements.push(
      React.createElement(
        Box,
        { key: 'wf-sep', marginBottom: 0 },
        React.createElement(Text, { dimColor: true }, '── 步骤 ──')
      )
    )

    workflow.steps.forEach((step, i) => {
      const stepStyle = STEP_ICONS[step.status] || STEP_ICONS.pending
      const label = truncate(step.name, 14)
      const durationStr = step.duration ? ` ${Math.round(step.duration / 1000)}s` : ''

      elements.push(
        React.createElement(
          Box,
          { key: `step-${i}`, marginLeft: 1 },
          React.createElement(Text, { color: stepStyle.color }, stepStyle.icon),
          React.createElement(Text, null, ` ${i + 1}. `),
          React.createElement(
            Text,
            {
              color:
                step.status === 'running'
                  ? 'yellow'
                  : step.status === 'completed'
                    ? 'green'
                    : undefined,
            },
            label
          ),
          React.createElement(Text, { dimColor: true }, durationStr)
        )
      )
    })
  }

  // ═══ 进度条 ═══
  elements.push(
    React.createElement(
      Box,
      { key: 'progress', marginTop: 1 },
      React.createElement(Text, { dimColor: true }, '['),
      React.createElement(Text, { color: getProgressColor() }, '█'.repeat(filled)),
      React.createElement(Text, { dimColor: true }, '░'.repeat(empty)),
      React.createElement(Text, { dimColor: true }, ']'),
      React.createElement(Text, { dimColor: true }, ` ${percent}%`)
    )
  )

  // ═══ 错误 ═══
  if (error) {
    elements.push(
      React.createElement(
        Box,
        { key: 'error', marginTop: 1 },
        React.createElement(Text, { color: 'red' }, truncate(error, 38))
      )
    )
  }

  return React.createElement(Box, { flexDirection: 'column', paddingY: 0 }, ...elements)
}
