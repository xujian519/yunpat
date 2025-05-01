#!/usr/bin/env node

/**
 * 自动化文档生成工具
 *
 * 功能：
 * 1. 扫描包结构和依赖
 * 2. 提取接口定义和类型
 * 3. 生成架构图（Mermaid 格式）
 * 4. 更新 API 文档
 * 5. 生成使用示例
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 扫描所有包
 */
function scanPackages() {
  const packagesPath = path.join(__dirname, '..', 'packages')
  const packages = []

  const entries = fs.readdirSync(packagesPath, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const pkgPath = path.join(packagesPath, entry.name)
      const packageJsonPath = path.join(pkgPath, 'package.json')

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        packages.push({
          name: entry.name,
          fullName: packageJson.name,
          version: packageJson.version,
          description: packageJson.description || '',
          dependencies: packageJson.dependencies || {},
          peerDependencies: packageJson.peerDependencies || {},
        })
      }
    }
  }

  return packages
}

/**
 * 扫描所有 agents
 */
function scanAgents() {
  const agentsPath = path.join(__dirname, '..', 'packages', 'agents')
  const agents = []

  const entries = fs.readdirSync(agentsPath, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const agentPath = path.join(agentsPath, entry.name)
      const packageJsonPath = path.join(agentPath, 'package.json')

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        agents.push({
          name: entry.name,
          fullName: packageJson.name,
          description: packageJson.description || '',
          category: categorizeAgent(entry.name),
        })
      }
    }
  }

  return agents
}

/**
 * 对 agent 进行分类
 */
function categorizeAgent(agentName) {
  const categories = {
    基础: ['base', 'integration-tests', 'test'],
    内容生成: [
      'writer',
      'researcher',
      'invention',
      'analysis',
      'patent-responder',
      'patent-analyzer',
      'abstract-drafter',
      'specification-drafter',
      'claim-generator',
      'comparison-report-generator',
    ],
    检查验证: [
      'quality',
      'quality-checker',
      'claims',
      'claims-formality-checker',
      'spec-formality-checker',
      'subject-matter-checker',
      'unity-checker',
    ],
    检索管理: ['search', 'prior-art-search', 'patent-manager'],
    技术工具: ['specification', 'technical-drawing', 'format-converter'],
  }

  for (const [category, agents] of Object.entries(categories)) {
    if (agents.includes(agentName)) {
      return category
    }
  }

  return '其他'
}

/**
 * 提取包的导出接口
 */
function extractExports(pkgName) {
  const pkgPath = path.join(__dirname, '..', 'packages', pkgName)
  const indexPath = path.join(pkgPath, 'src', 'index.ts')

  if (!fs.existsSync(indexPath)) {
    return []
  }

  const content = fs.readFileSync(indexPath, 'utf-8')
  const exports = []

  // 提取 export 语句
  const exportRegex = /export\s+(?:(?:class|function|const|type|interface)\s+(\w+)|\{([^}]+)\})/g
  let match

  while ((match = exportRegex.exec(content)) !== null) {
    if (match[1]) {
      exports.push({ name: match[1], type: 'declaration' })
    } else if (match[2]) {
      const items = match[2].split(',').map((s) => s.trim().split(' ')[0])
      items.forEach((item) => {
        if (item) exports.push({ name: item, type: 'named' })
      })
    }
  }

  return exports
}

/**
 * 生成包依赖关系图（Mermaid 格式）
 */
function generateDependencyGraph(packages) {
  let graph = '```mermaid\ngraph TD\n'

  packages.forEach((pkg) => {
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).filter((dep) =>
      dep.startsWith('@yunpat/')
    )

    deps.forEach((dep) => {
      const depName = dep.replace('@yunpat/', '')
      graph += `    ${pkg.name} --> ${depName}\n`
    })
  })

  graph += '```\n'
  return graph
}

/**
 * 生成 Agents 分类图（Mermaid 格式）
 */
function generateAgentsClassDiagram(agents) {
  let diagram = '```mermaid\nclassDiagram\n'

  agents.forEach((agent) => {
    diagram += `    class ${agent.name} {\n`
    diagram += `        <<${agent.category}>>\n`
    diagram += `        +execute(input, context)\n`
    diagram += `        +plan(input, context)\n`
    diagram += `        +act(plan, context)\n`
    diagram += `    }\n`
  })

  diagram += '```\n'
  return diagram
}

/**
 * 生成 API 文档
 */
function generateAPIDocumentation(packages) {
  let docs = '# API 文档\n\n'
  docs += '自动生成时间: ' + new Date().toISOString() + '\n\n'

  packages.forEach((pkg) => {
    docs += `## ${pkg.fullName}\n\n`
    docs += `**版本**: ${pkg.version}\n`
    docs += `**描述**: ${pkg.description || '无描述'}\n\n`

    const exports = extractExports(pkg.name)
    if (exports.length > 0) {
      docs += '### 导出\n\n'
      exports.forEach((exp) => {
        docs += `- \`${exp.name}\` (${exp.type})\n`
      })
      docs += '\n'
    }

    const deps = Object.keys(pkg.dependencies || {}).filter((d) => d.startsWith('@yunpat/'))
    if (deps.length > 0) {
      docs += '### 依赖\n\n'
      deps.forEach((dep) => {
        docs += `- \`${dep}\`\n`
      })
      docs += '\n'
    }

    docs += '---\n\n'
  })

  return docs
}

/**
 * 生成架构文档
 */
function generateArchitectureDocs() {
  const packages = scanPackages()
  const agents = scanAgents()

  let docs = '# YunPat 架构文档（自动生成）\n\n'
  docs += '**生成时间**: ' + new Date().toISOString() + '\n'
  docs += '**包数量**: ' + packages.length + '\n'
  docs += '**Agent 数量**: ' + agents.length + '\n\n'

  docs += '## 📦 包概览\n\n'
  docs += '| 包名 | 描述 |\n'
  docs += '|------|------|\n'
  packages.forEach((pkg) => {
    docs += `| ${pkg.fullName} | ${pkg.description || '无描述'} |\n`
  })
  docs += '\n'

  docs += '## 🤖 Agents 概览\n\n'
  const categories = {}
  agents.forEach((agent) => {
    if (!categories[agent.category]) {
      categories[agent.category] = []
    }
    categories[agent.category].push(agent)
  })

  Object.entries(categories).forEach(([category, agentList]) => {
    docs += `### ${category} (${agentList.length}个)\n\n`
    agentList.forEach((agent) => {
      docs += `- **${agent.name}**: ${agent.description || '无描述'}\n`
    })
    docs += '\n'
  })

  docs += '## 🔗 依赖关系\n\n'
  docs += generateDependencyGraph(packages)

  docs += '## 🏗️ Agents 类图\n\n'
  docs += generateAgentsClassDiagram(agents)

  return docs
}

/**
 * 生成使用示例
 */
function generateUsageExamples() {
  let examples = '# 使用示例（自动生成）\n\n'
  examples += '**生成时间**: ' + new Date().toISOString() + '\n\n'

  const agents = scanAgents()

  examples += '## Agents 使用示例\n\n'

  agents.forEach((agent) => {
    if (agent.description) {
      examples += `### ${agent.name}\n\n`
      examples += `**描述**: ${agent.description}\n\n`
      examples += '```typescript\n'
      examples += `import { ${agent.name.charAt(0).toUpperCase() + agent.name.slice(1)} } from '@yunpat/agents/${agent.name}'\n\n`
      examples += `const agent = new ${agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}({\n`
      examples += `  name: '${agent.name}',\n`
      examples += `  description: '${agent.description}',\n`
      examples += `  llm: yourLLMAdapter\n`
      examples += `})\n\n`
      examples += `const result = await agent.run(input, context)\n`
      examples += '```\n\n'
      examples += '---\n\n'
    }
  })

  return examples
}

/**
 * 更新 PROJECT_STRUCTURE.md
 */
function updateProjectStructure() {
  const agents = scanAgents()
  const structurePath = path.join(__dirname, '..', 'docs', 'PROJECT_STRUCTURE.md')

  if (!fs.existsSync(structurePath)) {
    console.log('⚠️  PROJECT_STRUCTURE.md 不存在，跳过更新')
    return
  }

  let content = fs.readFileSync(structurePath, 'utf-8')

  // 更新 agents 包数量
  const countRegex = /(\d+)\s*个子包.*实际.*?(\d+)/
  content = content.replace(countRegex, `${agents.length}个子包（实际 ${agents.length}个`)

  // 更新版本信息
  const versionRegex = /\*\*更新时间\*\*:\s*\d{4}-\d{2}-\d{2}/
  content = content.replace(versionRegex, `**更新时间**: ${new Date().toISOString().split('T')[0]}`)

  fs.writeFileSync(structurePath, content, 'utf-8')
  console.log('✅ 已更新 PROJECT_STRUCTURE.md')
}

/**
 * 生成统计报告
 */
function generateStatsReport() {
  const packages = scanPackages()
  const agents = scanAgents()

  let report = '# 文档生成统计报告\n\n'
  report += '**生成时间**: ' + new Date().toISOString() + '\n\n'

  report += '## 📊 统计数据\n\n'
  report += '- 总包数: ' + packages.length + '\n'
  report += '- Agent 数: ' + agents.length + '\n'

  const categories = {}
  agents.forEach((agent) => {
    categories[agent.category] = (categories[agent.category] || 0) + 1
  })

  report += '\n### Agents 分类统计\n\n'
  Object.entries(categories).forEach(([cat, count]) => {
    report += `- ${cat}: ${count}个\n`
  })

  report += '\n## 📝 生成的文档\n\n'
  report += '1. 架构文档: `docs/ARCHITECTURE_AUTO.md`\n'
  report += '2. API 文档: `docs/API_AUTO.md`\n'
  report += '3. 使用示例: `docs/EXAMPLES_AUTO.md`\n'

  return report
}

/**
 * 主函数
 */
function main() {
  console.log('\n📚 自动化文档生成工具')
  console.log('='.repeat(80))
  console.log(`生成时间: ${new Date().toISOString()}`)
  console.log('')

  try {
    // 1. 扫描包和 agents
    console.log('📦 扫描包和 agents...')
    const packages = scanPackages()
    const agents = scanAgents()
    console.log(`  - 找到 ${packages.length} 个包`)
    console.log(`  - 找到 ${agents.length} 个 agents`)
    console.log('')

    // 2. 生成架构文档
    console.log('📄 生成架构文档...')
    const archDocs = generateArchitectureDocs()
    const archPath = path.join(__dirname, '..', 'docs', 'ARCHITECTURE_AUTO.md')
    fs.writeFileSync(archPath, archDocs, 'utf-8')
    console.log(`  ✅ 已生成: ${archPath}`)
    console.log('')

    // 3. 生成 API 文档
    console.log('📝 生成 API 文档...')
    const apiDocs = generateAPIDocumentation(packages)
    const apiPath = path.join(__dirname, '..', 'docs', 'API_AUTO.md')
    fs.writeFileSync(apiPath, apiDocs, 'utf-8')
    console.log(`  ✅ 已生成: ${apiPath}`)
    console.log('')

    // 4. 生成使用示例
    console.log('💡 生成使用示例...')
    const examples = generateUsageExamples()
    const examplesPath = path.join(__dirname, '..', 'docs', 'EXAMPLES_AUTO.md')
    fs.writeFileSync(examplesPath, examples, 'utf-8')
    console.log(`  ✅ 已生成: ${examplesPath}`)
    console.log('')

    // 5. 更新 PROJECT_STRUCTURE.md
    console.log('🔄 更新 PROJECT_STRUCTURE.md...')
    updateProjectStructure()
    console.log('')

    // 6. 生成统计报告
    console.log('📊 生成统计报告...')
    const stats = generateStatsReport()
    const statsPath = path.join(__dirname, '..', 'docs', 'GENERATION_STATS.md')
    fs.writeFileSync(statsPath, stats, 'utf-8')
    console.log(`  ✅ 已生成: ${statsPath}`)
    console.log('')

    console.log('='.repeat(80))
    console.log('✅ 文档生成完成！')
    console.log('')
    console.log('📋 生成的文档:')
    console.log('  1. docs/ARCHITECTURE_AUTO.md - 架构文档')
    console.log('  2. docs/API_AUTO.md - API 文档')
    console.log('  3. docs/EXAMPLES_AUTO.md - 使用示例')
    console.log('  4. docs/GENERATION_STATS.md - 统计报告')
    console.log('')
    console.log('💡 提示: 请检查生成的文档，并根据需要进行手动调整')
  } catch (error) {
    console.error('❌ 生成失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// 运行生成器
main()
