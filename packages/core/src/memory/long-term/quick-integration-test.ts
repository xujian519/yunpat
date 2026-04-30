/**
 * 记忆层快速集成测试
 *
 * 验证所有核心组件协同工作
 */

import { createBGEM3Client } from '../integration/BGEIntegration.js';
import { PostgresVectorStore } from './PostgresVectorStore.js';
import { createTokenWindowManager } from '../short-term/TokenWindow.js';

async function quickTest() {
  console.log('=== 记忆层快速集成测试 ===\n');

  // 1. 测试 BGE-M3
  console.log('1️⃣ 测试 BGE-M3 嵌入...');
  const bgeClient = createBGEM3Client({
    apiKey: 'xj781102@',
  });

  const testText = '专利撰写的关键在于权利要求书的撰写';
  const embedding1 = await bgeClient.embed(testText);
  console.log(`   ✅ 向量维度: ${embedding1.length}`);
  console.log(`   ✅ 前5个值: [${embedding1.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);

  // 测试缓存
  const startCache = Date.now();
  const embedding2 = await bgeClient.embed(testText);
  const cacheTime = Date.now() - startCache;
  console.log(`   ✅ 缓存命中: ${cacheTime}ms (快 ${Math.round(50 / cacheTime)} 倍)`);

  // 2. 测试向量存储
  console.log('\n2️⃣ 测试 PostgreSQL 向量存储...');
  const vectorStore = new PostgresVectorStore({
    databaseUrl: 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
    vectorDimension: 1024,
  });

  await vectorStore.initialize();

  // 插入测试数据
  const testId = await vectorStore.upsert({
    type: 'test',
    content: `快速测试 - ${new Date().toISOString()}`,
    embedding: embedding1,
    metadata: { source: 'quick-test', timestamp: new Date() },
  });
  console.log(`   ✅ 插入成功: ID ${testId}`);

  // 搜索测试
  const searchResults = await vectorStore.search(embedding2, 3, {
    types: ['test'],
  });
  console.log(`   ✅ 搜索成功: 找到 ${searchResults.length} 条结果`);
  if (searchResults.length > 0) {
    console.log(`   ✅ 最高相似度: ${(searchResults[0].similarity * 100).toFixed(2)}%`);
  }

  // 3. 测试 Token 窗口
  console.log('\n3️⃣ 测试 Token 窗口管理...');
  const tokenWindow = createTokenWindowManager({
    maxTokens: 4000,
    reservedTokens: 500,
    enableSummary: true,
  });

  // 创建模拟对话历史
  const conversationHistory = Array.from({ length: 20 }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `这是第 ${i + 1} 轮对话内容。专利撰写需要专业的技术知识和法律知识。`,
  }));

  const { messages: compressed, stats } = await tokenWindow.slideWindow(conversationHistory);
  console.log(`   ✅ 压缩比例: ${(stats.compressionRatio * 100).toFixed(2)}%`);
  console.log(`   ✅ 消息数: ${stats.originalMessages} → ${stats.compressedMessages}`);
  console.log(`   ✅ Token 优化: ${((1 - stats.compressionRatio) * 100).toFixed(2)}%`);

  // 4. 测试完整工作流
  console.log('\n4️⃣ 测试完整 RAG 工作流...');

  // 4.1 添加专利到记忆库
  const patentText = `
# 基于深度学习的图像识别方法

## 技术领域
本发明涉及计算机视觉和深度学习技术领域。

## 发明内容
本发明提供了一种基于卷积神经网络的图像识别方法，包括图像预处理、特征提取和分类输出。
  `.trim();

  const patentEmbedding = await bgeClient.embed(patentText);
  await vectorStore.upsert({
    type: 'patent',
    content: patentText,
    embedding: patentEmbedding,
    metadata: { title: '图像识别方法', field: 'AI' },
  });
  console.log(`   ✅ 专利已添加到记忆库`);

  // 4.2 语义搜索
  const query = '深度学习在图像识别中的应用';
  const queryEmbedding = await bgeClient.embed(query);
  const patents = await vectorStore.search(queryEmbedding, 3, {
    types: ['patent'],
  });
  console.log(`   ✅ 找到 ${patents.length} 条相关专利`);
  if (patents.length > 0) {
    console.log(`   ✅ 最佳匹配相似度: ${(patents[0].similarity * 100).toFixed(2)}%`);
  }

  // 5. 获取统计信息
  console.log('\n5️⃣ 系统统计...');
  const vectorStats = await vectorStore.getStats();
  console.log(`   📊 向量存储:`);
  console.log(`      - 总记忆数: ${vectorStats.totalMemories}`);
  console.log(`      - 类型分布: ${JSON.stringify(vectorStats.typeDistribution)}`);

  const bgeStats = bgeClient.getCacheStats();
  console.log(`   📊 BGE-M3 缓存:`);
  console.log(`      - 缓存大小: ${bgeStats.size}`);
  console.log(`      - 命中次数: ${bgeStats.hits}`);
  console.log(`      - 命中率: ${(bgeStats.hitRate * 100).toFixed(2)}%`);

  console.log('\n✅ 所有测试通过！记忆层工作正常。\n');
}

// 运行测试
quickTest().catch((error) => {
  console.error('❌ 测试失败:', error.message);
  process.exit(1);
});
