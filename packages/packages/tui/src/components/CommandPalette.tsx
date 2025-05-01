/**
 * @file 命令面板
 * @description Ctrl+K 触发的全屏命令搜索面板。
 *
 * 交互:
 *  - ↑↓ 导航命令列表
 *  - Enter 执行选中命令
 *  - Esc 关闭面板
 *  - 输入文本实时过滤命令
 *
 * 设计参考：opencode 的 DialogCommand 组件
 */

import React, { useState, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import { commandRegistry } from '../commands/index.js'
import { ICONS } from '../theme.js'

// ─── 类型 ─────────────────────────────────────────
interface CommandItem {
  name: string
  description: string
  category: string
}

type Props = {
  /** 选中命令后的回调（传入命令文本如 "/draft"） */
  onSelect: (commandText: string) => void
  /** 关闭面板 */
  onClose: () => void
}

// ─── 分类图标 ─────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  business: '📝',
  general: '⚙',
  session: '🔌',
  ui: '🖥',
  debug: '🔧',
  config: '⚙',
}

const CATEGORY_LABELS: Record<string, string> = {
  business: '专利业务',
  general: '通用',
  session: '会话',
  ui: '界面',
  debug: '调试',
  config: '配置',
}

// ─── 组件 ─────────────────────────────────────────
export const CommandPalette: React.FC<Props> = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  // 所有可用命令
  const allCommands: CommandItem[] = useMemo(() => {
    return commandRegistry.getAll().map((cmd) => ({
      name: `/${cmd.name}`,
      description: cmd.description,
      category: cmd.category,
    }))
  }, [])

  // 按分类分组 + 模糊过滤
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) {
      // 无搜索时按分类分组
      const groups = new Map<string, CommandItem[]>()
      for (const cmd of allCommands) {
        const list = groups.get(cmd.category) || []
        list.push(cmd)
        groups.set(cmd.category, list)
      }
      return { groups, flat: allCommands }
    }
    // 模糊搜索：匹配名称或描述
    const matches = allCommands.filter(
      (cmd) => cmd.name.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q)
    )
    // 搜索结果也按分类分
    const groups = new Map<string, CommandItem[]>()
    for (const cmd of matches) {
      const list = groups.get(cmd.category) || []
      list.push(cmd)
      groups.set(cmd.category, list)
    }
    return { groups, flat: matches }
  }, [allCommands, query])

  // 限制光标范围
  const safeCursor = Math.max(0, Math.min(cursor, filtered.flat.length - 1))

  // ─── 键盘处理 ───────────────────────────────
  useInput(
    (input, key) => {
      // Esc 关闭
      if (key.escape) {
        onClose()
        return
      }

      // 上下导航
      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1))
        return
      }
      if (key.downArrow) {
        setCursor((c) => Math.min(filtered.flat.length - 1, c + 1))
        return
      }

      // Enter 选择
      if (key.return) {
        const selected = filtered.flat[safeCursor]
        if (selected) {
          onSelect(selected.name)
          onClose()
        }
        return
      }

      // 退格
      if (key.backspace || key.delete) {
        setQuery((q) => q.slice(0, -1))
        setCursor(0)
        return
      }

      // 文字输入过滤
      if (input.length === 1 && !key.ctrl && !key.meta) {
        setQuery((q) => q + input)
        setCursor(0)
      }
    },
    { isActive: true }
  )

  // ─── 渲染 ───────────────────────────────────
  const title = query ? `搜索 "${query}"` : '命令面板'
  const matchCount = filtered.flat.length

  return React.createElement(
    Box,
    { flexDirection: 'column', paddingX: 2, paddingY: 1 },

    // ── 标题栏 ──
    React.createElement(
      Box,
      { key: 'header', marginBottom: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, `${ICONS.brand} ${title}`),
      React.createElement(Text, { dimColor: true }, `  (${matchCount} 个匹配)`),
      React.createElement(Text, { dimColor: true }, '  Esc 关闭')
    ),

    // ── 分隔线 ──
    React.createElement(
      Box,
      { key: 'divider' },
      React.createElement(Text, { dimColor: true }, '─'.repeat(60))
    ),

    // ── 命令列表 ──
    React.createElement(
      Box,
      { key: 'list', flexDirection: 'column', marginTop: 1 },
      ...renderGrouped(filtered.groups, safeCursor)
    ),

    // ── 底部提示 ──
    React.createElement(
      Box,
      { key: 'footer', marginTop: 1 },
      React.createElement(Text, { dimColor: true }, '↑↓ 导航  Enter 选择  Esc 关闭  输入文字过滤')
    )
  )
}

// ─── 辅助：按分类渲染 ──────────────────────────────
function renderGrouped(groups: Map<string, CommandItem[]>, cursor: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let globalIndex = 0

  for (const [category, items] of groups) {
    if (items.length === 0) continue

    const icon = CATEGORY_ICONS[category] ?? '•'
    const label = CATEGORY_LABELS[category] ?? category

    // 分类标题
    nodes.push(
      React.createElement(
        Box,
        { key: `cat-${category}` },
        React.createElement(Text, { bold: true, color: 'magenta' }, `${icon} ${label}`)
      )
    )

    // 分类下的命令
    for (const item of items) {
      const isFocused = globalIndex === cursor
      nodes.push(renderItem(item, globalIndex, isFocused))
      globalIndex++
    }

    // 分类间空隙
    nodes.push(React.createElement(Box, { key: `gap-${category}` }))
  }

  return nodes
}

function renderItem(item: CommandItem, index: number, isFocused: boolean): React.ReactNode {
  return React.createElement(
    Box,
    { key: `cmd-${index}`, paddingLeft: 2 },
    React.createElement(
      Text,
      {
        color: isFocused ? 'cyan' : undefined,
        bold: isFocused,
      },
      isFocused ? `> ${item.name}` : `  ${item.name}`
    ),
    React.createElement(Text, { dimColor: true }, ` — ${item.description}`)
  )
}

export * as CommandPalette_ from './CommandPalette'
