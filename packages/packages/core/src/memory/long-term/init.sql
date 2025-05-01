-- PostgreSQL + pgvector 初始化脚本
--
-- 使用方法：
--   psql -U yunpat -d yunpat -f init.sql

-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 启用 UUID 扩展（可选）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建记忆表（如果不存在）
CREATE TABLE IF NOT EXISTS memories (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  embedding TEXT NOT NULL DEFAULT '[]',
  metadata JSONB,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建 HNSW 索引（向量相似度搜索）
CREATE INDEX IF NOT EXISTS memories_embedding_hnsw_idx
ON memories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 创建元数据索引（JSONB 查询）
CREATE INDEX IF NOT EXISTS memories_metadata_idx
ON memories
USING gin (metadata);

-- 创建类型索引
CREATE INDEX IF NOT EXISTS memories_type_idx
ON memories (type);

-- 创建归档状态索引
CREATE INDEX IF NOT EXISTS memories_archived_idx
ON memories (is_archived);

-- 创建复合索引（类型 + 创建时间）
CREATE INDEX IF NOT EXISTS memories_type_created_at_idx
ON memories (type, created_at);

-- 创建图实体表
CREATE TABLE IF NOT EXISTS graph_entities (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  properties JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (type, name)
);

-- 创建图关系表
CREATE TABLE IF NOT EXISTS graph_relations (
  id SERIAL PRIMARY KEY,
  from_entity_id INTEGER NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
  to_entity_id INTEGER NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) NOT NULL,
  weight VARCHAR(10) NOT NULL DEFAULT '1.0',
  properties JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建关系索引
CREATE INDEX IF NOT EXISTS graph_relations_from_idx
ON graph_relations (from_entity_id);

CREATE INDEX IF NOT EXISTS graph_relations_to_idx
ON graph_relations (to_entity_id);

CREATE INDEX IF NOT EXISTS graph_relations_type_idx
ON graph_relations (relation_type);

-- 创建用户画像表
CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  preferences JSONB,
  behaviors JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建用户画像索引
CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx
ON user_profiles (user_id);

-- 插入测试数据（可选）
INSERT INTO memories (type, content, embedding, metadata)
VALUES
  ('patent', '专利撰写的关键在于权利要求书的撰写', '[0.1, 0.2, 0.3]', '{"agent": "writer", "tags": ["专利", "撰写"]}'),
  ('patent', '专利检索是专利申请前的重要步骤', '[0.2, 0.3, 0.4]', '{"agent": "researcher", "tags": ["专利", "检索"]}'),
  ('conversation', '今天天气不错', '[0.9, 0.8, 0.7]', '{"tags": ["闲聊"]}')
ON CONFLICT DO NOTHING;

-- 插入测试实体（可选）
INSERT INTO graph_entities (type, name, properties)
VALUES
  ('Patent', 'CN123456', '{"field": "AI"}'),
  ('Company', '宝宸科技', '{"location": "深圳"}'),
  ('Person', '张三', '{"role": "发明人"}')
ON CONFLICT (type, name) DO NOTHING;

-- 插入测试关系（可选）
INSERT INTO graph_relations (from_entity_id, to_entity_id, relation_type, weight)
SELECT
  e1.id,
  e2.id,
  'OWNS',
  '0.9'
FROM graph_entities e1, graph_entities e2
WHERE e1.type = 'Patent' AND e1.name = 'CN123456'
  AND e2.type = 'Company' AND e2.name = '宝宸科技'
ON CONFLICT DO NOTHING;

-- 创建视图：记忆统计
CREATE OR REPLACE VIEW memory_stats AS
SELECT
  type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE is_archived = FALSE) as active_count,
  COUNT(*) FILTER (WHERE is_archived = TRUE) as archived_count,
  MAX(created_at) as latest_created_at
FROM memories
GROUP BY type;

-- 创建视图：图统计
CREATE OR REPLACE VIEW graph_stats AS
SELECT
  'entities' as type,
  COUNT(*) as count
FROM graph_entities
UNION ALL
SELECT
  'relations' as type,
  COUNT(*) as count
FROM graph_relations;

-- 授予权限（根据需要调整）
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO yunpat;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO yunpat;

COMMIT;

-- 显示初始化完成信息
SELECT
  '✅ PostgreSQL + pgvector 初始化完成！' as status,
  '已创建表: memories, graph_entities, graph_relations, user_profiles' as tables,
  '已创建索引: HNSW (向量), GIN (元数据), B-Tree (类型/时间)' as indexes;
