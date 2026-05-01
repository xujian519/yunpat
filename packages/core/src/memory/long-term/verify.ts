#!/usr/bin/env tsx

/**
 * PostgreSQL + pgvector 验证脚本
 *
 * 快速验证数据库连接和基本功能
 */

import { PostgresVectorStore } from './PostgresVectorStore.js';
import { PostgresGraphStore } from './PostgresGraphStore.js';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://yunpat:yunpat123@localhost:5432/yunpat';

async function verify() {
  console.log('🔍 验证 PostgreSQL + pgvector 环境...\n');

  try {
    // 1. 测试向量存储
    console.log('1️⃣ 测试向量存储...');
    const vectorStore = new PostgresVectorStore({
      databaseUrl: DATABASE_URL,
      vectorDimension: 1024, // BGE-M3 维度
    });

    await vectorStore.initialize();

    // 插入测试数据（使用 1024 维向量，匹配 BGE-M3）
    const id = await vectorStore.upsert({
      type: 'test',
      content: '验证测试',
      embedding: Array(1024).fill(0.1),
      metadata: { verified: true },
    });

    console.log('   ✅ 插入成功，ID:', id);

    // 搜索测试
    const results = await vectorStore.search(Array(1024).fill(0.1), 5);
    console.log('   ✅ 搜索成功，找到', results.length, '条结果');

    // 统计信息
    const stats = await vectorStore.getStats();
    console.log('   ✅ 统计信息:', stats);

    await vectorStore.close();

    // 2. 测试图存储
    console.log('\n2️⃣ 测试图存储...');
    const graphStore = new PostgresGraphStore({
      databaseUrl: DATABASE_URL,
    });

    // 创建实体（使用随机名称避免重复）
    const timestamp = Date.now();
    const entityId = await graphStore.createEntity({
      type: 'TestEntity',
      name: `验证实体_${timestamp}`,
    });

    console.log('   ✅ 创建实体成功，ID:', entityId);

    // 创建关系（使用随机名称避免重复）
    const companyId = await graphStore.createEntity({
      type: 'Company',
      name: `宝宸科技_${timestamp}`,
    });

    await graphStore.createRelation({
      fromEntityId: entityId,
      toEntityId: companyId,
      relationType: 'TEST_RELATION',
      weight: 0.9,
    });

    console.log('   ✅ 创建关系成功');

    // 查找邻居
    const neighbors = await graphStore.getNeighbors(entityId);
    console.log('   ✅ 查找邻居成功，找到', neighbors.length, '个邻居');

    // 统计信息
    const graphStats = await graphStore.getStats();
    console.log('   ✅ 图统计:', graphStats);

    await graphStore.close();

    console.log('\n✅ 所有验证通过！PostgreSQL + pgvector 环境就绪。');
    console.log('\n📝 下一步:');
    console.log('   1. 运行示例: tsx example.ts');
    console.log('   2. 运行测试: pnpm test packages/core/src/memory/tests');
    console.log('   3. 查看文档: cat README.md');
  } catch (error) {
    console.error('\n❌ 验证失败:', error);
    console.error('\n💡 故障排查:');
    console.error('   1. 检查数据库是否启动: docker-compose ps');
    console.error('   2. 检查数据库日志: docker-compose logs postgres');
    console.error('   3. 检查环境变量: echo $DATABASE_URL');
    console.error('   4. 初始化数据库: psql -U yunpat -h localhost -d yunpat -f init.sql');
    process.exit(1);
  }
}

verify();
