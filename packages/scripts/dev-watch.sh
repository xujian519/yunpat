#!/bin/bash
# YunPat 热重载开发脚本
# 带 nodemon 自动重启，修改代码后自动生效
#
# 用法:
#   ./scripts/dev-watch.sh          # 启动 Adapter + TUI 热重载
#   ./scripts/dev-watch.sh --all      # 全部服务（含 Rust Gateway）
#   ./scripts/dev-watch.sh --no-tui   # 不启动 TUI，只启动后台服务

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

GATEWAY_PORT=${GATEWAY_PORT:-8080}
ADAPTER_PORT=${ADAPTER_PORT:-3001}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="${PROJECT_ROOT}/.dev-pids"
mkdir -p "$PID_DIR"

load_env() {
    local env_files=(".env.local" ".env")
    for env_file in "${env_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$env_file" ]; then
            set -a; source "$PROJECT_ROOT/$env_file"; set +a
            break
        fi
    done
}

# 检查端口
check_port() {
    local port=$1
    if lsof -i ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}端口 $port 被占用，尝试清理...${NC}"
        ${PROJECT_ROOT}/scripts/dev-stop.sh 2>/dev/null || true
        sleep 1
    fi
}

# 启动 Gateway（Rust 编译慢，通常不改，所以用普通启动）
start_gateway() {
    local debug_bin="${PROJECT_ROOT}/packages/rust-gateway/target/debug/yunpat-gateway"
    if [ ! -f "$debug_bin" ]; then
        echo -e "${YELLOW}编译 Rust Gateway...${NC}"
        (cd "${PROJECT_ROOT}/packages/rust-gateway" && cargo build 2>&1 | tail -5)
    fi

    check_port $GATEWAY_PORT
    export BIND_ADDRESS="0.0.0.0:${GATEWAY_PORT}"
    export ORCHESTRATOR_URL="http://localhost:${ADAPTER_PORT}"
    export GATEWAY_URL="http://localhost:${GATEWAY_PORT}"

    echo -e "${YELLOW}启动 Rust Gateway (端口 ${GATEWAY_PORT})...${NC}"
    "$debug_bin" &
    echo $! > "${PID_DIR}/gateway.pid"

    for i in {1..30}; do
        if curl -s "http://localhost:${GATEWAY_PORT}/internal/health" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Gateway 已启动${NC}"
            return 0
        fi
        sleep 0.5
    done
    echo -e "${RED}Gateway 启动超时${NC}"
    return 1
}

# 检查 nodemon
ensure_nodemon() {
    if ! command -v nodemon &> /dev/null; then
        if ! npx nodemon --version &> /dev/null; then
            echo -e "${YELLOW}安装 nodemon...${NC}"
            (cd "$PROJECT_ROOT" && pnpm add -D nodemon -w)
        fi
    fi
}

# 启动 Adapter 热重载
start_adapter_watch() {
    check_port $ADAPTER_PORT
    ensure_nodemon

    export GATEWAY_URL="http://localhost:${GATEWAY_PORT}"
    export PORT="${ADAPTER_PORT}"

    echo -e "${YELLOW}启动 Adapter 热重载...${NC}"
    echo -e "${BLUE}监听路径: packages/orchestrator-adapter/src, packages/orchestrator/src, packages/core/src, patents/agents${NC}"

    (cd "$PROJECT_ROOT" && \
        npx nodemon \
        --watch packages/orchestrator-adapter/src \
        --watch packages/orchestrator/src \
        --watch packages/core/src \
        --watch packages/agents \
        --watch patents/agents \
        --watch packages/tools \
        --watch packages/database \
        --ext ts,tsx,json \
        --delay 1 \
        --exec "npx tsx packages/orchestrator-adapter/src/server.ts" \
        2>&1 | while read line; do
            if echo "$line" | grep -q "restart"; then
                echo -e "${YELLOW}[Adapter] 代码变更，正在重启...${NC}"
            elif echo "$line" | grep -q "listening"; then
                echo -e "${GREEN}[Adapter] 已就绪${NC}"
            else
                echo "[Adapter] $line"
            fi
        done
    ) &
    echo $! > "${PID_DIR}/adapter.pid"
}

# 启动 TUI 热重载
start_tui_watch() {
    ensure_nodemon

    export YUNPAT_GATEWAY_URL="http://localhost:${GATEWAY_PORT}"

    echo -e "${YELLOW}启动 TUI 热重载...${NC}"
    echo -e "${BLUE}监听路径: packages/tui/src${NC}"

    (cd "$PROJECT_ROOT" && \
        npx nodemon \
        --watch packages/tui/src \
        --ext ts,tsx,json \
        --delay 1 \
        --exec "npx tsx packages/tui/src/cli.tsx" \
        2>&1 | while read line; do
            if echo "$line" | grep -q "restart"; then
                echo -e "${YELLOW}[TUI] 代码变更，正在重启...${NC}"
            elif echo "$line" | grep -q "listening"; then
                echo -e "${GREEN}[TUI] 已就绪${NC}"
            else
                echo "[TUI] $line"
            fi
        done
    ) &
    echo $! > "${PID_DIR}/tui.pid"
}

print_status() {
    echo -e "\n${BLUE}══════════════════════════════════════${NC}"
    echo -e "${BLUE}  YunPat 热重载开发环境已就绪${NC}"
    echo -e "${BLUE}══════════════════════════════════════${NC}"
    echo -e "  Gateway:     http://localhost:${GATEWAY_PORT}"
    echo -e "  Adapter:     http://localhost:${ADAPTER_PORT}"
    echo -e "  Health:      http://localhost:${GATEWAY_PORT}/internal/health"
    echo -e ""
    echo -e "${GREEN}热重载已激活:${NC}"
    echo -e "  • 修改 Adapter/Orchestrator/Core 代码 → 自动重启 Adapter"
    echo -e "  • 修改 TUI 组件代码 → 自动重启 TUI"
    echo -e ""
    echo -e "${YELLOW}命令:${NC}"
    echo -e "  停止全部:    ${PROJECT_ROOT}/scripts/dev-stop.sh"
    echo -e "  普通启动:    ${PROJECT_ROOT}/scripts/dev-start.sh"
    echo -e ""
    echo -e "${YELLOW}按 Ctrl+C 退出${NC}"
}

# 解析参数
START_GATEWAY=false
START_TUI=true

for arg in "$@"; do
    case $arg in
        --all) START_GATEWAY=true ;;
        --no-tui) START_TUI=false ;;
        --help|-h)
            echo "用法: $(basename $0) [选项]"
            echo ""
            echo "选项:"
            echo "  (无参数)      启动 Adapter + TUI 热重载（推荐开发模式）"
            echo "  --all        同时启动 Rust Gateway（如果你改了 Rust 代码）"
            echo "  --no-tui     不启动 TUI，只启动后台服务（调试 API 用）"
            echo "  --help       显示此帮助"
            exit 0
            ;;
    esac
done

echo -e "${GREEN}=== YunPat 热重载开发环境 ===${NC}\n"
load_env

if [ "$START_GATEWAY" = true ]; then
    start_gateway || exit 1
else
    # 检查 Gateway 是否已在运行
    if ! curl -s "http://localhost:${GATEWAY_PORT}/internal/health" >/dev/null 2>&1; then
        echo -e "${RED}Gateway 未运行，请先启动:${NC}"
        echo -e "  ${YELLOW}./scripts/dev-start.sh --gateway${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Gateway 已运行${NC}"
fi

start_adapter_watch

if [ "$START_TUI" = true ]; then
    sleep 2
    start_tui_watch
fi

print_status

# 等待任意子进程结束，清理其他
trap 'echo -e "\n${YELLOW}收到退出信号，正在停止...${NC}"; ${PROJECT_ROOT}/scripts/dev-stop.sh; exit 0' SIGINT SIGTERM

wait
