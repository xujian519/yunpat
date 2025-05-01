#!/bin/bash
# YunPat 开发启动脚本
# 一键启动所有开发服务（无热重载，用 tsx 免编译）
#
# 用法:
#   ./scripts/dev-start.sh          # 默认启动全部服务
#   ./scripts/dev-start.sh --gateway  # 仅启动 Rust Gateway
#   ./scripts/dev-start.sh --adapter  # 仅启动 Orchestrator Adapter
#   ./scripts/dev-start.sh --tui      # 仅启动 TUI
#   ./scripts/dev-start.sh --build    # 先编译再启动（生产模式）

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
GATEWAY_PORT=${GATEWAY_PORT:-8080}
ADAPTER_PORT=${ADAPTER_PORT:-3001}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# PID 文件
PID_DIR="${PROJECT_ROOT}/.dev-pids"
mkdir -p "$PID_DIR"

# 加载环境变量
load_env() {
    local env_files=(".env.local" ".env")
    for env_file in "${env_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$env_file" ]; then
            echo -e "${YELLOW}加载环境变量: $env_file${NC}"
            set -a
            source "$PROJECT_ROOT/$env_file"
            set +a
            break
        fi
    done
}

# 检查端口
check_port() {
    local port=$1
    local name=$2
    if lsof -i ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}错误: 端口 $port ($name) 已被占用${NC}"
        lsof -i ":$port" -sTCP:LISTEN
        echo -e "${YELLOW}尝试停止旧服务...${NC}"
        ${PROJECT_ROOT}/scripts/dev-stop.sh 2>/dev/null || true
        sleep 1
        if lsof -i ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "${RED}端口仍被占用，请手动清理${NC}"
            exit 1
        fi
    fi
}

# 检查 Rust Gateway 是否已编译
check_rust_build() {
    local release_bin="${PROJECT_ROOT}/packages/rust-gateway/target/release/yunpat-gateway"
    local debug_bin="${PROJECT_ROOT}/packages/rust-gateway/target/debug/yunpat-gateway"

    if [ -f "$release_bin" ]; then
        echo "$release_bin"
    elif [ -f "$debug_bin" ]; then
        echo "$debug_bin"
    else
        echo -e "${YELLOW}Rust Gateway 未编译，正在编译 debug 版本...${NC}"
        (cd "${PROJECT_ROOT}/packages/rust-gateway" && cargo build 2>&1 | tail -3)
        if [ -f "$debug_bin" ]; then
            echo "$debug_bin"
        else
            echo -e "${RED}编译失败${NC}"
            exit 1
        fi
    fi
}

# 启动 Gateway
start_gateway() {
    local gateway_bin=$(check_rust_build)
    check_port $GATEWAY_PORT "Rust Gateway"

    export BIND_ADDRESS="0.0.0.0:${GATEWAY_PORT}"
    export ORCHESTRATOR_URL="http://localhost:${ADAPTER_PORT}"
    export GATEWAY_URL="http://localhost:${GATEWAY_PORT}"

    echo -e "${YELLOW}启动 Rust Gateway (端口 ${GATEWAY_PORT})...${NC}"
    "$gateway_bin" &
    local pid=$!
    echo $pid > "${PID_DIR}/gateway.pid"

    # 等待启动
    echo -e "${YELLOW}等待 Gateway 启动...${NC}"
    for i in {1..30}; do
        if curl -s "http://localhost:${GATEWAY_PORT}/internal/health" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Gateway 已启动 (PID: $pid)${NC}"
            return 0
        fi
        if ! kill -0 $pid 2>/dev/null; then
            echo -e "${RED}Gateway 进程已退出${NC}"
            return 1
        fi
        sleep 0.5
    done

    echo -e "${RED}Gateway 启动超时${NC}"
    return 1
}

# 启动 Adapter (开发模式 - tsx)
start_adapter_dev() {
    check_port $ADAPTER_PORT "Orchestrator Adapter"

    export GATEWAY_URL="http://localhost:${GATEWAY_PORT}"
    export PORT="${ADAPTER_PORT}"

    echo -e "${YELLOW}启动 Orchestrator Adapter (开发模式, tsx, 端口 ${ADAPTER_PORT})...${NC}"
    (cd "$PROJECT_ROOT" && npx tsx packages/orchestrator-adapter/src/server.ts) &
    local pid=$!
    echo $pid > "${PID_DIR}/adapter.pid"

    sleep 2
    echo -e "${GREEN}✓ Adapter 已启动 (PID: $pid)${NC}"
}

# 启动 Adapter (生产模式 - 编译后)
start_adapter_build() {
    check_port $ADAPTER_PORT "Orchestrator Adapter"

    local adapter_dist="${PROJECT_ROOT}/packages/orchestrator-adapter/dist/server.js"
    if [ ! -f "$adapter_dist" ]; then
        echo -e "${YELLOW}Adapter 未编译，正在构建...${NC}"
        (cd "$PROJECT_ROOT" && pnpm --filter @yunpat/orchestrator-adapter build 2>&1 | tail -5)
    fi

    export GATEWAY_URL="http://localhost:${GATEWAY_PORT}"
    export PORT="${ADAPTER_PORT}"

    echo -e "${YELLOW}启动 Orchestrator Adapter (生产模式, 端口 ${ADAPTER_PORT})...${NC}"
    node "$adapter_dist" &
    local pid=$!
    echo $pid > "${PID_DIR}/adapter.pid"

    sleep 2
    echo -e "${GREEN}✓ Adapter 已启动 (PID: $pid)${NC}"
}

# 启动 TUI (开发模式 - tsx)
start_tui_dev() {
    export YUNPAT_GATEWAY_URL="http://localhost:${GATEWAY_PORT}"

    echo -e "${YELLOW}启动 TUI (开发模式, tsx)...${NC}"
    (cd "$PROJECT_ROOT" && npx tsx packages/tui/src/cli.tsx) &
    local pid=$!
    echo $pid > "${PID_DIR}/tui.pid"

    sleep 1
    echo -e "${GREEN}✓ TUI 已启动 (PID: $pid)${NC}"
}

# 启动 TUI (生产模式 - 编译后)
start_tui_build() {
    local tui_dist="${PROJECT_ROOT}/packages/tui/dist/cli.js"
    if [ ! -f "$tui_dist" ]; then
        echo -e "${YELLOW}TUI 未编译，正在构建...${NC}"
        (cd "$PROJECT_ROOT" && pnpm --filter @yunpat/tui build 2>&1 | tail -5)
    fi

    export YUNPAT_GATEWAY_URL="http://localhost:${GATEWAY_PORT}"

    echo -e "${YELLOW}启动 TUI (生产模式)...${NC}"
    node "$tui_dist" &
    local pid=$!
    echo $pid > "${PID_DIR}/tui.pid"

    sleep 1
    echo -e "${GREEN}✓ TUI 已启动 (PID: $pid)${NC}"
}

# 打印状态
print_status() {
    echo -e "\n${BLUE}══════════════════════════════════════${NC}"
    echo -e "${BLUE}  YunPat 开发环境已就绪${NC}"
    echo -e "${BLUE}══════════════════════════════════════${NC}"
    echo -e "  Gateway:     http://localhost:${GATEWAY_PORT}"
    echo -e "  Adapter:     http://localhost:${ADAPTER_PORT}"
    echo -e "  Health:      http://localhost:${GATEWAY_PORT}/internal/health"
    echo -e ""
    echo -e "${YELLOW}命令:${NC}"
    echo -e "  停止全部:    ${PROJECT_ROOT}/scripts/dev-stop.sh"
    echo -e "  热重载模式:  ${PROJECT_ROOT}/scripts/dev-watch.sh"
    echo -e "  日志:        tail -f .dev-pids/*.log"
    echo -e ""
    echo -e "${YELLOW}按 Ctrl+C 退出 TUI，运行 dev-stop.sh 停止后台服务${NC}"
}

# 解析参数
MODE="dev"
START_GATEWAY=false
START_ADAPTER=false
START_TUI=false

if [ $# -eq 0 ]; then
    # 默认启动全部
    START_GATEWAY=true
    START_ADAPTER=true
    START_TUI=true
else
    for arg in "$@"; do
        case $arg in
            --gateway) START_GATEWAY=true ;;
            --adapter) START_ADAPTER=true ;;
            --tui) START_TUI=true ;;
            --build) MODE="build" ;;
            --help|-h)
                echo "用法: $(basename $0) [选项]"
                echo ""
                echo "选项:"
                echo "  (无参数)      启动全部服务"
                echo "  --gateway    仅启动 Rust Gateway"
                echo "  --adapter    仅启动 Orchestrator Adapter"
                echo "  --tui        仅启动 TUI"
                echo "  --build      使用编译后的产物启动（而非 tsx）"
                echo "  --help       显示此帮助"
                echo ""
                echo "环境变量:"
                echo "  GATEWAY_PORT  Gateway 端口 (默认: 8080)"
                echo "  ADAPTER_PORT  Adapter 端口 (默认: 3001)"
                exit 0
                ;;
            *)
                echo -e "${RED}未知参数: $arg${NC}"
                echo "使用 --help 查看用法"
                exit 1
                ;;
        esac
    done
fi

# 主流程
echo -e "${GREEN}=== YunPat 开发环境启动 (${MODE} 模式) ===${NC}\n"

load_env

# 检查必要工具
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}错误: 未安装 pnpm${NC}"
    exit 1
fi

if [ "$START_GATEWAY" = true ]; then
    if ! command -v cargo &> /dev/null; then
        echo -e "${RED}错误: 未安装 Rust/Cargo${NC}"
        exit 1
    fi
    start_gateway || exit 1
fi

if [ "$START_ADAPTER" = true ]; then
    if [ "$MODE" = "build" ]; then
        start_adapter_build
    else
        start_adapter_dev
    fi
fi

if [ "$START_TUI" = true ]; then
    if [ "$MODE" = "build" ]; then
        start_tui_build
    else
        start_tui_dev
    fi
fi

print_status

# 如果启动了 TUI，等待它退出
if [ "$START_TUI" = true ]; then
    tui_pid=$(cat "${PID_DIR}/tui.pid" 2>/dev/null)
    if [ -n "$tui_pid" ]; then
        wait $tui_pid
        echo -e "\n${YELLOW}TUI 已退出${NC}"
    fi
fi
