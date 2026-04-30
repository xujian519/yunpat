/**
 * 语义缓存测试脚本
 *
 * 验证语义缓存的核心功能：
 * 1. 任务签名生成
 * 2. 相似任务查找
 * 3. 缓存存储和检索
 * 4. 缓存统计
 */

import {
  SemanticCache,
  createSimpleSignatureGenerator,
} from '../../core/dist/cache/SemanticCache.js';

// 定义测试用的任务类型
const testTask1 = {
  type: 'generate',
  topic: 'AI 智能体框架设计',
  format: 'markdown',
  requirements: ['技术文档', '详细'],
};

const testTask2 = {
  type: 'generate',
  topic: 'AI 智能体框架设计', // 完全相同的主题
  format: 'markdown',
  requirements: ['技术文档', '详细'],
};

const testTask3 = {
  type: 'optimize',
  topic: 'Web 开发最佳实践',
  format: 'markdown',
  requirements: ['简单', '清晰'],
};

// 定义测试用的结果类型
const testResult1 = {
  document: {
    title: 'AI 智能体框架设计',
    content: '# AI 智能体框架设计\n\n## 引言\n\n这是一个测试内容...',
    format: 'markdown',
  },
  stats: {
    wordCount: 500,
    paragraphCount: 5,
    sectionCount: 3,
  },
  metadata: {
    generatedAt: new Date(),
    tone: 'technical',
    revision: 1,
  },
};

// 创建签名生成器
const createSignature = createSimpleSignatureGenerator((task) => {
  return [task.type, task.topic, task.format || 'markdown', ...(task.requirements || [])];
});

// 创建语义缓存实例
const cache = new SemanticCache({
  similarityThreshold: 0.85,
  maxCacheSize: 100,
  cacheExpiration: 60000, // 1 分钟（测试用）
  generateSignature: createSignature,
});

async function runTests() {
  console.log('========== 语义缓存测试 ==========\n');

  // 测试 1: 存储第一个任务
  console.log('测试 1: 存储第一个任务');
  await cache.store(testTask1, testResult1);
  console.log('✅ 任务 1 已存储\n');

  // 测试 2: 查找相似任务（应该命中）
  console.log('测试 2: 查找相似任务');
  const similar = await cache.findSimilar(testTask2);
  if (similar) {
    console.log('✅ 找到相似任务');
    console.log(`   标题: ${similar.response.document.title}`);
    console.log(`   相似度: 高（主题相似）\n`);
  } else {
    console.log('❌ 未找到相似任务\n');
  }

  // 测试 3: 查找不相似任务（应该未命中）
  console.log('测试 3: 查找不相似任务');
  const notSimilar = await cache.findSimilar(testTask3);
  if (notSimilar) {
    console.log('❌ 错误：找到了不应该相似的任务\n');
  } else {
    console.log('✅ 正确：未找到相似任务\n');
  }

  // 测试 4: 精确匹配
  console.log('测试 4: 精确匹配');
  const exact = await cache.get(testTask1);
  if (exact) {
    console.log('✅ 精确匹配成功');
    console.log(`   标题: ${exact.document.title}\n`);
  } else {
    console.log('❌ 精确匹配失败\n');
  }

  // 测试 5: 缓存统计
  console.log('测试 5: 缓存统计');
  const stats = cache.getStats();
  console.log('✅ 缓存统计:');
  console.log(`   命中率: ${stats.hitRate}%`);
  console.log(`   总请求数: ${stats.totalRequests}`);
  console.log(`   缓存命中: ${stats.cacheHits}`);
  console.log(`   缓存未命中: ${stats.cacheMisses}`);
  console.log(`   当前大小: ${stats.size}`);
  console.log(`   平均相似度: ${stats.averageSimilarity}\n`);

  // 测试 6: 清空缓存
  console.log('测试 6: 清空缓存');
  cache.clear();
  const statsAfterClear = cache.getStats();
  if (statsAfterClear.size === 0 && statsAfterClear.totalRequests === 0) {
    console.log('✅ 缓存已清空\n');
  } else {
    console.log('❌ 缓存清空失败\n');
  }

  console.log('========== 测试完成 ==========');
}

runTests().catch(console.error);
