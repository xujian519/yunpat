#!/usr/bin/env node

/**
 * MVP验证脚本 - 验证是否使用真实API
 *
 * 使用方法：
 * node verify-mvp.js
 */

import { WriterAgent } from './patents/agents/writer/dist/WriterAgent.js'
import { createDeepSeekModel } from './packages/core/dist/index.js'
import { MemoryManager } from './packages/core/dist/index.js'

async function verifyMVP() {
  console.log('🔍 YunPat MVP 验证脚本')
  console.log('验证目标：确认MVP使用真实API而非mock数据\n')

  // 1. 检查环境变量
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error('❌ 错误：未设置 DEEPSEEK_API_KEY 环境变量')
    console.error('请在 config/.env 中设置 API Key')
    process.exit(1)
  }
  console.log('✅ API Key 已配置')

  // 2. 创建真实的LLM实例
  const llm = createDeepSeekModel(apiKey)
  console.log('✅ LLM实例已创建 (DeepSeek)')

  // 3. 创建内存管理器
  const memory = new MemoryManager()
  console.log('✅ 内存管理器已初始化')

  // 4. 创建WriterAgent
  const agent = new WriterAgent({ llm, memory })
  console.log('✅ WriterAgent 已初始化\n')

  // 5. 执行测试任务
  console.log('🚀 开始执行测试任务...')
  const testTask = {
    type: 'generate',
    topic: 'API验证测试-请勿使用mock数据',
    requirements: ['简短', '明确说明这是真实API生成的'],
  }

  console.log('任务配置：', JSON.stringify(testTask, null, 2))
  console.log('\n⏳ 正在调用真实API (可能需要10-30秒)...\n')

  try {
    const startTime = Date.now()
    const result = await agent.execute(testTask, {})
    const duration = Date.now() - startTime

    console.log('✅ API调用成功！\n')
    console.log('📊 执行结果：')
    console.log(`   - 执行时间: ${duration}ms`)
    console.log(`   - 文档标题: ${result.document.title}`)
    console.log(`   - 内容长度: ${result.document.content.length} 字符`)
    console.log(`   - 字数统计: ${result.stats.wordCount} 词`)
    console.log(`   - 章节数量: ${result.stats.sectionCount} 个`)
    console.log(`   - 段落数量: ${result.stats.paragraphCount} 个`)

    // 6. 验证内容真实性
    console.log('\n🔍 内容真实性验证：')

    const content = result.document.content
    const checks = {
      containsTopic: content.includes('API验证测试'),
      hasRealStructure: content.includes('##') && content.includes('#'),
      hasSubstantialContent: result.stats.wordCount > 50,
      notMockTemplate: !content.includes('mock') && !content.includes('模拟'),
    }

    console.log(`   ${checks.containsTopic ? '✅' : '❌'} 包含任务主题`)
    console.log(`   ${checks.hasRealStructure ? '✅' : '❌'} 具有真实文档结构`)
    console.log(`   ${checks.hasSubstantialContent ? '✅' : '❌'} 内容充实`)
    console.log(`   ${checks.notMockTemplate ? '✅' : '❌'} 非mock模板`)

    const allPassed = Object.values(checks).every((v) => v)

    if (allPassed) {
      console.log('\n🎉 验证通过：MVP确实使用了真实API！')
      console.log('   内容是基于真实LLM生成的，而非预定义的mock数据')
    } else {
      console.log('\n⚠️  警告：部分验证未通过，可能存在以下问题：')
      if (!checks.containsTopic) console.log('   - 内容未基于任务主题生成')
      if (!checks.hasRealStructure) console.log('   - 文档结构不完整')
      if (!checks.hasSubstantialContent) console.log('   - 内容过短，可能是简化响应')
      if (!checks.notMockTemplate) console.log('   - 检测到mock相关关键词')
    }

    // 显示部分生成内容
    console.log('\n📄 生成内容预览（前300字符）：')
    console.log('─'.repeat(50))
    console.log(content.substring(0, 300) + '...')
    console.log('─'.repeat(50))
  } catch (error) {
    console.error('\n❌ 验证失败：', error.message)
    console.error('   这可能表明：')
    console.error('   1. API配置错误')
    console.error('   2. 网络连接问题')
    console.error('   3. API服务异常')
    console.error('\n🔧 建议操作：')
    console.error('   - 运行 node scripts/check-api-key.js 检查API配置')
    console.error('   - 检查 config/.env 中的DEEPSEEK_API_KEY设置')
    process.exit(1)
  }
}

// 加载环境变量（从已有的process.env中读取，因为运行前会source）
// 在运行此脚本前，请确保已经运行: source config/.env

verifyMVP().catch(console.error)
