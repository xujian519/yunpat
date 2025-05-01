#!/usr/bin/env node

/**
 * MVP Agent完整性验证脚本
 * 检查所有agent是否完整且可运行
 */

import fs from 'fs/promises'
import path from 'path'

const AGENTS_DIR = './patents/agents'

// 定义需要检查的agents
const AGENTS_TO_CHECK = [
  {
    name: 'WriterAgent',
    path: 'writer/src/WriterAgent.ts',
    description: '专利撰写智能体',
    required: true,
  },
  {
    name: 'ResponderAgent',
    path: '../responder/PatentResponderAgent.ts',
    relativeTo: 'writer',
    description: '审查答复智能体',
    required: true,
  },
  {
    name: 'AnalyzerAgent',
    path: '../analyzer/PatentAnalyzerAgent.ts',
    relativeTo: 'writer',
    description: '专利分析智能体',
    required: true,
  },
  {
    name: 'InventionUnderstandingAgent',
    path: '../invention-understanding/InventionUnderstandingAgent.ts',
    relativeTo: 'writer',
    description: '发明理解智能体',
    required: true,
  },
  {
    name: 'PatentManagerAgent',
    path: '../manager/PatentManagerAgent.ts',
    relativeTo: 'writer',
    description: '专利管理智能体',
    required: false,
  },
]

// 检查文件是否存在
async function checkFileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

// 检查agent的完整性
async function checkAgentIntegrity(agent) {
  const basePath = path.join(AGENTS_DIR, agent.relativeTo || '')
  const fullPath = path.resolve(basePath, agent.path)

  const exists = await checkFileExists(fullPath)

  let hasDependencies = false
  let hasExports = false
  let error = null

  if (exists) {
    try {
      const content = await fs.readFile(fullPath, 'utf-8')

      // 检查是否有基本的agent结构
      hasDependencies = content.includes('import') && content.includes('export')
      hasExports =
        content.includes('class') && (content.includes('Agent') || content.includes('extends'))

      // 检查是否有核心方法
      const hasPlanMethod = content.includes('plan') || content.includes('async plan')
      const hasActMethod = content.includes('act') || content.includes('async act')

      if (!hasPlanMethod || !hasActMethod) {
        error = '缺少核心方法 (plan/act)'
      }
    } catch (err) {
      error = `读取文件失败: ${err.message}`
    }
  }

  return {
    ...agent,
    fullPath,
    exists,
    hasDependencies,
    hasExports,
    error,
    status: exists && hasDependencies && hasExports && !error ? '✅' : '❌',
  }
}

// 主检查函数
async function checkAgents() {
  console.log('🔍 YunPat MVP Agent 完整性检查\n')
  console.log('检查路径:', AGENTS_DIR)
  console.log('检查数量:', AGENTS_TO_CHECK.length)
  console.log('\n' + '='.repeat(80) + '\n')

  const results = []

  for (const agent of AGENTS_TO_CHECK) {
    const result = await checkAgentIntegrity(agent)
    results.push(result)

    const required = result.required ? '必需' : '可选'
    console.log(`${result.status} ${result.name} (${required})`)
    console.log(`   描述: ${result.description}`)
    console.log(`   路径: ${result.path}`)

    if (result.error) {
      console.log(`   ⚠️  错误: ${result.error}`)
    }

    if (result.exists) {
      console.log(`   ✅ 文件存在`)
      if (result.hasDependencies) console.log(`   ✅ 有依赖导入`)
      if (result.hasExports) console.log(`   ✅ 有类导出`)
    } else {
      console.log(`   ❌ 文件不存在`)
    }

    console.log('')
  }

  // 生成总结报告
  const total = results.length
  const passed = results.filter((r) => r.status === '✅').length
  const failed = total - passed
  const requiredPassed = results.filter((r) => r.required && r.status === '✅').length
  const requiredTotal = results.filter((r) => r.required).length

  console.log('='.repeat(80))
  console.log('\n📊 检查总结:\n')
  console.log(`   总计: ${total} 个agents`)
  console.log(`   通过: ${passed} 个`)
  console.log(`   失败: ${failed} 个`)
  console.log(`   必需agents: ${requiredPassed}/${requiredTotal} 通过\n`)

  if (requiredPassed === requiredTotal) {
    console.log('🎉 所有必需的agents都完整可用！\n')

    if (passed === total) {
      console.log('✨ 完美！所有agents（包括可选的）都可用！\n')
    }
  } else {
    console.log('❌ 部分必需agents不可用，需要修复！\n')

    const failedRequired = results.filter((r) => r.required && r.status !== '✅')
    console.log('需要修复的必需agents:')
    failedRequired.forEach((agent) => {
      console.log(`   - ${agent.name}: ${agent.error || '文件不存在'}`)
    })
    console.log('')
  }

  // 列出可用的agents
  const workingAgents = results.filter((r) => r.status === '✅').map((r) => r.name)
  if (workingAgents.length > 0) {
    console.log('🚀 可用的Agents:')
    workingAgents.forEach((name) => console.log(`   - ${name}`))
    console.log('')
  }

  return requiredPassed === requiredTotal
}

// 运行检查
checkAgents()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((err) => {
    console.error('检查过程出错:', err)
    process.exit(1)
  })
