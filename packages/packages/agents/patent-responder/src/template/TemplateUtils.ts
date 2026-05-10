import type { ResponseTemplate } from '../types/index.js'
import type { TemplateVariable } from './ResponseTemplateManager.js'

/** 模板变量的常见默认值 */
const COMMON_DEFAULTS: Record<string, string> = {
  applicationNumber: '申请号',
  patentTitle: '专利名称',
  notificationDate: '审查通知日期',
  responseDate: new Date().toLocaleDateString('zh-CN'),
  claimNumbers: '1, 2',
  claimNumber: '1',
  referenceNumber: 'D1',
  referenceContent: '对比文件内容',
  distinguishingFeatures: '区别技术特征',
  technicalEffect: '技术效果',
  technicalProblem: '技术问题',
  technicalObstacle: '技术障碍',
  unexpectedEffects: '预料不到的技术效果',
  section: '说明书第X段',
  originalText: '原始权利要求文本',
  amendedText: '修改后的权利要求文本',
  addedFeature: '添加的特征',
  limitedAspect: '限定的方面',
}

/**
 * 替换模板变量
 */
export function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{${key}\\}`, 'g')
    result = result.replace(placeholder, value || `{${key}}`)
  }

  return result
}

/**
 * 获取模板的所有必需变量
 */
export function getRequiredVariables(template: ResponseTemplate): string[] {
  const allPlaceholders = new Set<string>()

  if (template.content.opening) {
    const matches = template.content.opening.matchAll(/\{([^}]+)\}/g)
    for (const match of matches) {
      allPlaceholders.add(match[1])
    }
  }

  for (const argTemplate of template.content.argumentTemplates) {
    if (argTemplate.placeholders) {
      argTemplate.placeholders.forEach((p) => allPlaceholders.add(p))
    }
    const matches = argTemplate.template.matchAll(/\{([^}]+)\}/g)
    for (const match of matches) {
      allPlaceholders.add(match[1])
    }
  }

  if (template.content.closing) {
    const matches = template.content.closing.matchAll(/\{([^}]+)\}/g)
    for (const match of matches) {
      allPlaceholders.add(match[1])
    }
  }

  return Array.from(allPlaceholders)
}

/**
 * 获取模板变量列表（含默认值）
 */
export function getTemplateVariableList(variables: string[]): TemplateVariable[] {
  return variables.map((name) => ({
    name,
    defaultValue: COMMON_DEFAULTS[name] || '',
    required: !name.startsWith('optional_'),
    description: `变量 ${name}`,
  }))
}
