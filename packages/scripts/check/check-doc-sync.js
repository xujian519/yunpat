#!/usr/bin/env node

/**
 * 文档同步检查脚本
 *
 * 检查文档是否与代码保持同步：
 * 1. 检查新增的包是否有文档
 * 2. 检查 API 文档是否更新
 * 3. 检查 PROJECT_STRUCTURE.md 是否准确
 * 4. 生成同步报告
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..', '..')

/**
 * 扫描所有 packages
 */
function scanPackages() {
  const packagesPath = path.join(ROOT_DIR, 'packages')
  const packages = []

  try {
    const entries = fs.readdirSync(packagesPath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const pkgPath = path.join(packagesPath, entry.name)
        const packageJsonPath = path.join(pkgPath, 'package.json')

        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
            packages.push({
              name: entry.name,
              fullName: packageJson.name,
              version: packageJson.version,
              description: packageJson.description || '',
              hasReadme: fs.existsSync(path.join(pkgPath, 'README.md')),
              hasIndexTs: fs.existsSync(path.join(pkgPath, 'src', 'index.ts')),
            })
          } catch (error) {
            console.warn(`无法读取 ${entry.name} 的 package.json:`, error.message)
          }
        }
      }
    }
  } catch (error) {
    console.error('扫描 packages 失败:', error.message)
  }

  return packages
}

/**
 * 扫描所有 agents
 */
function scanAgents() {
  const agentsPath = path.join(ROOT_DIR, 'packages', 'agents')
  const agents = []

  try {
    const entries = fs.readdirSync(agentsPath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const agentPath = path.join(agentsPath, entry.name)
        const packageJsonPath = path.join(agentPath, 'package.json')

        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
            agents.push({
              name: entry.name,
              fullName: packageJson.name,
              description: packageJson.description || '',
              hasReadme: fs.existsSync(path.join(agentPath, 'README.md')),
              hasSrcIndex: fs.existsSync(path.join(agentPath, 'src', 'index.ts')),
              hasTests: fs.existsSync(path.join(agentPath, 'test')),
            })
          } catch (error) {
            // 忽略非包目录
          }
        }
      }
    }
  } catch (error) {
    console.error('扫描 agents 失败:', error.message)
  }

  return agents
}

/**
 * 检查 PROJECT_STRUCTURE.md 中的 agents 数量
 */
function checkProjectStructureDoc(actualAgentCount) {
  const docPath = path.join(ROOT_DIR, 'docs', 'PROJECT_STRUCTURE.md')

  if (!fs.existsSync(docPath)) {
    return {
      valid: false,
      error: 'PROJECT_STRUCTURE.md 不存在',
    }
  }

  try {
    const content = fs.readFileSync(docPath, 'utf-8')

    // 检查文档中的 agents 包数量描述
    // 查找类似 "27个子包" 的描述
    const match = content.match(/(\d+)\s*个子包/)

    if (!match) {
      return {
        valid: false,
        error: '未找到 agents 包数量描述',
      }
    }

    const documentedCount = parseInt(match[1])

    return {
      valid: documentedCount === actualAgentCount,
      documentedCount,
      actualCount: actualAgentCount,
      diff: actualAgentCount - documentedCount,
    }
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    }
  }
}

/**
 * 检查包是否有 README
 */
function checkPackageReadmes(packages) {
  const missing = []

  for (const pkg of packages) {
    if (!pkg.hasReadme) {
      missing.push(pkg.fullName)
    }
  }

  return {
    total: packages.length,
    withReadme: packages.filter((p) => p.hasReadme).length,
    withoutReadme: missing.length,
    missing,
  }
}

/**
 * 检查 agents 是否有 README
 */
function checkAgentReadmes(agents) {
  const missing = []

  for (const agent of agents) {
    if (!agent.hasReadme) {
      missing.push(agent.fullName)
    }
  }

  return {
    total: agents.length,
    withReadme: agents.filter((a) => a.hasReadme).length,
    withoutReadme: missing.length,
    missing,
  }
}

/**
 * 检查 agents 是否有测试
 */
function checkAgentTests(agents) {
  const missing = []

  for (const agent of agents) {
    if (!agent.hasTests) {
      missing.push(agent.fullName)
    }
  }

  return {
    total: agents.length,
    withTests: agents.filter((a) => a.hasTests).length,
    withoutTests: missing.length,
    missing,
  }
}

/**
 * 生成报告
 */
function generateReport() {
  console.log('\n📊 文档同步检查报告')
  console.log('='.repeat(80))
  console.log(`检查时间: ${new Date().toISOString()}`)
  console.log('')

  // 1. 扫描包和 agents
  const packages = scanPackages()
  const agents = scanAgents()

  console.log(`📦 扫描结果:`)
  console.log(`  - packages: ${packages.length} 个`)
  console.log(`  - agents: ${agents.length} 个`)
  console.log('')

  // 2. 检查 PROJECT_STRUCTURE.md
  console.log(`📄 PROJECT_STRUCTURE.md 检查:`)
  const structureCheck = checkProjectStructureDoc(agents.length)

  if (structureCheck.valid) {
    console.log(`  ✅ agents 包数量准确: ${structureCheck.actualCount} 个`)
  } else {
    console.log(`  ❌ agents 包数量不准确:`)
    console.log(`     文档记录: ${structureCheck.documentedCount} 个`)
    console.log(`     实际数量: ${structureCheck.actualCount} 个`)
    console.log(`     差异: ${structureCheck.diff > 0 ? '+' : ''}${structureCheck.diff}`)

    if (structureCheck.error) {
      console.log(`     错误: ${structureCheck.error}`)
    }
  }
  console.log('')

  // 3. 检查包 README
  console.log(`📚 包 README 检查:`)
  const readmeCheck = checkPackageReadmes(packages)
  console.log(
    `  - 有 README: ${readmeCheck.withReadme}/${readmeCheck.total} (${Math.round((readmeCheck.withReadme / readmeCheck.total) * 100)}%)`
  )
  console.log(`  - 缺少 README: ${readmeCheck.withoutReadme}`)

  if (readmeCheck.missing.length > 0) {
    console.log(`  缺少 README 的包:`)
    readmeCheck.missing.forEach((pkg) => {
      console.log(`    - ${pkg}`)
    })
  }
  console.log('')

  // 4. 检查 agents README
  console.log(`🤖 Agents README 检查:`)
  const agentReadmeCheck = checkAgentReadmes(agents)
  console.log(
    `  - 有 README: ${agentReadmeCheck.withReadme}/${agentReadmeCheck.total} (${Math.round((agentReadmeCheck.withReadme / agentReadmeCheck.total) * 100)}%)`
  )
  console.log(`  - 缺少 README: ${agentReadmeCheck.withoutReadme}`)

  if (agentReadmeCheck.missing.length > 0) {
    console.log(`  缺少 README 的 agents:`)
    agentReadmeCheck.missing.forEach((agent) => {
      console.log(`    - ${agent}`)
    })
  }
  console.log('')

  // 5. 检查 agents 测试
  console.log(`🧪 Agents 测试检查:`)
  const testCheck = checkAgentTests(agents)
  console.log(
    `  - 有测试: ${testCheck.withTests}/${testCheck.total} (${Math.round((testCheck.withTests / testCheck.total) * 100)}%)`
  )
  console.log(`  - 缺少测试: ${testCheck.withoutTests}`)

  if (testCheck.missing.length > 0) {
    console.log(`  缺少测试的 agents:`)
    testCheck.missing.forEach((agent) => {
      console.log(`    - ${agent}`)
    })
  }
  console.log('')

  // 6. 总结
  console.log('='.repeat(80))
  console.log('📋 总结:')

  const criticalIssues = []
  const warnings = []

  if (!structureCheck.valid) {
    criticalIssues.push('PROJECT_STRUCTURE.md 中的 agents 包数量需要更新')
  }

  if (readmeCheck.missing.length > 0) {
    warnings.push(`${readmeCheck.missing.length} 个包缺少 README`)
  }

  if (agentReadmeCheck.missing.length > 0) {
    warnings.push(`${agentReadmeCheck.missing.length} 个 agent 缺少 README`)
  }

  if (testCheck.missing.length > 0) {
    warnings.push(`${testCheck.missing.length} 个 agent 缺少测试`)
  }

  if (criticalIssues.length === 0 && warnings.length === 0) {
    console.log('  ✅ 所有检查通过！文档与代码保持同步。')
  } else {
    if (criticalIssues.length > 0) {
      console.log(`  ❌ 发现 ${criticalIssues.length} 个关键问题:`)
      criticalIssues.forEach((issue, index) => {
        console.log(`     ${index + 1}. ${issue}`)
      })
    }
    if (warnings.length > 0) {
      console.log(`  ⚠️  发现 ${warnings.length} 个警告:`)
      warnings.forEach((issue, index) => {
        console.log(`     ${index + 1}. ${issue}`)
      })
    }
  }

  console.log('')

  // 只在关键问题（文档数量不匹配）时返回非零退出码
  return criticalIssues.length === 0 ? 0 : 1
}

/**
 * 主函数
 */
function main() {
  const exitCode = generateReport()
  process.exit(exitCode)
}

// 运行检查
main()
