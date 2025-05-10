/**
 * Prompt 组装管道（Prompt Assembly Pipeline）
 *
 * 借鉴 Claude Code 的三阶段管道设计：
 * 1. getSystemPrompt()          → string[]       （组装内容）
 * 2. buildEffectiveSystemPrompt() → SystemPrompt   （选择优先级路径）
 * 3. buildSystemPromptBlocks()  → TextBlockParam[] （分块 + cache_control 标记）
 *
 * 五级优先级覆盖：
 * 0. Override（完全替换）
 * 1. Coordinator（协调者模式）
 * 2. Agent（Agent 定义 frontmatter）
 * 3. Custom（用户自定义）
 * 4. Default（默认组装）
 */

import {
  SystemPrompt,
  asSystemPrompt,
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
  splitByDynamicBoundary,
} from './system-prompt.js'
import { sectionRegistry, type PromptSection } from './section-registry.js'
import { renderPersonaRefs } from './persona-library.js'

/**
 * Prompt 配置
 */
export interface PromptConfig {
  /** Agent 类型标识 */
  agentType: string
  /** 完全覆盖的系统提示词（优先级 0） */
  overrideSystemPrompt?: SystemPrompt
  /** 附加到末尾的系统提示词 */
  appendSystemPrompt?: string
  /** 协调者模式提示词（优先级 1） */
  coordinatorPrompt?: SystemPrompt
  /** Agent 定义中的提示词（优先级 2） */
  agentDefinitionPrompt?: string
  /** 用户自定义提示词（优先级 3） */
  customPrompt?: string
  /** 是否包含动态 Section */
  includeDynamicSections?: boolean
}

/**
 * 组装管道
 */
export class PromptAssemblyPipeline {
  /** 实例级临时 Sections（每次 assemble 后自动清除） */
  private tempSections: PromptSection[] = []

  /**
   * 注册实例级 Section（临时，仅本次组装有效）
   */
  registerSection(section: PromptSection): void {
    this.tempSections.push(section)
  }

  /**
   * 清除实例级临时 Sections
   */
  clearTempSections(): void {
    this.tempSections = []
  }

  /**
   * 主入口：组装 System Prompt
   *
   * 按五级优先级选择最终使用的 System Prompt。
   */
  async assemble(config: PromptConfig): Promise<SystemPrompt> {
    // 优先级 0：完全覆盖
    if (config.overrideSystemPrompt) {
      return this.appendIfNeeded(config.overrideSystemPrompt, config.appendSystemPrompt)
    }

    // 优先级 1：协调者模式
    if (config.coordinatorPrompt) {
      return this.appendIfNeeded(config.coordinatorPrompt, config.appendSystemPrompt)
    }

    // 优先级 2：Agent 定义
    if (config.agentDefinitionPrompt) {
      const base = await this.buildDefaultPrompt(config)
      const agentPrompt = asSystemPrompt([config.agentDefinitionPrompt])
      return this.mergePrompts(base, agentPrompt, config.appendSystemPrompt)
    }

    // 优先级 3：用户自定义
    if (config.customPrompt) {
      const base = await this.buildDefaultPrompt(config)
      const custom = asSystemPrompt([config.customPrompt])
      return this.mergePrompts(base, custom, config.appendSystemPrompt)
    }

    // 优先级 4：默认组装
    const defaultPrompt = await this.buildDefaultPrompt(config)
    return this.appendIfNeeded(defaultPrompt, config.appendSystemPrompt)
  }

  /**
   * 构建默认 System Prompt
   *
   * 从 Section 注册表组装静态区 + 动态区。
   */
  private async buildDefaultPrompt(config: PromptConfig): Promise<SystemPrompt> {
    // 合并全局 sections 和实例级临时 sections
    const globalSections = await sectionRegistry.resolveAll({
      agentType: config.agentType,
      includeDynamic: config.includeDynamicSections ?? true,
    })

    // 将临时 sections 加入列表（解析异步 content）
    const tempResolved: Array<{ id: string; content: string; cacheScope: string | null }> = []
    for (const s of this.tempSections) {
      if (s.agentTypes && !s.agentTypes.includes(config.agentType)) continue
      const content = typeof s.content === 'function' ? await s.content() : s.content
      if (content !== null && content !== '') {
        tempResolved.push({ id: s.id, content, cacheScope: s.cacheScope })
      }
    }

    const sections = [...globalSections, ...tempResolved].sort((a, b) => {
      // 按原始 section 的 priority 排序
      const aPriority =
        this.tempSections.find((s) => s.id === a.id)?.priority ??
        sectionRegistry.getSectionMeta(a.id)?.priority ??
        50
      const bPriority =
        this.tempSections.find((s) => s.id === b.id)?.priority ??
        sectionRegistry.getSectionMeta(b.id)?.priority ??
        50
      return aPriority - bPriority
    })

    // 分离静态区和动态区
    const staticParts: string[] = []
    const dynamicParts: string[] = []

    for (const section of sections) {
      const rendered = renderPersonaRefs(section.content)
      if (section.cacheScope === 'global' || section.cacheScope === 'org') {
        staticParts.push(rendered)
      } else {
        dynamicParts.push(rendered)
      }
    }

    // 组装：静态区 + 分界标记 + 动态区
    const parts: string[] = []
    if (staticParts.length > 0) {
      parts.push(...staticParts)
    }
    if (dynamicParts.length > 0) {
      parts.push(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
      parts.push(...dynamicParts)
    }

    return asSystemPrompt(parts)
  }

  /**
   * 合并两个 Prompt（基础 + 覆盖）
   */
  private mergePrompts(base: SystemPrompt, overlay: SystemPrompt, append?: string): SystemPrompt {
    const merged = [...base, ...overlay]
    if (append) {
      merged.push(append)
    }
    return asSystemPrompt(merged)
  }

  /**
   * 附加额外提示词（如果存在）
   */
  private appendIfNeeded(prompt: SystemPrompt, append?: string): SystemPrompt {
    if (!append) return prompt
    return asSystemPrompt([...prompt, append])
  }

  /**
   * 将 System Prompt 转换为 API 可用的分块结构
   *
   * 静态区标记为全局缓存，动态区不缓存或会话缓存。
   */
  buildBlocks(prompt: SystemPrompt): Array<{
    text: string
    cacheScope?: 'global' | 'org' | 'session' | null
  }> {
    const [staticParts, dynamicParts] = splitByDynamicBoundary(prompt)

    const blocks: Array<{ text: string; cacheScope?: 'global' | 'org' | 'session' | null }> = []

    // 静态区：每个块标记全局缓存
    for (const part of staticParts) {
      if (part.trim()) {
        blocks.push({ text: part, cacheScope: 'global' })
      }
    }

    // 动态区：不缓存或会话级缓存
    for (const part of dynamicParts) {
      if (part.trim()) {
        blocks.push({ text: part, cacheScope: 'session' })
      }
    }

    return blocks
  }

  /**
   * 计算 Prompt 的预估 token 数
   *
   * 简单估算：中文字符约占 1.5 tokens，英文单词约占 1.3 tokens。
   */
  estimateTokens(prompt: SystemPrompt): number {
    const text = prompt.join('\n')
    let tokens = 0
    for (const char of text) {
      if (/[\u4e00-\u9fff]/.test(char)) {
        tokens += 1.5
      } else if (/[a-zA-Z]/.test(char)) {
        tokens += 0.3 // 字母，按单词平均估算
      } else {
        tokens += 0.5 // 数字、符号等
      }
    }
    return Math.round(tokens)
  }
}

/**
 * 全局组装管道实例
 */
export const promptPipeline = new PromptAssemblyPipeline()
