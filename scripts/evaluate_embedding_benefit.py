#!/usr/bin/env python3
"""
快速评估 Embedding 语义路由收益

使用本地 8009 端口 bge-m3-mlx-8bit 模型，对 golden-seed-v1.json 进行 embedding 路由评估，
与规则引擎基准（80% 准确率，0.042ms）对比。

运行方式:
    python3 scripts/evaluate_embedding_benefit.py
"""

import json
import yaml
import time
import math
import sys
from typing import List, Tuple, Dict, Optional
import urllib.request

# =============================================================================
# 配置
# =============================================================================
EMBEDDING_URL = "http://localhost:8009/v1/embeddings"
EMBEDDING_API_KEY = "xj781102@"
EMBEDDING_MODEL = "bge-m3-mlx-8bit"
GOLDEN_SEED_PATH = "packages/tests/benchmark/intent/golden-seed-v1.json"
INTENT_SCHEMA_PATH = "packages/config/intent-schema.yaml"

# 语义相似度阈值（与 Rust 代码对齐）
SEMANTIC_THRESHOLD = 0.78
SEMANTIC_MEDIUM_THRESHOLD = 0.65

# =============================================================================
# Embedding API 调用
# =============================================================================

def get_embedding(text: str) -> Optional[List[float]]:
    """调用本地 bge-m3 获取 embedding"""
    req = urllib.request.Request(
        EMBEDDING_URL,
        data=json.dumps({
            "model": EMBEDDING_MODEL,
            "input": text
        }).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {EMBEDDING_API_KEY}"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["data"][0]["embedding"]
    except Exception as e:
        print(f"  ⚠️ Embedding API error: {e}", file=sys.stderr)
        return None


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """计算两个向量的余弦相似度"""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# =============================================================================
# 意图描述生成
# =============================================================================

def build_intent_descriptions(schema: dict) -> List[Tuple[str, str, str]]:
    """
    从 schema 构建意图描述列表。
    返回: [(intent_id, label, description), ...]
    """
    results = []
    for intent in schema.get("intents", []):
        intent_id = intent["id"]
        label = intent.get("label", "")
        desc = intent.get("description", "")
        # 组合关键词增强描述
        keywords = intent.get("keywords", {})
        primary = keywords.get("primary", [])
        secondary = keywords.get("secondary", [])
        synonyms = intent.get("synonyms", {})
        
        # 构建富文本描述
        rich_desc = desc
        if primary:
            rich_desc += f" 相关关键词: {', '.join(primary[:5])}."
        if secondary:
            rich_desc += f" 次要关键词: {', '.join(secondary[:3])}."
        
        results.append((intent_id, label, rich_desc))
    
    return results


# =============================================================================
# 评估主逻辑
# =============================================================================

def evaluate():
    print("=" * 70)
    print("Embedding 语义路由收益评估")
    print("=" * 70)
    print(f"模型: {EMBEDDING_MODEL} (本地 8009 端口)")
    print(f"阈值: 高置信度 ≥ {SEMANTIC_THRESHOLD}, 中置信度 ≥ {SEMANTIC_MEDIUM_THRESHOLD}")
    print()

    # 加载 schema
    with open(INTENT_SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema = yaml.safe_load(f)
    
    intent_descs = build_intent_descriptions(schema)
    print(f"Schema 意图数: {len(intent_descs)}")
    for iid, label, _ in intent_descs:
        print(f"  - {iid}: {label}")
    print()

    # 加载 golden seed
    with open(GOLDEN_SEED_PATH, "r", encoding="utf-8") as f:
        golden = json.load(f)
    
    tests = golden["tests"]
    print(f"测试集: {len(tests)} 条 (golden-seed-v1)")
    print()

    # -------------------------------------------------------------------------
    # Step 1: 预计算意图描述的 embedding
    # -------------------------------------------------------------------------
    print("Step 1: 预计算意图描述 embedding...")
    intent_embeddings = {}
    for intent_id, label, desc in intent_descs:
        # 使用描述 + 标签组合
        text_for_embedding = f"{label}: {desc}"
        emb = get_embedding(text_for_embedding)
        if emb:
            intent_embeddings[intent_id] = emb
            print(f"  ✓ {intent_id}")
        else:
            print(f"  ✗ {intent_id} — 失败")
            return
    
    # 额外添加 "multi_intent" 和 "chitchat" 等 schema 中可能没有完整定义的意图
    extra_intents = {
        "multi_intent": "用户输入包含多个不同的意图或需求，需要分别处理",
        "chitchat": "用户进行闲聊、打招呼、询问系统能力或表达感谢，与专利业务无关",
        "clarify": "用户输入模糊不清，无法确定具体意图，需要进一步澄清",
        "coding": "用户请求编写代码、生成程序或进行软件开发相关任务",
    }
    for intent_id, desc in extra_intents.items():
        if intent_id not in intent_embeddings:
            emb = get_embedding(desc)
            if emb:
                intent_embeddings[intent_id] = emb
                print(f"  ✓ {intent_id} (extra)")
    
    print(f"\n预计算完成: {len(intent_embeddings)} 个意图 embedding")
    print()

    # -------------------------------------------------------------------------
    # Step 2: 逐条评估测试用例
    # -------------------------------------------------------------------------
    print("Step 2: 评估测试用例...")
    
    results = []
    correct = 0
    incorrect = 0
    total_latency = 0.0
    below_threshold = 0
    
    # 先计算所有测试用例的 embedding（模拟在线场景）
    test_embeddings = {}
    print("  计算查询 embedding...")
    for test in tests:
        text = test["text"]
        start = time.time()
        emb = get_embedding(text)
        elapsed = time.time() - start
        total_latency += elapsed
        if emb:
            test_embeddings[test["id"]] = (emb, elapsed)
        else:
            print(f"    ✗ {test['id']} — embedding 失败")
    
    print(f"  查询 embedding 完成: {len(test_embeddings)}/{len(tests)}")
    print()
    
    print("  路由评估:")
    for test in tests:
        test_id = test["id"]
        text = test["text"]
        expected = test["expected_intent"]
        
        if test_id not in test_embeddings:
            results.append({
                "id": test_id,
                "text": text,
                "expected": expected,
                "routed": "ERROR",
                "similarity": 0.0,
                "correct": False,
                "reason": "embedding_failed"
            })
            incorrect += 1
            print(f"    ✗ {test_id} — embedding 失败")
            continue
        
        emb, _ = test_embeddings[test_id]
        
        # 计算与所有意图的相似度
        best_intent = None
        best_sim = -1.0
        all_sims = []
        
        for intent_id, intent_emb in intent_embeddings.items():
            sim = cosine_similarity(emb, intent_emb)
            all_sims.append((intent_id, sim))
            if sim > best_sim:
                best_sim = sim
                best_intent = intent_id
        
        all_sims.sort(key=lambda x: x[1], reverse=True)
        
        # 判断是否正确
        is_correct = (best_intent == expected)
        
        if is_correct:
            correct += 1
            mark = "✓"
        else:
            incorrect += 1
            mark = "✗"
        
        if best_sim < SEMANTIC_MEDIUM_THRESHOLD:
            below_threshold += 1
        
        results.append({
            "id": test_id,
            "text": text[:40] + "..." if len(text) > 40 else text,
            "expected": expected,
            "routed": best_intent,
            "similarity": best_sim,
            "top3": all_sims[:3],
            "correct": is_correct,
        })
        
        sim_str = f"{best_sim:.3f}"
        detail = f"(期望: {expected}, top3: {', '.join(f'{i}:{s:.2f}' for i,s in all_sims[:3])})"
        print(f"    {mark} {test_id} [{sim_str}] → {best_intent} {detail}")
    
    print()
    
    # -------------------------------------------------------------------------
    # Step 3: 统计与对比
    # -------------------------------------------------------------------------
    print("=" * 70)
    print("评估结果")
    print("=" * 70)
    
    accuracy = correct / len(tests) * 100
    avg_latency = total_latency / len(tests) * 1000  # ms
    p95_latency = sorted([lat for _, lat in test_embeddings.values()])[int(len(test_embeddings) * 0.95)] * 1000 if test_embeddings else 0
    
    print(f"总测试数:     {len(tests)}")
    print(f"正确:         {correct}")
    print(f"错误:         {incorrect}")
    print(f"准确率:       {accuracy:.1f}%")
    print(f"平均延迟:     {avg_latency:.2f} ms")
    print(f"P95 延迟:     {p95_latency:.2f} ms")
    print(f"低于中阈值:   {below_threshold} 条 (相似度 < {SEMANTIC_MEDIUM_THRESHOLD})")
    print()
    
    # 与规则引擎对比
    print("=" * 70)
    print("与规则引擎对比")
    print("=" * 70)
    print(f"规则引擎:     80.0% 准确率, 0.042 ms 平均延迟")
    print(f"Embedding:    {accuracy:.1f}% 准确率, {avg_latency:.2f} ms 平均延迟")
    print()
    
    delta = accuracy - 80.0
    if delta > 5:
        print(f"📈 Embedding 路由显著优于规则引擎 (+{delta:.1f}%)，建议投入生产")
    elif delta > 0:
        print(f"📊 Embedding 路由略优于规则引擎 (+{delta:.1f}%)，可作为补充层")
    elif delta > -5:
        print(f"📊 Embedding 路由与规则引擎接近 ({delta:.1f}%)，需分析失败案例")
    else:
        print(f"📉 Embedding 路由明显劣于规则引擎 ({delta:.1f}%)，暂不建议单独使用")
    
    print()
    
    # -------------------------------------------------------------------------
    # Step 4: 失败案例分析
    # -------------------------------------------------------------------------
    print("=" * 70)
    print("失败案例分析")
    print("=" * 70)
    
    wrong_cases = [r for r in results if not r["correct"]]
    
    if not wrong_cases:
        print("🎉 全部通过！")
    else:
        for r in wrong_cases:
            print(f"\n  {r['id']}: {r['text']}")
            print(f"    期望: {r['expected']} | 路由到: {r['routed']} | 相似度: {r['similarity']:.3f}")
            if "top3" in r:
                print(f"    Top3 相似度: {', '.join(f'{i}={s:.3f}' for i,s in r['top3'])}")
    
    print()
    
    # -------------------------------------------------------------------------
    # Step 5: 分层统计
    # -------------------------------------------------------------------------
    print("=" * 70)
    print("按类别统计")
    print("=" * 70)
    
    category_stats = {}
    for test in tests:
        cat = test["id"].split("-")[0]
        if cat not in category_stats:
            category_stats[cat] = {"total": 0, "correct": 0}
        category_stats[cat]["total"] += 1
    
    for r in results:
        if r["correct"]:
            cat = r["id"].split("-")[0]
            category_stats[cat]["correct"] += 1
    
    for cat, stats in sorted(category_stats.items()):
        acc = stats["correct"] / stats["total"] * 100 if stats["total"] > 0 else 0
        print(f"  {cat:12s}: {stats['correct']}/{stats['total']} = {acc:.1f}%")
    
    print()
    
    # -------------------------------------------------------------------------
    # 结论
    # -------------------------------------------------------------------------
    print("=" * 70)
    print("结论与建议")
    print("=" * 70)
    
    if accuracy >= 85:
        print("✅ Embedding 路由收益显著，建议:")
        print("   1. 在 Rust Gateway 中配置本地 bge-m3 模型 (8009 端口)")
        print("   2. 将 Embedding 层作为规则引擎后的第二层（而非替代）")
        print("   3. 预计算意图 embedding，减少在线延迟")
    elif accuracy >= 75:
        print("⚠️  Embedding 路由有一定收益但不够稳定，建议:")
        print("   1. 作为规则引擎的补充层（规则未命中时启用）")
        print("   2. 调低阈值让更多 case 进入 LLM 兜底")
        print("   3. 重点优化失败案例的意图描述")
    else:
        print("❌ Embedding 路由当前收益不足，建议:")
        print("   1. 优化意图描述文本（加入更多 examples）")
        print("   2. 使用更大/更好的嵌入模型")
        print("   3. 保持规则引擎为主，Embedding 仅用于特定歧义场景")
    
    print()
    
    # 保存详细结果
    output_path = "data/checkpoints/embedding_evaluation_result.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "model": EMBEDDING_MODEL,
            "threshold": SEMANTIC_THRESHOLD,
            "medium_threshold": SEMANTIC_MEDIUM_THRESHOLD,
            "total_tests": len(tests),
            "correct": correct,
            "incorrect": incorrect,
            "accuracy": accuracy,
            "avg_latency_ms": avg_latency,
            "p95_latency_ms": p95_latency,
            "results": results,
        }, f, ensure_ascii=False, indent=2)
    
    print(f"详细结果已保存: {output_path}")


if __name__ == "__main__":
    evaluate()
