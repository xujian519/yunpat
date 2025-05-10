/**
 * Agent 定义解析器
 *
 * 支持 Markdown + YAML Frontmatter 格式的 Agent 定义文件。
 *
 * 借鉴 Claude Code 的 Agent Definition 设计：
 * - name: Agent 类型名
 * - description: 使用场景说明
 * - tools: 允许的工具集合
 * - model: 默认模型
 * - permissionMode: 权限模式
 * - maxTurns: 最大轮次
 * - memory: 记忆作用域
 *
 * Frontmatter 示例：
 * ```md
 * ---
 * name: claim-generator
 * description: 基于发明理解生成结构化权利要求
 * tools:
 *   - LLMChat
 *   - TemplateLoader
 * model: sonnet
 * maxTurns: 8
 * ---
 *
 * # 角色
 * {{persona:SENIOR_PATENT_AGENT}}
 *
 * # 任务
 * ...
 * ```
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { renderPersonaRefs } from './persona-library.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Agent 定义（Frontmatter 解析结果）
 */
export interface AgentDefinition {
  /** Agent 类型名 */
  name: string
  /** 使用场景说明 */
  description: string
  /** 允许的工具集合 */
  tools: string[]
  /** 禁用工具集合 */
  disallowedTools?: string[]
  /** 默认模型 */
  model?: string
  /** 推理努力级别 */
  effort?: string | number
  /** 权限模式 */
  permissionMode?: string
  /** 是否总是后台运行 */
  background?: boolean
  /** 隔离模式 */
  isolation?: 'worktree' | 'remote'
  /** 最大轮次 */
  maxTurns?: number
  /** 记忆作用域 */
  memory?: 'user' | 'project' | 'local'
  /** 预加载技能 */
  skills?: string[]
  /** 系统提示词主体（frontmatter 后的 markdown 内容） */
  systemPrompt: string
  /** 初始用户消息（可选） */
  initialPrompt?: string
  /** 文件来源路径 */
  sourcePath?: string
}

/**
 * 解析 Agent 定义文件
 */
export function parseAgentDefinition(filePath: string): AgentDefinition {
  if (!existsSync(filePath)) {
    throw new Error(`Agent 定义文件不存在: ${filePath}`)
  }

  const content = readFileSync(filePath, 'utf-8')
  return parseAgentDefinitionContent(content, filePath)
}

/**
 * 从文本内容解析 Agent 定义
 */
export function parseAgentDefinitionContent(content: string, sourcePath?: string): AgentDefinition {
  // 解析 YAML frontmatter
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    throw new Error('Agent 定义文件缺少 YAML frontmatter（必须以 --- 开头）')
  }

  const frontmatter = parseYamlFrontmatter(match[1])
  const markdownBody = match[2].trim()

  // 渲染 persona 引用
  const renderedPrompt = renderPersonaRefs(markdownBody)

  return {
    name: String(frontmatter.name),
    description: String(frontmatter.description || ''),
    tools: parseStringArray(frontmatter.tools),
    disallowedTools: parseStringArray(frontmatter.disallowedTools),
    model: frontmatter.model ? String(frontmatter.model) : undefined,
    effort: frontmatter.effort as string | number | undefined,
    permissionMode: frontmatter.permissionMode ? String(frontmatter.permissionMode) : undefined,
    background: frontmatter.background === true || frontmatter.background === 'true',
    isolation: frontmatter.isolation as 'worktree' | 'remote' | undefined,
    maxTurns: frontmatter.maxTurns ? parseInt(String(frontmatter.maxTurns), 10) : undefined,
    memory: frontmatter.memory as 'user' | 'project' | 'local' | undefined,
    skills: parseStringArray(frontmatter.skills),
    systemPrompt: renderedPrompt,
    initialPrompt: frontmatter.initialPrompt ? String(frontmatter.initialPrompt) : undefined,
    sourcePath,
  }
}

/**
 * 解析 YAML frontmatter（简化版，支持基本类型）
 */
function parseYamlFrontmatter(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.split('\n')
  let currentKey: string | null = null
  let currentArray: string[] = []
  let inArray = false

  for (const line of lines) {
    const trimmed = line.trim()

    // 空行结束数组
    if (trimmed === '' && inArray) {
      if (currentKey) {
        result[currentKey] = currentArray
      }
      inArray = false
      currentArray = []
      currentKey = null
      continue
    }

    // 数组元素：以 - 开头
    if (trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).trim()
      currentArray.push(value)
      inArray = true
      continue
    }

    // 键值对
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex > 0) {
      // 先保存之前的数组
      if (inArray && currentKey) {
        result[currentKey] = currentArray
        inArray = false
        currentArray = []
      }

      currentKey = trimmed.slice(0, colonIndex).trim()
      const value = trimmed.slice(colonIndex + 1).trim()

      // 布尔值
      if (value === 'true') {
        result[currentKey] = true
      } else if (value === 'false') {
        result[currentKey] = false
      } else if (value === '') {
        // 可能是数组的开始，等待下一行
        inArray = true
        currentArray = []
      } else {
        // 数字
        const num = Number(value)
        if (!isNaN(num) && String(num) === value) {
          result[currentKey] = num
        } else {
          result[currentKey] = value
        }
      }
    }
  }

  // 处理末尾的数组
  if (inArray && currentKey) {
    result[currentKey] = currentArray
  }

  return result
}

/**
 * 解析字符串数组（支持逗号分隔或 YAML 数组）
 */
function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v))
  }
  if (typeof value === 'string') {
    return value.split(',').map((v) => v.trim())
  }
  return []
}

/**
 * Agent 定义加载器
 */
export class AgentDefinitionLoader {
  private definitions = new Map<string, AgentDefinition>()
  private definitionsDir: string

  constructor(definitionsDir?: string) {
    this.definitionsDir =
      definitionsDir || join(__dirname, '..', '..', '..', 'agents', 'definitions')
  }

  /**
   * 加载所有 Agent 定义
   */
  async loadAll(): Promise<Map<string, AgentDefinition>> {
    if (!existsSync(this.definitionsDir)) {
      console.warn(`[AgentDefinitionLoader] 定义目录不存在: ${this.definitionsDir}`)
      return this.definitions
    }

    const files = readdirSync(this.definitionsDir).filter((f) => f.endsWith('.md'))

    for (const file of files) {
      try {
        const def = parseAgentDefinition(join(this.definitionsDir, file))
        this.definitions.set(def.name, def)
      } catch (error) {
        console.warn(`[AgentDefinitionLoader] 加载失败 ${file}:`, error)
      }
    }

    console.log(`[AgentDefinitionLoader] 已加载 ${this.definitions.size} 个 Agent 定义`)
    return this.definitions
  }

  /**
   * 获取指定 Agent 定义
   */
  get(name: string): AgentDefinition | undefined {
    return this.definitions.get(name)
  }

  /**
   * 列出所有已加载的 Agent 名称
   */
  list(): string[] {
    return Array.from(this.definitions.keys())
  }

  /**
   * 热重载单个 Agent 定义
   */
  reload(name: string): AgentDefinition | undefined {
    const filePath = join(this.definitionsDir, `${name}.md`)
    if (!existsSync(filePath)) {
      console.warn(`[AgentDefinitionLoader] 文件不存在: ${filePath}`)
      return undefined
    }

    try {
      const def = parseAgentDefinition(filePath)
      this.definitions.set(def.name, def)
      console.log(`[AgentDefinitionLoader] 已热重载: ${name}`)
      return def
    } catch (error) {
      console.error(`[AgentDefinitionLoader] 热重载失败 ${name}:`, error)
      return undefined
    }
  }
}

/**
 * 全局 Agent 定义加载器实例
 */
export const agentDefinitionLoader = new AgentDefinitionLoader()
