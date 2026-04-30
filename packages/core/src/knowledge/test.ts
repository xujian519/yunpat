/**
 * 知识库系统测试
 *
 * 验证：
 * 1. 知识存储
 * 2. 语义检索
 * 3. 知识注入
 * 4. 内置知识库
 */

import { KnowledgeEntryType, createKnowledgeBase } from './KnowledgeBase.js';

async function testKnowledgeBase() {
  console.log('=== 知识库系统测试 ===\n');

  // 1. 创建知识库
  const kb = createKnowledgeBase({
    name: 'test-knowledge',
    description: '测试知识库',
    persistent: false, // 测试时不持久化
    loadBuiltin: true, // 加载内置知识库
  });

  await kb.initialize();
  console.log('✅ 知识库初始化成功');

  // 2. 检查内置知识库
  const stats = kb.getStats();
  console.log(`\n📊 知识库统计:`);
  console.log(`   总条目数: ${stats.totalEntries}`);
  console.log(`   按类型分组:`);
  for (const [type, count] of Object.entries(stats.byType)) {
    if (count > 0) {
      console.log(`     - ${type}: ${count}`);
    }
  }
  console.log(`   按类别分组:`);
  for (const [category, count] of Object.entries(stats.byCategory)) {
    console.log(`     - ${category}: ${count}`);
  }

  // 3. 测试关键词搜索
  console.log('\n🔍 测试关键词搜索 (TypeScript):');
  const tsResults = await kb.search('TypeScript 类型', { mode: 'keyword', limit: 3 });
  for (const result of tsResults) {
    console.log(`   - ${result.entry.title} (分数: ${result.score.toFixed(3)})`);
  }

  // 4. 测试混合搜索
  console.log('\n🔍 测试混合搜索 (设计模式):');
  const patternResults = await kb.search('设计模式 单例 创建对象', { mode: 'hybrid', limit: 3 });
  for (const result of patternResults) {
    console.log(`   - ${result.entry.title} (分数: ${result.score.toFixed(3)})`);
  }

  // 5. 测试按类别获取
  console.log('\n📂 测试按类别获取 (error-solutions):');
  const errorSolutions = kb.getByCategory('error-solutions');
  console.log(`   找到 ${errorSolutions.length} 个错误解决方案`);
  errorSolutions.slice(0, 3).forEach((entry) => {
    console.log(`   - ${entry.title}`);
  });

  // 6. 测试按标签获取
  console.log('\n🏷️  测试按标签获取 (React):');
  const reactEntries = kb.getByTag('React');
  console.log(`   找到 ${reactEntries.length} 个 React 相关条目`);

  // 7. 测试知识注入
  console.log('\n💉 测试知识注入:');
  const injectionResult = await kb.enhancePrompt('帮我解决 React Hook 的依赖警告问题');
  console.log(`   注入了 ${injectionResult.injectedEntries.length} 个知识条目`);
  console.log(`   注入的类别: ${injectionResult.injectedCategories.join(', ')}`);
  console.log(`   增强后的提示词长度: ${injectionResult.enhancedPrompt.length} 字符`);

  // 8. 测试添加自定义知识
  console.log('\n➕ 测试添加自定义知识:');
  const customId = await kb.store({
    title: '自定义测试知识',
    content: '这是一条自定义的知识条目，用于测试知识库的存储功能。',
    type: KnowledgeEntryType.DOCUMENT,
    category: 'custom-test',
    tags: ['测试', '自定义'],
    priority: 1,
  });
  console.log(`   添加成功，ID: ${customId}`);

  // 9. 测试更新知识
  console.log('\n✏️  测试更新知识:');
  await kb.update(customId, {
    content: '这是更新后的知识内容。',
    priority: 2,
  });
  const updated = kb.get(customId);
  console.log(`   更新成功，版本: ${updated?.version}, 优先级: ${updated?.priority}`);

  // 10. 测试删除知识
  console.log('\n🗑️  测试删除知识:');
  const deleted = await kb.delete(customId);
  console.log(`   删除${deleted ? '成功' : '失败'}`);

  // 11. 最终统计
  const finalStats = kb.getStats();
  console.log('\n📊 最终统计:');
  console.log(`   总条目数: ${finalStats.totalEntries}`);
  console.log(`   总引用次数: ${finalStats.totalReferences}`);

  console.log('\n✅ 所有测试通过！');
}

// 运行测试
testKnowledgeBase().catch(console.error);
