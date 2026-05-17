/**
 * 工具类 — 包装 format-converter 和 patent-manager Agent
 */

import { z } from 'zod'
import { BaseMcpTool } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'
import type { ToolExecutionResult } from './DraftingTools.js'

// ============================================================
// 类型定义
// ============================================================

/** 结构化内容 */
interface StructuredContent {
  [key: string]: unknown
}

/** 文档元数据 */
interface DocumentMetadata {
  applicationNumber?: string
  applicant?: string
  inventor?: string
}

// ============================================================
// FormatConverterTool
// ============================================================

const formatConverterSchema = z.object({
  inputFormat: z.enum(['markdown', 'structured']).describe('输入格式'),
  outputFormat: z.enum(['docx']).describe('输出格式'),
  content: z
    .object({
      markdown: z.string().optional().describe('Markdown 内容'),
      structured: z.lazy(() => z.record(z.unknown())).optional().describe('结构化内容'),
    })
    .describe('待转换内容'),
  patentOfficeFormat: z
    .enum(['CNIPA', 'USPTO', 'EPO'])
    .optional()
    .default('CNIPA')
    .describe('目标专利局格式'),
  outputPath: z.string().optional().describe('输出文件路径'),
  metadata: z
    .object({
      applicationNumber: z.string().optional(),
      applicant: z.string().optional(),
      inventor: z.string().optional(),
    })
    .optional()
    .describe('文档元数据'),
})

export class FormatConverterTool extends BaseMcpTool<z.infer<typeof formatConverterSchema>, ToolExecutionResult> {
  readonly metadata = {
    name: 'format_convert',
    description:
      '格式转换：将 Markdown 或结构化内容转换为专利局标准格式（DOCX）。支持 CNIPA/USPTO/EPO 格式。用于专利申请文档的格式化输出。',
    version: '1.0.0',
    inputSchema: formatConverterSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof formatConverterSchema>,
    context: McpToolContext
  ): Promise<ToolExecutionResult> {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { PatentFormatConverterAgent } = await import('@yunpat/format-converter')
        const agent = new PatentFormatConverterAgent({
          name: 'format-converter',
          description: '格式转换智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })
        const agentConfig: Record<string, unknown> & {
          inputFormat: string
          outputFormat: string
          patentOfficeFormat: string
          content: unknown
          outputPath?: string
        } = {
          inputFormat: input.inputFormat,
          outputFormat: input.outputFormat,
          patentOfficeFormat: input.patentOfficeFormat,
          content: input.content,
          outputPath: input.outputPath || '/tmp/patent-output.docx',
        }
        const result = await agent.execute(agentConfig)
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[FormatConverterTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      success: false,
      error: '格式转换需要文档工具支持，请确保 MCP Server 以完整模式运行',
    }
  }
}

// ============================================================
// PatentManagerTool
// ============================================================

const patentManagerSchema = z.object({
  operation: z
    .enum([
      'create',
      'update',
      'query',
      'delete',
      'transition',
      'check_deadlines',
      'calculate_fees',
    ])
    .describe('操作类型'),
  data: z.lazy(() => z.record(z.unknown())).optional().describe('操作数据（根据操作类型不同）'),
})

export class PatentManagerTool extends BaseMcpTool<z.infer<typeof patentManagerSchema>, ToolExecutionResult> {
  readonly metadata = {
    name: 'patent_manager',
    description:
      '专利全生命周期管理：创建、查询、更新专利案件，状态流转，截止日期检查和费用计算。用于专利案件管理和流程监控。',
    version: '1.0.0',
    inputSchema: patentManagerSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof patentManagerSchema>,
    context: McpToolContext
  ): Promise<ToolExecutionResult> {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { PatentManagerAgent } = await import('@yunpat/agent-patent-manager')
        const agent = new PatentManagerAgent({
          name: 'patent-manager',
          description: '专利管理智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })
        const agentConfig: Record<string, unknown> & {
          operation: string
          data: unknown
        } = {
          operation: input.operation,
          data: input.data,
        }
        const result = await agent.execute(agentConfig)
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[PatentManagerTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      success: false,
      operation: input.operation,
      message: `操作 "${input.operation}" 需要数据库连接，请确保 PostgreSQL 可用`,
    }
  }
}
