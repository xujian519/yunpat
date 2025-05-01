#!/bin/bash

# YunPat PostgreSQL + pgvector 快速启动脚本
# 用途：快速搭建开发环境并运行测试

set -e  # 遇到错误立即退出

echo "🚀 YunPat PostgreSQL + pgvector 快速启动"
echo "========================================"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 检查 Docker 是否安装
echo "📦 检查 Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker 已安装${NC}"

# 2. 启动 PostgreSQL 容器
echo "🐘 启动 PostgreSQL + pgvector 容器..."
cd packages/core/src/memory/long-term
docker-compose up -d

# 等待 PostgreSQL 启动
echo "⏳ 等待 PostgreSQL 启动..."
for i in {1..30}; do
    if docker exec yunpat-postgres pg_isready -U yunpat &> /dev/null; then
        echo -e "${GREEN}✅ PostgreSQL 已启动${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ PostgreSQL 启动超时${NC}"
        exit 1
    fi
    sleep 1
done

# 3. 初始化数据库
echo "🔧 初始化数据库..."
docker exec -i yunpat-postgres psql -U yunpat -d yunpat < schema.sql
echo -e "${GREEN}✅ 数据库初始化完成${NC}"

# 4. 显示连接信息
echo ""
echo "========================================"
echo -e "${GREEN}🎉 环境准备完成！${NC}"
echo "========================================"
echo ""
echo "📋 连接信息："
echo "   数据库 URL: postgres://yunpat:yunpat123@localhost:5432/yunpat"
echo "   测试数据库: postgres://yunpat:yunpat123@localhost:5432/yunpat_test"
echo ""
echo "🛠️  常用命令："
echo "   查看日志: docker-compose logs -f postgres"
echo "   停止服务: docker-compose down"
echo "   数据库 Shell: docker exec -it yunpat-postgres psql -U yunpat -d yunpat"
echo "   pgAdmin: http://localhost:5050 (admin@yunpat.com / admin)"
echo ""
echo "🧪 运行测试："
echo "   cd packages/core"
echo "   pnpm test postgres-store.integration"
echo ""

# 5. 询问是否运行测试
read -p "是否立即运行集成测试？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧪 运行集成测试..."
    cd ../../../../..

    # 创建测试数据库
    echo "创建测试数据库..."
    docker exec yunpat-postgres psql -U yunpat -c "DROP DATABASE IF EXISTS yunpat_test;"
    docker exec yunpat-postgres psql -U yunpat -c "CREATE DATABASE yunpat_test;"

    # 初始化测试数据库
    docker exec -i yunpat-postgres psql -U yunpat -d yunpat_test < packages/core/src/memory/long-term/schema.sql

    # 运行测试
    pnpm --filter @yunpat/core test postgres-store.integration
fi

echo ""
echo -e "${GREEN}✅ 完成！${NC}"
