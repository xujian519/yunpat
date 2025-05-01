/**
 * 安全解析 JSON 内容
 *
 * 从 LLM 响应中提取 JSON，支持 markdown 代码块包裹
 */
export function safeParseJSON(content: unknown): Record<string, unknown> | null {
  if (typeof content !== 'string') {
    return null
  }

  const jsonMatch =
    content.match(/```json\s*([\s\S]*?)\s*```/) ||
    content.match(/```\s*([\s\S]*?)\s*```/) ||
    content.match(/{[\s\S]*}/)

  const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content

  try {
    const parsed = JSON.parse(jsonStr)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
