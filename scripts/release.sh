#!/bin/bash
set -e

echo "📦 云熙知识产权智能体 - 发布脚本"
echo "=================================="
echo ""

VERSION=$(grep '^version' Cargo.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')
echo "版本: $VERSION"

# 检查工作区是否干净
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ 工作区不干净，请先提交所有更改"
    exit 1
fi

# 运行测试
echo "🧪 运行测试..."
make test

# 构建发布版本
echo ""
echo "🔨 构建发布版本..."
make build

# 创建发布目录
RELEASE_DIR="release/yunpat-agent-v$VERSION"
mkdir -p "$RELEASE_DIR"

# 复制二进制文件
cp target/release/deepseek "$RELEASE_DIR/"

# 复制配置
cp -r config "$RELEASE_DIR/" 2>/dev/null || true

# 创建发布包
echo ""
echo "📦 创建发布包..."
tar -czf "release/yunpat-agent-v$VERSION-linux-x64.tar.gz" -C "$RELEASE_DIR" .

echo ""
echo "✅ 发布包已创建: release/yunpat-agent-v$VERSION-linux-x64.tar.gz"
echo ""
echo "下一步:"
echo "  1. 创建 Git tag: git tag v$VERSION"
echo "  2. 推送 tag: git push origin v$VERSION"
echo "  3. 在 GitHub 上创建 Release"
