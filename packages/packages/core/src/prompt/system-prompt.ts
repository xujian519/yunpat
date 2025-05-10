/**
 * System Prompt 品牌类型与常量
 *
 * 借鉴 Claude Code 设计：
 * - SystemPrompt 是 branded type，防止普通 string[] 被意外传入 API
 * - 静态区与动态区分界标记，支持缓存分块优化
 */

/**
 * System Prompt 品牌类型
 *
 * 只有通过 asSystemPrompt() 显式转换才能获得此类型。
 * 这防止普通 string[] 被意外传入需要缓存分块的 API 调用。
 */
export type SystemPrompt = readonly string[] & {
  readonly __brand: 'SystemPrompt'
}

/**
 * 将 string[] 转换为 SystemPrompt 品牌类型
 * 零开销类型断言（运行时无额外操作）
 */
export function asSystemPrompt(value: readonly string[]): SystemPrompt {
  return value as SystemPrompt
}

/**
 * 静态区与动态区的分界标记
 *
 * 作用：
 * 1. 将 System Prompt 分为"不变的静态区"和"因案件/会话而异的动态区"
 * 2. 静态区对所有案件相同，可获得全局缓存
 * 3. 动态区每次不同，只能会话级缓存或不缓存
 * 4. 标记本身在发送给 API 前被移除，AI 永远看不到
 */
export const SYSTEM_PROMPT_DYNAMIC_BOUNDARY = '__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'

/**
 * 检查给定内容是否包含分界标记
 */
export function hasDynamicBoundary(parts: readonly string[]): boolean {
  return parts.includes(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
}

/**
 * 在分界标记处分割 System Prompt
 *
 * @returns [staticParts, dynamicParts]
 */
export function splitByDynamicBoundary(parts: readonly string[]): [string[], string[]] {
  const boundaryIndex = parts.indexOf(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
  if (boundaryIndex === -1) {
    return [Array.from(parts), []]
  }
  return [
    parts.slice(0, boundaryIndex).filter((p) => p !== SYSTEM_PROMPT_DYNAMIC_BOUNDARY),
    parts.slice(boundaryIndex + 1).filter((p) => p !== SYSTEM_PROMPT_DYNAMIC_BOUNDARY),
  ]
}

/**
 * 移除分界标记，生成干净的 Prompt 数组
 */
export function removeBoundary(parts: readonly string[]): string[] {
  return parts.filter((p) => p !== SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
}
