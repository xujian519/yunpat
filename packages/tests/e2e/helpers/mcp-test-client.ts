/**
 * MCP JSON-RPC 测试客户端
 *
 * 轻量级客户端，直接调用 MCP 工具而无需启动完整服务器进程
 */

import type { LLMAdapter } from '@yunpat/core'

export interface MCPTestClientOptions {
  llm?: LLMAdapter | null
  enableDataSovereignty?: boolean
}

export interface MCPToolResult {
  success: boolean
  data?: unknown
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * 创建 MCP 测试客户端
 *
 * 直接导入并实例化工具类，绕过 JSON-RPC 传输层
 */
export async function createMCPTestClient(options?: MCPTestClientOptions) {
  const { llm = null, enableDataSovereignty = true } = options ?? {}

  const context = {
    llm,
    eventBus: null,
    memory: null,
    registry: null,
  }

  async function callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    let ToolClass: new () => { execute: (args: unknown, ctx: unknown) => Promise<unknown> }

    switch (name) {
      case 'patent_search': {
        const mod = await import('@yunpat/mcp-server/tools/PatentSearchTool.js')
        ToolClass = mod.PatentSearchTool
        break
      }
      case 'claims_generator': {
        const mod = await import('@yunpat/mcp-server/tools/index.js')
        ToolClass = mod.ClaimsGeneratorTool
        break
      }
      case 'quality_checker': {
        const mod = await import('@yunpat/mcp-server/tools/index.js')
        ToolClass = mod.QualityCheckerTool
        break
      }
      case 'project_scan': {
        const mod = await import('@yunpat/mcp-server/tools/ProjectScanTool.js')
        ToolClass = mod.ProjectScanTool
        break
      }
      default:
        return { success: false, error: `Unknown tool: ${name}` }
    }

    const tool = new ToolClass()

    // CON-01 检查
    if (enableDataSovereignty) {
      const inputText = Object.values(args)
        .filter((v): v is string => typeof v === 'string')
        .join('\n')

      if (inputText) {
        const { detectTechnicalDisclosure } = await import('@yunpat/core')
        const check = detectTechnicalDisclosure(inputText)
        if (check.isSensitive) {
          return {
            success: false,
            error: `CON-01: 检测到敏感内容 (${check.ruleId})，${check.reason}`,
            metadata: { sovereigntyCheck: check },
          }
        }
      }
    }

    try {
      const result = await tool.execute(args, context)
      return { success: true, data: result }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  }

  async function listTools(): Promise<string[]> {
    const tools = await import('@yunpat/mcp-server/tools/index.js')
    return Object.keys(tools)
  }

  return { callTool, listTools, context }
}
