/**
 * @file 模型选择器对话框
 * @description 底部面板形式的模型切换对话框。
 *
 * 设计参考：opencode 的 DialogModel 组件
 * 采用底部面板模式（非全屏），保持对话上下文可见。
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { ICONS } from '../theme.js'

// ─── 可用模型列表 ────────────────────────────────
const MODELS = [
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', desc: '深度求索旗舰模型，适合复杂专利分析' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', desc: '极速响应，适合日常撰写' },
  { id: 'glm-5.1', label: 'GLM 5.1', desc: '智谱最新旗舰模型' },
  { id: 'glm-4.7-flash', label: 'GLM 4.7 Flash', desc: '智谱极速模型' },
  { id: 'qwen-max', label: '通义千问 Max', desc: '阿里最强模型，适合中文专利' },
  { id: 'qwen-plus', label: '通义千问 Plus', desc: '阿里均衡模型' },
]

type Props = {
  currentModel?: string
  onSelect: (modelId: string) => void
  onClose: () => void
}

export const ModelSelector: React.FC<Props> = ({ currentModel, onSelect, onClose }) => {
  const [cursor, setCursor] = useState(() => {
    if (!currentModel) return 0
    const idx = MODELS.findIndex((m) => m.id === currentModel)
    return idx >= 0 ? idx : 0
  })

  const safeCursor = Math.max(0, Math.min(cursor, MODELS.length - 1))

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
        setCursor((c) => Math.min(MODELS.length - 1, c + 1))
        return
      }
      if (key.return) {
        const selected = MODELS[safeCursor]
        if (selected) onSelect(selected.id)
        onClose()
      }
    },
    { isActive: true }
  )

  return React.createElement(
    Box,
    { flexDirection: 'column', paddingX: 1, borderStyle: 'single', borderColor: 'cyan' },

    // 标题
    React.createElement(
      Box,
      { key: 'title' },
      React.createElement(Text, { bold: true, color: 'cyan' }, `${ICONS.gear ?? '⚙'} 选择模型`),
      React.createElement(Text, { dimColor: true }, '  ↑↓ 导航  Enter 确认  Esc 取消')
    ),

    React.createElement(
      Box,
      { key: 'divider' },
      React.createElement(Text, { dimColor: true }, '─'.repeat(50))
    ),

    // 模型列表
    ...MODELS.map((model, i) => {
      const isFocused = i === safeCursor
      const isCurrent = model.id === currentModel
      return React.createElement(
        Box,
        { key: model.id, paddingLeft: 2 },
        React.createElement(
          Text,
          { color: isFocused ? 'cyan' : undefined, bold: isFocused },
          isFocused ? '> ' : '  '
        ),
        React.createElement(
          Text,
          { color: isCurrent ? 'green' : undefined },
          model.label + (isCurrent ? ' (当前)' : '')
        ),
        React.createElement(Text, { dimColor: true }, ` — ${model.desc}`)
      )
    })
  )
}

export * as ModelSelector_ from './ModelSelector'
