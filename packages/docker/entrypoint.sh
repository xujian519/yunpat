#!/bin/sh
set -e

# YunPat 服务栈启动脚本
# 同时启动 Rust Gateway 和 Node.js Orchestrator Adapter

echo "Starting YunPat service stack..."

# 设置默认值
export RUST_LOG="${RUST_LOG:-info}"
export ORCHESTRATOR_PORT="${ORCHESTRATOR_PORT:-3001}"
export GATEWAY_PORT="${GATEWAY_PORT:-8080}"
export ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:3001}"
export BIND_ADDRESS="${BIND_ADDRESS:-0.0.0.0:8080}"

# 根据模式选择启动方式
case "${YUNPAT_MODE:-full}" in
  gateway)
    # 仅启动 Rust Gateway
    echo "Starting Rust Gateway only..."
    exec yunpat-gateway
    ;;

  adapter)
    # 仅启动 Node.js Orchestrator Adapter
    echo "Starting Orchestrator Adapter only..."
    cd /app
    exec node packages/orchestrator-adapter/dist/index.js
    ;;

  cli)
    # 启动 CLI 模式
    echo "Starting YunPat CLI..."
    cd /app
    exec node packages/cli/dist/index.js "$@"
    ;;

  tui)
    # 启动 TUI 模式
    echo "Starting YunPat TUI..."
    cd /app
    exec node packages/tui/dist/cli.js "$@"
    ;;

  full|*)
    # 启动完整服务栈（默认）
    echo "Starting full service stack..."

    # 在后台启动 Orchestrator Adapter
    echo "Starting Orchestrator Adapter on port ${ORCHESTRATOR_PORT}..."
    cd /app
    node packages/orchestrator-adapter/dist/index.js &
    ADAPTER_PID=$!

    # 等待 Adapter 就绪
    echo "Waiting for Orchestrator Adapter to be ready..."
    sleep 2

    # 启动 Rust Gateway（前台运行）
    echo "Starting Rust Gateway on ${BIND_ADDRESS}..."
    echo "Orchestrator URL: ${ORCHESTRATOR_URL}"

    # 信号处理：确保 Adapter 也被清理
    trap 'kill $ADAPTER_PID 2>/dev/null || true' EXIT TERM INT

    # 启动 Gateway
    exec yunpat-gateway
    ;;
esac
