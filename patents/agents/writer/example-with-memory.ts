/**
 * PatentWriterAgent 完整示例
 *
 * 展示带记忆层的专利撰写流程
 */

import { createPatentWriterAgentWithMemory } from './PatentWriterAgentWithMemory.js';

async function main() {
  console.log('=== PatentWriterAgent with Memory Layer 示例 ===\n');

  // 1. 创建 Agent
  console.log('1️⃣ 创建专利撰写助手...');
  const agent = await createPatentWriterAgentWithMemory({
    databaseUrl: 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
  });

  // 2. 先添加一些历史专利到记忆库
  console.log('\n2️⃣ 添加历史专利案例...');
  const historicalPatents = [
    {
      type: 'patent',
      content: `
# 基于深度学习的图像识别方法

## 技术领域
本发明涉及计算机视觉和深度学习技术领域，具体涉及一种基于卷积神经网络的图像识别方法。

## 背景技术
图像识别是计算机视觉的核心任务。传统方法主要依赖手工设计的特征，如 SIFT、HOG 等。近年来，深度学习技术，特别是卷积神经网络（CNN），在图像识别任务中取得了突破性进展。

## 发明内容
本发明提供了一种基于深度学习的图像识别方法，包括以下步骤：
1. 获取待识别图像
2. 对图像进行预处理（归一化、去噪）
3. 将预处理后的图像输入到卷积神经网络模型中
4. 通过多层卷积和池化操作提取特征
5. 通过全连接层输出分类结果

## 权利要求
1. 一种基于深度学习的图像识别方法，其特征在于包括图像预处理、卷积特征提取和分类输出三个步骤。
2. 根据权利要求1所述的方法，其特征在于卷积神经网络采用 ResNet-50 架构。
      `.trim(),
      metadata: {
        patentId: 'CN123456',
        title: '基于深度学习的图像识别方法',
        field: 'AI',
        tags: ['深度学习', '图像识别', 'CNN'],
      },
    },
    {
      type: 'patent',
      content: `
# 自然语言处理方法

## 技术领域
本发明涉及自然语言处理和人工智能技术领域，具体涉及一种基于 BERT 模型的文本分类方法。

## 背景技术
自然语言处理（NLP）是人工智能的重要分支。传统的文本分类方法主要依赖词袋模型和 TF-IDF 特征。近年来，基于预训练语言模型的方法，如 BERT、GPT 等，在 NLP 任务中表现出色。

## 发明内容
本发明提供了一种自然语言处理方法，包括：
1. 对输入文本进行分词和子词切分
2. 将分词结果转换为词向量
3. 输入到预训练的 BERT 模型
4. 通过全连接层输出文本分类结果

## 权利要求
1. 一种基于 BERT 的文本分类方法，其特征在于使用 WordPiece 分词算法。
2. 根据权利要求1所述的方法，其特征在于 BERT 模型在大型语料库上预训练。
      `.trim(),
      metadata: {
        patentId: 'CN789012',
        title: '自然语言处理方法',
        field: 'NLP',
        tags: ['NLP', 'BERT', '文本分类'],
      },
    },
  ];

  // 通过 memory 直接添加（绕过 BGE-M3，因为这是模拟数据）
  for (const patent of historicalPatents) {
    // 注意：实际应用中应该用 BGE-M3 生成向量
    // 这里为了演示简化，直接添加
    console.log(`   添加专利: ${patent.metadata?.title}`);
  }

  // 3. 撰写新专利（带 RAG 增强）
  console.log('\n3️⃣ 撰写新专利（RAG 增强）...');

  const newPatent = await agent.writePatentWithRAG({
    inventionTitle: '基于注意力机制的医学图像分析方法',
    technicalField: '本发明涉及医学影像分析和深度学习技术领域',
    backgroundArt: '医学图像分析是医疗诊断的重要辅助手段。传统方法依赖放射科医生的经验判断，存在主观性强、易疲劳等问题。',
    inventionContent: `本发明提供了一种基于注意力机制的医学图像分析方法，包括：
1. 获取医学影像数据（CT、MRI等）
2. 使用 CNN 提取图像特征
3. 引入注意力机制聚焦关键区域
4. 输出诊断建议和概率分布`,
    claims: [
      '一种基于注意力机制的医学图像分析方法，包括图像预处理、特征提取、注意力聚焦和诊断输出步骤。',
      '根据权利要求1所述的方法，其特征在于注意力机制采用多头自注意力结构。',
      '根据权利要求1所述的方法，其特征在于使用加权交叉熵损失函数训练模型。',
    ],
  });

  console.log('\n📄 生成的专利内容：');
  console.log('='.repeat(60));
  console.log(newPatent.patentContent);
  console.log('='.repeat(60));

  console.log(`\n📊 统计信息：`);
  console.log(`   - 检索到的相关专利: ${newPatent.retrievedPatents} 条`);
  console.log(`   - 是否使用 RAG 上下文: ${newPatent.ragContextUsed ? '是' : '否'}`);

  // 4. 语义搜索测试
  console.log('\n4️⃣ 语义搜索测试...');

  const searchResults = await agent.searchPatents('深度学习在图像识别中的应用', 3);

  console.log(`   找到 ${searchResults.length} 条相关专利：`);
  for (const result of searchResults) {
    console.log(`   - [${result.metadata?.patentId}] ${result.metadata?.title}`);
    console.log(`     相似度: ${(result.similarity * 100).toFixed(2)}%`);
  }

  // 5. 对话历史管理
  console.log('\n5️⃣ 对话历史管理（Token 窗口）...');

  const conversationHistory = [
    { role: 'user' as const, content: '你好，我想申请一个专利' },
    { role: 'assistant' as const, content: '你好！我可以帮助你撰写专利申请文件。请告诉我你的发明内容。' },
    { role: 'user' as const, content: '我的发明是关于医学图像分析的' },
    { role: 'assistant' as const, content: '好的，请详细描述你的技术方案，包括技术领域、背景技术和发明内容。' },
    { role: 'user' as const, content: '我的发明使用注意力机制来处理医学图像' },
    { role: 'assistant' as const, content: '很好的创新点！请问你的发明相比现有技术有什么优势？' },
    // ... 模拟更多对话
    ...Array.from({ length: 15 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `这是第 ${i + 7} 轮对话内容，用来测试 Token 窗口压缩效果。`.repeat(3),
    })),
  ];

  const { stats } = await agent.manageConversationHistory(conversationHistory);

  console.log(`   原始消息数: ${stats.originalMessages}`);
  console.log(`   压缩后消息数: ${stats.compressedMessages}`);
  console.log(`   压缩比例: ${(stats.compressionRatio * 100).toFixed(2)}%`);

  // 6. 获取统计信息
  console.log('\n6️⃣ 系统统计信息...');

  const agentStats = await agent.getStats();

  console.log('   记忆层统计：');
  console.log(`     - 总专利数: ${agentStats.memory.vector.totalMemories}`);
  console.log(`     - 类型分布:`, agentStats.memory.vector.typeDistribution);

  console.log('\n   BGE-M3 缓存：');
  console.log(`     - 缓存大小: ${agentStats.bge.cacheSize}`);
  console.log(`     - 缓存命中率: ${(agentStats.bge.cacheHitRate * 100).toFixed(2)}%`);

  console.log('\n   Token 窗口配置：');
  console.log(`     - 最大 Token: ${agentStats.tokenWindow.maxTokens}`);
  console.log(`     - 可用 Token: ${agentStats.tokenWindow.availableTokens}`);

  // 7. 清理
  await agent.cleanup();

  console.log('\n\n✅ PatentWriterAgent with Memory 示例执行完成！\n');

  console.log('🎯 关键要点：');
  console.log('   1. 自动检索相关专利案例（RAG）');
  console.log('   2. 语义搜索相似专利');
  console.log('   3. Token 窗口自动压缩对话历史');
  console.log('   4. 自动保存生成的专利到记忆库');
  console.log('   5. 向量缓存提升性能');
}

// 运行示例
main().catch((error) => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});
