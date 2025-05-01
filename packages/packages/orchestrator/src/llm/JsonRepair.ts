/**
 * JsonRepair - JSON 自修复工具
 *
 * 处理 LLM 输出的常见 JSON 格式问题：
 * - Markdown 代码围栏
 * - 尾随逗号
 * - 前缀/后缀文本
 * - 截断的 JSON
 */

/**
 * 尝试修复并解析 JSON 字符串
 * @returns 解析后的对象，或 null（无法修复时）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function attemptJsonRepair(raw: string): any | null {
  if (!raw || typeof raw !== 'string') return null

  let cleaned = raw.trim()

  // 1. 移除 Markdown 代码围栏
  cleaned = removeMarkdownFences(cleaned)
  if (!cleaned) return null

  // 2. 尝试直接解析
  try {
    return JSON.parse(cleaned)
  } catch {
    /* intentional */
  }

  // 3. 修复尾随逗号
  cleaned = fixTrailingCommas(cleaned)
  try {
    return JSON.parse(cleaned)
  } catch {
    /* intentional */
  }

  // 4. 提取 JSON 子串（处理前后有额外文本的情况）
  const extracted = extractJsonSubstring(cleaned)
  if (extracted) {
    try {
      return JSON.parse(extracted)
    } catch {
      /* intentional */
    }
    // 对提取的子串也尝试修复尾随逗号
    try {
      return JSON.parse(fixTrailingCommas(extracted))
    } catch {
      /* intentional */
    }
  }

  // 5. 尝试修复截断的 JSON
  const repaired = repairTruncatedJson(cleaned)
  if (repaired) {
    try {
      return JSON.parse(repaired)
    } catch {
      /* intentional */
    }
  }

  return null
}

/**
 * 移除 Markdown 代码围栏
 */
function removeMarkdownFences(text: string): string {
  let result = text

  // 匹配 ```json ... ``` 或 ``` ... ```
  const fenceMatch = result.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) {
    result = fenceMatch[1].trim()
  }

  // 只处理开头的围栏（没有闭合的情况）
  result = result.replace(/^```(?:json)?\s*\n?/, '')

  // 只处理结尾的围栏
  result = result.replace(/\n?\s*```$/, '')

  return result.trim()
}

/**
 * 修复尾随逗号
 */
function fixTrailingCommas(text: string): string {
  // 数组/对象中最后一个元素后的逗号
  return text.replace(/,\s*([}\]])/g, '$1')
}

/**
 * 从混合文本中提取 JSON 子串
 */
function extractJsonSubstring(text: string): string | null {
  // 查找第一个 { 或 [
  const objStart = text.indexOf('{')
  const arrStart = text.indexOf('[')

  let start = -1
  if (objStart >= 0 && arrStart >= 0) {
    start = Math.min(objStart, arrStart)
  } else if (objStart >= 0) {
    start = objStart
  } else if (arrStart >= 0) {
    start = arrStart
  }

  if (start < 0) return null

  const openChar = text[start]
  const closeChar = openChar === '{' ? '}' : ']'

  // 从末尾找最后一个匹配的闭合字符
  const end = text.lastIndexOf(closeChar)
  if (end <= start) return null

  return text.substring(start, end + 1)
}

/**
 * 尝试修复截断的 JSON（补全未闭合的括号和字符串）
 */
function repairTruncatedJson(text: string): string | null {
  const openers: string[] = []
  let inString = false
  let escape = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (ch === '\\' && inString) {
      escape = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === '{' || ch === '[') {
      openers.push(ch)
    } else if (ch === '}') {
      if (openers.length > 0 && openers[openers.length - 1] === '{') {
        openers.pop()
      }
    } else if (ch === ']') {
      if (openers.length > 0 && openers[openers.length - 1] === '[') {
        openers.pop()
      }
    }
  }

  if (openers.length === 0) return null

  let result = text

  // 如果在字符串中间截断，先闭合字符串
  if (inString) {
    result += '"'
  }

  // 移除末尾不完整的键值对（多种截断模式）
  // 模式1: "key": "partial value  → 已被上面的 inString 处理
  // 模式2: "key": 12             → 截断在数字/布尔值中间
  // 模式3: "key":                → 只有冒号没有值
  // 模式4: "key                  → 截断在键名中间
  result = result.replace(/,\s*"[^"]*"?\s*:\s*(?:[^,}\]]*)?$/, '')
  result = result.replace(/,\s*"[^"]*"?$/, '')

  // 补全未闭合的括号
  for (let i = openers.length - 1; i >= 0; i--) {
    result += openers[i] === '{' ? '}' : ']'
  }

  return result
}
