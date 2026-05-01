#!/bin/bash
# YunPat LLM 测试工具
#
# 快速测试不同 LLM 的推理策略集成

set -e

echo "🚀 YunPat LLM 测试工具"
echo "===================="
echo ""

# 检查环境变量
check_env() {
    local var_name=$1
    local var_value=${!var_name}

    if [ -n "$var_value" ]; then
        echo "✅ $var_name: 已配置"
        return 0
    else
        echo "❌ $var_name: 未配置"
        return 1
    fi
}

echo "📋 检查环境变量配置："
echo ""

DEEPSEEK_AVAILABLE=false
OMXL_AVAILABLE=false
ZHIPU_AVAILABLE=false

if check_env "DEEPSEEK_API_KEY"; then
    DEEPSEEK_AVAILABLE=true
fi

if check_env "OMXL_API_KEY"; then
    if check_env "OMXL_BASE_URL"; then
        OMXL_AVAILABLE=true
    fi
fi

if check_env "ZHIPU_API_KEY"; then
    ZHIPU_AVAILABLE=true
fi

echo ""
echo "===================="
echo ""

# 显示可用选项
echo "🎯 可用的测试选项："
echo ""

if [ "$DEEPSEEK_AVAILABLE" = true ]; then
    echo "1. DeepSeek V4 - CoT 创造性判断"
    echo "2. DeepSeek V4 - Reflection 质量检查"
    echo "3. DeepSeek V4 - 完整测试"
fi

if [ "$OMXL_AVAILABLE" = true ]; then
    echo "4. OMLX 本地模型 - CoT 创造性判断"
    echo "5. OMLX 本地模型 - ToT 布局设计"
    echo "6. OMLX 本地模型 - 完整测试"
fi

if [ "$ZHIPU_AVAILABLE" = true ]; then
    echo "7. 智谱 GLM-4 - ToT 布局设计"
    echo "8. 智谱 GLM-4 - 完整测试"
fi

echo "9. 运行所有可用测试"
echo "0. 退出"

echo ""
read -p "请选择测试选项 (0-9): " choice

echo ""
echo "===================="
echo ""

case $choice in
    1)
        if [ "$DEEPSEEK_AVAILABLE" = true ]; then
            echo "🔍 运行 DeepSeek CoT 测试..."
            pnpm --filter @yunpat/core exec tsx -e "
                import { createDeepSeekModel } from './packages/core/dist/llm/NativeLLMAdapter.js';
                import { ChainOfThoughtStrategy } from './packages/core/dist/reasoning/ChainOfThoughtStrategy.js';

                const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY);
                const cot = new ChainOfThoughtStrategy(llm, { maxSteps: 3, verbose: true });

                const result = await cot.reason('判断一种基于区块链的数字版权保护方法是否具有专利性？');
                console.log('置信度:', (result.confidence * 100).toFixed(1) + '%');
                console.log('结论:', result.conclusion);
            "
        else
            echo "❌ DeepSeek API key 未配置"
        fi
        ;;

    2)
        if [ "$DEEPSEEK_AVAILABLE" = true ]; then
            echo "🔍 运行 DeepSeek Reflection 测试..."
            pnpm --filter @yunpat/core exec tsx -e "
                import { createDeepSeekModel } from './packages/core/dist/llm/NativeLLMAdapter.js';
                import { EnhancedReflection } from './packages/core/dist/reasoning/EnhancedReflection.js';

                const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY);
                const reflection = new EnhancedReflection(llm, { verbose: false });

                const context = {
                    executionId: 'test',
                    agentName: 'TestAgent',
                    startTime: new Date(),
                    currentStage: 'act',
                    memory: {},
                    eventBus: {},
                    tools: {},
                    llm: {},
                    metadata: {},
                    sharedState: new Map(),
                };

                const report = await reflection.reflect(
                    { content: '1. 一种数据处理装置，包括处理器和存储器。' },
                    context,
                    '质量检查'
                );

                console.log('质量评分:', (report.overallScore * 100).toFixed(1) + '%');
                console.log('置信度:', (report.confidence * 100).toFixed(1) + '%');
            "
        else
            echo "❌ DeepSeek API key 未配置"
        fi
        ;;

    3)
        if [ "$DEEPSEEK_AVAILABLE" = true ]; then
            echo "🔍 运行 DeepSeek 完整测试..."
            pnpm --filter @yunpat/core exec tsx examples/patent-reasoning-cloud.ts
        else
            echo "❌ DeepSeek API key 未配置"
        fi
        ;;

    4)
        if [ "$OMXL_AVAILABLE" = true ]; then
            echo "🔍 运行 OMLX CoT 测试..."
            pnpm --filter @yunpat/core exec tsx -e "
                import { OMXLAdapter } from './packages/core/src/llm/OMXLAdapter.js';
                import { ChainOfThoughtStrategy } from './packages/core/src/reasoning/ChainOfThoughtStrategy.js';

                const llm = new OMXLAdapter({
                    baseURL: process.env.OMXL_BASE_URL,
                    apiKey: process.env.OMXL_API_KEY,
                    modelName: 'gemma-4-e2b-it-4bit',
                    timeout: 180000,
                });

                const cot = new ChainOfThoughtStrategy(llm, { maxSteps: 3, verbose: true });
                const result = await cot.reason('判断一个会飞的茶杯是否具有专利性？');

                console.log('置信度:', (result.confidence * 100).toFixed(1) + '%');
                console.log('结论:', result.conclusion);
            "
        else
            echo "❌ OMLX 配置未完成"
        fi
        ;;

    5)
        if [ "$OMXL_AVAILABLE" = true ]; then
            echo "🔍 运行 OMLX ToT 测试..."
            pnpm --filter @yunpat/core exec tsx -e "
                import { OMXLAdapter } from './packages/core/src/llm/OMXLAdapter.js';
                import { TreeOfThoughtsStrategy } from './packages/core/src/reasoning/TreeOfThoughtsStrategy.js';

                const llm = new OMXLAdapter({
                    baseURL: process.env.OMXL_BASE_URL,
                    apiKey: process.env.OMXL_API_KEY,
                    modelName: 'gemma-4-e2b-it-4bit',
                    timeout: 180000,
                });

                const tot = new TreeOfThoughtsStrategy(llm, { verbose: true });
                const thoughts = await tot.generateThoughts('设计智能交通信号控制系统的权利要求布局', 2);

                console.log('生成思路数:', thoughts.length);
                thoughts.forEach((t, i) => {
                    console.log('方案' + (i+1) + ':', t.thought.substring(0, 60) + '...');
                });
            "
        else
            echo "❌ OMLX 配置未完成"
        fi
        ;;

    6)
        if [ "$OMXL_AVAILABLE" = true ]; then
            echo "🔍 运行 OMLX 完整测试..."
            export OMXL_API_KEY="$OMXL_API_KEY"
            export OMXL_BASE_URL="$OMXL_BASE_URL"
            pnpm --filter @yunpat/core exec tsx examples/patent-reasoning-omxl.ts
        else
            echo "❌ OMLX 配置未完成"
        fi
        ;;

    7)
        if [ "$ZHIPU_AVAILABLE" = true ]; then
            echo "🔍 运行智谱 GLM ToT 测试..."
            pnpm --filter @yunpat/core exec tsx -e "
                import { createZhipuModel } from './packages/core/dist/llm/NativeLLMAdapter.js';
                import { TreeOfThoughtsStrategy } from './packages/core/dist/reasoning/TreeOfThoughtsStrategy.js';

                const llm = createZhipuModel(process.env.ZHIPU_API_KEY);
                const tot = new TreeOfThoughtsStrategy(llm, { verbose: true });

                const thoughts = await tot.generateThoughts('设计智能农业灌溉系统的权利要求布局', 2);
                console.log('生成思路数:', thoughts.length);
            "
        else
            echo "❌ 智谱 API key 未配置"
        fi
        ;;

    8)
        if [ "$ZHIPU_AVAILABLE" = true ]; then
            echo "🔍 运行智谱 GLM 完整测试..."
            export ZHIPU_API_KEY="$ZHIPU_API_KEY"
            pnpm --filter @yunpat/core exec tsx examples/patent-reasoning-cloud.ts
        else
            echo "❌ 智谱 API key 未配置"
        fi
        ;;

    9)
        echo "🔍 运行所有可用测试..."

        if [ "$DEEPSEEK_AVAILABLE" = true ]; then
            echo ""
            echo "▶️  测试 DeepSeek..."
            export DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY"
            pnpm --filter @yunpat/core exec tsx examples/patent-reasoning-cloud.ts
        fi

        if [ "$OMXL_AVAILABLE" = true ]; then
            echo ""
            echo "▶️  测试 OMLX..."
            export OMXL_API_KEY="$OMXL_API_KEY"
            export OMXL_BASE_URL="$OMXL_BASE_URL"
            pnpm --filter @yunpat/core exec tsx examples/patent-reasoning-omxl.ts
        fi

        if [ "$ZHIPU_AVAILABLE" = true ]; then
            echo ""
            echo "▶️  测试智谱 GLM..."
            export ZHIPU_API_KEY="$ZHIPU_API_KEY"
            pnpm --filter @yunpat/core exec tsx examples/patent-reasoning-cloud.ts
        fi
        ;;

    0)
        echo "👋 退出"
        exit 0
        ;;

    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

echo ""
echo "===================="
echo "✅ 测试完成！"
