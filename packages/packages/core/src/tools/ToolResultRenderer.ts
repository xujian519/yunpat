/**
 * 工具结果渲染器（Tool Result Renderer）
 *
 * Phase 2.3 核心组件：
 * - 将工具结果统一渲染为多种目标格式
 * - 支持 LLM message block、日志、UI 三种输出
 * - 优先使用工具的自定义渲染器， fallback 到默认渲染
 *
 * 借鉴 Claude Code 的 renderToolResultMessage / renderToolUseMessage 设计。
 */

import { EnhancedTool, ToolResultBlockParam, UIRenderSpec } from './types.js'

/**
 * 渲染目标
 */
export type RenderTarget = 'llm' | 'log' | 'ui'

/**
 * 工具结果渲染器
 */
export class ToolResultRenderer {
  /**
   * 渲染工具结果为 LLM message blocks
   *
   * 优先级：
   * 1. 工具自定义 `renderToolResultMessage()`
   * 2. 默认渲染器（按结果类型推断）
   */
  async renderForLLM<TOutput>(
    tool: EnhancedTool<any, TOutput>,
    result: TOutput
  ): Promise<ToolResultBlockParam[]> {
    // 优先使用工具自定义渲染
    if (tool.renderToolResultMessage) {
      try {
        return await tool.renderToolResultMessage(result)
      } catch (error) {
        console.warn(
          `[ToolResultRenderer] 工具 '${tool.metadata.name}' 自定义渲染失败，使用默认渲染:`,
          error
        )
      }
    }

    // 默认渲染
    return this.defaultRenderForLLM(result)
  }

  /**
   * 渲染工具结果为日志文本
   */
  async renderForLog<TOutput>(
    tool: EnhancedTool<any, TOutput>,
    result: TOutput,
    options?: { maxLength?: number }
  ): Promise<string> {
    const maxLength = options?.maxLength ?? 500
    const toolName = tool.metadata.name

    // 处理已压缩/持久化的结果
    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>
      if (obj._compacted === true && typeof obj.summary === 'string') {
        return `[${toolName}] ${obj.summary}`
      }
      if (obj._persisted === true && typeof obj.filePath === 'string') {
        return `[${toolName}] 结果已持久化: ${obj.filePath} (${obj.size} 字符)`
      }
    }

    let text: string
    try {
      if (typeof result === 'string') {
        text = result
      } else {
        text = JSON.stringify(result, null, 2)
      }
    } catch {
      text = String(result)
    }

    if (text.length > maxLength) {
      return `[${toolName}] ${text.substring(0, maxLength)}... [截断，共 ${text.length} 字符]`
    }

    return `[${toolName}] ${text}`
  }

  /**
   * 渲染工具结果为 UI 渲染规范
   */
  async renderForUI<TOutput>(
    tool: EnhancedTool<any, TOutput>,
    result: TOutput
  ): Promise<UIRenderSpec> {
    const toolName = tool.metadata.name

    // 处理已压缩/持久化的结果
    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>
      if (obj._compacted === true) {
        return {
          component: 'text',
          title: toolName,
          content: obj.summary ?? '[内容已压缩]',
          meta: { truncated: true },
        }
      }
      if (obj._persisted === true) {
        return {
          component: 'text',
          title: toolName,
          content: `结果已持久化到: ${obj.filePath ?? 'unknown'}`,
          meta: { filePath: obj.filePath, size: obj.size },
        }
      }
    }

    // 按结果类型选择组件
    if (typeof result === 'string') {
      // 检测是否为代码
      const isCode = this.looksLikeCode(result)
      return {
        component: isCode ? 'code' : 'text',
        title: toolName,
        content: result,
        meta: isCode
          ? { language: this.detectLanguage(result), lineCount: result.split('\n').length }
          : undefined,
      }
    }

    if (Array.isArray(result)) {
      // 检测是否为表格数据
      if (result.length > 0 && typeof result[0] === 'object') {
        return {
          component: 'table',
          title: toolName,
          content: result,
          meta: { rowCount: result.length },
        }
      }
      return {
        component: 'json',
        title: toolName,
        content: result,
        meta: { itemCount: result.length },
      }
    }

    if (result && typeof result === 'object') {
      // 检测是否为 diff
      if ('added' in result || 'removed' in result || 'diff' in result) {
        return {
          component: 'diff',
          title: toolName,
          content: result,
        }
      }

      // 检测是否为图片数据
      if ('data' in result && 'mimeType' in result) {
        return {
          component: 'image',
          title: toolName,
          content: result,
        }
      }

      return {
        component: 'json',
        title: toolName,
        content: result,
        meta: { keys: Object.keys(result as object) },
      }
    }

    return {
      component: 'text',
      title: toolName,
      content: String(result),
    }
  }

  /**
   * 渲染工具调用请求为可读描述
   */
  async renderToolUse<TInput>(tool: EnhancedTool<TInput>, input: TInput): Promise<string> {
    // 优先使用工具自定义渲染
    if (tool.renderToolUseMessage) {
      try {
        return await tool.renderToolUseMessage(input)
      } catch (error) {
        console.warn(
          `[ToolResultRenderer] 工具 '${tool.metadata.name}' 自定义 use 渲染失败，使用默认渲染:`,
          error
        )
      }
    }

    // 默认渲染
    const toolName = tool.metadata.name
    let inputStr: string
    try {
      inputStr = typeof input === 'string' ? input : JSON.stringify(input)
    } catch {
      inputStr = String(input)
    }

    if (inputStr.length > 200) {
      inputStr = inputStr.substring(0, 200) + '...'
    }

    return `${toolName}(${inputStr})`
  }

  // ============== 默认渲染器 ==============

  /**
   * 默认 LLM 渲染
   */
  private defaultRenderForLLM(result: unknown): ToolResultBlockParam[] {
    // 处理已压缩/持久化的结果
    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>
      if (obj._compacted === true) {
        return [
          {
            type: 'text',
            text: (obj.summary as string) ?? '[内容已压缩]',
            isCompacted: true,
            originalTokens: obj.originalTokens as number | undefined,
          },
          ...(obj.preview ? [{ type: 'text' as const, text: obj.preview as string }] : []),
        ]
      }
      if (obj._persisted === true) {
        return [
          {
            type: 'text',
            text: `[结果已持久化到磁盘: ${obj.filePath ?? 'unknown'} (${obj.size} 字符)]`,
          },
        ]
      }
    }

    // 字符串结果
    if (typeof result === 'string') {
      return [{ type: 'text', text: result }]
    }

    // JSON 结果
    try {
      const json = JSON.stringify(result, null, 2)
      return [{ type: 'json', json: result, text: json }]
    } catch {
      return [{ type: 'text', text: String(result) }]
    }
  }

  // ============== 辅助方法 ==============

  /**
   * 检测文本是否为代码
   */
  private looksLikeCode(text: string): boolean {
    const codeIndicators = [
      /^\s*function\s+/,
      /^\s*const\s+\w+\s*=/,
      /^\s*import\s+/,
      /^\s*export\s+/,
      /^\s*class\s+/,
      /^\s*def\s+/,
      /^\s*#include/,
      /\{\s*[\w"']+\s*:/,
      /^\s*\{\s*$/m,
    ]
    return codeIndicators.some((pattern) => pattern.test(text))
  }

  /**
   * 简单检测代码语言
   */
  private detectLanguage(text: string): string {
    if (text.includes('import {') || text.includes('export ')) return 'typescript'
    if (text.includes('def ') || text.includes('import ')) return 'python'
    if (text.includes('func ') || text.includes('package ')) return 'go'
    if (text.includes('#include')) return 'c'
    if (text.includes('class ') && text.includes('public static')) return 'java'
    if (text.includes('<?xml') || text.includes('<!DOCTYPE')) return 'xml'
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) return 'json'
    return 'text'
  }
}

/**
 * 默认渲染器实例
 */
export const defaultToolResultRenderer = new ToolResultRenderer()
