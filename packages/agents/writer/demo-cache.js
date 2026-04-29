/**
 * 语义缓存实际使用演示
 *
 * 展示语义缓存如何在实际使用中节省成本
 */

import { SemanticCache, createSimpleSignatureGenerator } from '../../core/dist/cache/SemanticCache.js';

// 模拟写作任务
const writingTasks = [
  {
    type: 'generate',
    topic: 'React Hooks 使用指南',
    format: 'markdown',
    requirements: ['详细', '包含示例'],
  },
  {
    type: 'generate',
    topic: 'React Hooks 使用指南', // 重复任务
    format: 'markdown',
    requirements: ['详细', '包含示例'],
  },
  {
    type: 'generate',
    topic: 'React Hooks 完整教程', // 相似任务
    format: 'markdown',
    requirements: ['详细', '包含示例'],
  },
  {
    type: 'optimize',
    topic: 'Vue 3 组合式 API',
    format: 'markdown',
    requirements: ['简洁'],
  },
  {
    type: 'generate',
    topic: 'Vue 3 组合式 API',
    format: 'markdown',
    requirements: ['简洁'],
  },
];

// 模拟写作结果
const createMockResult = (topic) => ({
  document: {
    title: topic,
    content: `# ${topic}\n\n## 引言\n\n这是一个关于 ${topic} 的详细文档...\n\n## 主要内容\n\n- 概念介绍\n- 使用示例\n- 最佳实践\n\n## 总结\n\n本文档全面介绍了 ${topic} 的核心概念和使用方法。`,
    format: 'markdown',
  },
  stats: {
    wordCount: 800,
    paragraphCount: 10,
    sectionCount: 5,
  },
  metadata: {
    generatedAt: new Date(),
    tone: 'technical',
    revision: 1,
  },
});

// 创建签名生成器
const createSignature = createSimpleSignatureGenerator((task) => {
  return [
    task.type,
    task.topic,
    task.format || 'markdown',
    ...(task.requirements || []),
  ];
});

// 创建语义缓存
const cache = new SemanticCache({
  similarityThreshold: 0.85,
  maxCacheSize: 1000,
  cacheExpiration: 7 * 24 * 60 * 60 * 1000,
  generateSignature: createSignature,
});

// 模拟 LLM 调用成本（单位：元）
const LLM_COST_PER_CALL = 0.1;

async function simulateWriting() {
  console.log('========== 语义缓存实际使用演示 ==========\n');
  console.log('模拟 5 个写作任务，展示缓存如何节省成本\n');

  let totalCost = 0;
  let savedCost = 0;
  let llmCalls = 0;
  let cacheHits = 0;

  for (let i = 0; i < writingTasks.length; i++) {
    const task = writingTasks[i];
    console.log(`\n--- 任务 ${i + 1}: ${task.topic} ---`);

    // 尝试从缓存获取
    const cached = await cache.findSimilar(task);

    if (cached) {
      console.log('✅ 缓存命中！');
      console.log(`   相似度: ${cached.signature.embedding[0] > 0 ? '高' : '中'}`);
      console.log(`   原始任务: ${cached.task.topic}`);
      console.log(`   成本: ¥0（节省 ¥${LLM_COST_PER_CALL}）`);
      savedCost += LLM_COST_PER_CALL;
      cacheHits++;
    } else {
      console.log('❌ 缓存未命中，调用 LLM 生成...');
      // 模拟 LLM 调用
      const result = createMockResult(task.topic);
      await cache.store(task, result);
      console.log(`   成本: ¥${LLM_COST_PER_CALL}`);
      totalCost += LLM_COST_PER_CALL;
      llmCalls++;
    }
  }

  // 输出总结
  console.log('\n========== 成本分析 ==========');
  console.log(`总任务数: ${writingTasks.length}`);
  console.log(`LLM 调用次数: ${llmCalls}`);
  console.log(`缓存命中次数: ${cacheHits}`);
  console.log(`实际成本: ¥${totalCost.toFixed(2)}`);
  console.log(`节省成本: ¥${savedCost.toFixed(2)}`);
  console.log(`无缓存成本: ¥${(writingTasks.length * LLM_COST_PER_CALL).toFixed(2)}`);
  console.log(`节省比例: ${((savedCost / (writingTasks.length * LLM_COST_PER_CALL)) * 100).toFixed(1)}%`);

  // 输出缓存统计
  console.log('\n========== 缓存统计 ==========');
  const stats = cache.getStats();
  console.log(`命中率: ${stats.hitRate}%`);
  console.log(`总请求数: ${stats.totalRequests}`);
  console.log(`缓存命中: ${stats.cacheHits}`);
  console.log(`缓存未命中: ${stats.cacheMisses}`);
  console.log(`当前缓存大小: ${stats.size}`);
  console.log(`平均相似度: ${stats.averageSimilarity}`);

  console.log('\n========== 预期效果 ==========');
  console.log('✅ 重复任务成本降低: 100%');
  console.log('✅ 相似任务成本降低: 50%+');
  console.log('✅ 响应速度提升: 10倍+');
  console.log('✅ 整体成本节省: 40%+');
}

simulateWriting().catch(console.error);
