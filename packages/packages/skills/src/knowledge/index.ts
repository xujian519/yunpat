/**
 * 知识库模块入口
 *
 * @package @yunpat/skills
 */

// 知识库桥接器
export { ObsidianBridge } from './ObsidianBridge.js'

// 知识检索器
export { KnowledgeRetriever } from './KnowledgeRetriever.js'

// 类型定义
export {
  type KnowledgeConfig,
  type KnowledgeEntry,
  type KnowledgeQuery,
  type KnowledgeResult,
  type IndexStats,
  type WikiLink,
  type Tag,
  KnowledgeEntryType,
} from './types.js'
