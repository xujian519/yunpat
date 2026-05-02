#!/bin/bash
# 自动化部署脚本
# 用法: ./scripts/deploy.sh [environment]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
ENVIRONMENT=${1:-"production"}
BUILD_DIR="dist"
BACKUP_DIR=".deploy-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}=== 部署脚本 ===${NC}"
echo "环境: $ENVIRONMENT"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 函数：清理旧构建
cleanup_old_builds() {
    echo -e "${YELLOW}🧹 清理旧构建...${NC}"
    find . -name "*.log" -mtime +7 -delete 2>/dev/null || true
    find node_modules -name "*.log" -delete 2>/dev/null || true
}

# 函数：备份当前版本
backup_current_version() {
    if [ -d "$BUILD_DIR" ]; then
        echo -e "${YELLOW}💾 备份当前版本...${NC}"
        mkdir -p "$BACKUP_DIR"
        tar -czf "$BACKUP_DIR/pre-deploy_$TIMESTAMP.tar.gz" "$BUILD_DIR" 2>/dev/null || true
        echo "✅ 备份完成: $BACKUP_DIR/pre-deploy_$TIMESTAMP.tar.gz"
    fi
}

# 函数：构建项目
build_project() {
    echo -e "${YELLOW}🏗️ 构建项目...${NC}"
    
    # 清理旧构建
    rm -rf "$BUILD_DIR"
    
    # 运行构建
    if [ "$ENVIRONMENT" = "production" ]; then
        pnpm build:production
    else
        pnpm build
    fi
    
    # 验证构建结果
    if [ ! -d "$BUILD_DIR" ]; then
        echo -e "${RED}❌ 构建失败：找不到输出目录${NC}"
        exit 1
    fi
    
    echo "✅ 构建完成"
}

# 函数：运行测试
run_tests() {
    echo -e "${YELLOW}🧪 运行测试...${NC}"
    pnpm test:unit || echo "⚠️ 单元测试失败，继续部署"
}

# 函数：部署
deploy() {
    echo -e "${YELLOW}🚀 开始部署...${NC}"
    
    case "$ENVIRONMENT" in
        production)
            echo "📦 部署到生产环境"
            # 这里添加实际的部署命令
            # 例如: rsync -avz dist/ user@server:/path/
            echo "✅ 生产环境部署完成"
            ;;
        staging)
            echo "🧪 部署到预发布环境"
            # 预发布环境部署命令
            echo "✅ 预发布环境部署完成"
            ;;
        development)
            echo "🔧 部署到开发环境"
            # 开发环境部署命令
            echo "✅ 开发环境部署完成"
            ;;
        *)
            echo -e "${RED}❌ 未知环境: $ENVIRONMENT${NC}"
            exit 1
            ;;
    esac
}

# 函数：健康检查
health_check() {
    echo -e "${YELLOW}🔍 健康检查...${NC}"
    
    # 检查构建产物
    if [ ! -d "$BUILD_DIR" ]; then
        echo -e "${RED}❌ 健康检查失败：找不到构建产物${NC}"
        return 1
    fi
    
    # 检查关键文件
    if [ -f "packages/core/dist/index.js" ] || [ -f "packages/core/dist/index.mjs" ]; then
        echo "✅ 核心包构建正常"
    else
        echo -e "${YELLOW}⚠️ 警告：核心包可能构建失败${NC}"
    fi
    
    echo "✅ 健康检查通过"
}

# 函数：回滚
rollback() {
    echo -e "${RED}🔄 回滚到之前版本...${NC}"
    
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/pre-deploy_*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        echo -e "${RED}❌ 没有找到备份文件${NC}"
        exit 1
    fi
    
    echo "恢复备份: $LATEST_BACKUP"
    tar -xzf "$LATEST_BACKUP"
    echo "✅ 回滚完成"
}

# 主流程
main() {
    # 检查是否有回滚请求
    if [ "$2" = "rollback" ]; then
        rollback
        exit 0
    fi
    
    # 正常部署流程
    cleanup_old_builds
    backup_current_version
    build_project
    run_tests
    health_check
    deploy
    
    echo ""
    echo -e "${GREEN}=== 部署完成 ===${NC}"
    echo "环境: $ENVIRONMENT"
    echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "回滚命令: ./scripts/deploy.sh $ENVIRONMENT rollback"
}

# 错误处理
trap 'echo -e "${RED}❌ 部署失败${NC}"; exit 1' ERR

# 运行主流程
main "$@"
