/**
 * YunPat 基础使用示例
 *
 * 演示如何创建和使用智能体
 */

import {
  EventBus,
  ShortTermMemory,
  ToolRegistry,
  LangChainAdapter,
} from '@yunpat/core';
import { WriterAgent } from '@yunpat/agent-writer';
import { ResearcherAgent } from '@yunpat/agent-researcher';

async function main() {
  // 1. 初始化框架组件
  const eventBus = new EventBus();
  const memory = new ShortTermMemory();
  const tools = new ToolRegistry(eventBus);
  const llm = new LangChainAdapter({
    apiKey: process.env.OPENAI_API_KEY!,
    modelName: 'gpt-4',
  });

  // 2. 订阅事件（可选，用于监控）
  eventBus.subscribe('agent:started', (event) => {
    console.log(`[事件] ${event.source} 开始执行`);
  });

  eventBus.subscribe('agent:completed', (event) => {
    console.log(`[事件] ${event.source} 执行完成`);
    console.log(`耗时: ${event.data.duration}ms`);
  });

  // 3. 创建智能体
  const writer = new WriterAgent({ eventBus, memory, tools, llm });
  const researcher = new ResearcherAgent({ eventBus, memory, tools, llm });

  // 4. 执行任务
  console.log('=== 示例 1: 技术写作 ===\n');

  const writingResult = await writer.execute({
    type: 'generate',
    topic: 'TypeScript 类型系统基础',
    format: 'markdown',
    requirements: ['结构清晰', '包含示例代码'],
  });

  console.log('生成的文档:');
  console.log(writingResult.document.content);
  console.log('\n统计:', writingResult.stats);

  console.log('\n=== 示例 2: 研究分析 ===\n');

  const researchResult = await researcher.execute({
    question: '2024 年 AI Agent 框架对比',
    depth: 'standard',
    sources: ['web', 'academic'],
  });

  console.log('核心发现:');
  researchResult.keyFindings.forEach((finding, index) => {
    console.log(`${index + 1}. ${finding}`);
  });

  console.log('\n数据汇总:', researchResult.dataSummary);
}

// 运行示例
main().catch(console.error);
