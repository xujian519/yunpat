/**
 * 统一知识图谱服务
 *
 * 架构：PostgreSQL-First
 * - 主要知识源：PostgreSQL legal_world_model（397万条记录 + 33万向量嵌入）
 * - 概念增强：YunPat 核心概念（100个 + 5,229双链）
 * - OpenClaw 专利知识图谱（4万节点 + 40万边 + BGE-M3 嵌入）
 */

export {
  PostgreSQLClient,
  type VectorSearchResult,
  type StructuredQueryResult,
  type EntityResult,
  type PostgreSQLClientConfig,
  type PostgreSQLStats,
} from './PostgreSQLClient.js'

export {
  YunPatAdapter,
  type YunPatConcept,
  type WikiPage,
  type YunPatWikiCard,
} from './adapters/YunPatAdapter.enhanced.js'

export {
  PostgreSQLFirstKnowledgeGraph,
  createKnowledgeGraph,
  type KnowledgeQueryOptions,
  type KnowledgeResult,
  type RelationInference,
} from './PostgreSQLFirstKnowledgeGraph.js'

export {
  OpenClawAdapter,
  type OpenClawNode,
  type OpenClawEdge,
  type OpenClawAdapterConfig,
} from './adapters/OpenClawAdapter.js'
