/**
 * PatentDispatchTool - 专利子 Agent 委托调度工具
 *
 * 职责：
 * 1. 分析用户意图和任务复杂度
 * 2. 决定是直接调用 MCP 工具还是返回 agent_spawn 配置
 * 3. 简单任务 → 直接返回 MCP 工具调用配置
 * 4. 复杂任务 → 返回 agent_spawn 配置，触发 Rust TUI 的子 Agent 委托
 */

import { z } from 'zod'
import { BaseMcpTool } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'

/**
 * 意图类型（与 Rust PatentWorkflowTool agent_id 映射）
 */
type PatentIntent =
  | 'research' // 专利检索研究
  | 'drafting' // 专利撰写
  | 'oa-response' // 审查意见答复
  | 'trademark' // 商标分析
  | 'creativity' // 创造性评估
  | 'reexamination' // 复审请求
  | 'invalidation' // 无效宣告
  | 'patent_search' // 专利检索（Google Patents）
  | 'paper_search' // 论文检索
  | 'patent_db' // 本地专利数据库检索
  | 'legal_search' // 法律知识检索

/**
 * 任务复杂度评估结果
 */
interface ComplexityAssessment {
  isSimple: boolean
  reason: string
  estimatedSteps: number
}

/**
 * PatentDispatchTool 输入 Schema
 */
const patentDispatchToolSchema = z.object({
  intent: z
    .enum([
      'research',
      'drafting',
      'oa-response',
      'trademark',
      'creativity',
      'reexamination',
      'invalidation',
      'patent_search',
      'paper_search',
      'patent_db',
      'legal_search',
    ])
    .describe('意图类型，对应 Rust PatentWorkflowTool 的 agent_id'),
  task_description: z.string().describe('用户任务描述'),
  context: z.record(z.any()).optional().describe('额外上下文信息'),
})

/**
 * PatentDispatchTool - 专利子 Agent 委托调度
 */
export class PatentDispatchTool extends BaseMcpTool<z.infer<typeof patentDispatchToolSchema>, any> {
  readonly metadata = {
    name: 'patent_dispatch',
    description:
      '专利子 Agent 委托调度工具。分析用户意图和任务复杂度，决定是直接调用 MCP 工具还是返回 agent_spawn 配置触发 Rust TUI 子 Agent。',
    version: '1.0.0',
    inputSchema: patentDispatchToolSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof patentDispatchToolSchema>,
    _context: McpToolContext
  ) {
    const { intent, task_description, context: extraContext } = input

    // 评估任务复杂度
    const complexity = this.assessComplexity(intent, task_description)

    if (complexity.isSimple) {
      // 简单任务：直接返回 MCP 工具调用配置
      return this.buildDirectToolConfig(intent, task_description, extraContext)
    } else {
      // 复杂任务：返回 agent_spawn 配置
      return this.buildAgentSpawnConfig(intent, task_description, complexity, extraContext)
    }
  }

  /**
   * 评估任务复杂度
   */
  private assessComplexity(intent: PatentIntent, taskDescription: string): ComplexityAssessment {
    const desc = taskDescription.toLowerCase()
    const length = taskDescription.length

    // 简单检索类任务
    const simpleSearchIntents: PatentIntent[] = [
      'patent_search',
      'paper_search',
      'patent_db',
      'legal_search',
    ]
    if (simpleSearchIntents.includes(intent)) {
      // 短查询（<50字）且无复杂条件
      if (length < 50 && !desc.includes('和') && !desc.includes('或') && !desc.includes('并且')) {
        return {
          isSimple: true,
          reason: '简单关键词检索',
          estimatedSteps: 1,
        }
      }
    }

    // 复杂撰写类任务
    const draftingIntents: PatentIntent[] = [
      'drafting',
      'oa-response',
      'research',
      'invalidation',
      'reexamination',
    ]
    if (draftingIntents.includes(intent)) {
      // 撰写类任务始终复杂（需要多阶段处理）
      return {
        isSimple: false,
        reason: '需要多阶段分析和生成',
        estimatedSteps: this.estimateDraftingSteps(intent, taskDescription),
      }
    }

    // 商标分析、创造性评估等中等复杂度任务
    if (length < 100) {
      return {
        isSimple: true,
        reason: '单阶段分析任务',
        estimatedSteps: 1,
      }
    }

    // 默认为复杂任务
    return {
      isSimple: false,
      reason: '任务描述较长或包含多个子任务',
      estimatedSteps: 3,
    }
  }

  /**
   * 估算撰写类任务步骤数
   */
  private estimateDraftingSteps(intent: PatentIntent, _taskDescription: string): number {
    switch (intent) {
      case 'drafting':
        return 5 // 意图解析、知识检索、权利要求生成、说明书撰写、完成
      case 'oa-response':
        return 4 // 意图解析、审查分析、答复策略、答复撰写
      case 'research':
        return 5 // 意图解析、知识检索、论文检索、报告撰写、完成
      case 'invalidation':
        return 4 // 意图解析、证据收集、无效策略、请求撰写
      case 'reexamination':
        return 4 // 意图解析、驳回分析、复审策略、请求撰写
      default:
        return 3
    }
  }

  /**
   * 构建直接工具调用配置（简单任务）
   */
  private buildDirectToolConfig(
    intent: PatentIntent,
    taskDescription: string,
    extraContext?: Record<string, unknown>
  ) {
    // 意图到 MCP 工具名的映射
    const intentToMcpTool: Record<PatentIntent, string> = {
      patent_search: 'patent_search',
      paper_search: 'patent_search', // 复用 patent_search 工具
      patent_db: 'project_scan', // 使用 project_scan 工具
      legal_search: 'legal_knowledge_search',
      research: 'patent_search',
      drafting: 'claims_generator',
      'oa-response': 'quality_checker',
      trademark: 'patent_search',
      creativity: 'quality_checker',
      reexamination: 'patent_search',
      invalidation: 'invalid_decision_search',
    }

    const mcpTool = intentToMcpTool[intent]

    return {
      action: 'direct_tool_call',
      tool: mcpTool,
      reason: `简单${intent}任务，直接调用 MCP 工具`,
      tool_args: this.buildToolArgs(intent, taskDescription, extraContext),
    }
  }

  /**
   * 构建工具参数
   */
  private buildToolArgs(
    intent: PatentIntent,
    taskDescription: string,
    extraContext?: Record<string, unknown>
  ): Record<string, unknown> {
    switch (intent) {
      case 'patent_search':
      case 'paper_search':
      case 'research':
        return {
          inventionTitle: taskDescription,
          technicalField: extraContext?.field || '通用技术领域',
          keyFeatures: extraContext?.features || [],
        }

      case 'patent_db':
        return {
          workspace_path: process.cwd(),
        }

      case 'legal_search':
        return {
          question: taskDescription,
          domain: extraContext?.domain || '专利法',
          sources: extraContext?.sources || ['legal_article', 'invalid_decision', 'patent_rule'],
        }

      case 'drafting':
        return {
          inventionTitle: taskDescription,
          technicalField: extraContext?.field || '通用技术领域',
          keyFeatures: extraContext?.features || [],
          enableDependentClaims: true,
        }

      case 'oa-response':
        return {
          claims: taskDescription,
          specification: extraContext?.specification || '',
        }

      default:
        return {
          query: taskDescription,
        }
    }
  }

  /**
   * 构建 agent_spawn 配置（复杂任务）
   */
  private buildAgentSpawnConfig(
    intent: PatentIntent,
    taskDescription: string,
    complexity: ComplexityAssessment,
    extraContext?: Record<string, unknown>
  ) {
    return {
      action: 'agent_spawn',
      agent_id: intent,
      reason: `${complexity.reason}（预估 ${complexity.estimatedSteps} 个阶段），需要子 Agent 处理`,
      agent_config: {
        agent_id: intent,
        input: {
          topic: taskDescription,
          case_id: extraContext?.case_id,
        },
        expected_stages: complexity.estimatedSteps,
        timeout_seconds: extraContext?.timeout || 300,
      },
      // 与 Rust HookInstruction 兼容的格式
      hook_instruction: {
        action: 'inject_message',
        role: 'assistant',
        content: `正在启动 ${intent} 子 Agent 处理您的请求（预估 ${complexity.estimatedSteps} 个阶段）...`,
      },
    }
  }
}
