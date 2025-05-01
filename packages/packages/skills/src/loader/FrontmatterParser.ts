/**
 * Frontmatter 解析器
 *
 * 负责解析 SKILL.md 文件中的 frontmatter 元数据
 *
 * @package @yunpat/skills
 */

import matter from 'gray-matter'
import type { SkillFrontmatter } from '../types/SkillFrontmatter.js'

/**
 * 标准化 when_to_use 字段
 *
 * YAML 多行字符串会被解析为字符串，需要转换为数组
 *
 * @param value - 原始值（字符串或数组）
 * @returns 标准化后的数组
 */
function normalizeWhenToUse(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  // 如果已经是数组，直接返回
  if (Array.isArray(value)) {
    return value as string[]
  }

  // 如果是字符串，按行分割并清理
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        // 移除 YAML 列表标记 "- "
        if (line.startsWith('- ')) {
          return line.substring(2)
        }
        return line
      })
  }

  // 其他类型，返回 undefined
  return undefined
}

/**
 * 解析 Frontmatter
 *
 * @param content - SKILL.md 文件内容
 * @param filePath - 文件路径（用于错误提示）
 * @returns 解析后的 frontmatter 和 markdown 内容
 */
export function parseFrontmatter(
  content: string,
  filePath: string
): { frontmatter: SkillFrontmatter; content: string } {
  const { data, content: markdownContent } = matter(content)

  // 验证必填字段
  if (!data.name && !data.description) {
    throw new Error(`Skill must have either 'name' or 'description' in frontmatter: ${filePath}`)
  }

  // 标准化字段
  const frontmatter: SkillFrontmatter = {
    // 基本信息
    name: data.name,
    description: data.description || data.name || 'Unnamed skill',
    version: data.version,

    // 可见性控制
    'user-invocable': data['user-invocable'] ?? true,
    hidden: data.hidden ?? false,

    // 使用指导（标准化为数组）
    when_to_use: normalizeWhenToUse(data.when_to_use),

    // 工具限制
    'allowed-tools': data['allowed-tools'],

    // 模型配置
    model: data.model,
    temperature: data.temperature,
    'max-tokens': data['max-tokens'],

    // 条件激活
    paths: data.paths,
    'file-types': data['file-types'],

    // 知识库增强
    knowledge: data.knowledge,

    // 参数定义
    arguments: data.arguments,
    'argument-hint': data['argument-hint'],

    // 执行上下文
    context: data.context,
    agent: data.agent,

    // 努力程度
    effort: data.effort,

    // Hooks
    hooks: data.hooks,

    // Shell 执行
    shell: data.shell,
    'shell-timeout': data['shell-timeout'],
    'allowed-commands': data['allowed-commands'],

    // 其他
    tags: data.tags,
    deprecated: data.deprecated,
    'deprecated-by': data['deprecated-by'],
    'migration-guide': data['migration-guide'],

    // 调试
    debug: data.debug,
    'log-level': data['log-level'],
  }

  return { frontmatter, content: markdownContent }
}

/**
 * 验证 Frontmatter
 *
 * @param frontmatter - frontmatter 对象
 * @returns 验证结果
 */
export function validateFrontmatter(frontmatter: SkillFrontmatter): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // 检查必填字段
  if (!frontmatter.name && !frontmatter.description) {
    errors.push("Either 'name' or 'description' is required")
  }

  // 检查枚举值
  if (frontmatter.context && !['inline', 'fork'].includes(frontmatter.context)) {
    errors.push("Context must be 'inline' or 'fork'")
  }

  if (frontmatter.shell && !['bash', 'node'].includes(frontmatter.shell)) {
    errors.push("Shell must be 'bash' or 'node'")
  }

  if (
    frontmatter.effort &&
    !['low', 'medium', 'high'].includes(frontmatter.effort as string) &&
    typeof frontmatter.effort !== 'number'
  ) {
    errors.push("Effort must be 'low', 'medium', 'high', or a number")
  }

  // 检查数值范围
  if (frontmatter.temperature !== undefined) {
    if (frontmatter.temperature < 0 || frontmatter.temperature > 2) {
      errors.push('Temperature must be between 0 and 2')
    }
  }

  if (frontmatter['max-tokens'] !== undefined) {
    if (frontmatter['max-tokens'] < 1 || frontmatter['max-tokens'] > 200000) {
      errors.push('Max tokens must be between 1 and 200000')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
