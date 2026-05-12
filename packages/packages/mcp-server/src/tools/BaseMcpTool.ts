/**
 * MCP 工具基类
 */

import { z } from 'zod'
import type { McpToolContext } from '../types.js'

/**
 * MCP 工具元数据
 */
export interface McpToolMetadata {
  name: string
  description: string
  inputSchema: any
  outputSchema?: any
  version?: string
  author?: string
  timeout?: number // 执行超时时间(ms)，默认 600000 (10分钟)
}

/**
 * MCP 工具执行结果
 */
export interface McpToolResult<T = any> {
  success: boolean
  data?: T
  error?: string
  executionTime?: number
  metadata?: {
    timestamp: string
    toolName: string
    version: string
  }
}

/**
 * MCP 工具基类
 */
export abstract class BaseMcpTool<TInput, TOutput> {
  abstract readonly metadata: McpToolMetadata

  protected abstract executeInternal(input: TInput, context: McpToolContext): Promise<TOutput>

  protected validateInput(input: unknown): TInput {
    try {
      return this.metadata.inputSchema.parse(input) as TInput
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('; ')
        throw new Error(`输入验证失败: ${errorMessages}`)
      }
      throw error
    }
  }

  async execute(input: unknown, context: McpToolContext = {}): Promise<McpToolResult<TOutput>> {
    const startTime = Date.now()

    try {
      const validatedInput = this.validateInput(input)
      const data = await this.executeInternal(validatedInput, context)
      const executionTime = Date.now() - startTime

      return {
        success: true,
        data,
        executionTime,
        metadata: {
          timestamp: new Date().toISOString(),
          toolName: this.metadata.name,
          version: this.metadata.version || '1.0.0',
        },
      }
    } catch (error) {
      const executionTime = Date.now() - startTime

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        metadata: {
          timestamp: new Date().toISOString(),
          toolName: this.metadata.name,
          version: this.metadata.version || '1.0.0',
        },
      }
    }
  }

  getMcpSchema() {
    return {
      name: this.metadata.name,
      description: this.metadata.description,
      inputSchema: this.zodToJsonSchema(this.metadata.inputSchema),
    }
  }

  private zodToJsonSchema(schema: z.ZodType<any>): any {
    if (schema instanceof z.ZodObject) {
      const properties: Record<string, any> = {}
      const required: string[] = []

      for (const [key, value] of Object.entries(schema.shape)) {
        properties[key] = this.zodToJsonSchema(value as z.ZodType<any>)
        if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
          required.push(key)
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      }
    }

    if (schema instanceof z.ZodString) return { type: 'string' }
    if (schema instanceof z.ZodNumber) return { type: 'number' }
    if (schema instanceof z.ZodBoolean) return { type: 'boolean' }
    if (schema instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodToJsonSchema(schema.element),
      }
    }
    if (schema instanceof z.ZodEnum) {
      return { type: 'string', enum: schema.options }
    }
    if (schema instanceof z.ZodOptional) {
      return this.zodToJsonSchema(schema.unwrap())
    }
    if (schema instanceof z.ZodDefault) {
      const innerSchema = this.zodToJsonSchema(schema.removeDefault())
      // 获取默认值
      const defaultValue = schema._def.defaultValue()
      return { ...innerSchema, default: defaultValue }
    }

    return { type: 'string' }
  }
}
