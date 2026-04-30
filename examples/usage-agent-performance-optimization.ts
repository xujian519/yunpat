/**
 * 智能体性能优化使用示例
 *
 * 展示如何在智能体中使用缓存、监控等性能优化功能
 */

import { createDeepSeekModel } from '../packages/core/dist/index.js';
import { EventBus } from '../packages/core/dist/eventbus/index.js';
import { MemoryStore } from '../packages/core/dist/memory/MemoryStore.js';
import { ToolRegistry } from '../packages/core/dist/tools/ToolRegistry.js';
import { Agent } from '../packages/core/dist/agent/Agent.js';

/**
 * 示例智能体：专利撰写智能体（带性能优化）
 *
 * 展示如何集成缓存和监控功能
 */
class PatentWriterAgentOptimized extends Agent<string, string> {
  constructor(config: any) {
    super({
      name: 'PatentWriterAgent-Optimized',
      description: '专利撰写智能体（性能优化版）',
      eventBus: config.eventBus,
      memory: config.memory,
      tools: config.tools,
      llm: config.llm,
      maxIterations: 5,
      timeout: 60000,

      // ========== 性能优化配置 ==========
      enableReasoningCache: true, // 启用推理缓存
      cacheConfig: {
        maxEntries: 100,
        similarityThreshold: 0.85,
        ttl: 3600000, // 1 小时
      },
      enablePerformanceMonitoring: true, // 启用性能监控
      reasoningStrategy: 'auto', // 自动选择推理策略
    });
  }

  /**
   * 规划阶段
   */
  protected async plan(input: string, context: any): Promise<any> {
    console.log(`\n📋 [规划] 开始规划专利撰写任务...`);

    // 1. 尝试从缓存获取规划结果
    const cacheKey = `plan-${input}`;
    const cached = await this.queryCache(cacheKey);

    if (cached.found && cached.similarity && cached.similarity > 0.9) {
      console.log(`✅ [缓存命中] 使用缓存的规划，相似度: ${(cached.similarity * 100).toFixed(1)}%`);
      return cached.result;
    }

    // 2. 缓存未命中，执行规划
    console.log(`⚡ [执行] 生成专利撰写规划...`);

    const plan = {
      title: '专利名称',
      sections: ['技术领域', '背景技术', '发明内容', '具体实施方式'],
      estimatedTokens: 2000,
    };

    // 3. 存储到缓存
    await this.storeToCache(cacheKey, plan, 500);

    return plan;
  }

  /**
   * 执行阶段
   */
  protected async act(plan: any, context: any): Promise<string> {
    console.log(`\n✍️  [执行] 开始撰写专利文档...`);

    // 开始性能监控
    const monitorId = this.performanceMonitor?.startInference('patent-writing', {
      title: plan.title,
    });

    try {
      let content = '';

      for (const section of plan.sections) {
        // 每个章节都尝试使用缓存
        const sectionCacheKey = `section-${plan.title}-${section}`;
        const cached = await this.queryCache(sectionCacheKey);

        if (cached.found) {
          console.log(
            `✅ [缓存命中] ${section} (相似度: ${(cached.similarity * 100).toFixed(1)}%)`
          );
          content += `\n## ${section}\n${cached.result}\n`;
        } else {
          console.log(`⚡ [执行] 生成 ${section}...`);
          const sectionContent = `## ${section}\n这是${section}的详细内容...`;
          content += `${sectionContent}\n`;

          // 存储到缓存
          await this.storeToCache(sectionCacheKey, sectionContent, 300);
        }
      }

      // 结束性能监控
      if (monitorId && this.performanceMonitor) {
        this.performanceMonitor.endInference(monitorId, 2000, true);
      }

      return content;
    } catch (error) {
      if (monitorId && this.performanceMonitor) {
        this.performanceMonitor.endInference(monitorId, 0, false, (error as Error).message);
      }
      throw error;
    }
  }

  /**
   * 反思阶段
   */
  protected async reflect(result: string, context: any): Promise<any> {
    console.log(`\n🤔 [反思] 评估专利质量...`);

    // 简化反思：检查字数和章节
    const wordCount = result.length;
    const sections = (result.match(/## .+/g) || []).length;

    return {
      wordCount,
      sectionCount: sections,
      quality: wordCount > 1000 && sections >= 4 ? 'excellent' : 'good',
      suggestions: wordCount < 1000 ? ['建议扩充内容'] : [],
    };
  }
}

/**
 * 使用示例
 */
async function demonstratePerformanceOptimizedAgent() {
  console.log('🚀 智能体性能优化演示\n');

  // 1. 创建依赖
  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test');
  const eventBus = new EventBus();
  const memory = new MemoryStore();
  const tools = new ToolRegistry();

  // 2. 创建智能体
  const agent = new PatentWriterAgentOptimized({
    eventBus,
    memory,
    tools,
    llm,
  });

  // 3. 第一次执行（冷启动，无缓存）
  console.log('\n=== 第一次执行（冷启动） ===');
  const startTime1 = Date.now();
  const result1 = await agent.execute('撰写一种基于AI的图像识别方法');
  const duration1 = Date.now() - startTime1;
  console.log(`\n⏱️  耗时: ${duration1}ms`);

  // 4. 第二次执行（相同问题，应该命中缓存）
  console.log('\n=== 第二次执行（缓存命中） ===');
  const startTime2 = Date.now();
  const result2 = await agent.execute('撰写一种基于AI的图像识别方法');
  const duration2 = Date.now() - startTime2;
  console.log(`\n⏱️  耗时: ${duration2}ms`);

  // 5. 第三次执行（相似问题，可能命中缓存）
  console.log('\n=== 第三次执行（相似问题） ===');
  const startTime3 = Date.now();
  const result3 = await agent.execute('撰写基于深度学习的图像识别技术');
  const duration3 = Date.now() - startTime3;
  console.log(`\n⏱️  耗时: ${duration3}ms`);

  // 6. 显示性能统计
  console.log('\n=== 性能统计 ===');
  const stats = agent.getPerformanceStats();

  if (stats.cache) {
    console.log('\n📊 缓存统计:');
    console.log(`  总条目数: ${stats.cache.totalEntries}`);
    console.log(`  命中次数: ${stats.cache.hits}`);
    console.log(`  命中率: ${(stats.cache.hitRate * 100).toFixed(1)}%`);
    console.log(`  节省Token: ${stats.cache.tokensSaved}`);
    console.log(`  总Token: ${stats.cache.totalTokens}`);
    console.log(`  平均相似度: ${(stats.cache.avgSimilarity * 100).toFixed(1)}%`);
  }

  if (stats.monitor) {
    console.log('\n📈 推理统计:');
    console.log(`  总推理次数: ${stats.monitor.totalInferences}`);
    console.log(`  总耗时: ${(stats.monitor.totalDuration / 1000).toFixed(2)}s`);
    console.log(`  平均耗时: ${stats.monitor.avgDuration.toFixed(2)}ms`);
    console.log(`  P95耗时: ${stats.monitor.p95Duration}ms`);
  }

  // 7. 显示性能报告
  console.log('\n' + '='.repeat(70));
  console.log(agent.exportPerformanceReport());

  // 8. 性能对比
  console.log('📊 性能对比:');
  console.log(`  第一次执行: ${duration1}ms (冷启动)`);
  console.log(`  第二次执行: ${duration2}ms (缓存命中)`);
  console.log(`  第三次执行: ${duration3}ms (可能命中)`);
  console.log(`\n性能提升: ${((1 - duration2 / duration1) * 100).toFixed(1)}%`);
  console.log(`  Token节省: ${stats.cache?.tokensSaved || 0} / ${stats.cache?.totalTokens || 0}`);

  return {
    result1,
    result2,
    result3,
    stats,
  };
}

/**
 * 运行演示
 */
async function main() {
  try {
    console.log('🎯 智能体性能优化演示\n');
    console.log('本演示展示：');
    console.log('1. 推理缓存：自动复用相似问题的结果');
    console.log('2. 性能监控：追踪推理耗时和Token消耗');
    console.log('3. 性能统计：命中率、Token节省等指标\n');

    await demonstratePerformanceOptimizedAgent();

    console.log('\n' + '='.repeat(70));
    console.log('🎉 演示完成！');
    console.log('='.repeat(70));

    console.log('\n✅ 性能优化功能已成功集成到智能体！');
    console.log('\n🎯 关键特性：');
    console.log('  ✅ 自动缓存：相似问题自动复用');
    console.log('  ✅ 性能监控：实时追踪推理性能');
    console.log('  ✅ 统计报告：命中率、Token节省等');
    console.log('  ✅ 便捷API：queryCache()、storeToCache() 等');

    console.log('\n📝 集成方式：');
    console.log('  1. 在 AgentConfig 中启用性能优化');
    console.log('  2. 使用 queryCache() 查询缓存');
    console.log('  3. 使用 storeToCache() 存储结果');
    console.log('  4. 使用 getPerformanceStats() 获取统计');
    console.log('  5. 使用 exportPerformanceReport() 导出报告');
  } catch (error) {
    console.error('\n❌ 演示失败:', (error as Error).message);
  }
}

// 运行演示
main();
