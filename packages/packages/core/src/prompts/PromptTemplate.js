/**
 * 提示词模板系统
 *
 * 核心功能：
 * 1. 模板管理（加载、解析、变量替换）
 * 2. 结构化提示词（角色、任务、约束、输出格式）
 * 3. Few-shot 示例管理（动态选择最优示例）
 * 4. 提示词版本控制（A/B 测试支持）
 *
 * 使用示例：
 * ```typescript
 * const template = new PromptTemplate('writer-outline');
 * const prompt = await template.render({
 *   topic: 'AI 智能体',
 *   style: '技术文档'
 * });
 * ```
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
/**
 * 提示词模板类
 */
export class PromptTemplate {
  templatePath
  templateContent
  metadata
  constructor(templatePath) {
    this.templatePath = templatePath
    this.templateContent = this.loadTemplate(templatePath)
    this.metadata = this.parseMetadata(this.templateContent)
  }
  /**
   * 加载模板文件
   */
  loadTemplate(templatePath) {
    // 支持相对路径和绝对路径
    const fullPath = this.resolveTemplatePath(templatePath)
    if (!existsSync(fullPath)) {
      throw new Error(`模板文件不存在: ${fullPath}`)
    }
    return readFileSync(fullPath, 'utf-8')
  }
  /**
   * 解析模板路径
   */
  resolveTemplatePath(templatePath) {
    // 如果是绝对路径，直接返回
    if (templatePath.startsWith('/')) {
      return templatePath
    }
    // 如果是相对路径，基于当前文件解析
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const templatesDir = join(__dirname, 'templates')
    return join(templatesDir, templatePath)
  }
  /**
   * 解析模板元数据（YAML frontmatter）
   */
  parseMetadata(content) {
    const defaultMetadata = {
      name: this.templatePath,
      version: '1.0.0',
      description: '',
    }
    // 检查是否有 YAML frontmatter
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
    const match = content.match(frontmatterRegex)
    if (!match) {
      // 没有 frontmatter，提取内容作为模板
      this.templateContent = content
      return defaultMetadata
    }
    // 解析 YAML frontmatter
    const frontmatter = match[1]
    this.templateContent = match[2] // 剩余内容作为模板
    try {
      const lines = frontmatter.split('\n')
      const metadata = {}
      for (const line of lines) {
        const colonIndex = line.indexOf(':')
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim()
          const value = line.slice(colonIndex + 1).trim()
          // 处理数组类型
          if (key.startsWith('required') || key.startsWith('optional') || key === 'tags') {
            metadata[key] = value
              .slice(1, -1)
              .split(',')
              .map((v) => v.trim())
          } else {
            metadata[key] = value
          }
        }
      }
      return { ...defaultMetadata, ...metadata }
    } catch (error) {
      // 解析失败，返回默认元数据
      return defaultMetadata
    }
  }
  /**
   * 渲染模板 - 替换变量
   *
   * @param variables 模板变量
   * @param options 渲染选项
   * @returns 渲染后的提示词
   */
  async render(variables, options = {}) {
    let content = this.templateContent
    // 1. 验证变量（如果启用）
    if (options.validateVariables !== false) {
      const validation = this.validateVariables(variables)
      if (!validation.valid) {
        throw new Error(`变量验证失败:\n${validation.errors.join('\n')}`)
      }
    }
    // 2. 替换变量
    content = this.replaceVariables(content, variables)
    // 3. 添加 Few-shot 示例（如果提供）
    if (options.fewShots && options.fewShots.length > 0) {
      const selectedExamples = this.selectFewShots(
        variables.task || '',
        options.fewShots,
        options.fewShotCount || 3
      )
      if (selectedExamples.length > 0) {
        content = this.addFewShots(content, selectedExamples)
      }
    }
    // 注意：PromptOptimizer已删除（压缩功能对专利平台无意义）
    // 如果需要压缩，请使用外部工具或自定义实现
    return content
  }
  /**
   * 替换模板变量
   */
  replaceVariables(content, variables) {
    let result = content
    // 替换 {{variable}} 语法
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
      result = result.replace(regex, String(value))
    }
    // 替换未定义的变量为空字符串（或保留占位符，根据需求）
    result = result.replace(/\{\{[^}]+\}\}/g, '')
    return result
  }
  /**
   * 选择 Few-shot 示例
   *
   * 策略：
   * 1. 基于任务相似度选择
   * 2. 优先选择高分示例
   * 3. 确保多样性
   */
  selectFewShots(task, pool, count = 3) {
    if (pool.length === 0) {
      return []
    }
    // 如果没有任务描述，随机选择
    if (!task) {
      return pool.slice(0, Math.min(count, pool.length))
    }
    // 基于标签匹配
    const taskTags = task.split(/\s+/)
    const scored = pool.map((example) => {
      let score = 0
      // 计算标签匹配分数
      if (example.tags) {
        for (const tag of example.tags) {
          if (taskTags.some((t) => t.includes(tag) || tag.includes(t))) {
            score += 1
          }
        }
      }
      // 使用预设分数（如果有）
      if (example.score !== undefined) {
        score += example.score
      }
      return { ...example, score }
    })
    // 按分数排序并选择前 N 个
    scored.sort((a, b) => (b.score || 0) - (a.score || 0))
    return scored.slice(0, Math.min(count, scored.length))
  }
  /**
   * 添加 Few-shot 示例到提示词
   */
  addFewShots(content, examples) {
    const examplesSection = examples
      .map(
        (example, index) => `### 示例 ${index + 1}\n输入: ${example.input}\n输出: ${example.output}`
      )
      .join('\n\n')
    return `${content}\n\n## Few-shot 示例\n\n${examplesSection}`
  }
  /**
   * 验证模板变量
   */
  validateVariables(variables) {
    const errors = []
    const warnings = []
    // 检查必需变量
    if (this.metadata.requiredVariables) {
      for (const required of this.metadata.requiredVariables) {
        if (!(required in variables)) {
          errors.push(`缺少必需变量: ${required}`)
        }
      }
    }
    // 检查未使用的变量（警告）
    const allRequired = [
      ...(this.metadata.requiredVariables || []),
      ...(this.metadata.optionalVariables || []),
    ]
    for (const key of Object.keys(variables)) {
      if (!allRequired.includes(key)) {
        warnings.push(`未使用的变量: ${key}`)
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }
  /**
   * 验证提示词
   */
  validate(prompt) {
    const errors = []
    const warnings = []
    // 检查是否有未替换的变量
    const unmatchedVariables = prompt.match(/\{\{[^}]+\}\}/g)
    if (unmatchedVariables) {
      warnings.push(`存在未替换的变量: ${unmatchedVariables.join(', ')}`)
    }
    // 检查提示词长度
    if (prompt.length < 10) {
      errors.push('提示词过短')
    }
    if (prompt.length > 10000) {
      warnings.push('提示词过长，可能导致性能问题')
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }
  /**
   * 获取模板版本
   */
  getVersion() {
    return this.metadata.version
  }
  /**
   * 获取模板元数据
   */
  getMetadata() {
    return { ...this.metadata }
  }
  /**
   * 获取原始模板内容
   */
  getRawContent() {
    return this.templateContent
  }
  /**
   * 更新模板版本（用于 A/B 测试）
   */
  updateVersion(version) {
    this.metadata.version = version
  }
}
/**
 * 模板管理器 - 管理多个模板
 */
export class TemplateManager {
  templates = new Map()
  /**
   * 注册模板
   */
  registerTemplate(name, template) {
    this.templates.set(name, template)
  }
  /**
   * 获取模板
   */
  getTemplate(name) {
    return this.templates.get(name)
  }
  /**
   * 加载内置模板
   */
  async loadBuiltinTemplates() {
    const builtinTemplates = [
      'writer-outline.md',
      'writer-chapter.md',
      'researcher-query.md',
      'validator-check.md',
    ]
    for (const templateName of builtinTemplates) {
      try {
        const template = new PromptTemplate(templateName)
        this.registerTemplate(templateName, template)
      } catch (error) {
        console.warn(`无法加载内置模板: ${templateName}`, error)
      }
    }
  }
  /**
   * 列出所有模板
   */
  listTemplates() {
    return Array.from(this.templates.keys())
  }
  /**
   * 获取所有模板的元数据
   */
  getAllMetadata() {
    const result = {}
    for (const [name, template] of this.templates.entries()) {
      result[name] = template.getMetadata()
    }
    return result
  }
}
/**
 * 创建模板实例（工厂函数）
 */
export function createTemplate(templatePath) {
  return new PromptTemplate(templatePath)
}
/**
 * 创建模板管理器（工厂函数）
 */
export function createTemplateManager() {
  return new TemplateManager()
}
//# sourceMappingURL=PromptTemplate.js.map
