/**
 * PostgreSQL + pgvector 使用示例
 *
 * 演示完整的记忆管理流程
 */

import { MemoryLayer, createMemoryLayer } from './MemoryLayer.js';

/**
 * 示例 1: 基础向量搜索
 */
async function example1() {
  console.log('=== 示例 1: 基础向量搜索 ===');

  const memory = await createMemoryLayer({
    databaseUrl: 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
    vectorDimension: 128,
  });

  // 1. 添加记忆
  console.log('📝 添加记忆...');
  await memory.addMemory({
    type: 'patent',
    content: '专利撰写的关键在于权利要求书的撰写',
    embedding: Array(128).fill(0.1).map((v, i) => v + i * 0.01),
    metadata: { agent: 'writer', tags: ['专利', '撰写'] },
  });

  await memory.addMemory({
    type: 'patent',
    content: '专利检索是专利申请前的重要步骤',
    embedding: Array(128).fill(0.2).map((v, i) => v + i * 0.02),
    metadata: { agent: 'researcher', tags: ['专利', '检索'] },
  });

  // 2. 搜索记忆
  console.log('🔍 搜索记忆...');
  const results = await memory.searchMemories(
    Array(128).fill(0.11), // 查询向量
    5, // Top-K
    { types: ['patent'] } // 过滤条件
  );

  console.log('搜索结果:');
  for (const r of results) {
    console.log(`  - ${r.content} (相似度: ${r.similarity.toFixed(4)})`);
  }

  await memory.close();
}

/**
 * 示例 2: 图查询
 */
async function example2() {
  console.log('\n=== 示例 2: 图查询 ===');

  const memory = await createMemoryLayer({
    databaseUrl: 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
    vectorDimension: 128,
  });

  // 1. 创建实体
  console.log('📝 创建实体...');
  const patentId = await memory.createEntity({
    type: 'Patent',
    name: 'CN123456',
    properties: { field: 'NLP' },
  });

  const companyId = await memory.createEntity({
    type: 'Company',
    name: '宝宸科技',
    properties: { location: '深圳' },
  });

  // 2. 创建关系
  console.log('🔗 创建关系...');
  await memory.createRelation({
    fromEntityId: patentId,
    toEntityId: companyId,
    relationType: 'OWNS',
    weight: 0.95,
  });

  // 3. 查找邻居
  console.log('🔍 查找邻居...');
  const neighbors = await memory.getNeighbors(patentId, 'OWNS');
  console.log('专利 CN123456 的归属公司:', neighbors.map((n) => n.name));

  // 4. 查找路径
  const personId = await memory.createEntity({
    type: 'Person',
    name: '张三',
  });

  await memory.createRelation({
    fromEntityId: personId,
    toEntityId: patentId,
    relationType: 'INVENTED',
    weight: 1.0,
  });

  console.log('🔍 查找路径...');
  const path = await memory.findShortestPath(personId, companyId, 5);
  console.log('从张三到宝宸科技的路径:', path?.nodes.map((n) => n.name));

  await memory.close();
}

/**
 * 示例 3: 统计信息
 */
async function example3() {
  console.log('\n=== 示例 3: 统计信息 ===');

  const memory = await createMemoryLayer({
    databaseUrl: 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
    vectorDimension: 128,
  });

  const stats = await memory.getStats();

  console.log('📊 记忆层统计:');
  console.log('  向量存储:');
  console.log(`    - 总记忆数: ${stats.vector.totalMemories}`);
  console.log(`    - 已归档: ${stats.vector.archivedMemories}`);
  console.log(`    - 类型分布:`, stats.vector.typeDistribution);

  console.log('  图存储:');
  console.log(`    - 总实体数: ${stats.graph.totalEntities}`);
  console.log(`    - 总关系数: ${stats.graph.totalRelations}`);
  console.log(`    - 实体类型:`, stats.graph.entityTypes);
  console.log(`    - 关系类型:`, stats.graph.relationTypes);

  await memory.close();
}

/**
 * 主函数
 */
async function main() {
  try {
    await example1();
    await example2();
    await example3();

    console.log('\n✅ 所有示例执行完成！');
  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
