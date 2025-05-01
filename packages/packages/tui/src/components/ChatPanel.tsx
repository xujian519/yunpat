/**
 * @file 对话面板组件
 * @description 对话历史显示，支持消息虚拟化和简易 Markdown 渲染
 */

import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import type { SessionMessage } from '../types/index.js'
import { ROLE_STYLES } from '../theme.js'

/** 最大渲染消息数（防止终端卡顿） */
const MAX_VISIBLE_MESSAGES = 150

interface ChatPanelProps {
  messages: SessionMessage[]
}

/**
 * 简易 Markdown 行渲染
 * 支持：粗体、行内代码、标题、列表、分隔线
 */
function renderMarkdownLine(line: string, dimmed: boolean): React.ReactNode {
  // 空行
  if (!line) return React.createElement(Text, null, ' ')

  const textProps = dimmed ? { dimColor: true } : {}

  // 分隔线
  if (/^─{3,}$/.test(line) || /^══{3,}$/.test(line)) {
    return React.createElement(Text, { ...textProps, dimColor: true }, line)
  }

  // 标题 (### ...)
  const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
  if (headingMatch) {
    return React.createElement(Text, { ...textProps, bold: true, color: 'cyan' }, line)
  }

  // 列表项 (• 或 - 或 数字.)
  const listMatch = line.match(/^(\s*)([•\-]\s|\d+\.\s)(.+)/)
  if (listMatch) {
    const [, indent, marker, content] = listMatch
    return React.createElement(
      Box,
      null,
      React.createElement(Text, { ...textProps }, `${indent ?? ''}${marker ?? ''}`),
      renderInlineFormatting(content ?? '', textProps)
    )
  }

  return renderInlineFormatting(line, textProps)
}

/**
 * 行内格式渲染：粗体、代码
 */
function renderInlineFormatting(text: string, baseProps: Record<string, unknown>): React.ReactNode {
  // 简化处理：分段匹配 `code` 和 **bold**
  const parts: React.ReactNode[] = []
  let remaining = text
  let keyIdx = 0

  while (remaining.length > 0) {
    // 匹配行内代码 `...`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`/)
    if (codeMatch) {
      if (codeMatch[1]) {
        parts.push(React.createElement(Text, { ...baseProps, key: `t${keyIdx++}` }, codeMatch[1]))
      }
      parts.push(
        React.createElement(
          Text,
          { ...baseProps, key: `c${keyIdx++}`, color: 'yellow', backgroundColor: '#333333' },
          ` ${codeMatch[2]} `
        )
      )
      remaining = remaining.slice(codeMatch[0]?.length ?? 0)
      continue
    }

    // 匹配粗体 **...**
    const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*/)
    if (boldMatch) {
      if (boldMatch[1]) {
        parts.push(React.createElement(Text, { ...baseProps, key: `t${keyIdx++}` }, boldMatch[1]))
      }
      parts.push(
        React.createElement(Text, { ...baseProps, key: `b${keyIdx++}`, bold: true }, boldMatch[2])
      )
      remaining = remaining.slice(boldMatch[0]?.length ?? 0)
      continue
    }

    // 无特殊格式，输出剩余文本
    parts.push(React.createElement(Text, { ...baseProps, key: `r${keyIdx++}` }, remaining))
    break
  }

  return parts.length === 1 ? parts[0] : React.createElement(React.Fragment, null, ...parts)
}

/**
 * 渲染单条消息
 */
function MessageItem({
  msg,
  index,
  isLast,
}: {
  msg: SessionMessage
  index: number
  isLast: boolean
}) {
  const style = ROLE_STYLES[msg.role]
  const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const isSystem = msg.role === 'system'

  // 按行拆分并渲染
  const lines = msg.content.split('\n')

  return React.createElement(
    Box,
    { flexDirection: 'column', marginBottom: isLast ? 0 : 1, width: '100%' },
    // 消息头部
    React.createElement(
      Box,
      null,
      React.createElement(Text, { color: style.color, bold: true }, style.icon),
      React.createElement(Text, { color: style.color, bold: true }, ` ${style.prefix} `),
      React.createElement(Text, { dimColor: true }, time)
    ),
    // 消息内容
    ...lines.map((line, i) =>
      React.createElement(Box, { key: i }, renderMarkdownLine(line, isSystem))
    )
  )
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages }) => {
  // 虚拟化：只渲染最近的消息
  const visibleMessages = useMemo(() => {
    if (messages.length <= MAX_VISIBLE_MESSAGES) return messages
    return messages.slice(-MAX_VISIBLE_MESSAGES)
  }, [messages])

  // 截断提示
  const truncated = messages.length > MAX_VISIBLE_MESSAGES

  if (visibleMessages.length === 0) {
    return React.createElement(
      Box,
      { flexDirection: 'column', flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
      React.createElement(
        Text,
        { dimColor: true, italic: true },
        ' 输入消息开始对话，或输入 /help 查看命令 '
      )
    )
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', flexGrow: 1 },
    // 截断提示
    truncated
      ? React.createElement(
          Box,
          { marginBottom: 1 },
          React.createElement(
            Text,
            { dimColor: true, italic: true },
            ` ... 早期 ${messages.length - MAX_VISIBLE_MESSAGES} 条消息已折叠 ...`
          )
        )
      : null,
    // 消息列表
    ...visibleMessages.map((msg, index) =>
      React.createElement(MessageItem, {
        key: index,
        msg,
        index,
        isLast: index === visibleMessages.length - 1,
      })
    )
  )
}
