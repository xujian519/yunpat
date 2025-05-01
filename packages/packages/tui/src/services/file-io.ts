/**
 * @file 文件 I/O 服务
 * @description 处理技术交底书读取、输出文件写入、工作区扫描
 */

import { promises as fs } from 'fs'
import path from 'path'

/**
 * 支持的交底书文件扩展名
 */
const DISCLOSURE_EXTENSIONS = new Set(['.txt', '.md', '.docx', '.pdf', '.rtf'])

/**
 * 专利相关文件名关键词（用于工作区扫描）
 */
const PATENT_KEYWORDS = [
  '交底书',
  '审查意见',
  '权利要求',
  '说明书',
  '摘要',
  'disclosure',
  'office-action',
  'claims',
  'specification',
  'abstract',
  'patent',
  '申请',
  '答复',
]

/**
 * 读取交底书文件内容
 *
 * 目前支持纯文本文件（.txt, .md）。
 * PDF/DOCX 等格式需要额外的解析库，此处返回提示信息。
 */
export async function readDisclosureFile(filePath: string): Promise<string> {
  const resolved = path.resolve(filePath)

  try {
    const stat = await fs.stat(resolved)
    if (!stat.isFile()) {
      throw new Error(`路径不是文件: ${resolved}`)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`文件不存在: ${resolved}`)
    }
    throw error
  }

  const ext = path.extname(resolved).toLowerCase()

  // 纯文本格式直接读取
  if (ext === '.txt' || ext === '.md' || ext === '.rtf') {
    return fs.readFile(resolved, 'utf-8')
  }

  // 需要额外解析的格式
  if (ext === '.pdf') {
    throw new Error(
      `PDF 文件需要使用解析工具处理: ${resolved}\n` +
        '请先使用 /oa --file 命令或独立的 PDF 解析工具提取文本。'
    )
  }

  if (ext === '.docx') {
    throw new Error(
      `DOCX 文件暂不支持直接读取: ${resolved}\n` + '请将文件另存为 .txt 或 .md 格式后重试。'
    )
  }

  // 尝试作为文本读取其他格式
  try {
    return await fs.readFile(resolved, 'utf-8')
  } catch {
    throw new Error(`不支持的文件格式: ${ext}`)
  }
}

/**
 * 将内容写入输出文件
 */
export async function writeOutputFile(filePath: string, content: string): Promise<void> {
  const resolved = path.resolve(filePath)
  const dir = path.dirname(resolved)

  // 确保目录存在
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(resolved, content, 'utf-8')
}

/**
 * 扫描工作区目录，检测专利相关文件
 */
export async function scanWorkspace(
  dir: string
): Promise<{ files: string[]; directories: string[] }> {
  const resolved = path.resolve(dir)

  try {
    await fs.access(resolved)
  } catch {
    throw new Error(`目录不存在: ${resolved}`)
  }

  const files: string[] = []
  const directories: string[] = []

  async function walk(currentDir: string, depth: number): Promise<void> {
    // 限制递归深度
    if (depth > 3) return

    const entries = await fs.readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      // 跳过 node_modules 和隐藏目录
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const fullPath = path.join(currentDir, entry.name)
      const relativePath = path.relative(resolved, fullPath)

      if (entry.isDirectory()) {
        directories.push(relativePath)
        await walk(fullPath, depth + 1)
      } else if (entry.isFile()) {
        // 检测专利相关文件
        const ext = path.extname(entry.name).toLowerCase()
        const nameLower = entry.name.toLowerCase()
        const isPatentRelated =
          DISCLOSURE_EXTENSIONS.has(ext) &&
          PATENT_KEYWORDS.some((kw) => nameLower.includes(kw.toLowerCase()))

        if (isPatentRelated || ext === '.pdf') {
          files.push(relativePath)
        }
      }
    }
  }

  await walk(resolved, 0)
  return { files, directories }
}
