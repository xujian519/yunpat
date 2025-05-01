#!/bin/bash
# YunPat TUI 启动脚本
# 启动 Rust 网关、Orchestrator 适配器和 TUI

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 配置
GATEWAY_PORT=${GATEWAY_PORT:-8081}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATEWAY_BIN="${PROJECT_ROOT}/packages/rust-gateway/target/release/yunpat-gateway"
ADAPTER_SERVER="${PROJECT_ROOT}/packages/orchestrator-adapter/dist/server.js"
TUI_BIN="${PROJECT_ROOT}/packages/tui/dist/cli.js"

# 加载环境变量（安全方式：仅加载 KEY=VALUE 格式）
load_env() {
    local env_files=(".env.local" ".env")
    for env_file in "${env_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$env_file" ]; then
            echo -e "${YELLOW}加载环境变量: $env_file${NC}"
            while IFS='=' read -r key value; do
                # 跳过注释和空行
                [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
                # 去除前后空白
                key=$(echo "$key" | xargs)
                value=$(echo "$value" | xargs)
                # 仅导出合法的 KEY=VALUE
                if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
                    export "$key=$value"
                fi
            done < "$PROJECT_ROOT/$env_file"
            break
        fi
    done
}

# 检查环境变量
check_env() {
    echo -e "${YELLOW}检查环境变量...${NC}"

    # 检查主 LLM 配置
    local provider="${MODEL_PROVIDER:-zhipu}"
    local has_key=false

    case "$provider" in
        zhipu)
            if [ -n "$ZHIPU_API_KEY" ]; then
                has_key=true
                echo -e "${GREEN}✓ 智谱 GLM: ${ZHIPU_MODEL:-glm-4.7-flash}${NC}"
            fi
            ;;
        anthropic)
            if [ -n "$ANTHROPIC_API_KEY" ]; then
                has_key=true
                echo -e "${GREEN}✓ Anthropic Claude: ${ANTHROPIC_MODEL:-claude-sonnet-4-20250514}${NC}"
            fi
            ;;
        openai)
            if [ -n "$OPENAI_API_KEY" ]; then
                has_key=true
                echo -e "${GREEN}✓ OpenAI: ${OPENAI_MODEL:-gpt-4o}${NC}"
            fi
            ;;
    esac

    if [ "$has_key" = false ]; then
        echo -e "${RED}错误: 未设置 API 密钥${NC}"
        echo "请设置以下环境变量之一:"
        echo "  export ZHIPU_API_KEY=your_key_here      # 智谱 GLM (推荐)"
        echo "  export ANTHROPIC_API_KEY=your_key_here  # Anthropic Claude"
        echo "  export OPENAI_API_KEY=your_key_here     # OpenAI GPT"
        echo ""
        echo "或创建 .env.local 文件 (参考 .env.example.tui)"
        exit 1
    fi

    # 显示 oMLX 配置
    if [ -n "$OMLX_BASE_URL" ]; then
        echo -e "${GREEN}✓ oMLX 多模态: ${OMLX_MULTIMODAL_MODEL:-glm-4v} @ ${OMLX_BASE_URL}${NC}"
    fi
    if [ -n "$OMLX_BASE_URL" ]; then
        echo -e "${GREEN}✓ oMLX 嵌入: ${OMLX_EMBEDDING_MODEL:-bge-m3} @ ${OMLX_BASE_URL}${NC}"
    fi
    if [ -n "$OMLX_BASE_URL" ]; then
        echo -e "${GREEN}✓ oMLX Rerank: ${OMLX_RERANK_MODEL:-bge-reranker-v2} @ ${OMLX_BASE_URL}${NC}"
    fi
}

# 检查依赖
check_dependencies() {
    echo -e "${YELLOW}检查依赖...${NC}"

    if [ ! -f "$GATEWAY_BIN" ]; then
        echo -e "${RED}错误: 网关二进制不存在，请先编译:${NC}"
        echo "  cd packages/rust-gateway && cargo build --release"
        exit 1
    fi

    if [ ! -f "$ADAPTER_SERVER" ]; then
        echo -e "${YELLOW}Orchestrator 适配器未构建，正在构建...${NC}"
        (cd "$PROJECT_ROOT" && pnpm --filter @yunpat/orchestrator-adapter build)
    fi

    if [ ! -f "$TUI_BIN" ]; then
        echo -e "${YELLOW}TUI 未构建，正在构建...${NC}"
        (cd "$PROJECT_ROOT" && pnpm --filter @yunpat/tui build)
    fi

    echo -e "${GREEN}✓ 依赖检查完成${NC}"
}

# 检查端口占用
check_port() {
    local port=$1
    local name=$2
    if lsof -i ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}错误: 端口 $port ($name) 已被占用${NC}"
        lsof -i ":$port" -sTCP:LISTEN
        exit 1
    fi
}

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}正在停止服务...${NC}"

    if [ -n "$GATEWAY_PID" ]; then
        kill $GATEWAY_PID 2>/dev/null || true
        echo -e "${GREEN}✓ 网关已停止${NC}"
    fi

    if [ -n "$ADAPTER_PID" ]; then
        kill $ADAPTER_PID 2>/dev/null || true
        echo -e "${GREEN}✓ 适配器已停止${NC}"
    fi

    exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "${GREEN}=== YunPat TUI 启动 ===${NC}\n"

load_env
check_env
check_dependencies

# 检查端口
ADAPTER_PORT=${ADAPTER_PORT:-3001}
check_port $GATEWAY_PORT "网关"
check_port $ADAPTER_PORT "适配器"

# 设置环境变量
export GATEWAY_URL="http://localhost:${GATEWAY_PORT}"
export ORCHESTRATOR_URL="http://localhost:${ADAPTER_PORT}"
export BIND_ADDRESS="0.0.0.0:${GATEWAY_PORT}"

# ===== Gateway 意图路由器 LLM 配置 =====
# 默认使用 DeepSeek（从 .env 继承 DEEPSEEK_API_KEY）
export ROUTER_LLM_BASE_URL=${DEEPSEEK_BASE_URL:-"https://api.deepseek.com/v1"}
export ROUTER_LLM_API_KEY=${DEEPSEEK_API_KEY:-""}
export ROUTER_LLM_MODEL=${ROUTER_LLM_MODEL:-"deepseek-chat"}

# ===== Orchestrator 主 LLM 配置 =====
# 如果没有 ZHIPU_API_KEY，用 DeepSeek（兼容 OpenAI API）
if [ -z "$ZHIPU_API_KEY" ] && [ -n "$DEEPSEEK_API_KEY" ]; then
    export MODEL_PROVIDER="openai"
    export OPENAI_API_KEY="$DEEPSEEK_API_KEY"
    export OPENAI_BASE_URL="${DEEPSEEK_BASE_URL:-https://api.deepseek.com}/v1"
    export OPENAI_MODEL="deepseek-chat"
    echo -e "${GREEN}✓ Orchestrator LLM: DeepSeek (OpenAI 兼容)${NC}"
fi

# 启动 Rust 网关
echo -e "${YELLOW}启动 Rust 网关 (端口 ${GATEWAY_PORT})...${NC}"
$GATEWAY_BIN &
GATEWAY_PID=$!

# 等待网关启动
echo -e "${YELLOW}等待网关启动...${NC}"
for i in {1..30}; do
    if curl -s "http://localhost:${GATEWAY_PORT}/internal/health" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ 网关已启动${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}网关启动超时${NC}"
        cleanup
    fi
    sleep 0.5
done

# 启动 Orchestrator 适配器
echo -e "${YELLOW}启动 Orchestrator 适配器 (端口 3001)...${NC}"
node "$ADAPTER_SERVER" &
ADAPTER_PID=$!

sleep 2

# 启动 TUI
echo -e "${GREEN}=== 启动 TUI ===${NC}"
echo -e "网关: http://localhost:${GATEWAY_PORT}"
echo -e "适配器: http://localhost:3001"
echo -e "${YELLOW}按 Ctrl+C 退出${NC}\n"

# 运行 TUI
node "$TUI_BIN"

# 清理
cleanup
