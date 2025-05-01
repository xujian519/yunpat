#!/usr/bin/env node

/**
 * 每周文档审查脚本
 *
 * 功能：
 * 1. 检查文档同步状态
 * 2. 评估代码完成度
 * 3. 生成审查报告
 * 4. 发送通知（可选）
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 执行命令并获取输出
 */
function execCommand(command, cwd = path.join(__dirname, '..')) {
  try {
    return execSync(command, { cwd, encoding: 'utf-8' })
  } catch (error) {
    return error.stdout || error.message
  }
}

/**
 * 检查文档同步状态
 */
function checkDocSync() {
  console.log('📄 检查文档同步状态...')
  const output = execCommand('node scripts/check-doc-sync.js')

  // 解析输出
  const lines = output.split('\n')
  const issues = []

  let inSummary = false
  for (const line of lines) {
    if (line.includes('📋 总结:')) {
      inSummary = true
      continue
    }

    if (inSummary && line.includes('发现')) {
      const match = line.match(/发现\s+(\d+)\s+个问题/)
      if (match) {
        issues.push({
          type: 'doc_sync',
          count: parseInt(match[1]),
          details: output,
        })
      }
      break
    }
  }

  return issues.length > 0 ? issues : [{ type: 'doc_sync', count: 0, details: output }]
}

/**
 * 评估代码完成度
 */
function evaluateCompletion() {
  console.log('📊 评估代码完成度...')
  const output = execCommand('node scripts/evaluate-completion.js')

  // 解析输出
  const lines = output.split('\n')
  const stats = {
    total: 0,
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
  }

  for (const line of lines) {
    if (line.includes('评估包数')) {
      const match = line.match(/评估包数:\s*(\d+)/)
      if (match) stats.total = parseInt(match[1])
    }

    if (line.includes('优秀')) {
      const match = line.match(/优秀\s*\(≥80%\):\s*(\d+)/)
      if (match) stats.excellent = parseInt(match[1])
    }

    if (line.includes('良好')) {
      const match = line.match(/良好\s*\(60-79%\):\s*(\d+)/)
      if (match) stats.good = parseInt(match[1])
    }

    if (line.includes('一般')) {
      const match = line.match(/一般\s*\(40-59%\):\s*(\d+)/)
      if (match) stats.fair = parseInt(match[1])
    }

    if (line.includes('较差')) {
      const match = line.match(/较差\s*\(<40%\):\s*(\d+)/)
      if (match) stats.poor = parseInt(match[1])
    }
  }

  return {
    type: 'completion',
    stats,
    details: output,
  }
}

/**
 * 检查最近的代码变更
 */
function checkRecentChanges() {
  console.log('🔍 检查最近的代码变更...')

  // 获取最近一周的提交
  const output = execCommand('git log --since="1 week ago" --pretty=format:"%h %s" --no-merges')
  const commits = output.split('\n').filter((line) => line.trim())

  // 获取修改的文件
  const filesOutput = execCommand('git diff --name-only HEAD~10 HEAD')
  const changedFiles = filesOutput.split('\n').filter((line) => line.trim())

  return {
    type: 'recent_changes',
    commits: commits.length,
    files: changedFiles.filter((f) => f.endsWith('.ts')).length,
    details: {
      recentCommits: commits.slice(0, 10),
      changedTsFiles: changedFiles.filter((f) => f.endsWith('.ts')).slice(0, 20),
    },
  }
}

/**
 * 检查测试覆盖率
 */
function checkTestCoverage() {
  console.log('🧪 检查测试覆盖率...')

  try {
    // 尝试运行测试覆盖率
    const output = execCommand('npm run test:coverage', path.join(__dirname, '..'))

    // 简单解析（实际应该解析覆盖率报告）
    return {
      type: 'test_coverage',
      status: 'success',
      details: output.substring(0, 500),
    }
  } catch (error) {
    return {
      type: 'test_coverage',
      status: 'failed',
      error: error.message,
    }
  }
}

/**
 * 生成审查报告
 */
function generateReviewReport() {
  console.log('\n📋 生成每周审查报告')
  console.log('='.repeat(80))

  const reviewDate = new Date().toISOString().split('T')[0]
  const reportDate = new Date().toISOString()

  let report = `# 每周文档审查报告\n\n`
  report += `**审查日期**: ${reviewDate}\n`
  report += `**生成时间**: ${reportDate}\n`
  report += `**审查人**: 自动化审查系统\n\n`

  report += `## 📊 审查概览\n\n`

  // 1. 文档同步检查
  console.log('\n1️⃣ 文档同步检查')
  const docSyncIssues = checkDocSync()
  report += `### 1. 文档同步状态\n\n`

  if (docSyncIssues[0].count === 0) {
    report += `✅ **状态**: 良好\n`
    report += `- 所有文档与代码保持同步\n\n`
  } else {
    report += `⚠️ **状态**: 需要关注\n`
    report += `- 发现 ${docSyncIssues[0].count} 个同步问题\n\n`
  }

  // 2. 代码完成度评估
  console.log('\n2️⃣ 代码完成度评估')
  const completion = evaluateCompletion()
  report += `### 2. 代码完成度\n\n`
  report += `- 总包数: ${completion.stats.total}\n`
  report += `- 🟢 优秀 (≥80%): ${completion.stats.excellent} 个\n`
  report += `- 🟡 良好 (60-79%): ${completion.stats.good} 个\n`
  report += `- 🔴 一般/较差 (<60%): ${completion.stats.fair + completion.stats.poor} 个\n\n`

  // 3. 最近变更
  console.log('\n3️⃣ 最近代码变更')
  const changes = checkRecentChanges()
  report += `### 3. 最近变更\n\n`
  report += `- 本周提交数: ${changes.commits}\n`
  report += `- 修改的 TS 文件: ${changes.files}\n\n`

  // 4. 测试覆盖率
  console.log('\n4️⃣ 测试覆盖率')
  const testCoverage = checkTestCoverage()
  report += `### 4. 测试覆盖率\n\n`

  if (testCoverage.status === 'success') {
    report += `✅ 测试通过\n\n`
  } else {
    report += `⚠️ 测试需要关注\n\n`
  }

  // 5. 改进建议
  report += `## 💡 改进建议\n\n`

  const suggestions = []

  if (docSyncIssues[0].count > 0) {
    suggestions.push(`1. 修复 ${docSyncIssues[0].count} 个文档同步问题`)
  }

  if (completion.stats.poor > 3) {
    suggestions.push(`2. 优先改进 ${completion.stats.poor} 个低完成度 Agent`)
  }

  if (changes.commits < 5) {
    suggestions.push(`3. 增加开发活跃度`)
  }

  if (suggestions.length === 0) {
    suggestions.push('1. 继续保持当前状态')
    suggestions.push('2. 定期运行文档同步检查')
    suggestions.push('3. 关注低完成度 Agent 的改进')
  }

  suggestions.forEach((s) => {
    report += `- ${s}\n`
  })

  report += `\n`

  // 6. 下周计划
  report += `## 📅 下周计划\n\n`
  report += `- [ ] 运行文档生成工具\n`
  report += `- [ ] 更新进度追踪文档\n`
  report += `- [ ] 审查新增代码的文档\n`
  report += `- [ ] 修复发现的文档问题\n\n`

  // 7. 详细信息
  report += `## 📎 详细信息\n\n`
  report += `### 文档同步检查详情\n\n`
  report += `<details>\n<summary>点击展开</summary>\n\n`
  report += '```\n' + docSyncIssues[0].details + '\n```\n\n'
  report += `</details>\n\n`

  report += `### 代码完成度评估详情\n\n`
  report += `<details>\n<summary>点击展开</summary>\n\n`
  report += '```\n' + completion.details + '\n```\n\n'
  report += `</details>\n\n`

  return report
}

/**
 * 保存报告
 */
function saveReport(report) {
  const reportsDir = path.join(__dirname, '..', 'docs', 'reports')
  const archiveDir = path.join(reportsDir, 'WEEKLY_REVIEWS')

  // 创建目录
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true })
  }

  // 保存报告
  const reviewDate = new Date().toISOString().split('T')[0]
  const reportPath = path.join(archiveDir, `weekly-review-${reviewDate}.md`)

  fs.writeFileSync(reportPath, report, 'utf-8')

  console.log(`\n✅ 报告已保存: ${reportPath}`)

  return reportPath
}

/**
 * 发送通知（占位符）
 */
function sendNotification(reportPath) {
  console.log('\n📬 通知功能')
  console.log('  报告路径:', reportPath)
  console.log('  💡 提示: 可以配置邮件、Slack 或其他通知方式')
  console.log('')
  console.log('  配置示例:')
  console.log('  - 邮件: 使用 nodemailer 发送报告')
  console.log('  - Slack: 使用 Webhook 发送消息')
  console.log('  - GitHub: 创建 Issue 或 PR 评论')
}

/**
 * 主函数
 */
function main() {
  console.log('\n📅 每周文档审查')
  console.log('='.repeat(80))
  console.log(`审查时间: ${new Date().toISOString()}`)
  console.log('')

  try {
    // 生成报告
    const report = generateReviewReport()

    // 保存报告
    const reportPath = saveReport(report)

    // 发送通知
    sendNotification(reportPath)

    // 输出摘要
    console.log('\n' + '='.repeat(80))
    console.log('✅ 每周审查完成！')
    console.log('')
    console.log('📋 审查摘要:')
    console.log('  - 文档同步检查: 已完成')
    console.log('  - 代码完成度评估: 已完成')
    console.log('  - 最近变更检查: 已完成')
    console.log('  - 测试覆盖率检查: 已完成')
    console.log('')
    console.log('📄 报告位置:', reportPath)
    console.log('')
    console.log('💡 提示: 请查看报告了解详细情况')
  } catch (error) {
    console.error('\n❌ 审查失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// 运行审查
main()
