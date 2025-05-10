/**
 * System Prompt Section 注册表
 *
 * 借鉴 Claude Code 的 Section 注册表设计：
 * - 缓存式 Section：计算一次，会话期间复用
 * - 非缓存式 Section：每轮重新计算（会破坏 Prompt Cache，需谨慎使用）
 *
 * 每个 Section 是一个独立的提示词片段，按优先级和依赖关系组装。
 */

import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from './system-prompt.js'

/**
 * Section 定义
 */
export interface PromptSection {
  /** Section 唯一标识 */
  id: string
  /** 优先级（越小越靠前） */
  priority: number
  /** 内容生成器 */
  content: string | (() => string | Promise<string>)
  /** 缓存策略 */
  cacheScope: 'global' | 'org' | 'session' | null
  /** 是否每轮重新计算 */
  isDynamic: boolean
  /** 依赖的其他 Section ID */
  dependsOn?: string[]
  /** 仅对特定 Agent 类型生效 */
  agentTypes?: string[]
}

/**
 * Section 注册表
 */
class SectionRegistry {
  private sections = new Map<string, PromptSection>()
  private cache = new Map<string, string>()

  /**
   * 注册缓存式 Section
   *
   * @param id Section ID
   * @param config 配置
   */
  register(
    id: string,
    config: Omit<PromptSection, 'id' | 'isDynamic'> & { isDynamic?: boolean }
  ): void {
    this.sections.set(id, {
      id,
      isDynamic: false,
      ...config,
    })
    // 清除该 Section 的缓存（如果存在）
    this.cache.delete(id)
  }

  /**
   * 注册动态 Section（每轮重新计算）
   *
   * 使用此模式必须提供理由，因为会破坏 Prompt Cache。
   */
  registerDynamic(
    id: string,
    reason: string,
    config: Omit<PromptSection, 'id' | 'isDynamic' | 'cacheScope'>
  ): void {
    console.warn(`[SectionRegistry] 注册动态 Section "${id}"，理由: ${reason}`)
    this.sections.set(id, {
      id,
      isDynamic: true,
      cacheScope: null,
      ...config,
    })
  }

  /**
   * 获取 Section 内容（带缓存）
   */
  async resolve(id: string): Promise<string | null> {
    const section = this.sections.get(id)
    if (!section) {
      console.warn(`[SectionRegistry] 未找到 Section: ${id}`)
      return null
    }

    // 动态 Section 不缓存
    if (section.isDynamic) {
      const content =
        typeof section.content === 'function' ? await section.content() : section.content
      return content
    }

    // 检查缓存
    if (this.cache.has(id)) {
      return this.cache.get(id)!
    }

    // 计算并缓存
    const content =
      typeof section.content === 'function' ? await section.content() : section.content

    if (content !== null) {
      this.cache.set(id, content)
    }

    return content
  }

  /**
   * 解析所有 Section，按优先级排序
   *
   * @param options 过滤选项
   * @returns 按优先级排序的 [id, content][] 数组
   */
  async resolveAll(options?: {
    agentType?: string
    includeDynamic?: boolean
  }): Promise<Array<{ id: string; content: string; cacheScope: string | null }>> {
    const results: Array<{ id: string; content: string; cacheScope: string | null }> = []

    // 按优先级排序
    const sorted = Array.from(this.sections.values()).sort((a, b) => a.priority - b.priority)

    for (const section of sorted) {
      // 过滤：Agent 类型匹配
      if (options?.agentType && section.agentTypes) {
        if (!section.agentTypes.includes(options.agentType)) {
          continue
        }
      }

      // 过滤：跳过动态 Section（除非显式包含）
      if (section.isDynamic && !options?.includeDynamic) {
        continue
      }

      const content = await this.resolve(section.id)
      if (content !== null && content !== '') {
        results.push({
          id: section.id,
          content,
          cacheScope: section.cacheScope,
        })
      }
    }

    return results
  }

  /**
   * 清除缓存（用于 /compact 或会话重置后）
   */
  clearCache(): void {
    this.cache.clear()
    console.log('[SectionRegistry] Section 缓存已清除')
  }

  /**
   * 列出所有已注册的 Section ID
   */
  listSections(): string[] {
    return Array.from(this.sections.keys())
  }

  /**
   * 获取 Section 元数据（不包含内容）
   */
  getSectionMeta(id: string): Omit<PromptSection, 'content'> | undefined {
    const section = this.sections.get(id)
    if (!section) return undefined
    const { content: _, ...meta } = section
    return meta
  }
}

/**
 * 全局 Section 注册表实例
 */
export const sectionRegistry = new SectionRegistry()

/**
 * 便捷函数：注册缓存式 Section
 */
export function registerSection(
  id: string,
  priority: number,
  content: string | (() => string | Promise<string>),
  cacheScope: PromptSection['cacheScope'] = 'session',
  options?: { agentTypes?: string[]; dependsOn?: string[] }
): void {
  sectionRegistry.register(id, {
    priority,
    content,
    cacheScope,
    ...options,
  })
}

/**
 * 便捷函数：注册动态 Section
 */
export function registerDynamicSection(
  id: string,
  priority: number,
  content: string | (() => string | Promise<string>),
  reason: string,
  options?: { agentTypes?: string[]; dependsOn?: string[] }
): void {
  sectionRegistry.registerDynamic(id, reason, {
    priority,
    content,
    ...options,
  })
}

/**
 * 注册默认 Prompt Sections
 *
 * 在应用启动时调用一次，注册所有 Agent 共享的默认 Section。
 */
export function registerDefaultPromptSections(): void {
  // 基础规则 Section（静态，全局缓存）
  registerSection(
    'base_rules',
    10,
    `## 基础规则
- 所有技术术语首次出现时附英文对照
- 引用中国专利法条款时必须标注具体条文号（如 A22.3）
- 区分确定性结论与风险评估，不确定性必须明确告知`,
    'global'
  )

  // 输出格式 Section（静态，全局缓存）
  registerSection(
    'output_format',
    20,
    `## 输出格式
- 除非特别说明，所有 LLM 输出必须为严格的 JSON 格式
- JSON 中不得包含 Markdown 代码块标记
- 数值型字段不得使用字符串包裹`,
    'global'
  )

  // 角色引用 Section（动态，会话级）
  // 实际内容由 Agent 定义决定，这里注册占位符
  registerSection(
    'persona',
    5,
    '', // 空内容，由 Agent 定义覆盖
    'session'
  )

  console.log('[SectionRegistry] 默认 Prompt Sections 已注册')
}
