/**
 * AgentFactory - Agent 工厂
 *
 * 遍历 agentManifest，使用动态 import() 按需加载 Agent 包，
 * 统一构造配置并实例化，注册到 AgentRegistry。
 *
 * 设计要点：
 * - 单个 Agent 加载失败不影响其他 Agent
 * - 统一配置格式 { name, description, llm, eventBus, memory, tools }
 * - 所有 Agent 基类（Agent → KnowledgeEnhancedAgent → ProfessionalAgent）都接受此格式
 */

import type { LLMAdapter, EventBus, MemoryStore, ToolRegistry } from '@yunpat/core'
import { AgentRegistry, type ExecutableAgent } from './AgentRegistry.js'
import { agentManifest, type AgentManifestEntry } from './agentManifest.js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

/**
 * Agent 共享依赖
 */
export interface AgentSharedDeps {
  llm: LLMAdapter
  eventBus: EventBus
  memory: MemoryStore
  tools: ToolRegistry
}

export class AgentFactory {
  private deps: AgentSharedDeps
  private isDev: boolean
  private projectRoot: string

  constructor(deps: AgentSharedDeps) {
    this.deps = deps
    // 检测开发模式：tsx 运行时或 NODE_ENV=development
    this.isDev = process.env.NODE_ENV === 'development' || process.argv[0]?.includes('tsx')
    // 计算项目根目录（AgentFactory 在 packages/orchestrator/src/registry/ 下）
    const currentDir = dirname(fileURLToPath(import.meta.url))
    this.projectRoot = resolve(currentDir, '../../../..')
  }

  /**
   * 批量创建所有 Agent 并注册到 registry
   *
   * 使用动态 import 按需加载，错误容忍（单个失败不影响其他）
   */
  async createAll(registry: AgentRegistry): Promise<void> {
    const results = await Promise.allSettled(
      agentManifest.map((entry) => this.createAndRegister(entry, registry))
    )

    // 报告失败的 Agent（不中断整体流程）
    let successCount = 0
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++
      } else {
        console.warn(
          `[AgentFactory] Failed to load agent "${agentManifest[index].agentId}": ${result.reason}`
        )
      }
    })

    console.log(
      `[AgentFactory] Loaded ${successCount}/${agentManifest.length} agents: ${registry.listIds().join(', ')}`
    )
  }

  /**
   * 创建单个 Agent 并注册
   */
  private async createAndRegister(
    entry: AgentManifestEntry,
    registry: AgentRegistry
  ): Promise<void> {
    const agent = await this.createAgent(entry)
    if (!agent) return
    // 不覆盖已注册的 agent（允许外部注入 mock）
    if (registry.has(entry.agentId)) return
    registry.register(entry.agentId, agent)
  }

  /**
   * 动态加载并实例化单个 Agent
   *
   * 使用 dynamic import() 按需加载，agent 包不可用时优雅跳过。
   */
  private async createAgent(entry: AgentManifestEntry): Promise<ExecutableAgent | null> {
    let module: Record<string, unknown>

    try {
      if (this.isDev) {
        // 开发模式：直接从源码加载，避免需要构建 dist/
        const srcPath = await this.resolveDevPath(entry.packageName)
        if (srcPath) {
          try {
            module = await import(srcPath)
          } catch (devError) {
            console.warn(
              `[AgentFactory] Dev import failed for "${entry.packageName}", falling back to npm package`
            )
            module = await import(entry.packageName)
          }
        } else {
          module = await import(entry.packageName)
        }
      } else {
        // 生产模式：使用 npm 包名（指向 dist/index.js）
        module = await import(entry.packageName)
      }
    } catch (importError) {
      // 包不存在或无法加载 —— 可选依赖，优雅跳过
      const errMsg = importError instanceof Error ? importError.message : String(importError)
      console.warn(
        `[AgentFactory] Agent package "${entry.packageName}" not available, skipping "${entry.agentId}": ${errMsg}`
      )
      return null
    }

    const AgentClass = module[entry.className]
    if (typeof AgentClass !== 'function') {
      console.warn(`[AgentFactory] Class "${entry.className}" not found in "${entry.packageName}"`)
      return null
    }

    // 统一构造配置
    const config = {
      name: entry.defaultName,
      description: entry.defaultDescription,
      llm: this.deps.llm,
      eventBus: this.deps.eventBus,
      memory: this.deps.memory,
      tools: this.deps.tools,
    }

    // 实例化（大部分 Agent 接受 config 对象）
    const agent = new (AgentClass as new (...args: unknown[]) => ExecutableAgent)(config)
    return agent
  }

  /**
   * 解析开发模式下的源码路径
   *
   * 支持 @yunpat/agent-xxx 和 @yunpat/xxx 两种包名格式，
   * 在 packages/agents/ 目录下查找对应的 src/index.ts/js。
   */
  private async resolveDevPath(packageName: string): Promise<string | null> {
    // 提取 @yunpat/ 后面的包 slug（支持 agent-xxx 和 xxx 两种格式）
    const match = packageName.match(/^@yunpat\/(.+)$/)
    if (!match) return null

    const agentName = match[1]
    const possiblePaths = [
      resolve(this.projectRoot, 'packages', 'agents', agentName, 'src', 'index.ts'),
      resolve(this.projectRoot, 'packages', 'agents', agentName, 'src', 'index.js'),
    ]

    for (const p of possiblePaths) {
      try {
        const fs = await import('fs')
        if (fs.existsSync(p)) {
          return 'file://' + p
        }
      } catch {
        continue
      }
    }

    return null
  }
}
