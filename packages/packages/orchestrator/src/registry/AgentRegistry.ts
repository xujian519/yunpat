/**
 * AgentRegistry - Agent 注册表
 *
 * 管理 agentId → Agent 实例的映射，支持动态注册和查找。
 * 使用最小接口 ExecutableAgent，避免依赖具体 Agent 类型。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { type AgentManifestEntry, agentManifest } from './agentManifest.js'

/**
 * Agent 最小执行接口
 * 所有 Agent 基类（Agent → KnowledgeEnhancedAgent → ProfessionalAgent）都实现了 execute()
 */
export interface ExecutableAgent {
  execute(input: any): Promise<any>
}

/**
 * Agent 注册表
 */
export class AgentRegistry {
  private agents = new Map<string, ExecutableAgent>()

  /**
   * 注册 Agent
   */
  register(id: string, agent: ExecutableAgent): void {
    this.agents.set(id, agent)
  }

  /**
   * 获取 Agent
   */
  get(id: string): ExecutableAgent | undefined {
    return this.agents.get(id)
  }

  /**
   * 检查 Agent 是否存在
   */
  has(id: string): boolean {
    return this.agents.has(id)
  }

  /**
   * 列出所有已注册的 Agent ID
   */
  listIds(): string[] {
    return Array.from(this.agents.keys())
  }

  /**
   * 获取已注册 Agent 数量
   */
  get size(): number {
    return this.agents.size
  }

  /**
   * 获取清单中所有条目（含能力元数据）
   */
  getManifestEntries(): AgentManifestEntry[] {
    return agentManifest
  }

  /**
   * 按能力查找清单中的 Agent
   */
  findByCapability(capability: string): AgentManifestEntry[] {
    return agentManifest.filter((entry) => entry.capabilities?.includes(capability) ?? false)
  }

  /**
   * 生成 LLM 友好的代理能力摘要，供 Context 层注入
   */
  getCapabilitySummary(): string {
    return agentManifest
      .map((entry) => {
        const caps = entry.capabilities?.join(', ') ?? ''
        const layer = entry.layer ?? 'unknown'
        return `- ${entry.agentId}: ${entry.defaultDescription} (${layer}) [${caps}]`
      })
      .join('\n')
  }
}
