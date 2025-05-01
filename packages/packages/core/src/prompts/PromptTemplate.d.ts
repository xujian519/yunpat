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
/**
 * Few-shot 示例
 */
export interface FewShotExample {
  /** 输入 */
  input: string
  /** 输出 */
  output: string
  /** 示例标签（用于选择） */
  tags?: string[]
  /** 相似度分数（用于排序） */
  score?: number
}
/**
 * 模板变量
 */
export type TemplateVariables = Record<string, unknown>
/**
 * 模板元数据
 */
export interface TemplateMetadata {
  /** 模板名称 */
  name: string
  /** 模板版本 */
  version: string
  /** 模板描述 */
  description: string
  /** 作者 */
  author?: string
  /** 创建时间 */
  createdAt?: string
  /** 更新时间 */
  updatedAt?: string
  /** 标签 */
  tags?: string[]
  /** 所需变量 */
  requiredVariables?: string[]
  /** 可选变量 */
  optionalVariables?: string[]
}
/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean
  /** 错误信息 */
  errors: string[]
  /** 警告信息 */
  warnings: string[]
}
/**
 * 模板渲染选项
 */
export interface RenderOptions {
  /** 是否启用变量验证 */
  validateVariables?: boolean
  /** Few-shot 示例池 */
  fewShots?: FewShotExample[]
  /** 选择的示例数量 */
  fewShotCount?: number
}
/**
 * 提示词模板类
 */
export declare class PromptTemplate {
  private templatePath
  private templateContent
  private metadata
  constructor(templatePath: string)
  /**
   * 加载模板文件
   */
  private loadTemplate
  /**
   * 解析模板路径
   */
  private resolveTemplatePath
  /**
   * 解析模板元数据（YAML frontmatter）
   */
  private parseMetadata
  /**
   * 渲染模板 - 替换变量
   *
   * @param variables 模板变量
   * @param options 渲染选项
   * @returns 渲染后的提示词
   */
  render(variables: TemplateVariables, options?: RenderOptions): Promise<string>
  /**
   * 替换模板变量
   */
  private replaceVariables
  /**
   * 选择 Few-shot 示例
   *
   * 策略：
   * 1. 基于任务相似度选择
   * 2. 优先选择高分示例
   * 3. 确保多样性
   */
  selectFewShots(task: string, pool: FewShotExample[], count?: number): FewShotExample[]
  /**
   * 添加 Few-shot 示例到提示词
   */
  private addFewShots
  /**
   * 验证模板变量
   */
  validateVariables(variables: TemplateVariables): ValidationResult
  /**
   * 验证提示词
   */
  validate(prompt: string): ValidationResult
  /**
   * 获取模板版本
   */
  getVersion(): string
  /**
   * 获取模板元数据
   */
  getMetadata(): TemplateMetadata
  /**
   * 获取原始模板内容
   */
  getRawContent(): string
  /**
   * 更新模板版本（用于 A/B 测试）
   */
  updateVersion(version: string): void
}
/**
 * 模板管理器 - 管理多个模板
 */
export declare class TemplateManager {
  private templates
  /**
   * 注册模板
   */
  registerTemplate(name: string, template: PromptTemplate): void
  /**
   * 获取模板
   */
  getTemplate(name: string): PromptTemplate | undefined
  /**
   * 加载内置模板
   */
  loadBuiltinTemplates(): Promise<void>
  /**
   * 列出所有模板
   */
  listTemplates(): string[]
  /**
   * 获取所有模板的元数据
   */
  getAllMetadata(): Record<string, TemplateMetadata>
}
/**
 * 创建模板实例（工厂函数）
 */
export declare function createTemplate(templatePath: string): PromptTemplate
/**
 * 创建模板管理器（工厂函数）
 */
export declare function createTemplateManager(): TemplateManager
//# sourceMappingURL=PromptTemplate.d.ts.map
