/**
 * RAG（检索增强生成）引擎
 *
 * 核心功能：
 * 1. 文本向量化（BGE-M3）
 * 2. 向量存储（PostgreSQL + pgvector）
 * 3. 语义检索
 * 4. 上下文注入
 */

import { createBGEM3Client, type BGEM3Client } from './BGEIntegration.js';
import { MemoryLayer as MemoryLayerClass } from '../long-term/MemoryLayer.js';

/**
 * RAG 配置
 */
export interface RAGConfig {
  /** 数据库 URL */
  databaseUrl: string;
  /** BGE-M3 配置 */
  bgeConfig?: {
    baseURL?: string;
    apiKey?: string;
    model?: string;
  };
  /** 检索参数 */
  retrieval?: {
    topK?: number; // 检索 Top-K（默认 5）
    threshold?: number; // 相似度阈值（默认 0.7）
  };
}

/**
 * RAG 引擎
 *
 * 完整的检索增强生成流程
 */
export class RAGEngine {
  private memory: MemoryLayerClass;
  private bgeClient: BGEM3Client;
  private topK: number;
  private threshold: number;

  constructor(config: RAGConfig) {
    // 初始化记忆层
    this.memory = new MemoryLayerClass({
      databaseUrl: config.databaseUrl,
      vectorDimension: 1024, // BGE-M3
    });

    // 初始化 BGE-M3 客户端
    this.bgeClient = createBGEM3Client(config.bgeConfig);

    // 检索参数
    this.topK = config.retrieval?.topK ?? 5;
    this.threshold = config.retrieval?.threshold ?? 0.7;
  }

  /**
   * 初始化引擎
   */
  async initialize(): Promise<void> {
    // 健康检查
    const isHealthy = await this.bgeClient.healthCheck();
    if (!isHealthy) {
      throw new Error('BGE-M3 服务不可用');
    }

    // 初始化记忆层
    await this.memory.initialize();

    console.log('✅ RAG 引擎初始化完成');
  }

  /**
   * 添加文档（自动向量化）
   */
  async addDocument(document: {
    type: string;
    content: string;
    metadata?: Record<string, any>;
  }): Promise<number> {
    // 生成向量
    const embedding = await this.bgeClient.embed(document.content);

    // 存储到记忆层
    const memoryId = await this.memory.addMemory({
      type: document.type,
      content: document.content,
      embedding,
      metadata: document.metadata,
    });

    return memoryId;
  }

  /**
   * 批量添加文档
   */
  async addDocuments(documents: Array<{
    type: string;
    content: string;
    metadata?: Record<string, any>;
  }>): Promise<number[]> {
    // 批量生成向量
    const texts = documents.map((d) => d.content);
    const embeddings = await this.bgeClient.embedBatch(texts);

    // 批量存储
    const memories = documents.map((doc, i) => ({
      type: doc.type,
      content: doc.content,
      embedding: embeddings[i],
      metadata: doc.metadata,
    }));

    return await this.memory.addMemories(memories);
  }

  /**
   * 检索相关文档（核心功能）
   */
  async retrieve(query: string, options?: {
    topK?: number;
    threshold?: number;
    filter?: {
      types?: string[];
      tags?: string[];
      agent?: string;
    };
  }): Promise<Array<{
    content: string;
    similarity: number;
    metadata: Record<string, any> | null;
    type: string;
  }>> {
    // 生成查询向量
    const queryEmbedding = await this.bgeClient.embed(query);

    // 检索
    const results = await this.memory.searchMemories(
      queryEmbedding,
      options?.topK ?? this.topK,
      options?.filter
    );

    // 过滤低相似度结果
    const threshold = options?.threshold ?? this.threshold;
    const filtered = results
      .filter((r) => r.similarity >= threshold)
      .map((r) => ({
        content: r.content,
        similarity: r.similarity,
        metadata: r.metadata,
        type: r.type,
      }));

    return filtered;
  }

  /**
   * 增强查询（RAG 核心流程）
   *
   * 流程：
   * 1. 检索相关文档
   * 2. 构建增强上下文
   * 3. 返回提示词
   */
  async augmentQuery(
    query: string,
    options?: {
      topK?: number;
      threshold?: number;
      filter?: {
        types?: string[];
        tags?: string[];
        agent?: string;
      };
    }
  ): Promise<{
    augmentedQuery: string;
    retrievedDocs: Array<{
      content: string;
      similarity: number;
      metadata: Record<string, any> | null;
    }>;
  }> {
    // 检索相关文档
    const retrievedDocs = await this.retrieve(query, options);

    // 构建增强上下文
    const contextParts = retrievedDocs.map((doc, i) => {
      const source = doc.metadata?.source ?? `文档 ${i + 1}`;
      return `[${source}] (相似度: ${doc.similarity.toFixed(3)})\n${doc.content}`;
    });

    const context = contextParts.join('\n\n');

    // 构建增强查询
    const augmentedQuery = `
基于以下参考信息回答问题：

参考信息：
${context}

问题：${query}
`.trim();

    return {
      augmentedQuery,
      retrievedDocs,
    };
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    vector: any;
    graph: any;
    bge: {
      cacheSize: number;
      cacheHits: number;
      cacheMisses: number;
      cacheHitRate: number;
    };
  }> {
    const memoryStats = await this.memory.getStats();
    const bgeStats = this.bgeClient.getCacheStats();

    return {
      vector: memoryStats.vector,
      graph: memoryStats.graph,
      bge: {
        cacheSize: bgeStats.size,
        cacheHits: bgeStats.hits,
        cacheMisses: bgeStats.misses,
        cacheHitRate: bgeStats.hitRate,
      },
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.memory.close();
    this.bgeClient.clearCache();
  }
}

/**
 * 创建 RAG 引擎
 */
export async function createRAGEngine(config: RAGConfig): Promise<RAGEngine> {
  const engine = new RAGEngine(config);
  await engine.initialize();

  return engine;
}
