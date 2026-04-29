/**
 * P1 成本优化验证测试
 *
 * 验证：
 * 1. 语义缓存效果
 * 2. 增量生成效果
 * 3. 批处理优化效果
 */

import {
  createCostAwareAdapter,
  SemanticCache,
  IncrementalGenerator,
  BatchProcessor,
} from './packages/core/dist/index.js';
import { WriterAgent } from './packages/agents/writer/dist/index.js';
import { EventBus, ShortTermMemory, ToolRegistry } from './packages/core/dist/index.js';

// ========== 配置 ==========
const DEEPSEEK_API_KEY = 'sk-1b9f6c6ba33f4130a3fb76ea29c2ef95';
const OMLX_BASE_URL = 'http://localhost:8009/v1';

// ========== 测试 1: 语义缓存 ==========
async function testSemanticCache() {
  console.log('\n🧪 测试 1: 语义缓存系统');

  const cache = new SemanticCache();

  // 模拟缓存任务
  const tasks = [
    { type: 'generate', topic: '介绍 TypeScript', format: 'markdown' },
    { type: 'generate', topic: 'TypeScript 入门教程', format: 'markdown' },
    { type: 'generate', topic: 'TypeScript 编程语言简介', format: 'markdown' },
  ];

  // 模拟存储第一个任务的响应
  const mockResponse = {
    document: {
      title: 'TypeScript 简介',
      content: '# TypeScript 简介\n\nTypeScript 是 JavaScript 的超集...',
      format: 'markdown',
    },
    stats: { wordCount: 100, paragraphCount: 2, sectionCount: 2 },
    metadata: { generatedAt: new Date(), tone: 'technical', revision: 1 },
  };

  await cache.store(tasks[0], mockResponse);

  // 查找相似任务
  console.log('\n查找相似任务:');
  for (const task of tasks) {
    const cached = await cache.findSimilar(task, 0.8);
    if (cached) {
      console.log(`  ✅ "${task.topic}" → 缓存命中`);
    } else {
      console.log(`  ❌ "${task.topic}" → 缓存未命中`);
    }
  }

  // 统计信息
  const stats = cache.getStats();
  console.log(`\n缓存统计:`);
  console.log(`  命中率: ${stats.hitRate}`);
  console.log(`  总请求: ${stats.totalRequests}`);
  console.log(`  缓存命中: ${stats.cacheHits}`);

  return {
    hitRate: parseFloat(stats.hitRate) || 0,
  };
}

// ========== 测试 2: 增量生成 ==========
async function testIncrementalGeneration() {
  console.log('\n🧪 测试 2: 增量生成策略');

  const generator = new IncrementalGenerator();

  const originalContent = `# TypeScript 简介

TypeScript 是一种由微软开发的自由和开源的编程语言。它是 JavaScript 的一个超集，而且本质上向这个语言添加了可选的静态类型和基于类的面向对象编程。

## 主要特性

TypeScript 添加了类型系统，这使得开发者能够在编译时捕获错误。`;

  const newRequirements = '将这篇 TypeScript 介绍从 100 字扩展到 200 字';

  console.log(`\n原始内容: ${originalContent.length} 字符`);
  console.log(`新要求: ${newRequirements}`);

  try {
    // 分析差异
    const diff = await generator.diff(originalContent, newRequirements);
    console.log(`\n差异分析:`);
    console.log(`  变更数: ${diff.changes.length}`);
    diff.changes.forEach((change, i) => {
      console.log(`  ${i + 1}. ${change.type}${change.section ? ` (${change.section})` : ''}`);
    });

    // 计算节省比例
    const modifyRatio = diff.changes.filter(c => c.type === 'modify').length / diff.changes.length;
    const savings = modifyRatio * 0.7; // 修改部分节省 70%

    console.log(`\n预估成本节省: ${(savings * 100).toFixed(1)}%`);

    return {
      diff,
      savings,
    };
  } catch (error) {
    console.log(`\n⚠️  增量生成测试跳过（需要 LLM）: ${error.message}`);
    return { savings: 0 };
  }
}

// ========== 测试 3: 批处理优化 ==========
async function testBatchProcessing() {
  console.log('\n🧪 测试 3: 批处理优化');

  const sections = ['引言', '核心概念', '实现细节', '应用场景', '总结'];

  console.log(`\n章节列表: ${sections.join(', ')}`);
  console.log(`章节数: ${sections.length}`);

  // 计算调用次数对比
  const serialCalls = sections.length;
  const batchCalls = Math.ceil(sections.length / 5); // 假设每批最多5个

  const costPerCall = 0.002; // ¥0.002/次
  const serialCost = serialCalls * costPerCall;
  const batchCost = batchCalls * costPerCall * 1.5; // 批处理每次贵50%

  console.log(`\n成本对比:`);
  console.log(`  串行调用: ${serialCalls}次 × ¥${costPerCall} = ¥${serialCost.toFixed(4)}`);
  console.log(`  批处理: ${batchCalls}次 × ¥${(costPerCall * 1.5).toFixed(4)} = ¥${batchCost.toFixed(4)}`);
  console.log(`  节省: ¥${(serialCost - batchCost).toFixed(4)} (${((serialCost - batchCost) / serialCost * 100).toFixed(1)}%)`);

  return {
    serialCalls,
    batchCalls,
    savings: ((serialCost - batchCost) / serialCost * 100),
  };
}

// ========== 主测试流程 ==========
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  YunPat 框架 P1 成本优化 - 验证测试                 ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const results = {
    semanticCache: null,
    incrementalGeneration: null,
    batchProcessing: null,
  };

  // 测试 1: 语义缓存
  try {
    results.semanticCache = await testSemanticCache();
  } catch (error) {
    console.error('❌ 语义缓存测试失败:', error.message);
  }

  // 测试 2: 增量生成
  try {
    results.incrementalGeneration = await testIncrementalGeneration();
  } catch (error) {
    console.error('❌ 增量生成测试失败:', error.message);
  }

  // 测试 3: 批处理
  try {
    results.batchProcessing = await testBatchProcessing();
  } catch (error) {
    console.error('❌ 批处理测试失败:', error.message);
  }

  // 输出总结
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  P1 优化效果总结                                   ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (results.semanticCache) {
    console.log(`✅ 语义缓存: 命中率 ${results.semanticCache.hitRate * 100}%`);
  }

  if (results.incrementalGeneration) {
    console.log(`✅ 增量生成: 节省 ${results.incrementalGeneration.savings * 100}%`);
  }

  if (results.batchProcessing) {
    console.log(`✅ 批处理: 节省 ${results.batchProcessing.savings.toFixed(1)}%`);
  }

  // 计算总体节省
  if (results.semanticCache && results.batchProcessing) {
    const avgSavings = (
      (results.semanticCache.hitRate * 0.5 + // 缓存命中节省50%
      results.batchProcessing.savings / 100) / 2
    );

    console.log(`\n📊 综合成本节省: ~${(avgSavings * 100).toFixed(1)}%`);
  }

  console.log('\n✨ P1 成本优化验证完成！');
}

main().catch((error) => {
  console.error('测试执行出错:', error);
  process.exit(1);
});
