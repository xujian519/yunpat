/**
 * @file 输入框组件
 * @description 用户输入，支持斜杠命令高亮、Tab 补全、历史记录
 *
 * 设计：
 * - 不依赖 ink-text-input 的默认行为（它会吞掉 Tab/↑↓ 键）
 * - 用 useInput 捕获所有键盘事件，自己管理光标和编辑
 * - Tab 补全命令名，↑↓ 浏览历史
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { commandRegistry } from '../commands/index.js'

/** 最大历史记录条数 */
const MAX_HISTORY = 100

interface InputBarProps {
  placeholder?: string
  onSubmit: (value: string) => void
  disabled?: boolean
  focus?: boolean
}

export const InputBar: React.FC<InputBarProps> = ({
  placeholder = '输入消息...',
  onSubmit,
  disabled = false,
  focus = true,
}) => {
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const savedValueRef = useRef('')

  // ─── 提交 ─────────────────────────────────
  const handleSubmit = useCallback(
    (submitted: string) => {
      const trimmed = submitted.trim()
      if (!trimmed) return
      onSubmit(trimmed)
      setHistory((prev) => {
        const next = prev.filter((h) => h !== trimmed)
        next.push(trimmed)
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
      })
      setHistoryIndex(-1)
      savedValueRef.current = ''
      setValue('')
    },
    [onSubmit]
  )

  // ─── 命令建议 ─────────────────────────────
  const isCommandInput = value.startsWith('/')
  const commandPart = isCommandInput ? (value.slice(1).split(/\s+/)[0] ?? '') : ''

  const suggestions = useMemo(() => {
    if (!isCommandInput || !commandPart) return []
    return commandRegistry.getSuggestions(commandPart).slice(0, 5)
  }, [isCommandInput, commandPart])

  // ─── Tab 补全 ──────────────────────────────
  const handleTabComplete = useCallback(() => {
    if (!isCommandInput || suggestions.length === 0) return
    const first = suggestions[0]
    if (!first) return
    // 如果只有一个建议或有空格，只补全命令部分
    if (!value.includes(' ')) {
      setValue(`/${first.command} `)
    }
  }, [isCommandInput, suggestions, value])

  // ─── 键盘事件 ──────────────────────────────
  useInput(
    (input, key) => {
      if (disabled) return

      // Enter → 提交
      if (key.return) {
        handleSubmit(value)
        return
      }

      // Backspace → 删除末尾字符
      if (key.backspace || key.delete) {
        setValue((v) => v.slice(0, -1))
        if (historyIndex !== -1) setHistoryIndex(-1)
        return
      }

      // Tab → 补全
      if (key.tab) {
        handleTabComplete()
        return
      }

      // ↑ → 历史上翻
      if (key.upArrow) {
        if (history.length === 0) return
        if (historyIndex === -1) savedValueRef.current = value
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setValue(history[newIndex] ?? '')
        return
      }

      // ↓ → 历史下翻
      if (key.downArrow) {
        if (historyIndex === -1) return
        if (historyIndex >= history.length - 1) {
          setHistoryIndex(-1)
          setValue(savedValueRef.current)
        } else {
          const newIndex = historyIndex + 1
          setHistoryIndex(newIndex)
          setValue(history[newIndex] ?? '')
        }
        return
      }

      // Ctrl+C / Ctrl+U → 清空
      if (key.ctrl && (input === 'u' || input === 'c')) {
        setValue('')
        setHistoryIndex(-1)
        return
      }

      // 普通字符
      if (input && !key.ctrl && !key.meta) {
        setValue((v) => v + input)
        if (historyIndex !== -1) setHistoryIndex(-1)
      }
    },
    { isActive: focus && !disabled }
  )

  // ─── 渲染 ──────────────────────────────────

  // 禁用
  if (disabled) {
    return React.createElement(
      Box,
      { borderStyle: 'single', paddingX: 1 },
      React.createElement(Text, { dimColor: true }, placeholder)
    )
  }

  // 命令输入 → 高亮命令部分
  if (isCommandInput && commandPart) {
    const firstSpace = value.indexOf(' ')
    const cmdText = firstSpace === -1 ? value : value.slice(0, firstSpace)
    const restText = firstSpace === -1 ? '' : value.slice(firstSpace)

    return React.createElement(
      Box,
      { flexDirection: 'column' },
      // 输入行
      React.createElement(
        Box,
        { borderStyle: 'single', paddingX: 1 },
        React.createElement(Text, { color: 'green' }, '> '),
        React.createElement(Text, { bold: true, color: 'cyan' }, cmdText),
        restText ? React.createElement(Text, null, restText) : null,
        React.createElement(Text, { dimColor: true }, '█')
      ),
      // 建议行
      suggestions.length > 0
        ? React.createElement(
            Box,
            { paddingX: 2, marginTop: 0 },
            React.createElement(Text, { dimColor: true }, 'Tab补全: '),
            ...suggestions.flatMap((s, i) => [
              React.createElement(
                Text,
                { key: `c${i}`, color: i === 0 ? 'cyan' : 'gray', bold: i === 0 },
                `/${s.command}`
              ),
              React.createElement(Text, { key: `d${i}` }, i < suggestions.length - 1 ? ' ' : ''),
            ])
          )
        : null
    )
  }

  // 普通输入
  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(
      Box,
      { borderStyle: 'single', paddingX: 1 },
      React.createElement(Text, { color: 'green' }, '> '),
      React.createElement(Text, null, value),
      React.createElement(Text, { dimColor: true }, '█')
    )
  )
}
