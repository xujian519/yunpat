#!/bin/bash

# YunPat 环境变量验证脚本
# 检查 .env 配置是否完整和正确

set -e

echo "🔍 YunPat 环境变量配置检查"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo -e "${RED}❌ 错误: .env 文件不存在${NC}"
    echo ""
    echo "请先创建 .env 文件："
    echo "  cp .env.quickstart.example .env"
    echo "  或"
    echo "  cp .env.example .env"
    echo ""
    echo "然后编辑 .env 文件，填入实际的 API Key 和路径。"
    exit 1
fi

echo -e "${GREEN}✅ .env 文件存在${NC}"
echo ""

# 加载环境变量
set -a
source .env
set +a

# 必需配置检查
echo "📋 必需配置检查："
echo "--------------------------------"

check_required() {
    local var_name=$1
    local var_value=${!var_name}
    local description=$2

    if [ -z "$var_value" ] || [[ "$var_value" == *"your-"* ]] || [[ "$var_value" == *"sk-"* ]]; then
        if [[ "$var_value" == *"sk-"* ]]; then
            echo -e "${GREEN}✅${NC} $var_name: $description"
        else
            echo -e "${RED}❌${NC} $var_name: $description (未配置或使用默认值)"
            return 1
        fi
    else
        echo -e "${GREEN}✅${NC} $var_name: $description"
    fi
}

# 检查必需的环境变量
REQUIRED_VARS=(
    "DEEPSEEK_API_KEY:DeepSeek API 密钥"
    "KNOWLEDGE_BASE_PATH:知识库路径"
    "PROMPT_TEMPLATES_DIR:提示词模板目录"
)

all_required=true
for var in "${REQUIRED_VARS[@]}"; do
    IFS=':' read -r var_name description <<< "$var"
    if ! check_required "$var_name" "$description"; then
        all_required=false
    fi
done

echo ""

# 可选配置检查
echo "📋 可选配置检查："
echo "--------------------------------"

check_optional() {
    local var_name=$1
    local var_value=${!var_name}
    local description=$2

    if [ -z "$var_value" ] || [[ "$var_value" == *"your-"* ]]; then
        echo -e "${YELLOW}⚠️ ${NC} $var_name: $description (未配置)"
    else
        echo -e "${GREEN}✅${NC} $var_name: $description"
    fi
}

# 检查可选的环境变量
OPTIONAL_VARS=(
    "DASHSCOPE_API_KEY:通义千问 API 密钥"
    "GLM_API_KEY:智谱 GLM API 密钥"
    "DATABASE_URL:PostgreSQL 数据库连接"
    "REDIS_URL:Redis 缓存连接"
)

for var in "${OPTIONAL_VARS[@]}"; do
    IFS=':' read -r var_name description <<< "$var"
    check_optional "$var_name" "$description"
done

echo ""

# 路径验证
echo "📂 路径验证："
echo "--------------------------------"

if [ -n "$KNOWLEDGE_BASE_PATH" ]; then
    if [ -d "$KNOWLEDGE_BASE_PATH" ]; then
        file_count=$(find "$KNOWLEDGE_BASE_PATH" -type f | wc -l)
        echo -e "${GREEN}✅${NC} 知识库路径存在: $KNOWLEDGE_BASE_PATH"
        echo "   包含 $file_count 个文件"
    else
        echo -e "${RED}❌${NC} 知识库路径不存在: $KNOWLEDGE_BASE_PATH"
        all_required=false
    fi
fi

if [ -n "$PROMPT_TEMPLATES_DIR" ]; then
    if [ -d "$PROMPT_TEMPLATES_DIR" ]; then
        echo -e "${GREEN}✅${NC} 提示词模板目录存在: $PROMPT_TEMPLATES_DIR"
    else
        echo -e "${YELLOW}⚠️ ${NC} 提示词模板目录不存在: $PROMPT_TEMPLATES_DIR"
    fi
fi

echo ""

# 依赖检查
echo "🔧 依赖检查："
echo "--------------------------------"

if command -v node &> /dev/null; then
    node_version=$(node -v)
    echo -e "${GREEN}✅${NC} Node.js: $node_version"
else
    echo -e "${RED}❌${NC} Node.js 未安装"
    all_required=false
fi

if command -v pnpm &> /dev/null; then
    pnpm_version=$(pnpm -v)
    echo -e "${GREEN}✅${NC} pnpm: $pnpm_version"
else
    echo -e "${YELLOW}⚠️ ${NC} pnpm 未安装（推荐使用）"
fi

echo ""

# 总结
echo "================================"
if [ "$all_required" = true ]; then
    echo -e "${GREEN}✅ 所有必需配置已正确设置！${NC}"
    echo ""
    echo "下一步："
    echo "  1. 运行测试: pnpm test"
    echo "  2. 构建项目: pnpm build"
    echo "  3. 测试 GLM: ./test-glm.sh"
    exit 0
else
    echo -e "${RED}❌ 部分必需配置缺失，请补充后重试${NC}"
    echo ""
    echo "请检查以下配置："
    echo "  1. 确保 DEEPSEEK_API_KEY 已设置"
    echo "  2. 确保 KNOWLEDGE_BASE_PATH 路径正确"
    echo "  3. 确保 PROMPT_TEMPLATES_DIR 路径正确"
    echo ""
    echo "获取 API Key："
    echo "  - DeepSeek: https://platform.deepseek.com/"
    echo "  - 通义千问: https://dashscope.console.aliyun.com/"
    echo "  - 智谱 GLM: https://open.bigmodel.cn/"
    exit 1
fi
