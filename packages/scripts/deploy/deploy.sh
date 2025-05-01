#!/bin/bash

# ============================================================================
# YunPat 部署脚本
# ============================================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi

    log_success "依赖检查通过"
}

# 检查环境变量
check_env_vars() {
    log_info "检查环境变量..."

    if [ ! -f .env ]; then
        log_warning ".env文件不存在，使用默认配置"
        cat > .env << 'ENVFILE'
# LLM配置
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key_here

# 数据库配置
POSTGRES_PASSWORD=yunpat_password

# Grafana配置
GRAFANA_PASSWORD=admin
ENVFILE
        log_warning "已创建.env文件，请设置API密钥"
    fi

    log_success "环境变量检查完成"
}

# 构建镜像
build_images() {
    log_info "开始构建Docker镜像..."

    log_info "构建OrchestratorAgent..."
    docker-compose build orchestrator

    log_success "镜像构建完成"
}

# 启动服务
start_services() {
    log_info "启动服务..."

    # 创建必要的目录
    mkdir -p logs docker/prometheus docker/grafana/provisioning docker/grafana/dashboards

    # 启动服务
    docker-compose up -d

    # 等待服务启动
    log_info "等待服务启动..."
    sleep 10

    # 检查服务状态
    if docker-compose ps | grep -q "Up"; then
        log_success "服务启动成功"
    else
        log_error "服务启动失败"
        docker-compose logs
        exit 1
    fi
}

# 健康检查
health_check() {
    log_info "执行健康检查..."

    # 检查Redis
    if docker-compose exec -T redis redis-cli ping &> /dev/null; then
        log_success "Redis健康检查通过"
    else
        log_warning "Redis健康检查失败"
    fi

    # 检查PostgreSQL
    if docker-compose exec -T postgres pg_isready -U yunpat &> /dev/null; then
        log_success "PostgreSQL健康检查通过"
    else
        log_warning "PostgreSQL健康检查失败"
    fi
}

# 显示服务信息
show_info() {
    echo ""
    log_success "YunPat部署完成！"
    echo ""
    echo "服务访问地址："
    echo "  - Grafana监控:      http://localhost:3001 (admin/admin)"
    echo "  - Prometheus:      http://localhost:9090"
    echo ""
    echo "查看日志："
    echo "  docker-compose logs -f [service-name]"
    echo ""
    echo "停止服务："
    echo "  docker-compose down"
    echo ""
}

# 主函数
main() {
    echo "=========================================="
    echo "  YunPat 自动部署脚本"
    echo "=========================================="
    echo ""

    # 解析命令行参数
    case "${1:-deploy}" in
        build)
            check_dependencies
            check_env_vars
            build_images
            ;;
        start)
            check_dependencies
            check_env_vars
            start_services
            health_check
            show_info
            ;;
        stop)
            log_info "停止服务..."
            docker-compose down
            log_success "服务已停止"
            ;;
        restart)
            log_info "重启服务..."
            docker-compose restart
            health_check
            log_success "服务已重启"
            ;;
        logs)
            docker-compose logs -f "${2:-}"
            ;;
        status)
            docker-compose ps
            ;;
        deploy)
            check_dependencies
            check_env_vars
            build_images
            start_services
            health_check
            show_info
            ;;
        health)
            health_check
            ;;
        *)
            echo "用法: $0 {deploy|build|start|stop|restart|logs|status|health}"
            echo ""
            echo "命令说明："
            echo "  deploy  - 完整部署（构建+启动+健康检查）"
            echo "  build   - 仅构建Docker镜像"
            echo "  start   - 仅启动服务"
            echo "  stop    - 停止所有服务"
            echo "  restart - 重启所有服务"
            echo "  logs    - 查看日志（可选指定服务名）"
            echo "  status  - 查看服务状态"
            echo "  health  - 执行健康检查"
            echo ""
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
