/**
 * JSON 解析工具
 *
 * 统一处理 LLM 响应中的 JSON 提取和解析
 * 遵循简洁优先原则：一个工具函数，多种使用场景
 */

export class JSONParser {
  /**
   * 从 LLM 响应中提取并解析 JSON
   *
   * @param content - LLM 返回的原始内容
   * @param defaultValue - 解析失败时的默认值
   * @param transform - 可选的数据转换函数
   * @returns 解析后的数据或默认值
   */
  static parse<T>(content: string, defaultValue: T, transform?: (data: any) => T): T {
    try {
      const jsonStr = this.extractJSON(content)
      if (!jsonStr) return defaultValue

      const data = JSON.parse(jsonStr)
      return transform ? transform(data) : (data as T)
    } catch (error) {
      console.warn('[JSONParser] 解析失败:', error)
      return defaultValue
    }
  }

  /**
   * 从文本中提取 JSON 字符串
   *
   * 支持以下格式：
   * - ```json ... ```
   * - ``` ... ```
   * - 直接的 JSON 对象
   */
  private static extractJSON(content: string): string | null {
    const patterns = [/```json\s*([\s\S]*?)\s*```/, /```\s*([\s\S]*?)\s*```/, /{[\s\S]*}/]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) return match[1] || match[0]
    }
    return null
  }
}
