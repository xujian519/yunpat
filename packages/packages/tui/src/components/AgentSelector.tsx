/**
 * @file Agent 选择器对话框
 * @description 底部面板形式的 Agent 切换对话框。
 *
 * 设计参考：opencode 的 DialogAgent 组件
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { ICONS } from '../theme.js'

// ─── 可用 Agent 列表 ──────────────────────────────
const AGENTS = [
  { id: 'patent-writer', label: '专利撰写', desc: '完整专利申请文件撰写', icon: '✍️' },
  { id: 'patent-analyzer', label: '专利分析', desc: '专利技术分析、侵权评估', icon: '🔍' },
  { id: 'patent-responder', label: '审查答复', desc: '审查意见通知书答复', icon: '📋' },
  { id: 'patent-searcher', label: '专利检索', desc: '现有技术检索与分析', icon: '🔎' },
  { id: 'claims-generator', label: '权利要求', desc: '权利要求书生成', icon: '📐' },
  { id: 'specification-drafter', label: '说明书撰写', desc: '专利说明书撰写', icon: '📄' },
  { id: 'abstract-drafter', label: '摘要撰写', desc: '专利摘要撰写', icon: '📝' },
  { id: 'quality-checker', label: '质量检查', desc: '专利文本质量检查', icon: '✅' },
]

type Props = {
  currentAgent?: string
  onSelect: (agentId: string) => void
  onClose: () => void
}

export const AgentSelector: React.FC<Props> = ({ currentAgent, onSelect, onClose }) => {
  const [cursor, setCursor] = useState(() => {
    if (!currentAgent) return 0
    const idx = AGENTS.findIndex((a) => a.id === currentAgent)
    return idx >= 0 ? idx : 0
  })

  const safeCursor = Math.max(0, Math.min(cursor, AGENTS.length - 1))

  useInput(
    (input, key) => {
      if (key.escape) {
        onClose()
        return
      }
      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1))
        return
      }
      if (key.downArrow) {
        setCursor((c) => Math.min(AGENTS.length - 1, c + 1))
        return
      }
      if (key.return) {
        const selected = AGENTS[safeCursor]
        if (selected) onSelect(selected.id)
        onClose()
      }
    },
    { isActive: true }
  )

  return React.createElement(
    Box,
    { flexDirection: 'column', paddingX: 1, borderStyle: 'single', borderColor: 'magenta' },

    // 标题
    React.createElement(
      Box,
      { key: 'title' },
      React.createElement(
        Text,
        { bold: true, color: 'magenta' },
        `${ICONS.star ?? '★'} 选择智能体`
      ),
      React.createElement(Text, { dimColor: true }, '  ↑↓ 导航  Enter 确认  Esc 取消')
    ),

    React.createElement(
      Box,
      { key: 'divider' },
      React.createElement(Text, { dimColor: true }, '─'.repeat(50))
    ),

    // Agent 列表
    ...AGENTS.map((agent, i) => {
      const isFocused = i === safeCursor
      const isCurrent = agent.id === currentAgent
      return React.createElement(
        Box,
        { key: agent.id, paddingLeft: 2 },
        React.createElement(
          Text,
          { color: isFocused ? 'magenta' : undefined, bold: isFocused },
          isFocused ? '> ' : '  '
        ),
        React.createElement(Text, null, agent.icon + ' '),
        React.createElement(
          Text,
          { color: isCurrent ? 'green' : undefined },
          agent.label + (isCurrent ? ' (当前)' : '')
        ),
        React.createElement(Text, { dimColor: true }, ` — ${agent.desc}`)
      )
    })
  )
}

export * as AgentSelector_ from './AgentSelector'
