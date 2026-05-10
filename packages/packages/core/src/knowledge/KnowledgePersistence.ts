/**
 * 知识库持久化模块
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import type { KnowledgeEntry } from './KnowledgeTypes.js'

/**
 * 保存到磁盘
 */
export async function saveToDisk(
  storagePath: string,
  name: string,
  description: string | undefined,
  entries: Map<string, KnowledgeEntry>
): Promise<void> {
  const data = {
    version: 1,
    name,
    description,
    entries: Array.from(entries.values()),
    savedAt: new Date().toISOString(),
  }

  await fs.mkdir(path.dirname(storagePath), { recursive: true })
  await fs.writeFile(storagePath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 从磁盘加载
 */
export async function loadFromDisk(storagePath: string): Promise<KnowledgeEntry[]> {
  try {
    const content = await fs.readFile(storagePath, 'utf-8')
    const data = JSON.parse(content)

    const entries = data.entries as KnowledgeEntry[]
    for (const entry of entries) {
      entry.createdAt = new Date(entry.createdAt)
      entry.updatedAt = new Date(entry.updatedAt)
    }
    return entries
  } catch {
    return []
  }
}

/**
 * 生成条目 ID
 */
export function generateId(title: string, category: string): string {
  const normalized = `${category}:${title}`.toLowerCase().replace(/\s+/g, '-')
  const hash = simpleHash(normalized)
  return `${normalized}-${hash.slice(0, 8)}`
}

/**
 * 简单哈希函数
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}
