/**
 * YunPat MCP Server v3.0
 *
 * Model Context Protocol 服务器
 * 提供专利工具的 MCP 接口
 *
 * v3.0 更新：
 * - 集成真实的 YunPat 智能体
 * - 支持完整的上下文传递（LLM、EventBus、Memory、Tools）
 * - 回退机制：智能体调用失败时使用规则模式
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'

// 导入核心框架
import {
  EventBus,
  ShortTermMemory,
  ToolRegistry,
  createDeepSeekModel,
  detectTechnicalDisclosure,
} from '@yunpat/core'

// 导入工具
import {
  PatentSearchTool,
  ClaimsGeneratorTool,
  QualityCheckerTool,
  LegalKnowledgeSearchTool,
  InvalidDecisionSearchTool,
  PatentRuleSearchTool,
  ProjectScanTool,
  PatentDispatchTool,
  PatentWriterTool,
  PatentCompareTool,
} from './tools/index.js'

import type { McpToolContext } from './types.js'

/**
 * 创建 MCP 服务器
 */
function createServer() {
  // 初始化核心框架
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
  const llm = apiKey ? createDeepSeekModel(apiKey) : null
  const eventBus = new EventBus()
  const memory = new ShortTermMemory()
  const tools = new ToolRegistry(eventBus)

  // 创建工具实例
  const patentSearchTool = new PatentSearchTool()
  const claimsGeneratorTool = new ClaimsGeneratorTool()
  const qualityCheckerTool = new QualityCheckerTool()
  const legalKnowledgeTool = new LegalKnowledgeSearchTool()
  const invalidDecisionTool = new InvalidDecisionSearchTool()
  const patentRuleTool = new PatentRuleSearchTool()
  const projectScanTool = new ProjectScanTool()
  const patentDispatchTool = new PatentDispatchTool()
  const patentWriterTool = new PatentWriterTool()
  const patentCompareTool = new PatentCompareTool()

  // 所有工具列表
  const toolsList = [
    patentSearchTool,
    claimsGeneratorTool,
    qualityCheckerTool,
    legalKnowledgeTool,
    invalidDecisionTool,
    patentRuleTool,
    projectScanTool,
    patentDispatchTool,
    patentWriterTool,
    patentCompareTool,
  ]

  // 构建工具名称 → 实例的查找 Map
  const toolMap = new Map(toolsList.map((t) => [t.metadata.name, t] as const))

  // 注册到 ToolRegistry（激活事件发布）
  for (const mcpTool of toolsList) {
    tools.register({
      name: mcpTool.metadata.name,
      description: mcpTool.metadata.description,
      inputSchema: mcpTool.metadata.inputSchema,
      execute: (input: unknown, context?: unknown) =>
        mcpTool.execute(input, context as McpToolContext),
    })
  }

  // 创建 MCP 服务器
  const server = new Server(
    {
      name: 'yunpat-patent-tools',
      version: '3.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  /**
   * 注册工具列表处理器
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const toolDefinitions: Tool[] = toolsList.map((tool) => tool.getMcpSchema())

    return {
      tools: toolDefinitions,
    }
  })

  /**
   * 注册工具调用处理器
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      // CON-01: 数据主权检测 — 提取工具参数中的文本内容进行检查
      const inputText = extractInputText(args)
      if (inputText) {
        const sovereigntyCheck = detectTechnicalDisclosure(inputText)
        if (sovereigntyCheck.isSensitive && sovereigntyCheck.routing === 'local') {
          // 技术交底书内容 → 拒绝外部处理，返回提示
          console.error(`[CON-01] 检测到敏感内容: ${sovereigntyCheck.reason}`)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  notice: '数据主权保护 (CON-01)',
                  message: sovereigntyCheck.reason,
                  action: '检测到技术交底书内容，为保护您的技术秘密，该内容不会发送到外部 API。',
                  suggestion:
                    '请配置本地 Ollama 模型以使用完整功能，或使用抽象化描述替代原始技术交底。',
                  rule_id: sovereigntyCheck.ruleId,
                }),
              },
            ],
            isError: true,
          }
        }
        if (sovereigntyCheck.isSensitive) {
          console.error(`[CON-01B] 内容需抽象化: ${sovereigntyCheck.reason}`)
        }
      }
      // 创建执行上下文（包含真实的 LLM 和框架组件）
      const context: McpToolContext = {
        llm,
        eventBus,
        memory,
        registry: tools,
      }

      // 根据工具名称分发
      const mcpTool = toolMap.get(name)
      if (!mcpTool) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Unknown tool: ${name}`,
              }),
            },
          ],
          isError: true,
        }
      }

      const result = await mcpTool.execute(args, context)

      // 格式化返回结果
      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: result.error,
                  toolName: name,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        }
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: error instanceof Error ? error.message : String(error),
                toolName: name,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      }
    }
  })

  return server
}

/**
 * 从工具参数中提取文本内容用于数据主权检测
 */
function extractInputText(args: Record<string, unknown> | undefined): string {
  if (!args) return ''
  const parts: string[] = []
  for (const value of Object.values(args)) {
    if (typeof value === 'string') {
      parts.push(value)
    }
  }
  return parts.join('\n')
}

/**
 * 启动服务器
 */
async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.warn('警告: 未设置 API 密钥 (DEEPSEEK_API_KEY 或 OPENAI_API_KEY)')
    console.warn('MCP 服务器将以规则模式运行（不使用 LLM）')
    console.warn('要启用完整功能，请设置: export DEEPSEEK_API_KEY=your_key')
  }

  const server = createServer()

  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('✓ YunPat MCP Server v3.0 已启动')
  if (apiKey) {
    console.error('✓ 已启用智能体集成模式')
  } else {
    console.error('⚠ 运行在规则模式（部分功能受限）')
  }

  // 错误处理
  process.on('SIGINT', async () => {
    await server.close()
    process.exit(0)
  })
}

// 启动服务器
main().catch((error) => {
  console.error('Server error:', error)
  process.exit(1)
})
