/**
 * @file HITL 面板组件
 * @description Claude Code 风格的人机协作面板
 */

import React from 'react'
import { Box, Text } from 'ink'
import type { HITLRequest } from '../types/index.js'

interface HITLPanelProps {
  request: HITLRequest
  onSelect: (optionId: string) => void
}

const ACTION_STYLES: Record<
  HITLRequest['options'][number]['action'],
  { label: string; color: string; key: string }
> = {
  approve: { label: '批准', color: 'green', key: '✓' },
  reject: { label: '拒绝', color: 'red', key: '✗' },
  modify: { label: '修改', color: 'yellow', key: '✎' },
  skip: { label: '跳过', color: 'gray', key: '⊘' },
}

export const HITLPanel: React.FC<HITLPanelProps> = ({ request, onSelect }) => {
  const { content, options } = request

  // 渲染内容
  const renderContent = () => {
    switch (content.type) {
      case 'confirmation':
        return React.createElement(Text, { color: 'yellow' }, `⚠ ${content.message}`)
      case 'choice':
        return React.createElement(
          Box,
          { flexDirection: 'column' },
          React.createElement(Text, { color: 'cyan' }, `? ${content.message}`),
          ...content.choices.map((choice, i) =>
            React.createElement(
              Box,
              { key: i, marginLeft: 2 },
              React.createElement(Text, { dimColor: true }, `${i + 1}. `),
              React.createElement(Text, null, choice)
            )
          )
        )
      case 'correction':
        return React.createElement(
          Box,
          { flexDirection: 'column' },
          React.createElement(Text, { color: 'yellow' }, `✎ ${content.message}`),
          ...Object.entries(content.data || {}).map(([key, value]) =>
            React.createElement(
              Box,
              { key, marginLeft: 2 },
              React.createElement(Text, { dimColor: true }, `${key}: `),
              React.createElement(Text, null, String(value))
            )
          )
        )
      case 'input':
        return React.createElement(Text, { color: 'cyan' }, `> ${content.message}`)
      default:
        return null
    }
  }

  return React.createElement(
    Box,
    {
      borderStyle: 'double',
      paddingX: 1,
      paddingY: 1,
    },
    // 标题
    React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(Text, { bold: true, color: 'magenta' }, '! 需要确认 ')
    ),

    // 内容
    React.createElement(Box, { marginBottom: 1, paddingX: 1 }, renderContent()),

    // 选项
    ...options.map((option, index) => {
      const actionStyle = ACTION_STYLES[option.action]
      return React.createElement(
        Box,
        { key: option.id, marginLeft: 2, marginBottom: index < options.length - 1 ? 1 : 0 },
        React.createElement(Text, { bold: true, color: 'cyan' }, `${index + 1}.`),
        React.createElement(
          Text,
          { color: actionStyle.color },
          ` ${actionStyle.key} ${actionStyle.label}`
        ),
        ...(option.label
          ? [React.createElement(Text, { dimColor: true, key: 'label' }, ` · ${option.label}`)]
          : [])
      )
    }),

    // 提示
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Text, { dimColor: true, italic: true }, ' 按数字选择，ESC 取消 ')
    )
  )
}
