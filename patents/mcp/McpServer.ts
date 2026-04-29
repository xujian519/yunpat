/**
 * MCP (Model Context Protocol) 服务器
 *
 * 为 YunPat 提供 MCP 工具接口
 */

import { EventEmitter } from 'events';

/**
 * MCP 工具定义
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

/**
 * MCP 工具调用结果
 */
export interface McpToolResult {
  content: any;
  isError?: boolean;
}

/**
 * MCP 服务器配置
 */
export interface McpServerConfig {
  name: string;
  version: string;
  tools: McpTool[];
}

/**
 * MCP 服务器
 */
export class McpServer extends EventEmitter {
  private config: McpServerConfig;
  private tools: Map<string, (params: any) => Promise<any>>;

  constructor(config: McpServerConfig) {
    super();
    this.config = config;
    this.tools = new Map();

    // 注册工具
    config.tools.forEach(tool => {
      this.tools.set(tool.name, this.createToolHandler(tool));
    });
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    console.log(`🚀 MCP 服务器启动: ${this.config.name} v${this.config.version}`);
    console.log(`📦 已注册工具: ${Array.from(this.tools.keys()).join(', ')}`);
    this.emit('started');
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    console.log(`🛑 MCP 服务器停止`);
    this.emit('stopped');
  }

  /**
   * 列出工具
   */
  listTools(): McpTool[] {
    return this.config.tools;
  }

  /**
   * 调用工具
   */
  async callTool(name: string, params: any): Promise<McpToolResult> {
    const handler = this.tools.get(name);

    if (!handler) {
      return {
        content: null,
        isError: true
      };
    }

    try {
      const result = await handler(params);
      this.emit('toolCalled', { name, params, result });

      return {
        content: result
      };
    } catch (error) {
      this.emit('toolError', { name, params, error });

      return {
        content: {
          error: error instanceof Error ? error.message : String(error)
        },
        isError: true
      };
    }
  }

  /**
   * 创建工具处理器
   */
  private createToolHandler(tool: McpTool): (params: any) => Promise<any> {
    return async (params: any) => {
      // 根据工具名称分发
      switch (tool.name) {
        case 'search_patents':
          return this.handleSearchPatents(params);
        case 'generate_claims':
          return this.handleGenerateClaims(params);
        case 'assess_quality':
          return this.handleAssessQuality(params);
        case 'parse_office_action':
          return this.handleParseOfficeAction(params);
        default:
          throw new Error(`Unknown tool: ${tool.name}`);
      }
    };
  }

  /**
   * 处理专利搜索
   */
  private async handleSearchPatents(params: any): Promise<any> {
    console.log(`🔍 [MCP] 搜索专利:`, params);

    // TODO: 实际的搜索逻辑
    return {
      total: 100,
      patents: [
        {
          patentNumber: 'CN123456789A',
          title: '一种基于深度学习的图像识别方法',
          abstract: '本发明提供了一种基于深度学习的图像识别方法...'
        }
      ]
    };
  }

  /**
   * 处理权利要求生成
   */
  private async handleGenerateClaims(params: any): Promise<any> {
    console.log(`✍️ [MCP] 生成权利要求:`, params);

    // TODO: 实际的生成逻辑
    return {
      claims: [
        {
          claimType: 'independent',
          number: 1,
          content: '一种[发明类型]，其特征在于，包括：[特征1]、[特征2]...'
        }
      ]
    };
  }

  /**
   * 处理质量评估
   */
  private async handleAssessQuality(params: any): Promise<any> {
    console.log(`📊 [MCP] 评估质量:`, params);

    // TODO: 实际的评估逻辑
    return {
      overallScore: 85,
      clarityScore: 90,
      supportScore: 80,
      breadthScore: 85
    };
  }

  /**
   * 处理审查意见解析
   */
  private async handleParseOfficeAction(params: any): Promise<any> {
    console.log(`📋 [MCP] 解析审查意见:`, params);

    // TODO: 实际的解析逻辑
    return {
      applicationNumber: 'CN202310123456.7',
      actionType: 'FirstAction',
      rejections: []
    };
  }

  /**
   * 注册新工具
   */
  registerTool(tool: McpTool, handler: (params: any) => Promise<any>): void {
    this.config.tools.push(tool);
    this.tools.set(tool.name, handler);
    console.log(`✅ 新工具已注册: ${tool.name}`);
  }
}

/**
 * 创建专利 MCP 服务器
 */
export function createPatentMcpServer(): McpServer {
  const config: McpServerConfig = {
    name: 'yunpat-patent-tools',
    version: '1.0.0',
    tools: [
      {
        name: 'search_patents',
        description: '搜索专利',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: {
              type: 'array',
              items: { type: 'string' }
            },
            applicant: {
              type: 'string'
            },
            limit: {
              type: 'number',
              default: 10
            }
          },
          required: ['keywords']
        }
      },
      {
        name: 'generate_claims',
        description: '生成权利要求',
        inputSchema: {
          type: 'object',
          properties: {
            technicalFeatures: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  featureType: { type: 'string' }
                }
              }
            },
            inventionType: {
              type: 'string'
            }
          },
          required: ['technicalFeatures', 'inventionType']
        }
      },
      {
        name: 'assess_quality',
        description: '评估权利要求质量',
        inputSchema: {
          type: 'object',
          properties: {
            claims: {
              type: 'array',
              items: { type: 'object' }
            }
          },
          required: ['claims']
        }
      },
      {
        name: 'parse_office_action',
        description: '解析审查意见',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string'
            }
          },
          required: ['text']
        }
      }
    ]
  };

  const server = new McpServer(config);

  // 事件监听
  server.on('started', () => {
    console.log('✅ MCP 服务器已启动');
  });

  server.on('stopped', () => {
    console.log('✅ MCP 服务器已停止');
  });

  server.on('toolCalled', ({ name, params, result }) => {
    console.log(`🔧 [MCP] 工具调用: ${name}`);
    console.log(`   参数:`, JSON.stringify(params, null, 2));
  });

  server.on('toolError', ({ name, params, error }) => {
    console.error(`❌ [MCP] 工具错误: ${name}`);
    console.error(`   参数:`, JSON.stringify(params, null, 2));
    console.error(`   错误:`, error);
  });

  return server;
}

/**
 * MCP 工具调用示例
 */
export async function exampleMcpUsage() {
  const server = createPatentMcpServer();

  await server.start();

  // 调用工具
  const searchResult = await server.callTool('search_patents', {
    keywords: ['深度学习', '图像识别'],
    limit: 5
  });

  console.log('搜索结果:', searchResult);

  await server.stop();
}
