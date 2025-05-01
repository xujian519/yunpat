#!/usr/bin/env python3
"""
为专利无效决定生成向量嵌入（Python 版本）

使用 BGE-M3 模型生成向量嵌入，并存储到 PostgreSQL
"""

import psycopg2
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Tuple
import time

# 配置
CONFIG = {
    'pg_host': 'localhost',
    'pg_port': 5432,
    'pg_database': 'legal_world_model',
    'pg_user': 'postgres',
    'pg_password': 'nxLVXyZ3e87L0kE8Xqx3AB9NK1z74pwOdjugqpc7hc',

    # 测试模式
    'test_mode': True,
    'max_documents': 10,

    # 分块配置
    'chunk_size': 500,
    'chunk_overlap': 50,
    'max_chunks': 10,
}

def chunk_text(text: str, chunk_size: int, overlap: int, max_chunks: int) -> List[str]:
    """分块处理文本"""
    chunks = []
    paragraphs = text.split('\n\n')
    current_chunk = ''

    for paragraph in paragraphs:
        if len(current_chunk) + len(paragraph) > chunk_size:
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = paragraph[-overlap:] if len(paragraph) > overlap else paragraph
            else:
                # 单个段落太长，强制分割
                for i in range(0, len(paragraph), chunk_size - overlap):
                    chunks.append(paragraph[i:i + chunk_size])
        else:
            current_chunk += ('\n\n' if current_chunk else '') + paragraph

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks[:max_chunks]

def main():
    print("=" * 40)
    print("专利无效决定向量嵌入生成器（Python 版本）")
    print("=" * 40)
    print(f"\n测试模式: 只处理前 {CONFIG['max_documents']} 个文档\n")

    # 连接数据库
    print("[Step 1] 连接数据库...")
    conn = psycopg2.connect(
        host=CONFIG['pg_host'],
        port=CONFIG['pg_port'],
        database=CONFIG['pg_database'],
        user=CONFIG['pg_user'],
        password=CONFIG['pg_password']
    )
    cursor = conn.cursor()
    print("✅ 数据库连接成功")

    # 创建表
    print("\n[Step 2] 创建向量表...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patent_decisions_v2_embeddings (
            id SERIAL PRIMARY KEY,
            document_id UUID NOT NULL,
            document_number VARCHAR(255),
            chunk_index INTEGER,
            chunk_text TEXT NOT NULL,
            vector VECTOR(1024) NOT NULL,
            weight DOUBLE PRECISION DEFAULT 1.0,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)
    conn.commit()
    print("✅ 向量表创建成功")

    # 加载 BGE-M3 模型
    print("\n[Step 3] 加载 BGE-M3 模型...")
    model = SentenceTransformer('BAAI/bge-m3')
    print("✅ BGE-M3 模型加载成功")

    # 查询文档
    print("\n[Step 4] 查询文档...")
    limit = CONFIG['max_documents'] if CONFIG['test_mode'] else 9562
    cursor.execute(
        "SELECT id, document_number, content FROM patent_decisions_v2 ORDER BY id LIMIT %s",
        (limit,)
    )
    documents = cursor.fetchall()
    print(f"✅ 找到 {len(documents)} 个文档")

    # 生成向量嵌入
    print("\n[Step 5] 生成向量嵌入...")
    total_chunks = 0
    start_time = time.time()

    for i, (doc_id, doc_number, content) in enumerate(documents, 1):
        print(f"\n处理文档 {i}/{len(documents)}: {doc_number}")

        # 分块
        chunks = chunk_text(content, CONFIG['chunk_size'], CONFIG['chunk_overlap'], CONFIG['max_chunks'])
        print(f"  分块数: {len(chunks)}")

        # 生成向量嵌入
        for j, chunk in enumerate(chunks):
            try:
                print(f"    生成向量 {j + 1}/{len(chunks)}...", end='', flush=True)

                # 生成向量
                embedding = model.encode(chunk, normalize_embeddings=True)

                # 插入数据库
                cursor.execute(
                    """
                    INSERT INTO patent_decisions_v2_embeddings
                      (document_id, document_number, chunk_index, chunk_text, vector)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (doc_id, doc_number, j, chunk, embedding.tolist())
                )

                total_chunks += 1
                print(" ✅")

            except Exception as err:
                print(f" ❌ 失败: {err}")

        # 每 5 个文档提交一次
        if i % 5 == 0:
            conn.commit()

    # 最终提交
    conn.commit()

    # 统计
    elapsed = time.time() - start_time
    print(f"\n✅ 向量嵌入生成完成: {total_chunks} 个向量")
    print(f"   总耗时: {elapsed:.1f} 秒")
    print(f"   平均速度: {total_chunks / elapsed:.2f} 向量/秒")

    # 查询统计
    cursor.execute("SELECT COUNT(*) FROM patent_decisions_v2_embeddings")
    count = cursor.fetchone()[0]
    print(f"\n总向量数: {count}")

    print("\n" + "=" * 40)
    print("✅ 测试完成！")
    print("=" * 40)

    # 关闭连接
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
