/**
 * @file Schema → LLM 函数定义转换
 * @description 将 EnhancedTool 的 Zod schema 转换为 OpenAI 兼容的
 * function calling JSON Schema，用于 LLM 工具调用。
 *
 * 设计参考：opencode 的 ToolRegistry.tools() 方法，
 * 使用 Schema.declare + ZodOverride 注解自动生成 JSON Schema。
 *
 * YunPat 当前使用 Zod 3.22+，兼容 `z.toJSONSchema()` (实验性)
 * 和手动 schema 遍历两种方式。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod'
import type { EnhancedTool, ToolMetadata } from './types.js'

// ─── 类型 ─────────────────────────────────────────

/** OpenAI 兼容的函数定义 */
export interface LLMFunctionDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/** JSON Schema 基础类型 */
interface JsonSchema {
  type?: string
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  enum?: unknown[]
  additionalProperties?: boolean
  [key: string]: unknown
}

// ─── 主转换函数 ──────────────────────────────────

/**
 * 从 EnhancedTool 生成 LLM 函数定义
 *
 * @param tool - 增强工具实例
 * @returns OpenAI 兼容的函数定义，包含 name, description, parameters
 */
export function toolToLLMFunction(tool: EnhancedTool): LLMFunctionDefinition {
  return {
    name: tool.metadata.name,
    description: buildToolDescription(tool.metadata),
    parameters: zodToJsonSchema(tool.metadata.inputSchema),
  }
}

/**
 * 批量转换
 */
export function toolsToLLMFunctions(tools: EnhancedTool[]): LLMFunctionDefinition[] {
  return tools.map(toolToLLMFunction)
}

// ─── Zod → JSON Schema ───────────────────────────

/**
 * 将 Zod schema 转换为 JSON Schema 对象
 *
 * 优先使用 Zod 内建的 toJSONSchema()（Zod 3.23+），
 * 回退到手动转换。
 */
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // Zod 3.23+ 内建方法
  if (typeof (schema as any).toJSONSchema === 'function') {
    try {
      const result = (schema as any).toJSONSchema()
      return sanitizeJsonSchema(result)
    } catch {
      // 回退到手动转换
    }
  }

  // 手动转换基本类型
  return sanitizeJsonSchema(zodToJsonSchemaManual(schema))
}

/**
 * 手动 Zod → JSON Schema 转换
 * 覆盖常用 Zod 类型：object, string, number, enum, array, optional
 */
function zodToJsonSchemaManual(schema: z.ZodType): JsonSchema {
  const def = (schema as any)._def

  // ZodObject
  if (schema instanceof z.ZodObject) {
    const shape = def.shape() as Record<string, z.ZodType>
    const properties: Record<string, JsonSchema> = {}
    const required: string[] = []

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchemaManual(value)
      // 非 optional 类型标记为 required
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key)
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false,
    }
  }

  // ZodString
  if (schema instanceof z.ZodString) {
    const checks = def.checks || []
    const result: JsonSchema = { type: 'string' }
    // 提取 description
    if (def.description) result.description = def.description
    // 提取 enum 约束
    for (const check of checks) {
      if (check.kind === 'enum') {
        result.enum = check.value
      }
    }
    return result
  }

  // ZodNumber
  if (schema instanceof z.ZodNumber) {
    const result: JsonSchema = { type: 'number' }
    if (def.description) result.description = def.description
    return result
  }

  // ZodBoolean
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' }
  }

  // ZodEnum
  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: def.values as unknown[],
    }
  }

  // ZodArray
  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchemaManual(def.type),
    }
  }

  // ZodOptional → unwrap
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchemaManual(def.innerType)
  }

  // ZodDefault → unwrap
  if (schema instanceof z.ZodDefault) {
    return zodToJsonSchemaManual(def.innerType)
  }

  // ZodEffects (refine, transform 等) → unwrap
  if (schema instanceof z.ZodEffects) {
    return zodToJsonSchemaManual(def.schema)
  }

  // 兜底：返回 string 类型
  return { type: 'string' }
}

// ─── 描述生成 ────────────────────────────────────

/**
 * 构建工具描述（含参数说明）
 *
 * 生成格式：
 * ```
 * 工具简要描述
 *
 * 参数：
 * - paramName: paramDescription
 * ```
 */
function buildToolDescription(metadata: ToolMetadata): string {
  const parts: string[] = [metadata.description]

  // 从 inputSchema 提取参数描述
  if (metadata.inputSchema instanceof z.ZodObject) {
    const shape = (metadata.inputSchema as any)._def.shape() as Record<string, z.ZodType>
    const paramDescriptions: string[] = []

    for (const [key, value] of Object.entries(shape)) {
      const desc = (value as any)._def?.description
      if (desc) {
        paramDescriptions.push(`- ${key}: ${desc}`)
      }
    }

    if (paramDescriptions.length > 0) {
      parts.push('\n参数：')
      parts.push(...paramDescriptions)
    }
  }

  return parts.join('\n')
}

// ─── 清理 ───────────────────────────────────────

/**
 * 清理 JSON Schema，移除 LLM 不需要的字段
 * （如 $schema, default 值等）
 */
function sanitizeJsonSchema(schema: JsonSchema): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  // 保留关键字段
  const keepKeys = [
    'type',
    'description',
    'properties',
    'required',
    'items',
    'enum',
    'additionalProperties',
  ]

  for (const key of keepKeys) {
    if (key in schema && schema[key] !== undefined) {
      // 递归清理嵌套属性
      if (key === 'properties' && schema.properties) {
        const cleaned: Record<string, unknown> = {}
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          cleaned[propName] = sanitizeJsonSchema(propSchema)
        }
        result[key] = cleaned
      } else if (key === 'items' && schema.items) {
        result[key] = sanitizeJsonSchema(schema.items)
      } else {
        result[key] = schema[key]
      }
    }
  }

  return result
}

export * as SchemaToLLM from './SchemaToLLM'
