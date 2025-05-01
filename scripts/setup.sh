#!/bin/bash
set -e

echo "🚀 云熙知识产权智能体 - 开发环境初始化"
echo "=========================================="
echo ""

# 检查 Rust
if ! command -v rustc &> /dev/null; then
    echo "📦 安装 Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "✅ Rust 已安装: $(rustc --version)"
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js 18+: https://nodejs.org/"
    exit 1
else
    echo "✅ Node.js 已安装: $(node --version)"
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 安装 pnpm..."
    npm install -g pnpm
else
    echo "✅ pnpm 已安装: $(pnpm --version)"
fi

# 安装 Rust 依赖
echo ""
echo "🦀 安装 Rust 依赖..."
cd crates
cargo fetch
cd ..

# 安装 TypeScript 依赖
echo ""
echo "🔷 安装 TypeScript 依赖..."
cd packages
pnpm install
cd ..

echo ""
echo "🎉 开发环境初始化完成！"
echo ""
echo "常用命令:"
echo "  make build    - 构建全部"
echo "  make dev      - 启动开发模式"
echo "  make test     - 运行全部测试"
echo "  make run      - 启动 TUI"
echo ""
