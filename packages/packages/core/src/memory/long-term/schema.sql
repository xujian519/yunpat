-- YunPat PostgreSQL 记忆层初始化脚本
-- 支持：向量存储（pgvector）、图关系、元数据过滤
-- 最后更新：2026-05-01

-- ============================================
-- 1. 启用必要扩展
-- ============================================

-- 启用 pgvector 扩展（向量相似度搜索）
CREATE EXTENSION IF NOT EXISTS vector;

-- 启用 pg_trgm 扩展（文本模糊搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 2. 创建记忆表（向量存储核心）
-- ============================================

CREATE TABLE IF NOT EXISTS memories (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,                    -- 记忆类型（conversation/document/code/snippet）
  content TEXT NOT NULL,                 -- 记忆内容（原文）
  embedding vector(1024) NOT NULL,       -- 向量嵌入（BGE-M3: 1024 维）
  metadata JSONB,                        -- 元数据（灵活查询）
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. 创建图关系表
-- ============================================

-- 实体表（图节点）
CREATE TABLE IF NOT EXISTS graph_entities (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,                    -- 实体类型（Person/Organization/Location/Concept）
  name TEXT NOT NULL,                    -- 实体名称
  properties JSONB,                      -- 实体属性
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 关系表（图边）
CREATE TABLE IF NOT EXISTS graph_relations (
  id SERIAL PRIMARY KEY,
  from_entity_id INTEGER NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
  to_entity_id INTEGER NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,           -- 关系类型（RELATED_TO/OWNS/CITED_IN/LOCATED_AT）
  weight FLOAT NOT NULL DEFAULT 1.0,     -- 关系权重（0-1，用于排序）
  properties JSONB,                      -- 关系属性
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- 4. 创建用户画像表
-- ============================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  preferences JSONB,                     -- 用户偏好
  behaviors JSONB,                       -- 行为特征
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5. 创建索引（性能优化）
-- ============================================

-- HNSW 索引（向量相似度搜索核心）
-- m=16: 每个节点的连接数
-- ef_construction=64: 构建时的候选列表大小
CREATE INDEX IF NOT EXISTS memories_embedding_hnsw_idx
  ON memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 元数据 GIN 索引（支持 JSONB 查询）
CREATE INDEX IF NOT EXISTS memories_metadata_idx
  ON memories USING gin (metadata);

-- 类型索引（常见过滤条件）
CREATE INDEX IF NOT EXISTS memories_type_idx
  ON memories(type);

-- 归档状态索引
CREATE INDEX IF NOT EXISTS memories_archived_idx
  ON memories(is_archived);

-- 复合索引（类型 + 创建时间）
CREATE INDEX IF NOT EXISTS memories_type_created_at_idx
  ON memories(type, created_at DESC);

-- 图关系索引
CREATE INDEX IF NOT EXISTS graph_relations_from_idx
  ON graph_relations(from_entity_id);

CREATE INDEX IF NOT EXISTS graph_relations_to_idx
  ON graph_relations(to_entity_id);

CREATE INDEX IF NOT EXISTS graph_relations_type_idx
  ON graph_relations(relation_type);

-- 实体名称索引（快速查找）
CREATE INDEX IF NOT EXISTS graph_entities_name_idx
  ON graph_entities(name);

CREATE INDEX IF NOT EXISTS graph_entities_type_idx
  ON graph_entities(type);

-- ============================================
-- 6. 创建触发器（自动更新 updated_at）
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. 性能优化配置
-- ============================================

-- 增加工作内存（提升排序性能）
-- ALTER SYSTEM SET work_mem = '256MB';
-- SELECT pg_reload_conf();

-- ============================================
-- 8. 示例数据（可选）
-- ============================================

-- 插入测试实体
-- INSERT INTO graph_entities (type, name, properties) VALUES
--   ('Person', '张三', '{"description": "专利发明人"}'::jsonb),
--   ('Organization', '宝宸公司', '{"description": "技术公司"}'::jsonb);

-- 插入测试关系
-- INSERT INTO graph_relations (from_entity_id, to_entity_id, relation_type, weight) VALUES
--   (1, 2, 'OWNS', 0.9);

-- ============================================
-- 完成
-- ============================================

-- 查看表结构
\d memories

-- 查看索引
\di+ memories*

-- 查看扩展
\dx
