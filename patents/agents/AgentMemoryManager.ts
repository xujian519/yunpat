/**
 * Agent Memory Manager - 统一记忆层管理器
 *
 * 为所有 Agent 提供统一的记忆层接口
 *
 * 核心功能：
 * 1. 统一初始化记忆层组件
 * 2. 共享 BGE-M3 客户端和向量存储
 * 3. 管理 Agent 间的记忆共享
 * 4. 提供统一的统计和监控
 */

import { createBGEM3Client } from '../../packages/core/src/memory/integration/BGEIntegration.js';
import { PostgresVectorStore } from '../../packages/core/src/memory/long-term/PostgresVectorStore.js';
import { createTokenWindowManager } from '../../packages/core/src/memory/short-term/TokenWindow.js';
import { loadMemoryConfig, validateMemoryConfig, type MemoryConfig } from '../../packages/core/src/memory/config.js';

/**
 * 全局记忆层配置
 */
export interface GlobalMemoryConfig {
  bgeApiKey?: string;
  databaseUrl?: string;
  vectorDimension?: number;
  maxTokens?: number;
  reservedTokens?: number;
  cacheMaxSize?: number;
  enableRAG?: boolean;
  enableTokenWindow?: boolean;
}

/**
 * 记忆层统计信息
 */
export interface MemoryStats {
  bge: {
    cacheSize: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
  };
  vector: {
    totalMemories: number;
    typeDistribution: Record<string, number>;
  };
  agents: {
    activeAgents: string[];
    totalCalls: number;
  };
}

/**
 * Agent Memory Manager
 */
export class AgentMemoryManager {
  private static instance: AgentMemoryManager | null = null;

  private bgeClient: any;
  private vectorStore: any;
  private tokenWindows: Map<string, any> = new Map();
  private config: GlobalMemoryConfig;
  private agentStats: Map<string, number> = new Map();
  private isInitialized: boolean = false;

  private constructor(config: GlobalMemoryConfig = {}) {
    // 从环境变量加载配置，用户配置覆盖环境变量
    const envConfig = loadMemoryConfig(config);

    this.config = {
      bgeApiKey: envConfig.bgeApiKey,
      databaseUrl: envConfig.databaseUrl,
      vectorDimension: envConfig.vectorDimension,
      maxTokens: envConfig.maxTokens,
      reservedTokens: envConfig.reservedTokens,
      cacheMaxSize: envConfig.cacheMaxSize,
      enableRAG: envConfig.enableRAG,
      enableTokenWindow: envConfig.enableTokenWindow,
    };

    // 验证配置
    const validation = validateMemoryConfig(this.config);
    if (!validation.valid) {
      console.warn('[AgentMemoryManager] 配置警告:');
      validation.errors.forEach((error) => console.warn(`  - ${error}`));
    }

    this.bgeClient = null;
    this.vectorStore = null;
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: GlobalMemoryConfig): AgentMemoryManager {
    if (!AgentMemoryManager.instance) {
      AgentMemoryManager.instance = new AgentMemoryManager(config);
    }
    return AgentMemoryManager.instance;
  }

  /**
   * 初始化记忆层
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔧 初始化全局记忆层管理器...');

    // 1. 初始化 BGE-M3（如果启用 RAG）
    if (this.config.enableRAG) {
      this.bgeClient = createBGEM3Client({
        apiKey: this.config.bgeApiKey!,
        cacheMaxSize: this.config.cacheMaxSize,
      });
      console.log('✅ BGE-M3 客户端已初始化');
    } else {
      console.log('⚠️  BGE-M3 已禁用（RAG 功能将不可用）');
    }

    // 2. 初始化向量存储
    this.vectorStore = new PostgresVectorStore({
      databaseUrl: this.config.databaseUrl || 'postgres://localhost:5432/yunpat',
      vectorDimension: this.config.vectorDimension || 1024,
    });
    await this.vectorStore.initialize();
    console.log('✅ PostgreSQL 向量存储已初始化');

    this.isInitialized = true;
    console.log('🎉 全局记忆层管理器初始化完成！\n');
  }

  /**
   * 为 Agent 注册 Token 窗口
   */
  registerTokenWindow(agentName: string, config?: { maxTokens?: number }): any {
    if (!this.tokenWindows.has(agentName)) {
      const tokenWindow = createTokenWindowManager({
        maxTokens: config?.maxTokens ?? this.config.maxTokens,
        reservedTokens: this.config.reservedTokens,
        enableSummary: true,
      });
      this.tokenWindows.set(agentName, tokenWindow);
      console.log(`✅ Token 窗口已注册: ${agentName}`);
    }
    return this.tokenWindows.get(agentName);
  }

  /**
   * 获取 BGE-M3 客户端
   */
  getBGEClient() {
    if (!this.isInitialized) {
      throw new Error('记忆层未初始化，请先调用 initialize()');
    }
    if (!this.config.enableRAG || !this.bgeClient) {
      throw new Error('BGE-M3 未启用，请在配置中设置 enableRAG: true');
    }
    return this.bgeClient;
  }

  /**
   * 获取向量存储
   */
  getVectorStore() {
    if (!this.isInitialized) {
      throw new Error('记忆层未初始化，请先调用 initialize()');
    }
    return this.vectorStore;
  }

  /**
   * 语义搜索（跨所有 Agent）
   */
  async searchMemories(query: string, topK: number = 5, types?: string[]): Promise<any[]> {
    if (!this.isInitialized) {
      throw new Error('记忆层未初始化');
    }
    if (!this.config.enableRAG || !this.bgeClient) {
      throw new Error('BGE-M3 未启用，无法进行语义搜索');
    }

    const queryEmbedding = await this.bgeClient.embed(query);
    const results = await this.vectorStore.search(queryEmbedding, topK, { types });

    return results;
  }

  /**
   * 添加记忆（由 Agent 调用）
   */
  async addMemory(memory: {
    type: string;
    content: string;
    metadata?: any;
    agentName?: string;
  }): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('记忆层未初始化');
    }
    if (!this.config.enableRAG || !this.bgeClient) {
      throw new Error('BGE-M3 未启用，无法添加带向量的记忆');
    }

    const embedding = await this.bgeClient.embed(memory.content);

    const id = await this.vectorStore.upsert({
      type: memory.type,
      content: memory.content,
      embedding,
      metadata: {
        ...memory.metadata,
        agentName: memory.agentName || 'unknown',
        createdAt: new Date().toISOString(),
      },
    });

    // 记录 Agent 调用次数
    if (memory.agentName) {
      const currentCalls = this.agentStats.get(memory.agentName) || 0;
      this.agentStats.set(memory.agentName, currentCalls + 1);
    }

    return id;
  }

  /**
   * 获取全局统计信息
   */
  async getStats(): Promise<MemoryStats> {
    if (!this.isInitialized) {
      throw new Error('记忆层未初始化');
    }

    const memoryStats = await this.vectorStore.getStats();
    const bgeStats = this.bgeClient.getCacheStats();

    return {
      bge: {
        cacheSize: bgeStats.size,
        cacheHits: bgeStats.hits,
        cacheMisses: bgeStats.misses,
        cacheHitRate: bgeStats.hitRate,
      },
      vector: {
        totalMemories: memoryStats.totalMemories,
        typeDistribution: memoryStats.typeDistribution,
      },
      agents: {
        activeAgents: Array.from(this.agentStats.keys()),
        totalCalls: Array.from(this.agentStats.values()).reduce((sum, val) => sum + val, 0),
      },
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.vectorStore) {
      await this.vectorStore.close();
    }
    if (this.bgeClient) {
      this.bgeClient.clearCache();
    }
    this.tokenWindows.clear();
    this.agentStats.clear();
    console.log('✅ 全局记忆层管理器资源已清理');
  }

  /**
   * 重置单例（用于测试）
   */
  static resetInstance(): void {
    AgentMemoryManager.instance = null;
  }
}

/**
 * 快速初始化全局记忆层
 */
export async function initGlobalMemory(config?: GlobalMemoryConfig): Promise<AgentMemoryManager> {
  const manager = AgentMemoryManager.getInstance(config);
  await manager.initialize();
  return manager;
}
