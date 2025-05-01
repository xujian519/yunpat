/**
 * 变量替换器
 *
 * 负责替换提示词中的变量
 *
 * @package @yunpat/skills
 */

/**
 * 替换变量
 *
 * 支持以下变量格式：
 * - 简单变量：{{variable}}
 * - 嵌套变量：{{user.name}}
 * - 条件变量：{{#if condition}}...{{/if}}
 *
 * @param template - 模板字符串
 * @param vars - 变量对象
 * @returns 替换后的字符串
 */
export function replaceVariables(template: string, vars: Record<string, any>): string {
  let result = template

  // 1. 简单变量 {{variable}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : `{{${key}}}`
  })

  // 2. 嵌套变量 {{user.name}}
  result = result.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const keys = path.split('.')
    let value: any = vars

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        return `{{${path}}}`
      }
    }

    return value !== undefined && value !== null ? String(value) : `{{${path}}}`
  })

  // 3. 条件变量 {{#if condition}}...{{/if}}
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, condition, content) => {
    return vars[condition] ? content : ''
  })

  // 4. 条件取反 {{#unless condition}}...{{/unless}}
  result = result.replace(
    /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
    (_, condition, content) => {
      return !vars[condition] ? content : ''
    }
  )

  // 5. 循环变量 {{#each items}}...{{/each}}
  result = result.replace(
    /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, arrayName, content) => {
      const items = vars[arrayName]
      if (!Array.isArray(items)) return ''

      return items
        .map((item, index) => {
          let itemContent = content
          // 替换 {{this}} 为当前项
          itemContent = itemContent.replace(/\{\{this\}\}/g, () => String(item))
          // 替换 {{@index}} 为索引
          itemContent = itemContent.replace(/\{\{@index\}\}/g, () => String(index))
          return itemContent
        })
        .join('') // 使用空字符串连接，因为模板中已包含换行符
    }
  )

  return result
}

/**
 * 获取模板中使用的变量列表
 *
 * @param template - 模板字符串
 * @returns 变量名数组
 */
export function getTemplateVariables(template: string): string[] {
  const variables = new Set<string>()

  // 匹配 {{variable}}
  const simpleVars = template.match(/\{\{(\w+)\}\}/g)
  if (simpleVars) {
    simpleVars.forEach((match) => {
      const varName = match.replace(/\{|\}/g, '')
      if (!['if', 'unless', 'each', 'this', '@index'].includes(varName)) {
        variables.add(varName)
      }
    })
  }

  // 匹配 {{path.path}}
  const nestedVars = template.match(/\{\{([\w.]+)\}\}/g)
  if (nestedVars) {
    nestedVars.forEach((match) => {
      const path = match.replace(/\{|\}/g, '')
      if (!path.includes('.') || path.split('.')[0] !== 'if') {
        variables.add(path.split('.')[0])
      }
    })
  }

  return Array.from(variables)
}

/**
 * 验证必需变量
 *
 * @param template - 模板字符串
 * @param vars - 变量对象
 * @param required - 必需变量列表
 * @returns 验证结果
 */
export function validateRequiredVariables(
  template: string,
  vars: Record<string, any>,
  required: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  for (const varName of required) {
    if (!(varName in vars) || vars[varName] === undefined || vars[varName] === null) {
      missing.push(varName)
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}
