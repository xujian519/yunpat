/**
 * 记忆层统一接口
 *
 * 整合向量存储和图存储
 * 提供统一的记忆管理 API
 */

import { PostgresVectorStore, type SearchFilter } from './PostgresVectorStore.js';
import { PostgresGraphStore } from './PostgresGraphStore.js';

// 导出所有类型
export * from './schema.js';

/**
 * 记忆项
 */
export interface MemoryItem {
  id?: number;
  type: string;
  content: string;
  embedding: string | number[]; // 支持传入 number[] 或已序列化的 string
  metadata?: {
    agent?: string;
    userId?: string;
    tags?: string[];
    [key: string]: any;
  };
}

/**
 * 记忆层配置
 */
export interface MemoryLayerConfig {
  /** PostgreSQL 连接 URL */
  databaseUrl: string;
  /** 向量维度 */
  vectorDimension?: number;
}

/**
 * 记忆层类
 *
 * 核心功能：
 * 1. 统一的记忆存储与检索
 * 2. 向量搜索 + 图推理
 * 3. 自动实体抽取与关系建立
 */
export class MemoryLayer {
  private vectorStore: PostgresVectorStore;
  private graphStore: PostgresGraphStore;

  constructor(config: MemoryLayerConfig) {
    this.vectorStore = new PostgresVectorStore({
      databaseUrl: config.databaseUrl,
      vectorDimension: config.vectorDimension,
    });

    this.graphStore = new PostgresGraphStore({
      databaseUrl: config.databaseUrl,
    });
  }

  /**
   * 初始化记忆层
   */
  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    console.log('✅ 记忆层初始化完成');
  }

  /**
   * 添加记忆
   */
  async addMemory(memory: MemoryItem): Promise<number> {
    const id = await this.vectorStore.upsert(memory);

    // TODO: 自动抽取实体和关系
    // await this.extractEntitiesAndRelations(id, memory);

    return id;
  }

  /**
   * 批量添加记忆
   */
  async addMemories(memories: MemoryItem[]): Promise<number[]> {
    return await this.vectorStore.upsertBatch(memories);
  }

  /**
   * 搜索记忆（向量相似度）
   */
  async searchMemories(
    queryEmbedding: number[],
    topK: number = 10,
    filter?: SearchFilter
  ) {
    return await this.vectorStore.search(queryEmbedding, topK, filter);
  }

  /**
   * 获取记忆详情
   */
  async getMemory(id: number) {
    return await this.vectorStore.get(id);
  }

  /**
   * 创建实体（图节点）
   */
  async createEntity(entity: {
    type: string;
    name: string;
    properties?: Record<string, any>;
  }): Promise<number> {
    return await this.graphStore.createEntity(entity);
  }

  /**
   * 创建关系（图边）
   */
  async createRelation(relation: {
    fromEntityId: number;
    toEntityId: number;
    relationType: string;
    weight?: number;
    properties?: Record<string, any>;
  }): Promise<number> {
    return await this.graphStore.createRelation(relation);
  }

  /**
   * 查找最短路径
   */
  async findShortestPath(
    fromEntityId: number,
    toEntityId: number,
    maxHops?: number
  ) {
    return await this.graphStore.findShortestPath(fromEntityId, toEntityId, maxHops);
  }

  /**
   * 获取邻居实体
   */
  async getNeighbors(entityId: number, relationType?: string) {
    return await this.graphStore.getNeighbors(entityId, relationType);
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    const [vectorStats, graphStats] = await Promise.all([
      this.vectorStore.getStats(),
      this.graphStore.getStats(),
    ]);

    return {
      vector: vectorStats,
      graph: graphStats,
    };
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    await Promise.all([
      this.vectorStore.close(),
      this.graphStore.close(),
    ]);
  }
}

/**
 * 创建记忆层实例
 */
export async function createMemoryLayer(
  config: MemoryLayerConfig
): Promise<MemoryLayer> {
  const layer = new MemoryLayer(config);
  await layer.initialize();

  return layer;
}
