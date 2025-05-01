#!/bin/bash

# YunPat Metrics 服务器启动脚本

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          启动 YunPat Metrics 服务器                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 检查端口是否被占用
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  端口 3000 已被占用"
    echo "请先停止占用该端口的进程："
    echo "  lsof -ti:3000 | xargs kill -9"
    exit 1
fi

# 启动服务器
echo "🚀 启动服务器..."
npx tsx examples/simple-metrics-server.ts
