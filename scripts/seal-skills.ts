#!/usr/bin/env npx tsx
/**
 * 提示词加密工具
 *
 * 用法：
 *   pnpm skills:keygen                    # 生成新密钥
 *   pnpm skills:seal                      # 加密 .yunpat/skills/patent-drafting/claims-*.md
 *   pnpm skills:seal --key <hex64>        # 指定密钥
 *   pnpm skills:seal --output ./sealed    # 指定输出目录
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, join, basename } from 'node:path'
import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import { sealContent } from '../packages/packages/core/src/skills/SecureContentProvider.js'

// 解析命令行参数
const args = process.argv.slice(2)

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`)
}

// 核心文件列表
const CORE_SKILLS = [
  'claims-core.md',
  'claims-essential-features.md',
  'claims-judicial.md',
  'claims-law-profile.md',
  'claims-domain-mechanical.md',
  'claims-domain-electrical.md',
  'claims-domain-chemical.md',
  'claims-domain-computer.md',
]

/** 生成密钥 */
function generateKey(): string {
  return randomBytes(32).toString('hex')
}

/** 获取密钥：命令行 > 环境变量 > 密钥文件 */
function getKey(): string {
  const keyArg = getArg('key')
  if (keyArg) {
    if (!/^[0-9a-f]{64}$/i.test(keyArg)) {
      console.error('❌ 密钥格式错误：需要 64 字符 hex 字符串')
      process.exit(1)
    }
    return keyArg
  }

  const envKey = process.env.YUNPAT_SKILLS_KEY
  if (envKey && /^[0-9a-f]{64}$/i.test(envKey)) return envKey

  const keyFile = join(homedir(), '.yunpat', '.skills-key')
  if (existsSync(keyFile)) {
    const fileKey = readFileSync(keyFile, 'utf-8').trim()
    if (/^[0-9a-f]{64}$/i.test(fileKey)) return fileKey
  }

  console.error('❌ 未找到密钥。使用 --key 参数、YUNPAT_SKILLS_KEY 环境变量、或运行 pnpm skills:keygen')
  process.exit(1)
}

/** 加密核心技能文件 */
function sealSkills(): void {
  const sourceDir = getArg('source-dir') || resolve(process.cwd(), 'packages', '.yunpat', 'skills', 'patent-drafting')
  const outputDir = getArg('output') || join(homedir(), '.yunpat', 'sealed-skills', 'patent-drafting')

  if (!existsSync(sourceDir)) {
    console.error(`❌ 源目录不存在: ${sourceDir}`)
    process.exit(1)
  }

  // 确保输出目录存在
  mkdirSync(outputDir, { recursive: true })

  const key = getKey()
  console.log(`📦 加密提示词文件...`)
  console.log(`   源目录: ${sourceDir}`)
  console.log(`   输出目录: ${outputDir}`)
  console.log(`   密钥状态: ✅`)
  console.log()

  let sealed = 0
  let skipped = 0

  for (const filename of CORE_SKILLS) {
    const sourcePath = resolve(sourceDir, filename)
    if (!existsSync(sourcePath)) {
      console.log(`   ⏭️  跳过（不存在）: ${filename}`)
      skipped++
      continue
    }

    const content = readFileSync(sourcePath, 'utf-8')
    const skillPath = `patent-drafting/${basename(filename, '.md')}`

    const sealedFile = sealContent({
      content,
      originalPath: skillPath,
      masterKey: key,
    })

    const outputPath = resolve(outputDir, `${basename(filename, '.md')}.sealed`)
    writeFileSync(outputPath, JSON.stringify(sealedFile, null, 2))

    console.log(`   🔒 ${filename} → ${basename(filename, '.md')}.sealed (${(content.length / 1024).toFixed(1)}KB)`)
    sealed++
  }

  console.log()
  console.log(`✅ 完成：${sealed} 个文件已加密${skipped > 0 ? `，${skipped} 个跳过` : ''}`)
}

// ========== 主入口 ==========

if (hasFlag('generate-key') || hasFlag('keygen')) {
  const key = generateKey()
  console.log(key)
} else {
  sealSkills()
}
