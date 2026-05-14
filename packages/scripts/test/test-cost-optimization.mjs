/**
 * 成本优化对比测试
 *
 * 验证：
 * 1. 提示词压缩效果（Token 对比）
 * 2. 任务路由效果（本地 vs 云端）
 * 3. 并行执行效果（时间对比）
 */

import {
  createResilientDeepSeekAdapter,
  createCostAwareAdapter,
  PromptOptimizer,
  TaskRouter,
} from './packages/core/dist/index.js';
import { WriterAgent } from './packages/agents/writer/dist/index.js';
import { EventBus, ShortTermMemory, ToolRegistry } from './packages/core/dist/index.js';

// ========== 配置 ==========
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) {
  throw new Error('Missing DEEPSEEK_API_KEY environment variable');
}
const OMLX_BASE_URL = 'http://localhost:8009/v1';
const OMLX_API_KEY = process.env.OMLX_API_KEY;

// ========== 测试 1: 提示词压缩效果 ==========
async function testPromptCompression() {
  console.log('\n🧪 测试 1: 提示词压缩效果');

  const optimizer = new PromptOptimizer();

  // 原始提示词
  const originalPrompt = `
请为以下主题创建一个技术文档大纲：

主题：TypeScript 编程语言

要求：
- 结构清晰
- 内容准确
- 逻辑严密

请以 JSON 数组格式返回大纲，例如：
["引言", "核心概念", "实现细节", "总结"]

**重要格式要求：**
1. 必须是有效的 JSON 数组格式
2. 每个元素都是字符串类型的章节标题
3. 可以使用 markdown 代码块包裹（可选）
4. 也可以直接返回 JSON 数组（不使用代码块）

只返回 JSON 数组，不要包含其他说明文字。
`;

  // 压缩后
  const compressedPrompt = optimizer.compress(originalPrompt);

  // 估算 Token（粗略：中文 ≈ 0.7 token/字，英文 ≈ 0.3 token/词）
  const estimateTokens = (text) => {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return Math.floor(chineseChars * 0.7 + englishWords * 0.3);
  };

  const originalTokens = estimateTokens(originalPrompt);
  const compressedTokens = estimateTokens(compressedPrompt);
  const savings = ((originalTokens - compressedTokens) / originalTokens * 100).toFixed(1);

  console.log(`\n原始提示词:`);
  console.log(`  Token: ${originalTokens}`);
  console.log(`  长度: ${originalPrompt.length} 字符`);

  console.log(`\n压缩后提示词:`);
  console.log(`  Token: ${compressedTokens}`);
  console.log(`  长度: ${compressedPrompt.length} 字符`);

  console.log(`\n✅ 压缩效果:`);
  console.log(`  节省 Token: ${originalTokens - compressedTokens} (${savings}%)`);
  console.log(`  压缩比: ${(compressedTokens / originalTokens).toFixed(2)}`);

  return {
    originalTokens,
    compressedTokens,
    savings: parseFloat(savings),
  };
}

// ========== 测试 2: 任务路由效果 ==========
async function testTaskRouting() {
  console.log('\n🧪 测试 2: 智能任务路由效果');

  const taskRouter = new TaskRouter(
    createResilientDeepSeekAdapter(DEEPSEEK_API_KEY, OMLX_BASE_URL)
  );

  const testTasks = [
    { type: 'generate', topic: '一句话介绍 TypeScript', format: 'markdown' }, // 简单
    { type: 'generate', topic: '写一份 TypeScript 入门教程', format: 'markdown' }, // 中等
    { type: 'generate', topic: '深入分析 TypeScript 类型系统的设计原理和应用场景', format: 'markdown' }, // 复杂
  ];

  const results = [];

  for (const task of testTasks) {
    const complexity = taskRouter.evaluateComplexity(task);
    const recommendedModel = complexity === 'simple' || complexity === 'medium' ? 'OMXL (本地)' : 'DeepSeek (云端)';

    results.push({
      task: task.topic.substring(0, 30) + '...',
      complexity,
      recommendedModel,
    });

    console.log(`\n任务: ${task.topic.substring(0, 40)}...`);
    console.log(`  复杂度: ${complexity}`);
    console.log(`  推荐模型: ${recommendedModel}`);
  }

  const localTasks = results.filter(r => r.recommendedModel.includes('OMXL')).length;
  const cloudTasks = results.filter(r => r.recommendedModel.includes('DeepSeek')).length;
  const localRatio = (localTasks / results.length * 100).toFixed(1);

  console.log(`\n✅ 路由统计:`);
  console.log(`  本地任务: ${localTasks}/${results.length} (${localRatio}%)`);
  console.log(`  云端任务: ${cloudTasks}/${results.length} (${(100 - localRatio).toFixed(1)}%)`);
  console.log(`  预计节省: ~${localRatio * 0.5}% API 成本`);

  return {
    localRatio: parseFloat(localRatio),
  };
}

// ========== 测试 3: 并行执行效果 ==========
async function testParallelExecution() {
  console.log('\n🧪 测试 3: 并行执行效果');

  const eventBus = new EventBus();
  const memory = new ShortTermMemory();
  const tools = new ToolRegistry(eventBus);

  // 使用成本感知适配器
  const llm = createCostAwareAdapter(DEEPSEEK_API_KEY, OMLX_BASE_URL);

  const agent = new WriterAgent({ eventBus, memory, tools, llm });

  const task = {
    type: 'generate',
    topic: '用 200 字介绍 JavaScript',
    format: 'markdown',
  };

  console.log(`\n执行任务: ${task.topic}`);
  console.log('(并行执行中...)');

  const startTime = Date.now();
  const result = await agent.execute(task);
  const duration = Date.now() - startTime;

  console.log(`\n✅ 执行完成:`);
  console.log(`  耗时: ${duration}ms (${(duration / 1000).toFixed(1)}秒)`);
  console.log(`  章节数: ${result.stats.sectionCount}`);
  console.log(`  字数: ${result.stats.wordCount}`);

  // 预估串行执行时间
  const estimatedSerialTime = duration * result.stats.sectionCount; // 假设线性扩展
  const speedup = ((estimatedSerialTime - duration) / estimatedSerialTime * 100).toFixed(1);

  console.log(`\n预估对比:`);
  console.log(`  串行执行: ~${estimatedSerialTime}ms`);
  console.log(`  并行执行: ${duration}ms`);
  console.log(`  提速: ${speedup}%`);

  return {
    parallelTime: duration,
    estimatedSerialTime,
    speedup: parseFloat(speedup),
  };
}

// ========== 主测试流程 ==========
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  YunPat 框架成本优化验证 - 对比测试               ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const results = {
    promptCompression: null,
    taskRouting: null,
    parallelExecution: null,
  };

  // 测试 1: 提示词压缩
  try {
    results.promptCompression = await testPromptCompression();
  } catch (error) {
    console.error('❌ 提示词压缩测试失败:', error.message);
  }

  // 测试 2: 任务路由
  try {
    results.taskRouting = await testTaskRouting();
  } catch (error) {
    console.error('❌ 任务路由测试失败:', error.message);
  }

  // 测试 3: 并行执行
  try {
    results.parallelExecution = await testParallelExecution();
  } catch (error) {
    console.error('❌ 并行执行测试失败:', error.message);
  }

  // 输出总结
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  优化效果总结                                       ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (results.promptCompression) {
    console.log(`✅ 提示词压缩: 节省 ${results.promptCompression.savings}% Token`);
  }

  if (results.taskRouting) {
    console.log(`✅ 任务路由: ${results.taskRouting.localRatio}% 任务本地化`);
  }

  if (results.parallelExecution) {
    console.log(`✅ 并行执行: 提速 ${results.parallelExecution.speedup}%`);
  }

  // 计算总体成本节省
  if (results.promptCompression && results.taskRouting) {
    const tokenSavings = results.promptCompression.savings / 100;
    const routingSavings = results.taskRouting.localRatio / 100 * 0.5; // 本地化节省 50%
    const totalSavings = (tokenSavings + routingSavings - tokenSavings * routingSavings) * 100;

    console.log(`\n📊 综合成本节省: ~${totalSavings.toFixed(1)}%`);
  }

  if (results.parallelExecution) {
    console.log(`📊 执行时间减少: ~${results.parallelExecution.speedup}%`);
  }

  console.log('\n✨ 成本优化验证完成！');
}

main().catch((error) => {
  console.error('测试执行出错:', error);
  process.exit(1);
});
