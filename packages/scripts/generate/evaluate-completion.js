#!/usr/bin/env node

/**
 * YunPat 包完成度评估脚本
 *
 * 评估标准：
 * 1. 基础框架 (10%): package.json + 基本目录结构
 * 2. 核心逻辑 (40%): 主要功能实现
 * 3. 测试覆盖 (20%): 测试文件存在且通过
 * 4. 文档完整 (10%): README + API文档
 * 5. 生产就绪 (20%): 错误处理 + 日志 + 配置
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 评估标准配置
const CRITERIA_WEIGHTS = {
  hasBasicStructure: 0.1, // 基础框架
  hasCoreLogic: 0.4, // 核心逻辑
  testCoverage: 0.2, // 测试覆盖
  hasDocumentation: 0.1, // 文档完整
  isProductionReady: 0.2, // 生产就绪
}

/**
 * 检查包是否有基础结构
 */
function checkBasicStructure(pkgPath) {
  const checks = {
    hasPackageJson: false,
    hasSrcDir: false,
    hasIndexFile: false,
    hasTsConfig: false,
  }

  try {
    checks.hasPackageJson = fs.existsSync(path.join(pkgPath, 'package.json'))
    checks.hasSrcDir = fs.existsSync(path.join(pkgPath, 'src'))
    checks.hasIndexFile = fs.existsSync(path.join(pkgPath, 'src', 'index.ts'))
    checks.hasTsConfig = fs.existsSync(path.join(pkgPath, 'tsconfig.json'))

    const passedChecks = Object.values(checks).filter((v) => v).length
    return passedChecks / Object.keys(checks).length
  } catch (error) {
    return 0
  }
}

/**
 * 检查核心逻辑实现
 */
function checkCoreLogic(pkgPath) {
  try {
    const srcPath = path.join(pkgPath, 'src')
    if (!fs.existsSync(srcPath)) return 0

    const tsFiles = fs
      .readdirSync(srcPath)
      .filter((file) => file.endsWith('.ts') && file !== 'index.ts')

    // 基于文件数量和代码行数的简单评估
    const fileCount = tsFiles.length
    let totalLines = 0

    for (const file of tsFiles) {
      try {
        const content = fs.readFileSync(path.join(srcPath, file), 'utf-8')
        totalLines += content.split('\n').length
      } catch (error) {
        // 忽略读取错误
      }
    }

    // 评分标准：
    // - 至少2个TS文件
    // - 至少100行有效代码
    // - 主要逻辑文件存在（非类型定义）

    if (fileCount === 0) return 0
    if (fileCount < 2) return 0.3
    if (totalLines < 100) return 0.4
    if (totalLines < 300) return 0.6
    if (totalLines < 500) return 0.8
    return 1.0
  } catch (error) {
    return 0
  }
}

/**
 * 检查测试覆盖
 */
function checkTestCoverage(pkgPath) {
  try {
    const testPath = path.join(pkgPath, 'test')
    const srcPath = path.join(pkgPath, 'src')

    if (!fs.existsSync(srcPath)) return 0

    const srcFiles = fs.readdirSync(srcPath).filter((f) => f.endsWith('.ts'))
    const hasTestDir = fs.existsSync(testPath)

    if (!hasTestDir) return 0

    const testFiles = fs
      .readdirSync(testPath)
      .filter((f) => f.endsWith('.test.ts') || f.endsWith('.spec.ts'))

    if (testFiles.length === 0) return 0

    // 简单的测试覆盖率评估：测试文件 / 源文件
    const coverage = testFiles.length / Math.max(srcFiles.length, 1)
    return Math.min(coverage, 1.0)
  } catch (error) {
    return 0
  }
}

/**
 * 检查文档完整性
 */
function checkDocumentation(pkgPath) {
  try {
    const checks = {
      hasReadme: false,
      hasApiDocs: false,
    }

    checks.hasReadme = fs.existsSync(path.join(pkgPath, 'README.md'))

    // 检查是否有API文档（在docs目录或README中的API部分）
    const docsPath = path.join(pkgPath, 'docs')
    if (fs.existsSync(docsPath)) {
      const docFiles = fs.readdirSync(docsPath).filter((f) => f.endsWith('.md'))
      checks.hasApiDocs = docFiles.length > 0
    }

    // 如果README包含API部分，也算有文档
    if (checks.hasReadme) {
      try {
        const readme = fs.readFileSync(path.join(pkgPath, 'README.md'), 'utf-8')
        if (readme.includes('API') || readme.includes('Usage')) {
          checks.hasApiDocs = true
        }
      } catch (error) {
        // 忽略读取错误
      }
    }

    const passedChecks = Object.values(checks).filter((v) => v).length
    return passedChecks / Object.keys(checks).length
  } catch (error) {
    return 0
  }
}

/**
 * 检查生产就绪度
 */
function checkProductionReady(pkgPath) {
  try {
    const srcPath = path.join(pkgPath, 'src')
    if (!fs.existsSync(srcPath)) return 0

    // 检查主要源文件是否包含错误处理、日志等
    const tsFiles = fs.readdirSync(srcPath).filter((f) => f.endsWith('.ts') && f !== 'index.ts')

    if (tsFiles.length === 0) return 0

    let featuresFound = 0
    const maxFeatures = 3

    for (const file of tsFiles.slice(0, 3)) {
      // 只检查前3个文件
      try {
        const content = fs.readFileSync(path.join(srcPath, file), 'utf-8')

        if (content.includes('try') && content.includes('catch')) {
          featuresFound++ // 错误处理
        }
        if (content.includes('console.') || content.includes('logger')) {
          featuresFound++ // 日志
        }
        if (content.includes('process.env') || content.includes('config')) {
          featuresFound++ // 配置管理
        }

        if (featuresFound >= maxFeatures) break
      } catch (error) {
        // 忽略读取错误
      }
    }

    return featuresFound / maxFeatures
  } catch (error) {
    return 0
  }
}

/**
 * 评估单个包
 */
function evaluatePackage(pkgPath, pkgName) {
  const criteria = {
    hasBasicStructure: checkBasicStructure(pkgPath),
    hasCoreLogic: checkCoreLogic(pkgPath),
    testCoverage: checkTestCoverage(pkgPath),
    hasDocumentation: checkDocumentation(pkgPath),
    isProductionReady: checkProductionReady(pkgPath),
  }

  const score =
    criteria.hasBasicStructure * CRITERIA_WEIGHTS.hasBasicStructure +
    criteria.hasCoreLogic * CRITERIA_WEIGHTS.hasCoreLogic +
    criteria.testCoverage * CRITERIA_WEIGHTS.testCoverage +
    criteria.hasDocumentation * CRITERIA_WEIGHTS.hasDocumentation +
    criteria.isProductionReady * CRITERIA_WEIGHTS.isProductionReady

  return {
    name: pkgName,
    score: Math.round(score * 100),
    criteria,
  }
}

/**
 * 评估所有agents包
 */
function evaluateAllAgents() {
  const agentsPath = path.join(__dirname, '..', 'packages', 'agents')
  const results = []

  try {
    const entries = fs.readdirSync(agentsPath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const pkgPath = path.join(agentsPath, entry.name)

        // 跳过非包目录
        if (!fs.existsSync(path.join(pkgPath, 'package.json'))) {
          continue
        }

        const result = evaluatePackage(pkgPath, entry.name)
        results.push(result)
      }
    }
  } catch (error) {
    console.error('扫描agents目录失败:', error.message)
  }

  return results
}

/**
 * 生成报告
 */
function generateReport(results) {
  console.log('\n📊 YunPat Agents 包完成度评估报告')
  console.log('='.repeat(80))
  console.log(`评估时间: ${new Date().toISOString()}`)
  console.log(`评估包数: ${results.length}`)
  console.log('')

  // 按分数排序
  results.sort((a, b) => b.score - a.score)

  // 分类统计
  const categories = {
    excellent: results.filter((r) => r.score >= 80), // 优秀 ≥80%
    good: results.filter((r) => r.score >= 60 && r.score < 80), // 良好 60-79%
    fair: results.filter((r) => r.score >= 40 && r.score < 60), // 一般 40-59%
    poor: results.filter((r) => r.score < 40), // 较差 <40%
  }

  console.log('📈 总体统计:')
  console.log(`  优秀 (≥80%): ${categories.excellent.length} 个`)
  console.log(`  良好 (60-79%): ${categories.good.length} 个`)
  console.log(`  一般 (40-59%): ${categories.fair.length} 个`)
  console.log(`  较差 (<40%): ${categories.poor.length} 个`)
  console.log('')

  // 详细结果
  console.log('📋 详细评估结果:')
  console.log('')

  for (const result of results) {
    const status = result.score >= 80 ? '🟢' : result.score >= 60 ? '🟡' : '🔴'
    console.log(`${status} ${result.name.padEnd(30)} ${result.score.toString().padStart(3)}%`)

    // 显示详细信息
    if (result.score < 80) {
      const issues = []
      if (result.criteria.hasBasicStructure < 0.5) issues.push('基础结构')
      if (result.criteria.hasCoreLogic < 0.5) issues.push('核心逻辑')
      if (result.criteria.testCoverage < 0.3) issues.push('测试覆盖')
      if (result.criteria.hasDocumentation < 0.5) issues.push('文档')
      if (result.criteria.isProductionReady < 0.5) issues.push('生产就绪')

      if (issues.length > 0) {
        console.log(`   ⚠️  需改进: ${issues.join(', ')}`)
      }
    }
    console.log('')
  }

  // 建议
  console.log('💡 改进建议:')
  console.log('')

  const lowScorePackages = results.filter((r) => r.score < 60)
  if (lowScorePackages.length > 0) {
    console.log('🔴 优先处理 (完成度<60%):')
    for (const pkg of lowScorePackages) {
      console.log(`   - ${pkg.name} (${pkg.score}%)`)
    }
    console.log('')
  }

  const noTestPackages = results.filter((r) => r.criteria.testCoverage === 0)
  if (noTestPackages.length > 0) {
    console.log('🧪 缺少测试的包:')
    for (const pkg of noTestPackages) {
      console.log(`   - ${pkg.name}`)
    }
    console.log('')
  }

  const noDocPackages = results.filter((r) => r.criteria.hasDocumentation === 0)
  if (noDocPackages.length > 0) {
    console.log('📚 缺少文档的包:')
    for (const pkg of noDocPackages) {
      console.log(`   - ${pkg.name}`)
    }
  }

  console.log('')
  console.log('='.repeat(80))
}

/**
 * 主函数
 */
function main() {
  const results = evaluateAllAgents()
  generateReport(results)
}

// 运行评估
main()
