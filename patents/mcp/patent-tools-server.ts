#!/usr/bin/env node

/**
 * YunPat Patent Tools MCP Server
 *
 * 提供 YunPat 专利工具的 MCP 协议接口
 * 允许 Claude Desktop 等 MCP 客户端使用 YunPat 的专利处理能力
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// 导入 YunPat 工具
import {
  KnowledgeSearchTool,
  PatentSearchTool,
  PatentClaimsStructureTool,
  PatentProcessChartTool,
} from '@yunpat/builtin-tools'

import {
  OfficialDocParserToolV2,
  PatentApplicationGeneratorTool,
  PatentClaimsGeneratorTool,
  ResponseStatementGeneratorTool,
} from '@yunpat/document-tools'

/**
 * 创建 MCP 服务器
 */
function createServer() {
  const server = new Server(
    {
      name: 'yunpat-patent-tools-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // 注册工具列表处理器
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // 知识库检索工具
        {
          name: 'knowledge_search',
          description: '从专利知识库中检索相关卡片和文档。支持关键词、概念、领域多维度检索。',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '检索查询（关键词或问题）',
              },
              concepts: {
                type: 'array',
                items: { type: 'string' },
                description: '限定概念范围',
              },
              domains: {
                type: 'array',
                items: { type: 'string' },
                description: '限定领域范围',
              },
              limit: {
                type: 'number',
                description: '返回结果数量限制',
                default: 10,
              },
              includeContent: {
                type: 'boolean',
                description: '是否包含卡片内容',
                default: true,
              },
            },
            required: ['query'],
          },
        },

        // 专利检索工具
        {
          name: 'patent_search',
          description: '执行迭代式专利检索，支持多字段组合检索',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '检索关键词',
              },
              searchFields: {
                type: 'array',
                items: { type: 'string' },
                description: '检索字段（标题、摘要、权利要求等）',
              },
              dateRange: {
                type: 'object',
                properties: {
                  start: { type: 'string' },
                  end: { type: 'string' },
                },
                description: '日期范围',
              },
              assignee: {
                type: 'string',
                description: '申请人',
              },
              inventor: {
                type: 'string',
                description: '发明人',
              },
              ipc: {
                type: 'string',
                description: 'IPC分类号',
              },
            },
            required: ['query'],
          },
        },

        // 官文解析工具
        {
          name: 'official_doc_parse',
          description: '解析专利官文（审查意见通知书、驳回决定、缴费通知书等），提取结构化字段',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: '官文文件路径（PDF/图片）',
              },
              docType: {
                type: 'string',
                enum: [
                  'review_opinion',
                  'rejection_decision',
                  'payment_notice',
                  'grant_decision',
                  'reexamination_decision',
                ],
                description: '官文类型（自动检测）',
              },
              useOcr: {
                type: 'boolean',
                description: '是否使用OCR（扫描版PDF需要启用）',
                default: false,
              },
            },
            required: ['filePath'],
          },
        },

        // 专利申请文件生成工具
        {
          name: 'patent_application_generator',
          description: '生成专利申请文件（权利要求书、说明书等）',
          inputSchema: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  inventionTitle: {
                    type: 'string',
                    description: '发明名称',
                  },
                  technicalField: {
                    type: 'string',
                    description: '技术领域',
                  },
                  backgroundArt: {
                    type: 'string',
                    description: '背景技术',
                  },
                  inventionContent: {
                    type: 'string',
                    description: '发明内容',
                  },
                  claims: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          enum: ['independent', 'dependent'],
                        },
                        number: { type: 'number' },
                        content: { type: 'string' },
                        dependsOn: { type: 'number' },
                      },
                    },
                    description: '权利要求书',
                  },
                  abstract: {
                    type: 'string',
                    description: '摘要',
                  },
                },
                required: [
                  'inventionTitle',
                  'technicalField',
                  'backgroundArt',
                  'inventionContent',
                  'claims',
                  'abstract',
                ],
              },
              outputPath: {
                type: 'string',
                description: '输出文件路径',
              },
              template: {
                type: 'string',
                enum: ['standard', 'pct', 'utility'],
                description: '文档模板类型',
                default: 'standard',
              },
            },
            required: ['data', 'outputPath'],
          },
        },

        // 权利要求书生成工具
        {
          name: 'patent_claims_generator',
          description: '生成权利要求书',
          inputSchema: {
            type: 'object',
            properties: {
              claims: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['independent', 'dependent'],
                    },
                    number: { type: 'number' },
                    content: { type: 'string' },
                    dependsOn: { type: 'number' },
                  },
                },
                description: '权利要求数组',
              },
              outputPath: {
                type: 'string',
                description: '输出文件路径',
              },
            },
            required: ['claims', 'outputPath'],
          },
        },

        // 意见陈述书生成工具
        {
          name: 'response_statement_generator',
          description: '生成审查意见陈述书',
          inputSchema: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  applicationNumber: {
                    type: 'string',
                    description: '申请号',
                  },
                  inventionTitle: {
                    type: 'string',
                    description: '发明名称',
                  },
                  reviewOpinionSummary: {
                    type: 'string',
                    description: '审查意见摘要',
                  },
                  responsePoints: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        examinerView: { type: 'string' },
                        applicantResponse: { type: 'string' },
                        legalBasis: { type: 'string' },
                      },
                    },
                    description: '答复要点',
                  },
                },
                required: [
                  'applicationNumber',
                  'inventionTitle',
                  'reviewOpinionSummary',
                  'responsePoints',
                ],
              },
              outputPath: {
                type: 'string',
                description: '输出文件路径',
              },
            },
            required: ['data', 'outputPath'],
          },
        },

        // 权利要求结构图工具
        {
          name: 'patent_claims_structure',
          description: '生成专利权利要求结构图（Mermaid格式）',
          inputSchema: {
            type: 'object',
            properties: {
              claims: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    number: { type: 'number' },
                    content: { type: 'string' },
                    type: {
                      type: 'string',
                      enum: ['independent', 'dependent'],
                    },
                    dependsOn: { type: 'number' },
                  },
                },
                description: '权利要求数组',
              },
              title: {
                type: 'string',
                description: '图表标题',
              },
            },
            required: ['claims'],
          },
        },

        // 专利流程图工具
        {
          name: 'patent_process_chart',
          description: '生成专利申请/审查流程图（Mermaid格式）',
          inputSchema: {
            type: 'object',
            properties: {
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    label: { type: 'string' },
                    type: {
                      type: 'string',
                      enum: ['start', 'process', 'decision', 'end'],
                    },
                  },
                },
                description: '流程步骤',
              },
              flows: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    from: { type: 'string' },
                    to: { type: 'string' },
                    label: { type: 'string' },
                  },
                },
                description: '流程连线',
              },
              title: {
                type: 'string',
                description: '图表标题',
              },
            },
            required: ['steps', 'flows'],
          },
        },
      ],
    }
  })

  // 注册工具调用处理器
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      // 创建简单的上下文（MCP 服务器可能不需要完整的上下文）
      const context = {
        registry: null,
        llm: null,
        memory: null,
        eventBus: null,
      } as any

      let result

      if (!args) {
        throw new Error(`Missing arguments for tool: ${name}`)
      }

      switch (name) {
        case 'knowledge_search': {
          const tool = new KnowledgeSearchTool()
          result = await tool.execute(args as any, context)
          break
        }

        case 'patent_search': {
          const tool = new PatentSearchTool()
          result = await tool.execute(args as any, context)
          break
        }

        case 'official_doc_parse': {
          const tool = new OfficialDocParserToolV2()
          result = await tool.execute(args as any, context)
          break
        }

        case 'patent_application_generator': {
          const tool = new PatentApplicationGeneratorTool()
          result = await tool.execute(args as any, context)
          break
        }

        case 'patent_claims_generator': {
          const tool = new PatentClaimsGeneratorTool()
          result = await tool.execute(args as any, context)
          break
        }

        case 'response_statement_generator': {
          const tool = new ResponseStatementGeneratorTool()
          result = await tool.execute(args as any, context)
          break
        }

        case 'patent_claims_structure': {
          const tool = new PatentClaimsStructureTool()
          result = await tool.execute(args as any, context)
          break
        }

        case 'patent_process_chart': {
          const tool = new PatentProcessChartTool()
          result = await tool.execute(args as any, context)
          break
        }

        default:
          throw new Error(`Unknown tool: ${name}`)
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
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
  const server = createServer()

  const transport = new StdioServerTransport()
  await server.connect(transport)

  // 服务器已启动，等待请求
  // stderr.write('YunPat Patent Tools MCP Server running on stdio\n');
}

main().catch((error) => {
  console.error('Server error:', error)
  process.exit(1)
})
