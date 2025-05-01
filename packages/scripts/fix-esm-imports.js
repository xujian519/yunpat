#!/usr/bin/env node
/**
 * 修复 ES 模块导入路径 - 添加 .js 扩展名
 * 用于修复 TypeScript 编译后的 ES 模块导入问题
 */

import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// 查找所有需要修复的 .ts 文件
const files = glob.sync('packages/**/src/**/*.ts', {
  cwd: rootDir,
  ignore: ['**/node_modules/**', '**/dist/**'],
})

let fixedCount = 0
let skippedCount = 0

for (const file of files) {
  const filePath = join(rootDir, file)
  let content = readFileSync(filePath, 'utf-8')
  const originalContent = content

  // 修复相对导入：from './xxx' -> from './xxx.js'
  // 但不修复：
  // - 已有 .js, .ts, .json 扩展名的
  // - 以 @ 开头的包导入
  // - 绝对路径导入

  content = content.replace(/from\s+['"](\.\.?[^'"]*)['"]/g, (match, importPath) => {
    // 跳过已有扩展名的
    if (/\.(js|ts|json|mts)$/.test(importPath)) {
      return match
    }
    // 跳过包导入
    if (importPath.startsWith('@') || !importPath.startsWith('.')) {
      return match
    }
    // 添加 .js 扩展名
    return `from '${importPath}.js'`
  })

  if (content !== originalContent) {
    writeFileSync(filePath, content, 'utf-8')
    fixedCount++
    console.log(`✓ Fixed: ${file}`)
  } else {
    skippedCount++
  }
}

console.log(`\n完成！修复了 ${fixedCount} 个文件，跳过 ${skippedCount} 个文件`)
