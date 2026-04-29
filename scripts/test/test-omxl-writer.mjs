import { createOMXLModel } from './packages/core/dist/index.js';
import { WriterAgent } from './packages/agents/writer/dist/index.js';
import { EventBus, ShortTermMemory, ToolRegistry } from './packages/core/dist/index.js';

async function testWriterAgentWithOMXL() {
  console.log('🧪 测试 Writer Agent 使用 OMLX 本地模型...\n');

  // 初始化框架组件
  const eventBus = new EventBus();
  const memory = new ShortTermMemory();
  const tools = new ToolRegistry(eventBus);
  const llm = createOMXLModel('xj781102@');

  // 创建 Writer Agent
  const agent = new WriterAgent({ eventBus, memory, tools, llm });

  try {
    console.log('📝 任务：用 100 字介绍 TypeScript\n');

    const result = await agent.execute({
      type: 'generate',
      topic: '用 100 字左右介绍 TypeScript',
      format: 'markdown',
    });

    console.log('✅ Writer Agent 执行成功！\n');
    console.log('生成内容:');
    console.log('─'.repeat(60));
    console.log(result.document.content);
    console.log('─'.repeat(60));
    console.log('\n📊 统计信息:');
    console.log(`  字数: ${result.stats.wordCount}`);
    console.log(`  章节数: ${result.stats.sectionCount}`);

    return true;
  } catch (error) {
    console.error('\n❌ Writer Agent 执行失败:');
    console.error(error);
    return false;
  }
}

testWriterAgentWithOMXL()
  .then((success) => {
    if (success) {
      console.log('\n✨ OMLX 本地模型验证成功！');
    } else {
      console.log('\n💡 建议：');
      console.log('1. 检查 OMLX 服务是否运行');
      console.log('2. 检查模型是否正确加载');
      console.log('3. 查看错误日志');
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('测试出错:', error);
    process.exit(1);
  });
