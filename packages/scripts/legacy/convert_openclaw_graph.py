#!/usr/bin/env python3
"""
转换 OpenClaw NetworkX 图为 JSON 格式

使用方法:
    python scripts/convert_openclaw_graph.py

输出:
    /Users/xujian/.openclaw/workspace/memory/patent-knowledge-graph/patent_knowledge_graph.json
"""

import pickle
import json
from pathlib import Path
import sys

# ============================================================================
# 配置
# ============================================================================

WORKSPACE = Path.home() / ".openclaw" / "workspace" / "memory" / "patent-knowledge-graph"
GPICKLE_FILE = WORKSPACE / "patent_knowledge_graph_updated.gpickle"
JSON_FILE = WORKSPACE / "patent_knowledge_graph.json"

# ============================================================================
# 转换函数
# ============================================================================

def convert_networkx_to_json():
    """转换 NetworkX 图为 JSON"""
    print("📂 加载 NetworkX 图...")

    try:
        import networkx as nx
        g = pickle.load(open(GPICKLE_FILE, 'rb'))
        print(f"✅ 图加载成功: {len(g.nodes)} 节点, {len(g.edges)} 边")
    except Exception as e:
        print(f"❌ 加载图失败: {e}")
        sys.exit(1)

    # 转换节点
    print("🔄 转换节点...")
    nodes = []
    for node_id, data in g.nodes(data=True):
        # 清理数据（确保可序列化为 JSON）
        clean_data = {}
        for key, value in data.items():
            if isinstance(value, (str, int, float, bool, list, dict)):
                clean_data[key] = value
            else:
                # 跳过不可序列化的类型
                clean_data[key] = str(value)

        nodes.append({
            'id': str(node_id),
            **clean_data
        })

    # 转换边
    print("🔄 转换边...")
    edges = []
    for u, v, data in g.edges(data=True):
        clean_data = {}
        for key, value in data.items():
            if isinstance(value, (str, int, float, bool, list, dict)):
                clean_data[key] = value
            else:
                clean_data[key] = str(value)

        edges.append({
            'from': str(u),
            'to': str(v),
            **clean_data
        })

    # 构建输出数据
    output_data = {
        'metadata': {
            'source': 'OpenClaw Patent Knowledge Graph',
            'format': 'NetworkX to JSON',
            'nodeCount': len(nodes),
            'edgeCount': len(edges),
            'createdAt': str(GPICKLE_FILE.stat().st_ctime)
        },
        'nodes': nodes,
        'edges': edges
    }

    # 保存 JSON
    print(f"💾 保存到 {JSON_FILE}...")
    json.dump(output_data, open(JSON_FILE, 'w'), ensure_ascii=False, indent=2)

    print(f"✅ 转换完成!")
    print(f"   - 节点数: {len(nodes)}")
    print(f"   - 边数: {len(edges)}")
    print(f"   - 文件大小: {JSON_FILE.stat().st_size / 1024 / 1024:.2f} MB")

# ============================================================================
# 主函数
# ============================================================================

if __name__ == '__main__':
    print("=" * 60)
    print("OpenClaw 知识图谱格式转换工具")
    print("=" * 60)
    print()

    # 检查文件是否存在
    if not GPICKLE_FILE.exists():
        print(f"❌ 错误: 找不到图文件 {GPICKLE_FILE}")
        print("请确认 OpenClaw 知识图谱路径正确")
        sys.exit(1)

    try:
        convert_networkx_to_json()
    except Exception as e:
        print(f"❌ 转换失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
