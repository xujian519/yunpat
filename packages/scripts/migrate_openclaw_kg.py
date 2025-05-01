#!/usr/bin/env python3
"""
OpenClaw 专利知识图谱迁移脚本

将 NetworkX pickle 格式的知识图谱迁移到 PostgreSQL (legal_world_model)

数据源：
- patent_knowledge_graph_updated.gpickle (40,034 节点, 407,744 边)
- embeddings.npy (BGE-M3 1024维, 首批1000节点)
- frontend/node_id_map_updated.json (嵌入索引→节点ID映射)

目标表：
- openclaw_kg_nodes (节点)
- openclaw_kg_edges (边)
"""

import pickle
import json
import os
import sys
import time
import numpy as np
from pathlib import Path

try:
    import psycopg
    USING_PSYCOPG3 = True
except ImportError:
    try:
        import psycopg2
        import psycopg2.extras
        USING_PSYCOPG3 = False
    except ImportError:
        print("❌ 需要安装 psycopg2 或 psycopg3: pip install psycopg[binary] 或 pip install psycopg2-binary")
        sys.exit(1)

# ==================== 配置 ====================

GRAPH_DIR = Path(os.environ.get(
    'OPENCLAW_GRAPH_DIR',
    str(Path.home() / '.openclaw' / 'workspace' / 'memory' / 'patent-knowledge-graph')
))
GPICKLE_FILE = GRAPH_DIR / 'patent_knowledge_graph_updated.gpickle'
EMBEDDINGS_FILE = GRAPH_DIR / 'embeddings.npy'
NODE_ID_MAP_FILE = GRAPH_DIR / 'frontend' / 'node_id_map_updated.json'
SEARCH_NODES_FILE = GRAPH_DIR / 'frontend' / 'search_nodes_updated.json'

# 数据库配置
DB_CONFIG = {
    'host': os.environ.get('PG_HOST', 'localhost'),
    'port': int(os.environ.get('PG_PORT', '5432')),
    'dbname': os.environ.get('PG_DATABASE', 'legal_world_model'),
    'user': os.environ.get('PG_USER', 'postgres'),
    'password': os.environ.get('PG_PASSWORD', ''),
}

# 批次大小
BATCH_SIZE = 500

# 节点属性中提取到独立列的字段
NODE_TYPE_KEY = 'node_type'  # NetworkX 中节点类型属性名

# ==================== DDL ====================

CREATE_TABLES_SQL = """
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 节点表
CREATE TABLE IF NOT EXISTS openclaw_kg_nodes (
    node_id TEXT PRIMARY KEY,
    node_type TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    metadata JSONB DEFAULT '{}',
    embedding vector(1024),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 边表
CREATE TABLE IF NOT EXISTS openclaw_kg_edges (
    id SERIAL PRIMARY KEY,
    from_node_id TEXT NOT NULL REFERENCES openclaw_kg_nodes(node_id),
    to_node_id TEXT NOT NULL REFERENCES openclaw_kg_nodes(node_id),
    relation_type TEXT NOT NULL DEFAULT 'related',
    weight REAL DEFAULT 1.0,
    similarity REAL DEFAULT 0.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_openclaw_nodes_type ON openclaw_kg_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_openclaw_edges_from ON openclaw_kg_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_openclaw_edges_to ON openclaw_kg_edges(to_node_id);
CREATE INDEX IF NOT EXISTS idx_openclaw_edges_relation ON openclaw_kg_edges(relation_type);
"""

# 向量索引（数据量大时创建，需要较多内存）
CREATE_VECTOR_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_openclaw_nodes_embedding
ON openclaw_kg_nodes USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
"""

# ==================== 工具函数 ====================

def get_connection():
    """获取数据库连接"""
    if USING_PSYCOPG3:
        conn = psycopg.connect(
            host=DB_CONFIG['host'],
            port=DB_CONFIG['port'],
            dbname=DB_CONFIG['dbname'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            autocommit=False,
        )
    else:
        conn = psycopg2.connect(
            host=DB_CONFIG['host'],
            port=DB_CONFIG['port'],
            dbname=DB_CONFIG['dbname'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
        )
    return conn


def load_graph():
    """加载 NetworkX 图"""
    print(f"📂 加载图谱: {GPICKLE_FILE}")
    if not GPICKLE_FILE.exists():
        print(f"❌ 文件不存在: {GPICKLE_FILE}")
        sys.exit(1)

    with open(GPICKLE_FILE, 'rb') as f:
        g = pickle.load(f)

    print(f"   ✅ 加载完成: {g.number_of_nodes()} 节点, {g.number_of_edges()} 边")
    return g


def load_embeddings():
    """加载嵌入向量和 ID 映射"""
    embeddings = None
    node_id_map = {}

    # 加载嵌入向量
    if EMBEDDINGS_FILE.exists():
        print(f"📂 加载嵌入向量: {EMBEDDINGS_FILE}")
        embeddings = np.load(str(EMBEDDINGS_FILE))
        print(f"   ✅ 加载完成: shape={embeddings.shape}")
    else:
        print(f"⚠️  嵌入向量文件不存在: {EMBEDDINGS_FILE}")

    # 加载 ID 映射 (index → node_id)
    if NODE_ID_MAP_FILE.exists():
        print(f"📂 加载节点ID映射: {NODE_ID_MAP_FILE}")
        with open(NODE_ID_MAP_FILE, 'r') as f:
            node_id_map = json.load(f)
        print(f"   ✅ 加载完成: {len(node_id_map)} 条映射")
    else:
        print(f"⚠️  节点ID映射文件不存在: {NODE_ID_MAP_FILE}")

    return embeddings, node_id_map


def extract_node_data(node_id, attrs):
    """从 NetworkX 节点属性提取标准化数据"""
    # 确定节点类型
    node_type = attrs.get(NODE_TYPE_KEY, attrs.get('type', 'Unknown'))

    # 提取基本信息
    name = attrs.get('name', attrs.get('title', str(node_id)))
    title = attrs.get('title', name)
    content = attrs.get('content', attrs.get('description', ''))

    # 收集额外属性到 metadata
    known_keys = {NODE_TYPE_KEY, 'type', 'name', 'title', 'content', 'description', 'embedding'}
    metadata = {}
    for k, v in attrs.items():
        if k not in known_keys and isinstance(v, (str, int, float, bool, list)):
            metadata[k] = v

    return {
        'node_id': str(node_id),
        'node_type': str(node_type),
        'name': str(name),
        'title': str(title),
        'content': str(content),
        'metadata': json.dumps(metadata, ensure_ascii=False, default=str),
    }


def extract_edge_data(source, target, attrs):
    """从 NetworkX 边属性提取标准化数据"""
    relation_type = attrs.get('relation', attrs.get('type', 'related'))
    weight = float(attrs.get('weight', 1.0))
    similarity = float(attrs.get('similarity', 0.0))

    # 额外属性
    known_keys = {'relation', 'type', 'weight', 'similarity'}
    metadata = {}
    for k, v in attrs.items():
        if k not in known_keys and isinstance(v, (str, int, float, bool, list)):
            metadata[k] = v

    return {
        'from_node_id': str(source),
        'to_node_id': str(target),
        'relation_type': str(relation_type),
        'weight': weight,
        'similarity': similarity,
        'metadata': json.dumps(metadata, ensure_ascii=False, default=str),
    }


# ==================== 迁移主逻辑 ====================

def create_tables(conn):
    """创建目标表"""
    print("\n🏗️  创建目标表...")
    cursor = conn.cursor()
    cursor.execute(CREATE_TABLES_SQL)
    conn.commit()
    print("   ✅ 表创建完成")


def truncate_tables(conn):
    """清空目标表（幂等重跑时使用）"""
    print("\n🧹 清空目标表...")
    cursor = conn.cursor()
    cursor.execute("TRUNCATE openclaw_kg_edges, openclaw_kg_nodes CASCADE")
    conn.commit()
    print("   ✅ 表已清空")


def insert_nodes(conn, graph, embeddings, node_id_map):
    """批量插入节点"""
    print(f"\n📝 插入节点 (batch_size={BATCH_SIZE})...")

    # 构建嵌入映射: node_id → vector
    embedding_map = {}
    if embeddings is not None and node_id_map:
        for node_id, idx in node_id_map.items():
            if isinstance(idx, int) and idx < len(embeddings):
                embedding_map[node_id] = embeddings[idx].tolist()

    cursor = conn.cursor()
    nodes = list(graph.nodes(data=True))
    total = len(nodes)
    inserted = 0
    errors = 0

    batch = []
    for i, (node_id, attrs) in enumerate(nodes):
        try:
            data = extract_node_data(node_id, attrs)

            # 附加嵌入向量
            embedding = embedding_map.get(str(node_id))
            if embedding is not None:
                batch.append((
                    data['node_id'], data['node_type'], data['name'],
                    data['title'], data['content'], data['metadata'],
                    str(embedding) if embedding else None,
                ))
            else:
                batch.append((
                    data['node_id'], data['node_type'], data['name'],
                    data['title'], data['content'], data['metadata'],
                    None,
                ))

            # 批量插入
            if len(batch) >= BATCH_SIZE:
                if USING_PSYCOPG3:
                    cursor.executemany(
                        """INSERT INTO openclaw_kg_nodes
                           (node_id, node_type, name, title, content, metadata, embedding)
                           VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                           ON CONFLICT (node_id) DO NOTHING""",
                        batch
                    )
                else:
                    psycopg2.extras.execute_batch(
                        cursor,
                        """INSERT INTO openclaw_kg_nodes
                           (node_id, node_type, name, title, content, metadata, embedding)
                           VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                           ON CONFLICT (node_id) DO NOTHING""",
                        batch
                    )
                inserted += len(batch)
                conn.commit()
                batch = []
                print(f"   进度: {inserted}/{total} ({inserted*100//total}%)")

        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"   ⚠️  节点 {node_id} 插入失败: {e}")

    # 插入剩余
    if batch:
        if USING_PSYCOPG3:
            cursor.executemany(
                """INSERT INTO openclaw_kg_nodes
                   (node_id, node_type, name, title, content, metadata, embedding)
                   VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                   ON CONFLICT (node_id) DO NOTHING""",
                batch
            )
        else:
            psycopg2.extras.execute_batch(
                cursor,
                """INSERT INTO openclaw_kg_nodes
                   (node_id, node_type, name, title, content, metadata, embedding)
                   VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                   ON CONFLICT (node_id) DO NOTHING""",
                batch
            )
        inserted += len(batch)
        conn.commit()

    embedding_count = len(embedding_map)
    print(f"   ✅ 节点插入完成: {inserted} 成功, {errors} 失败, {embedding_count} 有嵌入")
    return inserted, embedding_count


def insert_edges(conn, graph):
    """批量插入边"""
    print(f"\n📝 插入边 (batch_size={BATCH_SIZE})...")

    cursor = conn.cursor()
    edges = list(graph.edges(data=True))
    total = len(edges)
    inserted = 0
    errors = 0

    batch = []
    for i, (source, target, attrs) in enumerate(edges):
        try:
            data = extract_edge_data(source, target, attrs)
            batch.append((
                data['from_node_id'], data['to_node_id'],
                data['relation_type'], data['weight'],
                data['similarity'], data['metadata'],
            ))

            if len(batch) >= BATCH_SIZE:
                if USING_PSYCOPG3:
                    cursor.executemany(
                        """INSERT INTO openclaw_kg_edges
                           (from_node_id, to_node_id, relation_type, weight, similarity, metadata)
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        batch
                    )
                else:
                    psycopg2.extras.execute_batch(
                        cursor,
                        """INSERT INTO openclaw_kg_edges
                           (from_node_id, to_node_id, relation_type, weight, similarity, metadata)
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        batch
                    )
                inserted += len(batch)
                conn.commit()
                batch = []
                if inserted % 10000 == 0 or inserted == total:
                    print(f"   进度: {inserted}/{total} ({inserted*100//total}%)")

        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"   ⚠️  边 {source}→{target} 插入失败: {e}")

    # 插入剩余
    if batch:
        if USING_PSYCOPG3:
            cursor.executemany(
                """INSERT INTO openclaw_kg_edges
                   (from_node_id, to_node_id, relation_type, weight, similarity, metadata)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                batch
            )
        else:
            psycopg2.extras.execute_batch(
                cursor,
                """INSERT INTO openclaw_kg_edges
                   (from_node_id, to_node_id, relation_type, weight, similarity, metadata)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                batch
            )
        inserted += len(batch)
        conn.commit()

    print(f"   ✅ 边插入完成: {inserted} 成功, {errors} 失败")
    return inserted


def create_vector_index(conn):
    """创建向量索引（可能耗时较长）"""
    print("\n🔍 创建向量索引...")
    cursor = conn.cursor()
    try:
        cursor.execute(CREATE_VECTOR_INDEX_SQL)
        conn.commit()
        print("   ✅ 向量索引创建完成")
    except Exception as e:
        print(f"   ⚠️  向量索引创建失败（可稍后手动执行）: {e}")
        conn.rollback()


def print_stats(conn):
    """打印最终统计"""
    print("\n" + "=" * 60)
    print("📊 迁移统计")
    print("=" * 60)

    cursor = conn.cursor()

    # 节点统计
    cursor.execute("SELECT COUNT(*) FROM openclaw_kg_nodes")
    node_count = cursor.fetchone()[0]

    cursor.execute("SELECT node_type, COUNT(*) FROM openclaw_kg_nodes GROUP BY node_type ORDER BY COUNT(*) DESC")
    type_dist = cursor.fetchall()

    cursor.execute("SELECT COUNT(*) FROM openclaw_kg_nodes WHERE embedding IS NOT NULL")
    embedding_count = cursor.fetchone()[0]

    # 边统计
    cursor.execute("SELECT COUNT(*) FROM openclaw_kg_edges")
    edge_count = cursor.fetchone()[0]

    cursor.execute("SELECT relation_type, COUNT(*) FROM openclaw_kg_edges GROUP BY relation_type ORDER BY COUNT(*) DESC")
    rel_dist = cursor.fetchall()

    print(f"\n节点总数: {node_count:,}")
    print(f"嵌入覆盖: {embedding_count:,} ({embedding_count*100//max(node_count,1):.1f}%)")
    print(f"\n节点类型分布:")
    for ntype, count in type_dist:
        print(f"  {ntype:30s} {count:>6,}")

    print(f"\n边总数: {edge_count:,}")
    print(f"\n关系类型分布:")
    for rtype, count in rel_dist[:15]:
        print(f"  {rtype:30s} {count:>6,}")
    if len(rel_dist) > 15:
        print(f"  ... (共 {len(rel_dist)} 种关系类型)")


# ==================== 主入口 ====================

def main():
    start_time = time.time()

    print("=" * 60)
    print("🔄 OpenClaw 专利知识图谱 → PostgreSQL 迁移")
    print("=" * 60)

    # 1. 加载源数据
    graph = load_graph()
    embeddings, node_id_map = load_embeddings()

    # 2. 连接数据库
    print(f"\n🔌 连接数据库: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['dbname']}")
    conn = get_connection()
    print("   ✅ 连接成功")

    try:
        # 3. 创建表
        create_tables(conn)

        # 4. 清空旧数据（幂等）
        truncate_tables(conn)

        # 5. 插入节点
        node_count, emb_count = insert_nodes(conn, graph, embeddings, node_id_map)

        # 6. 插入边
        edge_count = insert_edges(conn, graph)

        # 7. 创建向量索引
        if emb_count > 0:
            create_vector_index(conn)

        # 8. 打印统计
        print_stats(conn)

    finally:
        conn.close()

    elapsed = time.time() - start_time
    print(f"\n⏱️  总耗时: {elapsed:.1f}s")
    print("✅ 迁移完成!")


if __name__ == '__main__':
    main()
