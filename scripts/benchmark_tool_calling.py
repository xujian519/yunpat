#!/usr/bin/env python3
"""
验证 Tool-calling 意图识别方案

使用 DeepSeek API (OpenAI 兼容格式)，将意图定义为 tools，
让 LLM 通过 tool_choice 自主选择意图，与 golden-seed-v1.json 对比。

运行方式:
    python3 scripts/benchmark_tool_calling.py
"""

import json
import yaml
import time
import os
import sys
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

# 使用 OpenAI 兼容客户端
from openai import OpenAI

# =============================================================================
# 配置
# =============================================================================
GOLDEN_SEED_PATH = "packages/tests/benchmark/intent/golden-seed-v1.json"
INTENT_SCHEMA_PATH = "packages/config/intent-schema.yaml"

# DeepSeek API
API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.deepseek.com/v1")
MODEL = os.environ.get("LLM_MODEL", "deepseek-chat")

# =============================================================================
# 构建 Tool Definitions
# =============================================================================

def build_tools(schema: dict) -> List[dict]:
    """
    将 intent-schema 转换为 OpenAI function-calling tools。
    每个意图对应一个 tool，tool 的 description 包含意图描述和示例。
    """
    tools = []
    
    for intent in schema.get("intents", []):
        intent_id = intent["id"]
        label = intent.get("label", "")
        desc = intent.get("description", "")
        examples = intent.get("examples", [])
        keywords = intent.get("keywords", {})
        primary = keywords.get("primary", [])
        
        # 构建 rich description
        rich_desc = f"{label}。{desc}"
        if examples:
            rich_desc += f"\n\n常见用户表述示例：\n" + "\n".join(f"- {ex}" for ex in examples[:5])
        if primary:
            rich_desc += f"\n\n关键词：{', '.join(primary[:8])}"
        
        tool = {
            "type": "function",
            "function": {
                "name": intent_id,
                "description": rich_desc,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reasoning": {
                            "type": "string",
                            "description": "简要说明为什么用户输入匹配这个意图"
                        }
                    },
                    "required": ["reasoning"]
                }
            }
        }
        tools.append(tool)
    
    # 添加特殊意图
    extra_tools = [
        {
            "type": "function",
            "function": {
                "name": "multi_intent",
                "description": "用户同时提出多个不同的需求，需要分别处理。例如：'先帮我检索现有技术，然后撰写完整的专利申请'",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "intents": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "识别到的多个意图列表"
                        },
                        "reasoning": {"type": "string", "description": "简要说明"}
                    },
                    "required": ["intents", "reasoning"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "chitchat",
                "description": "用户进行闲聊、打招呼、询问系统能力、表达感谢，或与专利业务无关的通用对话。例如：'你好'、'谢谢'、'你能做什么'、'写一篇关于人工智能的论文'、'帮我破解软件'",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reasoning": {"type": "string", "description": "简要说明"}
                    },
                    "required": ["reasoning"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "clarify",
                "description": "用户输入模糊不清，无法确定具体意图，需要进一步澄清。例如：'帮我处理一下这个专利的事情'",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reasoning": {"type": "string", "description": "简要说明"}
                    },
                    "required": ["reasoning"]
                }
            }
        },
    ]
    tools.extend(extra_tools)
    
    return tools


# =============================================================================
# Tool-calling 评估
# =============================================================================

@dataclass
class EvalResult:
    test_id: str
    text: str
    expected: str
    routed: str
    reasoning: str
    latency_ms: float
    input_tokens: int
    output_tokens: int
    correct: bool
    raw_response: dict


def evaluate_with_tool_calling(
    client: OpenAI,
    model: str,
    tools: List[dict],
    tests: List[dict],
) -> List[EvalResult]:
    """使用 tool-calling 评估测试集"""
    
    system_prompt = """你是一个专利智能助手的意图识别系统。

你的任务是分析用户的输入，判断用户的真实意图，并调用对应的功能工具。

重要规则：
1. 必须调用一个工具来表示用户的意图，不要返回普通文本回复
2. 如果用户表达模糊、无法判断具体意图，请调用 clarify 工具
3. 如果用户输入与专利业务无关（闲聊、问候、越界请求），请调用 chitchat 工具
4. 如果用户同时提出多个需求，请调用 multi_intent 工具
5. 注意否定词和限定词："不要权利要求"意味着不是 draft_claims，"只要说明书"意味着 draft_spec
6. 多轮对话中的省略句（如"要关于人工智能的"）应继承上下文的意图"""

    results = []
    total_input = 0
    total_output = 0
    
    for i, test in enumerate(tests):
        test_id = test["id"]
        text = test["text"]
        expected = test["expected_intent"]
        
        print(f"  [{i+1}/{len(tests)}] {test_id}: {text[:50]}...", end=" ", flush=True)
        
        start = time.time()
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                tools=tools,
                tool_choice="auto",
                temperature=0.0,
                max_tokens=200,
            )
            latency = (time.time() - start) * 1000
            
            # 解析 tool choice
            choice = response.choices[0]
            message = choice.message
            
            routed = "none"
            reasoning = ""
            
            if message.tool_calls and len(message.tool_calls) > 0:
                tool_call = message.tool_calls[0]
                routed = tool_call.function.name
                try:
                    args = json.loads(tool_call.function.arguments)
                    reasoning = args.get("reasoning", "")
                except:
                    reasoning = tool_call.function.arguments
            elif message.content:
                # LLM 返回了文本而非 tool call
                routed = "text_response"
                reasoning = message.content[:100]
            else:
                routed = "no_response"
            
            correct = (routed == expected)
            mark = "✓" if correct else "✗"
            
            input_tokens = response.usage.prompt_tokens if response.usage else 0
            output_tokens = response.usage.completion_tokens if response.usage else 0
            total_input += input_tokens
            total_output += output_tokens
            
            results.append(EvalResult(
                test_id=test_id,
                text=text,
                expected=expected,
                routed=routed,
                reasoning=reasoning,
                latency_ms=latency,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                correct=correct,
                raw_response=message.model_dump(),
            ))
            
            print(f"{mark} → {routed} ({latency:.0f}ms, {input_tokens}+{output_tokens}tok)")
            
        except Exception as e:
            latency = (time.time() - start) * 1000
            print(f"✗ ERROR: {e}")
            results.append(EvalResult(
                test_id=test_id,
                text=text,
                expected=expected,
                routed="ERROR",
                reasoning=str(e)[:100],
                latency_ms=latency,
                input_tokens=0,
                output_tokens=0,
                correct=False,
                raw_response={},
            ))
        
        # 避免 rate limit
        time.sleep(0.3)
    
    return results, total_input, total_output


# =============================================================================
# 主程序
# =============================================================================

def main():
    print("=" * 70)
    print("Tool-calling 意图识别方案验证")
    print("=" * 70)
    print(f"模型: {MODEL}")
    print(f"API: {BASE_URL}")
    print()
    
    if not API_KEY:
        print("❌ DEEPSEEK_API_KEY 未设置")
        sys.exit(1)
    
    # 加载 schema
    with open(INTENT_SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema = yaml.safe_load(f)
    
    tools = build_tools(schema)
    print(f"工具定义数: {len(tools)}")
    for t in tools:
        print(f"  - {t['function']['name']}")
    print()
    
    # 加载测试集
    with open(GOLDEN_SEED_PATH, "r", encoding="utf-8") as f:
        golden = json.load(f)
    
    tests = golden["tests"]
    print(f"测试集: {len(tests)} 条")
    print()
    
    # 创建客户端
    client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
    
    # 运行评估
    print("Step: Tool-calling 评估...")
    results, total_input, total_output = evaluate_with_tool_calling(
        client, MODEL, tools, tests
    )
    print()
    
    # -------------------------------------------------------------------------
    # 统计
    # -------------------------------------------------------------------------
    correct = sum(1 for r in results if r.correct)
    incorrect = len(results) - correct
    accuracy = correct / len(results) * 100
    avg_latency = sum(r.latency_ms for r in results) / len(results)
    latencies = sorted(r.latency_ms for r in results)
    p50 = latencies[len(latencies)//2]
    p95 = latencies[int(len(latencies)*0.95)]
    
    print("=" * 70)
    print("评估结果")
    print("=" * 70)
    print(f"总测试数:     {len(results)}")
    print(f"正确:         {correct}")
    print(f"错误:         {incorrect}")
    print(f"准确率:       {accuracy:.1f}%")
    print(f"平均延迟:     {avg_latency:.0f} ms")
    print(f"P50 延迟:     {p50:.0f} ms")
    print(f"P95 延迟:     {p95:.0f} ms")
    print(f"总输入 token: {total_input}")
    print(f"总输出 token: {total_output}")
    print()
    
    # 与基线对比
    print("=" * 70)
    print("与基线对比")
    print("=" * 70)
    print(f"规则引擎:     80.0% 准确率, 0.042 ms 延迟")
    print(f"Embedding:    64.0% 准确率, 14.1 ms 延迟")
    print(f"Tool-calling: {accuracy:.1f}% 准确率, {avg_latency:.0f} ms 延迟")
    print()
    
    # 成本估算 (DeepSeek-chat: 输入 1元/百万, 输出 2元/百万)
    cost = (total_input * 1.0 + total_output * 2.0) / 1_000_000
    print(f"预估成本:     ¥{cost:.4f} ({total_input}+{total_output} tokens)")
    print()
    
    # -------------------------------------------------------------------------
    # 失败案例分析
    # -------------------------------------------------------------------------
    print("=" * 70)
    print("失败案例分析")
    print("=" * 70)
    
    wrong = [r for r in results if not r.correct]
    if not wrong:
        print("🎉 全部通过！")
    else:
        for r in wrong:
            print(f"\n  {r.test_id}: {r.text}")
            print(f"    期望: {r.expected} | 实际: {r.routed}")
            print(f"    推理: {r.reasoning[:120]}")
    
    print()
    
    # -------------------------------------------------------------------------
    # 按类别统计
    # -------------------------------------------------------------------------
    print("=" * 70)
    print("按类别统计")
    print("=" * 70)
    
    cat_stats = {}
    for r in results:
        cat = r.test_id.split("-")[0]
        if cat not in cat_stats:
            cat_stats[cat] = {"total": 0, "correct": 0}
        cat_stats[cat]["total"] += 1
        if r.correct:
            cat_stats[cat]["correct"] += 1
    
    for cat, stats in sorted(cat_stats.items()):
        acc = stats["correct"] / stats["total"] * 100
        print(f"  {cat:12s}: {stats['correct']}/{stats['total']} = {acc:.1f}%")
    
    print()
    
    # -------------------------------------------------------------------------
    # 结论
    # -------------------------------------------------------------------------
    print("=" * 70)
    print("结论")
    print("=" * 70)
    
    if accuracy >= 85:
        print("✅ Tool-calling 方案表现优秀，建议作为主力路由方案")
    elif accuracy >= 75:
        print("⚠️  Tool-calling 方案可用，但需优化 tool descriptions 和 system prompt")
    else:
        print("❌ Tool-calling 方案当前表现不足，需大幅优化")
    
    print()
    
    # 保存详细结果
    output_path = "data/checkpoints/tool_calling_evaluation_result.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "model": MODEL,
            "total_tests": len(results),
            "correct": correct,
            "incorrect": incorrect,
            "accuracy": accuracy,
            "avg_latency_ms": avg_latency,
            "p50_latency_ms": p50,
            "p95_latency_ms": p95,
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "estimated_cost_cny": cost,
            "results": [
                {
                    "id": r.test_id,
                    "text": r.text,
                    "expected": r.expected,
                    "routed": r.routed,
                    "reasoning": r.reasoning,
                    "latency_ms": r.latency_ms,
                    "correct": r.correct,
                }
                for r in results
            ],
        }, f, ensure_ascii=False, indent=2)
    
    print(f"详细结果已保存: {output_path}")


if __name__ == "__main__":
    main()
