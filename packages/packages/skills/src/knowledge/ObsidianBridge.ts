/**
 * Obsidian 知识库桥接器
 *
 * 连接并读取 Obsidian vault，解析 Markdown 文件
 *
 * @package @yunpat/skills
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, extname } from 'path'
import matter from 'gray-matter'
import type { KnowledgeConfig, KnowledgeEntry, WikiLink, Tag } from './types.js'
import { KnowledgeEntryType } from './types.js'

/**
 * Obsidian 知识库桥接器
 */
export class ObsidianBridge {
  private config: KnowledgeConfig
  private cache: Map<string, KnowledgeEntry>

  constructor(config: KnowledgeConfig) {
    this.config = config
    this.cache = new Map()
  }

  /**
   * 读取所有 Markdown 文件
   *
   * @returns 知识条目数组
   */
  readAllEntries(): KnowledgeEntry[] {
    const entries: KnowledgeEntry[] = []
    const files = this.findMarkdownFiles(this.config.vaultPath)

    for (const file of files) {
      const entry = this.readFile(file)
      if (entry) {
        entries.push(entry)
      }
    }

    return entries
  }

  /**
   * 读取单个文件
   *
   * @param filePath - 文件路径（相对于 vault）
   * @returns 知识条目或 null
   */
  readFile(filePath: string): KnowledgeEntry | null {
    const fullPath = join(this.config.vaultPath, filePath)

    try {
      const content = readFileSync(fullPath, 'utf-8')
      const { data, content: markdownContent } = matter(content)

      // 解析 WikiLinks 和 Tags
      const links = this.extractWikiLinks(markdownContent)
      const tags = this.extractTags(markdownContent)

      // 确定条目类型
      const type = this.determineEntryType(filePath, tags, data)

      const entry: KnowledgeEntry = {
        type,
        title: data.title || this.extractTitle(markdownContent),
        content: markdownContent,
        path: filePath,
        metadata: {
          tags: tags.map((t) => t.text),
          links: links.map((l) => l.target),
          created: data.created ? new Date(data.created as string) : undefined,
          modified: data.modified ? new Date(data.modified as string) : statSync(fullPath).mtime,
          ...data,
        },
      }

      return entry
    } catch (error) {
      console.warn(`[ObsidianBridge] Failed to read file: ${filePath}`, error)
      return null
    }
  }

  /**
   * 查找所有 Markdown 文件
   *
   * @param dir - 目录路径
   * @returns 文件路径数组（相对于 vault）
   */
  private findMarkdownFiles(dir: string): string[] {
    const files: string[] = []

    try {
      const entries = readdirSync(dir)

      for (const entry of entries) {
        const fullPath = join(dir, entry)
        const stat = statSync(fullPath)

        if (stat.isDirectory()) {
          // 递归查找子目录
          files.push(...this.findMarkdownFiles(fullPath))
        } else if (stat.isFile() && extname(entry) === '.md') {
          // 相对于 vault 的路径
          files.push(relative(this.config.vaultPath, fullPath))
        }
      }
    } catch (error) {
      console.warn(`[ObsidianBridge] Failed to read directory: ${dir}`, error)
    }

    return files
  }

  /**
   * 提取 WikiLinks
   *
   * @param content - Markdown 内容
   * @returns WikiLink 数组
   */
  private extractWikiLinks(content: string): WikiLink[] {
    const links: WikiLink[] = []
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g

    let match
    let line = 1
    let col = 1

    while ((match = wikiLinkRegex.exec(content)) !== null) {
      const [fullMatch, linkText] = match

      // 计算位置
      const textBefore = content.substring(0, match.index)
      const lines = textBefore.split('\n')
      line = lines.length
      col = lines[lines.length - 1].length + 1

      // 解析链接
      const [target, alias] = linkText.split('|')
      links.push({
        text: alias || target,
        target: target.trim(),
        external: target.startsWith('http'),
        position: { line, column: col },
      })
    }

    return links
  }

  /**
   * 提取 Tags
   *
   * @param content - Markdown 内容
   * @returns Tag 数组
   */
  private extractTags(content: string): Tag[] {
    const tags: Tag[] = []
    const tagRegex = /#([a-zA-Z一-龥][a-zA-Z0-9一-龥_/]*)/g

    let match
    let line = 1
    let col = 1

    while ((match = tagRegex.exec(content)) !== null) {
      const [fullMatch, tagText] = match

      // 计算位置
      const textBefore = content.substring(0, match.index)
      const lines = textBefore.split('\n')
      line = lines.length
      col = lines[lines.length - 1].length + 1

      // 计算嵌套层级
      const nesting = (tagText.match(/\//g) || []).length

      tags.push({
        text: fullMatch,
        nesting,
        position: { line, column: col },
      })
    }

    return tags
  }

  /**
   * 提取标题
   *
   * @param content - Markdown 内容
   * @returns 标题或空字符串
   */
  private extractTitle(content: string): string {
    // 尝试提取第一个 # 标题
    const titleMatch = content.match(/^#\s+(.+)$/m)
    if (titleMatch) {
      return titleMatch[1].trim()
    }

    // 尝试提取第一行
    const firstLine = content.split('\n')[0].trim()
    if (firstLine && !firstLine.startsWith('---')) {
      return firstLine.substring(0, 50) // 限制长度
    }

    return 'Untitled'
  }

  /**
   * 确定条目类型
   *
   * @param filePath - 文件路径
   * @param tags - 标签数组
   * @param metadata - YAML 元数据
   * @returns 条目类型
   */
  private determineEntryType(
    filePath: string,
    tags: Tag[],
    metadata: Record<string, unknown>
  ): KnowledgeEntryType {
    // 从元数据判断
    if (metadata.type === 'concept') return KnowledgeEntryType.CONCEPT
    if (metadata.type === 'card') return KnowledgeEntryType.CARD

    // 从标签判断
    const tagTexts = tags.map((t) => t.text.toLowerCase())
    if (tagTexts.some((t) => t.includes('#概念') || t.includes('#concept'))) {
      return KnowledgeEntryType.CONCEPT
    }
    if (tagTexts.some((t) => t.includes('#卡片') || t.includes('#card'))) {
      return KnowledgeEntryType.CARD
    }

    // 从路径判断
    if (filePath.includes('概念') || filePath.includes('concepts')) {
      return KnowledgeEntryType.CONCEPT
    }
    if (filePath.includes('卡片') || filePath.includes('cards')) {
      return KnowledgeEntryType.CARD
    }

    // 默认为 Wiki 页面
    return KnowledgeEntryType.WIKI
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear()
  }
}
