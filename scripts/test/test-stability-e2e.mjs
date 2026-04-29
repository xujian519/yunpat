/**
 * 端到端稳定性测试
 *
 * 验证：
 * 1. ResilientLLMAdapter - 重试和降级
 * 2. ConfigManager - 配置加载
 * 3. TelemetryCollector - 可观测性
 * 4. Writer Agent - 大纲解析修复
 */

import {
  createResilientDeepSeekAdapter,
  ConfigManager,
  TelemetryCollector,
  EventBus,
  ShortTermMemory,
  ToolRegistry,
} from './packages/core/dist/index.js';
import { WriterAgent } from './packages/agents/writer/dist/index.js';

// ========== 测试配置 ==========
const DEEPSEEK_API_KEY = 'sk-1b9f6c6ba33f4130a3fb76ea29c2ef95';
const OMLX_BASE_URL = 'http://localhost:8009/v1';
const OMLX_API_KEY = 'xj781102@';

// ========== 测试 1: ResilientLLMAdapter ==========
async function testResilientLLM() {
  console.log('\n🧪 测试 1: ResilientLLMAdapter - 重试和降级机制');

  const llm = createResilientDeepSeekAdapter(DEEPSEEK_API_KEY, OMLX_BASE_URL);

  try {
    const response = await llm.chat({
      messages: [
        { role: 'user', content: '1+1等于几？用一句话回答' },
      ],
      temperature: 0.3,
      maxTokens: 50,
    });

    console.log('✅ LLM 调用成功');
    console.log(`   响应: ${response.message.content.substring(0, 100)}...`);
    return true;
  } catch (error) {
    console.error('❌ LLM 调用失败:', error.message);
    return false;
  }
}

// ========== 测试 2: ConfigManager ==========
async function testConfigManager() {
  console.log('\n🧪 测试 2: ConfigManager - 配置加载');

  try {
    const configManager = new ConfigManager({
      environment: 'development',
      enableEnvVar: true,
    });

    const config = configManager.load();

    console.log('✅ 配置加载成功');
    console.log(`   环境: ${config.environment}`);
    console.log(`   LLM 提供商: ${config.llm.primary.provider}`);

    return true;
  } catch (error) {
    console.error('❌ 配置加载失败:', error.message);
    return false;
  }
}

// ========== 测试 3: TelemetryCollector ==========
async function testTelemetryCollector() {
  console.log('\n🧪 测试 3: TelemetryCollector - 可观测性');

  try {
    const telemetry = new TelemetryCollector({
      maxEvents: 1000,
      alertConfig: {
        slowExecutionThreshold: 5000,
        highFailureRateThreshold: 0.5,
        enableAlerts: true,
      },
    });

    // 记录一些测试事件
    telemetry.record({
      id: 'test-1',
      timestamp: new Date(),
      agent: 'writer',
      stage: 'plan',
      duration: 1200,
      status: 'success',
      metrics: {
        llmCalls: 2,
        tokensUsed: 150,
      },
    });

    telemetry.record({
      id: 'test-2',
      timestamp: new Date(),
      agent: 'writer',
      stage: 'act',
      duration: 6000,
      status: 'success',
      metrics: {
        llmCalls: 5,
        tokensUsed: 500,
      },
    });

    const report = telemetry.getReport();

    console.log('✅ 遥测收集成功');
    console.log(`   总事件数: ${report.summary.totalEvents}`);
    console.log(`   成功率: ${(report.summary.successRate * 100).toFixed(1)}%`);
    console.log(`   平均延迟: ${report.summary.avgDuration.toFixed(0)}ms`);
    console.log(`   告警数: ${report.alerts.length}`);

    // 检查慢执行告警
    if (report.alerts.length > 0) {
      console.log(`   ⚠️  告警: ${report.alerts[0].type}`);
    }

    return true;
  } catch (error) {
    console.error('❌ 遥测收集失败:', error.message);
    return false;
  }
}

// ========== 测试 4: Writer Agent（修复后） ==========
async function testWriterAgent() {
  console.log('\n🧪 测试 4: Writer Agent - 大纲解析修复');

  const eventBus = new EventBus();
  const memory = new ShortTermMemory();
  const tools = new ToolRegistry(eventBus);
  const llm = createResilientDeepSeekAdapter(DEEPSEEK_API_KEY, OMLX_BASE_URL);

  const telemetry = new TelemetryCollector();
  eventBus.subscribe('agent:*', (event) => {
    if (event.type === 'agent:completed' || event.type === 'agent:error') {
      telemetry.record({
        id: `agent-${Date.now()}`,
        timestamp: new Date(),
        agent: event.data.agentName,
        stage: 'execute',
        duration: event.data.duration || 0,
        status: event.type === 'agent:completed' ? 'success' : 'failure',
        metrics: {
          llmCalls: event.data.llmCalls || 0,
          tokensUsed: event.data.tokensUsed || 0,
        },
      });
    }
  });

  try {
    const agent = new WriterAgent({ eventBus, memory, tools, llm });

    console.log('   执行任务: 用 50 字介绍 JavaScript...');
    const startTime = Date.now();

    const result = await agent.execute({
      type: 'generate',
      topic: '用 50 字左右介绍 JavaScript',
      format: 'markdown',
    });

    const duration = Date.now() - startTime;

    console.log('✅ Writer Agent 执行成功');
    console.log(`   耗时: ${duration}ms`);
    console.log(`   章节数: ${result.stats.sectionCount}`);
    console.log(`   字数: ${result.stats.wordCount}`);
    console.log(`   内容预览: ${result.document.content.substring(0, 150)}...`);

    return true;
  } catch (error) {
    console.error('❌ Writer Agent 执行失败:', error.message);
    return false;
  }
}

// ========== 主测试流程 ==========
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  YunPat 框架稳定性验证 - 端到端测试               ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const results = {
    resilientLLM: false,
    configManager: false,
    telemetry: false,
    writerAgent: false,
  };

  // 并行运行独立测试
  await Promise.all([
    (async () => { results.resilientLLM = await testResilientLLM(); })(),
    (async () => { results.configManager = await testConfigManager(); })(),
    (async () => { results.telemetry = await testTelemetryCollector(); })(),
  ]);

  // Writer Agent 依赖前面的测试，串行运行
  results.writerAgent = await testWriterAgent();

  // 输出总结
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  测试结果总结                                       ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const summary = [
    { name: 'ResilientLLMAdapter', status: results.resilientLLM },
    { name: 'ConfigManager', status: results.configManager },
    { name: 'TelemetryCollector', status: results.telemetry },
    { name: 'Writer Agent', status: results.writerAgent },
  ];

  let passedCount = 0;
  summary.forEach((test) => {
    const icon = test.status ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
    if (test.status) passedCount++;
  });

  console.log(`\n通过率: ${passedCount}/${summary.length} (${(passedCount / summary.length * 100).toFixed(0)}%)`);

  if (passedCount === summary.length) {
    console.log('\n🎉 所有稳定性改进验证通过！框架已可以稳定运行。');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分测试失败，请检查上述错误信息。');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('测试执行出错:', error);
  process.exit(1);
});
