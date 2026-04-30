/**
 * MCP 集成使用示例
 *
 * 展示如何使用 MCP 服务器
 */

import { createPatentMcpServer, McpServer } from '../patents/mcp/McpServer';

/**
 * 示例 1: 基本使用
 */
async function example1_BasicUsage() {
  console.log('=== 示例 1: MCP 基本使用 ===\n');

  // 创建 MCP 服务器
  const server = createPatentMcpServer();

  // 启动服务器
  await server.start();

  // 列出工具
  const tools = server.listTools();
  console.log('可用工具:');
  tools.forEach((tool) => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });

  // 调用工具
  const searchResult = await server.callTool('search_patents', {
    keywords: ['深度学习', '图像识别'],
    limit: 5,
  });

  console.log('\n搜索结果:', searchResult.content);

  // 停止服务器
  await server.stop();
}

/**
 * 示例 2: 注册自定义工具
 */
async function example2_CustomTool() {
  console.log('=== 示例 2: 注册自定义工具 ===\n');

  const server = createPatentMcpServer();

  // 注册自定义工具
  server.registerTool(
    {
      name: 'analyze_invention',
      description: '分析发明创造性',
      inputSchema: {
        type: 'object',
        properties: {
          features: {
            type: 'array',
            items: { type: 'string' },
          },
          priorArt: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['features', 'priorArt'],
      },
    },
    async (params) => {
      console.log('🔍 [自定义工具] 分析发明创造性');
      return {
        hasNovelty: true,
        hasInventiveStep: true,
        confidence: 0.85,
      };
    }
  );

  await server.start();

  // 调用自定义工具
  const result = await server.callTool('analyze_invention', {
    features: ['卷积神经网络', '图像识别'],
    priorArt: ['CN110123456A'],
  });

  console.log('分析结果:', result.content);

  await server.stop();
}

/**
 * 示例 3: 事件监听
 */
async function example3_EventListening() {
  console.log('=== 示例 3: 事件监听 ===\n');

  const server = createPatentMcpServer();

  // 监听事件
  server.on('toolCalled', ({ name, params, result }) => {
    console.log(`📝 工具调用记录`);
    console.log(`  工具: ${name}`);
    console.log(`  参数:`, JSON.stringify(params, null, 2));
    console.log(`  结果:`, JSON.stringify(result.content, null, 2));
  });

  server.on('toolError', ({ name, error }) => {
    console.error(`❌ 工具错误记录`);
    console.error(`  工具: ${name}`);
    console.error(`  错误:`, error);
  });

  await server.start();

  // 模拟工具调用
  await server.callTool('search_patents', {
    keywords: ['测试'],
  });

  await server.stop();
}

/**
 * 示例 4: 集成到智能体
 */
async function example4_AgentIntegration() {
  console.log('=== 示例 4: 集成到智能体 ===\n');

  const server = createPatentMcpServer();

  await server.start();

  console.log('智能体可以通过 MCP 服务器调用工具:');
  console.log('1. 搜索专利数据库');
  console.log('2. 生成权利要求');
  console.log('3. 评估质量');
  console.log('4. 解析审查意见');

  // 模拟智能体调用
  const patentSearch = await server.callTool('search_patents', {
    keywords: ['深度学习', '图像识别'],
  });

  console.log('\n智能体获得专利数据:', patentSearch.content);

  await server.stop();
}

/**
 * 主函数
 */
async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   MCP 集成使用示例                         ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    await example1_BasicUsage();
    await example2_CustomTool();
    await example3_EventListening();
    await example4_AgentIntegration();

    console.log('\n✅ 所有示例执行完成！');
  } catch (error) {
    console.error('❌ 示例执行失败:', error);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

export {
  example1_BasicUsage,
  example2_CustomTool,
  example3_EventListening,
  example4_AgentIntegration,
};
