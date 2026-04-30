/**
 * RAG 完整示例
 *
 * 演示完整的检索增强生成流程
 */

import { createRAGEngine, type RAGEngine } from './RAGEngine.js';

async function main() {
  console.log('=== RAG 检索增强生成示例 ===\n');

  // 1. 初始化 RAG 引擎
  console.log('1️⃣ 初始化 RAG 引擎...');
  const rag = await createRAGEngine({
    databaseUrl: 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
    bgeConfig: {
      apiKey: 'xj781102@',
    },
    retrieval: {
      topK: 5,
      threshold: 0.7,
    },
  });

  // 2. 添加专利文档
  console.log('\n2️⃣ 添加专利文档...');
  const patents = [
    {
      type: 'patent',
      content: '本发明涉及一种基于深度学习的图像识别方法，包括以下步骤：获取待识别图像；对图像进行预处理；将预处理后的图像输入到卷积神经网络模型中；输出识别结果。',
      metadata: {
        patentId: 'CN123456',
        title: '基于深度学习的图像识别方法',
        field: 'AI',
        tags: ['深度学习', '图像识别', 'CNN'],
      },
    },
    {
      type: 'patent',
      content: '本发明涉及一种自然语言处理方法，包括：对输入文本进行分词；将分词结果转换为词向量；输入到 BERT 模型；输出文本分类结果。',
      metadata: {
        patentId: 'CN789012',
        title: '自然语言处理方法',
        field: 'NLP',
        tags: ['NLP', 'BERT', '文本分类'],
      },
    },
    {
      type: 'patent',
      content: '本发明涉及一种知识图谱构建方法，包括：从文本中抽取实体；识别实体间关系；构建图数据库；实现知识推理。',
      metadata: {
        patentId: 'CN345678',
        title: '知识图谱构建方法',
        field: '知识图谱',
        tags: ['知识图谱', '实体抽取', '图数据库'],
      },
    },
  ];

  const memoryIds = await rag.addDocuments(patents);

  console.log(`   ✅ 已添加 ${memoryIds.length} 条专利文档`);

  // 3. 语义检索
  console.log('\n3️⃣ 测试语义检索...');

  const queries = [
    '如何使用深度学习识别图像？',
    'BERT 模型在自然语言处理中的应用',
    '如何构建知识图谱？',
  ];

  for (const query of queries) {
    console.log(`\n   查询: ${query}`);

    const results = await rag.retrieve(query, {
      topK: 2,
      threshold: 0.6,
    });

    console.log(`   找到 ${results.length} 条相关专利：`);

    for (const doc of results) {
      console.log(`   - [${doc.metadata?.patentId}] ${doc.metadata?.title}`);
      console.log(`     相似度: ${(doc.similarity * 100).toFixed(2)}%`);
      console.log(`     内容: ${doc.content.slice(0, 50)}...`);
    }
  }

  // 4. RAG 增强查询
  console.log('\n\n4️⃣ 测试 RAG 增强查询...');

  const userQuery = '我需要了解图像识别和自然语言处理的技术';
  console.log(`   用户问题: ${userQuery}`);

  const { augmentedQuery, retrievedDocs } = await rag.augmentQuery(userQuery, {
    topK: 3,
    threshold: 0.65,
  });

  console.log(`\n   检索到 ${retrievedDocs.length} 条相关文档`);
  console.log(`\n   增强后的查询：`);
  console.log('   ' + '-'.repeat(50));
  console.log('   ' + augmentedQuery.split('\n').join('\n   '));
  console.log('   ' + '-'.repeat(50));

  // 5. 统计信息
  console.log('\n\n5️⃣ 统计信息...');
  const stats = await rag.getStats();

  console.log('   向量存储：');
  console.log(`     - 总记忆数: ${stats.vector.totalMemories}`);
  console.log(`     - 类型分布:`, stats.vector.typeDistribution);

  console.log('\n   BGE-M3 缓存：');
  console.log(`     - 缓存大小: ${stats.bge.cacheSize}`);
  console.log(`     - 命中率: ${(stats.bge.cacheHitRate * 100).toFixed(2)}%`);

  // 6. 清理
  await rag.cleanup();

  console.log('\n\n✅ RAG 示例执行完成！\n');
  console.log('📝 关键要点：');
  console.log('   1. BGE-M3 自动将文本转换为 1024 维向量');
  console.log('   2. PostgreSQL + pgvector 实现语义检索');
  console.log('   3. 相似度阈值过滤低质量结果');
  console.log('   4. RAG 自动构建增强查询上下文');
  console.log('   5. 向量缓存提升重复查询性能');
}

// 运行示例
main().catch((error) => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});
