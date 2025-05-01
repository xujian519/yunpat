#!/bin/bash

# 文件放置检查脚本
# 检查根目录是否有违规的文档文件

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VIOLATIONS_FOUND=false

echo "🔍 检查项目根目录文件放置..."
echo ""

# 定义允许在根目录的文件
ALLOWED_ROOT_FILES=(
    "README.md"
    "CHANGELOG.md"
    "CONTRIBUTING.md"
    "CLAUDE.md"
    "LICENSE"
    ".env"
    ".env.example"
    ".env.test"
    ".gitignore"
    ".eslintrc.json"
    ".prettierrc"
    ".prettierrc.json"
    ".prettierignore"
    "package.json"
    "pnpm-workspace.yaml"
    "pnpm-lock.yaml"
    "tsconfig.base.json"
    "esbuild.config.mjs"
)

# 定义违规文件模式（这些文件应该在 docs/ 下）
VIOLATION_PATTERNS=(
    "*SUMMARY*.md"
    "*REPORT*.md"
    "*PLAN*.md"
    "*PROGRESS*.md"
    "*ANALYSIS*.md"
    "*GUIDE*.md"
    "API.md"
    "DEVELOPMENT.md"
    "ROADMAP.md"
    "*ARCHITECTURE*.md"
    "*REFACTOR*.md"
    "*OPTIMIZATION*.md"
    "*CLEANUP*.md"
    "*COMPLETION*.md"
)

echo "📋 检查根目录的 markdown 文件..."
echo ""

# 查找根目录所有 .md 文件
for md_file in "$PROJECT_ROOT"/*.md; do
    if [ -f "$md_file" ]; then
        filename=$(basename "$md_file")

        # 检查是否在允许列表中
        is_allowed=false
        for allowed in "${ALLOWED_ROOT_FILES[@]}"; do
            if [[ "$filename" == "$allowed" ]]; then
                is_allowed=true
                break
            fi
        done

        if [ "$is_allowed" = false ]; then
            echo "❌ 发现违规文件: $filename"
            echo "   建议移动到 docs/reports/ 或 docs/guides/"
            VIOLATIONS_FOUND=true
        fi
    fi
done

echo ""
echo "📊 检查结果:"
if [ "$VIOLATIONS_FOUND" = true ]; then
    echo "⚠️  发现违规文件，请参考 docs/FILE_MANAGEMENT_RULES.md 进行整理"
    exit 1
else
    echo "✅ 所有文件放置正确！"
    exit 0
fi
