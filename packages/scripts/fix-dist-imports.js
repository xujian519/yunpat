#!/usr/bin/env node
/**
 * 修复 dist 目录中的 ES 模块导入路径
 * 在 TypeScript 编译后运行，为相对导入添加 .js 扩展名
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

function processDirectory(dir) {
  const files = readdirSync(dir)

  for (const file of files) {
    const filePath = join(dir, file)
    const stat = statSync(filePath)

    if (stat.isDirectory()) {
      processDirectory(filePath)
    } else if (extname(file) === '.js') {
      fixImports(filePath)
    }
  }
}

function fixImports(filePath) {
  let content = readFileSync(filePath, 'utf-8')
  const originalContent = content

  // 修复相对导入：from './xxx' -> from './xxx.js'
  // 只修复：
  // - 相对路径导入 (以 . 开头)
  // - 没有扩展名或只有 .ts 扩展名的
  content = content.replace(/from\s+['"]((\.\.?\/[^'"]*?))['"]/g, (match, importPath) => {
    // 如果已经有 .js, .mjs, .json 扩展名，跳过
    if (/\.(js|mjs|json)$/.test(importPath)) {
      return match
    }
    // 移除可能的 .ts 扩展名，添加 .js
    const cleanPath = importPath.replace(/\.ts$/, '')
    return `from '${cleanPath}.js'`
  })

  if (content !== originalContent) {
    writeFileSync(filePath, content, 'utf-8')
    const relativePath = filePath.replace(rootDir, '')
    console.log(`✓ Fixed: ${relativePath}`)
  }
}

// 处理所有 packages 目录下的 dist 文件
const packagesDir = join(rootDir, 'packages')
const agentsDir = join(packagesDir, 'agents')

const dirsToProcess = [
  join(packagesDir, 'core', 'dist'),
  join(packagesDir, 'orchestrator', 'dist'),
  join(packagesDir, 'tui', 'dist'),
  join(packagesDir, 'orchestrator-adapter', 'dist'),
  join(agentsDir, 'base', 'dist'),
  join(agentsDir, 'patent-analyzer', 'dist'),
  join(agentsDir, 'patent-responder', 'dist'),
  join(agentsDir, 'search', 'dist'),
]

console.log('修复 dist 目录中的 ES 模块导入路径...')

for (const dir of dirsToProcess) {
  try {
    processDirectory(dir)
  } catch (e) {
    // 目录可能不存在，跳过
  }
}

console.log('完成！')
