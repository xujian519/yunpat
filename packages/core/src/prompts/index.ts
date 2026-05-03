/**
 * 提示词模板系统
 *
 * 提供结构化的提示词模板管理功能，包括：
 * - 模板加载和渲染
 * - 变量替换
 * - Few-shot 示例管理
 * - 版本控制
 */

export {
  PromptTemplate,
  TemplateManager,
  createTemplate,
  createTemplateManager,
} from './PromptTemplate.js'

export type {
  FewShotExample,
  TemplateVariables,
  TemplateMetadata,
  ValidationResult,
  RenderOptions,
} from './PromptTemplate.js'
