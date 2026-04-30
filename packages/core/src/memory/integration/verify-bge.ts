#!/usr/bin/env tsx

/**
 * BGE-M3 集成验证脚本
 *
 * 验证 BGE-M3 服务连接和基本功能
 */

import { createBGEM3Client } from './BGEIntegration.js';

async function verifyBGE() {
  console.log('🔍 验证 BGE-M3 服务...\n');

  try {
    // 1. 创建客户端
    console.log('1️⃣ 创建 BGE-M3 客户端...');
    const client = createBGEM3Client({
      apiKey: 'xj781102@',
    });

    // 2. 健康检查
    console.log('2️⃣ 健康检查...');
    const isHealthy = await client.healthCheck();

    if (!isHealthy) {
      console.error('   ❌ BGE-M3 服务不可用');
      console.error('   💡 请检查：');
      console.error('      - BGE-M3 服务是否启动（端口 8009）');
      console.error('      - API 密钥是否正确');
      process.exit(1);
    }

    console.log('   ✅ BGE-M3 服务正常');

    // 3. 测试单个文本向量化
    console.log('\n3️⃣ 测试单个文本向量化...');
    const text1 = '专利撰写的关键在于权利要求书的撰写';
    const embedding1 = await client.embed(text1);

    console.log(`   ✅ 向量维度: ${embedding1.length}`);
    console.log(`   ✅ 前 5 个值: [${embedding1.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);

    // 4. 测试批量向量化
    console.log('\n4️⃣ 测试批量向量化...');
    const texts = [
      '专利检索是专利申请前的重要步骤',
      '专利保护的核心是技术创新',
      '专利侵权需要进行对比分析',
    ];

    const embeddings = await client.embedBatch(texts);

    console.log(`   ✅ 批量处理: ${texts.length} 条文本`);
    console.log(`   ✅ 向量维度: ${embeddings[0].length}`);

    // 5. 测试缓存
    console.log('\n5️⃣ 测试缓存功能...');

    // 重复请求（应该命中缓存）
    await client.embed(texts[0]);
    await client.embed(texts[1]);

    const cacheStats = client.getCacheStats();

    console.log(`   ✅ 缓存大小: ${cacheStats.size}`);
    console.log(`   ✅ 缓存命中: ${cacheStats.hits}`);
    console.log(`   ✅ 缓存未命中: ${cacheStats.misses}`);
    console.log(`   ✅ 命中率: ${(cacheStats.hitRate * 100).toFixed(2)}%`);

    // 6. 计算相似度
    console.log('\n6️⃣ 测试相似度计算...');

    const similarity = cosineSimilarity(embeddings[0], embeddings[1]);

    console.log(`   ✅ 相似度: ${similarity.toFixed(4)}`);
    console.log(`   💡 相似度说明：`);
    console.log(`      - 1.0 = 完全相同`);
    console.log(`      - 0.8-0.9 = 非常相似`);
    console.log(`      - 0.6-0.8 = 比较相似`);
    console.log(`      - <0.6 = 不太相似`);

    console.log('\n✅ 所有验证通过！BGE-M3 集成正常工作。\n');

    console.log('📝 下一步：');
    console.log('   1. 运行 RAG 示例: tsx rag-example.ts');
    console.log('   2. 查看完整文档: cat README.md');

  } catch (error) {
    console.error('\n❌ 验证失败:', error);
    console.error('\n💡 故障排查：');
    console.error('   1. 检查 BGE-M3 服务状态：');
    console.error('      curl http://localhost:8009/v1/models');
    console.error('   2. 检查端口是否占用：');
    console.error('      lsof -i :8009');
    console.error('   3. 查看 BGE-M3 日志：');
    console.error('      docker logs <bge-m3-container>');
    process.exit(1);
  }
}

/**
 * 余弦相似度计算
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('向量长度不匹配');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

// 运行验证
verifyBGE();
