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
import { EventBus, ShortTermMemory, ToolRegistry, createDeepSeekModel } from '@yunpat/core'

// 导入工具
import {
  PatentSearchTool,
  ClaimsGeneratorTool,
  QualityCheckerTool,
  LegalKnowledgeSearchTool,
  InvalidDecisionSearchTool,
  PatentRuleSearchTool,
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

  // 所有工具列表
  const toolsList = [
    patentSearchTool,
    claimsGeneratorTool,
    qualityCheckerTool,
    legalKnowledgeTool,
    invalidDecisionTool,
    patentRuleTool,
  ]

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
      // 创建执行上下文（包含真实的 LLM 和框架组件）
      const context: McpToolContext = {
        llm,
        eventBus,
        memory,
        registry: tools,
      }

      // 根据工具名称分发
      let result

      switch (name) {
        case 'patent_search':
          result = await patentSearchTool.execute(args, context)
          break

        case 'claims_generator':
          result = await claimsGeneratorTool.execute(args, context)
          break

        case 'quality_checker':
          result = await qualityCheckerTool.execute(args, context)
          break

        case 'legal_knowledge_search':
          result = await legalKnowledgeTool.execute(args, context)
          break

        case 'invalid_decision_search':
          result = await invalidDecisionTool.execute(args, context)
          break

        case 'patent_rule_search':
          result = await patentRuleTool.execute(args, context)
          break

        default:
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
