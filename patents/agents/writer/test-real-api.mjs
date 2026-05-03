import { WriterAgent } from './dist/WriterAgent.js'
import { createDeepSeekModel } from '@yunpat/core'
import { MemoryManager } from '@yunpat/core'

async function testRealApi() {
  console.log('=== 测试真实API调用 ===\n')
  
  // 创建真实的LLM实例
  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY)
  
  // 创建内存管理器
  const memory = new MemoryManager()
  
  // 创建WriterAgent
  const agent = new WriterAgent({
    llm,
    memory,
  })
  
  // 创建测试任务
  const task = {
    type: 'generate',
    topic: '测试API是否真实',
    requirements: ['简短', '测试'],
  }
  
  console.log('1. 发送任务到WriterAgent...')
  console.log('   任务:', JSON.stringify(task, null, 2))
  
  try {
    const result = await agent.execute(task, {})
    
    console.log('\n2. API调用成功！')
    console.log('   生成的文档标题:', result.document.title)
    console.log('   文档内容长度:', result.document.content.length, '字符')
    console.log('   字数统计:', result.stats.wordCount)
    console.log('   章节数量:', result.stats.sectionCount)
    
    // 验证内容是否真实生成
    if (result.document.content.includes('测试API是否真实')) {
      console.log('\n✅ 确认：内容真实生成，不是mock数据！')
    } else {
      console.log('\n⚠️  警告：内容可能不是基于任务生成的')
    }
    
  } catch (error) {
    console.error('\n❌ API调用失败:', error.message)
    console.error('   这表明可能存在配置问题')
  }
}

testRealApi().catch(console.error)
