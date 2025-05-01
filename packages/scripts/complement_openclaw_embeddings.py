#!/usr/bin/env python3
"""
OpenClaw 知识图谱嵌入补全脚本

为 openclaw_kg_nodes 表中尚未生成嵌入的节点批量生成 BGE-M3 1024维向量。
使用本地 oMLX (port 8009) 的 bge-m3-mlx-8bit 模型，支持批量嵌入。
"""

from __future__ import annotations
import json
import os
import sys
import time
from pathlib import Path

try:
    import psycopg
    USING_PSYCOPG3 = True
except ImportError:
    import psycopg2
    import psycopg2.extras
    USING_PSYCOPG3 = False

try:
    import requests
except ImportError:
    print("需要 requests: pip install requests")
    sys.exit(1)

DB_CONFIG = {
    'host': os.environ.get('PG_HOST', 'localhost'),
    'port': int(os.environ.get('PG_PORT', '5432')),
    'dbname': os.environ.get('PG_DATABASE', 'legal_world_model'),
    'user': os.environ.get('PG_USER', 'postgres'),
    'password': os.environ.get('PG_PASSWORD', ''),
}

EMBEDDING_API_URL = os.environ.get(
    'EMBEDDING_API_URL',
    'http://localhost:8009/v1/embeddings'
)
EMBEDDING_API_KEY = os.environ.get('EMBEDDING_API_KEY', 'xj781102@')
EMBEDDING_MODEL = os.environ.get('EMBEDDING_MODEL', 'bge-m3-mlx-8bit')
BATCH_SIZE = 32  # 每次API调用发送的文本数
DB_BATCH_SIZE = 50  # 每次数据库提交的行数（嵌入向量较大，需小批次）
MAX_TEXT_LEN = 2000
MAX_RETRIES = 3


def get_connection():
    if USING_PSYCOPG3:
        return psycopg.connect(
            host=DB_CONFIG['host'], port=DB_CONFIG['port'],
            dbname=DB_CONFIG['dbname'], user=DB_CONFIG['user'],
            password=DB_CONFIG['password'], autocommit=False,
        )
    return psycopg2.connect(
        host=DB_CONFIG['host'], port=DB_CONFIG['port'],
        dbname=DB_CONFIG['dbname'], user=DB_CONFIG['user'],
        password=DB_CONFIG['password'],
    )


def get_embeddings_batch(texts: list[str]) -> list[list[float] | None]:
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {EMBEDDING_API_KEY}',
    }
    payload = {
        'model': EMBEDDING_MODEL,
        'input': texts,
        'encoding_format': 'float',
    }

    try:
        resp = requests.post(EMBEDDING_API_URL, json=payload, headers=headers, timeout=120)
        if resp.status_code == 200:
            data = resp.json()
            results = [None] * len(texts)
            for item in data.get('data', []):
                idx = item.get('index', 0)
                results[idx] = item['embedding']
            return results
        else:
            print(f"  API 错误 {resp.status_code}: {resp.text[:200]}")
            return [None] * len(texts)
    except Exception as e:
        print(f"  API 调用失败: {e}")
        return [None] * len(texts)


def main():
    start_time = time.time()
    print("=" * 60)
    print("OpenClaw 知识图谱嵌入补全")
    print("=" * 60)
    print(f"模型: {EMBEDDING_MODEL}")
    print(f"端点: {EMBEDDING_API_URL}")
    print(f"批次: API={BATCH_SIZE}, DB={DB_BATCH_SIZE}")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM openclaw_kg_nodes WHERE embedding IS NULL")
    pending = int(cursor.fetchone()[0])
    cursor.execute("SELECT COUNT(*) FROM openclaw_kg_nodes WHERE embedding IS NOT NULL")
    done = int(cursor.fetchone()[0])

    print(f"\n当前: {done:,} 已嵌入 / {pending:,} 待嵌入")
    if pending == 0:
        print("所有节点已有嵌入，无需补全")
        conn.close()
        return

    total_updated = 0
    total_errors = 0
    api_calls = 0

    # 一次性取所有待嵌入节点的文本（40K 行，内存可承受）
    cursor.execute(
        "SELECT node_id, title, content FROM openclaw_kg_nodes "
        "WHERE embedding IS NULL ORDER BY node_id"
    )
    all_rows = cursor.fetchall()
    print(f"已加载 {len(all_rows):,} 条待嵌入记录\n")

    # 分批调用 API
    update_buffer = []

    for i in range(0, len(all_rows), BATCH_SIZE):
        batch_rows = all_rows[i:i + BATCH_SIZE]
        texts = []
        for node_id, title, content in batch_rows:
            text = (f"{title}\n{content}" if content else title or node_id)[:MAX_TEXT_LEN]
            texts.append(text)

        embeddings = get_embeddings_batch(texts)
        api_calls += 1

        for (node_id, _, _), emb in zip(batch_rows, embeddings):
            if emb is not None:
                update_buffer.append((str(emb), node_id))
            else:
                total_errors += 1

        # 批量写回数据库
        if len(update_buffer) >= DB_BATCH_SIZE:
            _flush_updates(cursor, update_buffer, conn)
            conn.commit()
            total_updated += len(update_buffer)
            update_buffer = []

            elapsed = time.time() - start_time
            rate = total_updated / elapsed
            eta = (pending - total_updated) / rate if rate > 0 else 0
            pct = total_updated * 100 // pending
            print(f"  进度: {total_updated:,}/{pending:,} ({pct}%) "
                  f"速率: {rate:.1f}/s ETA: {eta/60:.1f}min")

    if update_buffer:
        _flush_updates(cursor, update_buffer, conn)
        conn.commit()
        total_updated += len(update_buffer)

    conn.close()

    elapsed = time.time() - start_time
    print(f"\n{'=' * 60}")
    print(f"完成: {total_updated:,} 成功 / {total_errors} 失败")
    print(f"API 调用: {api_calls} 次")
    print(f"耗时: {elapsed:.1f}s ({total_updated/elapsed:.1f}/s)")


def _flush_updates(cursor, buffer, conn):
    for attempt in range(MAX_RETRIES):
        try:
            if USING_PSYCOPG3:
                cursor.executemany(
                    "UPDATE openclaw_kg_nodes SET embedding = %s::vector WHERE node_id = %s",
                    buffer
                )
            else:
                psycopg2.extras.execute_batch(
                    cursor,
                    "UPDATE openclaw_kg_nodes SET embedding = %s::vector WHERE node_id = %s",
                    buffer
                )
            return
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                print(f"  DB 写入失败 (尝试 {attempt+1}/{MAX_RETRIES}): {e}")
                try:
                    conn.rollback()
                    conn.reset()
                except:
                    pass
            else:
                print(f"  DB 写入彻底失败，跳过本批: {e}")
                try:
                    conn.rollback()
                except:
                    pass


if __name__ == '__main__':
    main()
