# YunPat Makefile
# 提供常用的开发和管理命令

.PHONY: help install build test lint format deploy start stop restart logs clean

# 默认目标
help:
	@echo "YunPat 可用命令："
	@echo ""
	@echo "开发命令："
	@echo "  make install    - 安装依赖"
	@echo "  make build      - 构建项目"
	@echo "  make test       - 运行测试"
	@echo "  make lint       - 代码检查"
	@echo "  make format      - 代码格式化"
	@echo ""
	@echo "Docker命令："
	@echo "  make deploy     - 部署到Docker"
	@echo "  make start      - 启动服务"
	@echo "  make stop       - 停止服务"
	@echo "  make restart    - 重启服务"
	@echo "  make logs       - 查看日志"
	@echo "  make status     - 查看服务状态"
	@echo ""
	@echo "其他命令："
	@echo "  make clean      - 清理构建产物"
	@echo ""

# 安装依赖
install:
	@echo "📦 安装依赖..."
	pnpm install

# 构建项目
build:
	@echo "🔨 构建项目..."
	pnpm build

# 运行测试
test:
	@echo "🧪 运行测试..."
	pnpm test

# 代码检查
lint:
	@echo "🔍 代码检查..."
	pnpm lint

# 代码格式化
format:
	@echo "✨ 代码格式化..."
	pnpm format

# Docker部署
deploy:
	@echo "🚀 部署到Docker..."
	./scripts/deploy.sh deploy

# 启动服务
start:
	@echo "▶️  启动服务..."
	./scripts/deploy.sh start

# 停止服务
stop:
	@echo "⏹ 停止服务..."
	./scripts/deploy.sh stop

# 重启服务
restart:
	@echo "🔄 重启服务..."
	./scripts/deploy.sh restart

# 查看日志
logs:
	@./scripts/deploy.sh logs

# 查看服务状态
status:
	@./scripts/deploy.sh status

# 清理构建产物
clean:
	@echo "🧹 清理构建产物..."
	rm -rf packages/*/dist
	rm -rf node_modules
	rm -rf .pnpm-store
	@echo "✅ 清理完成"

# 构建Docker镜像
docker-build:
	@echo "🐳 构建Docker镜像..."
	./scripts/deploy.sh build

# 健康检查
health:
	@echo "🏥 执行健康检查..."
	./scripts/deploy.sh health
