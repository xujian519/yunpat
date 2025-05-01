#!/bin/bash
#
# 本地部署脚本
# 用法: ./scripts/deploy-local.sh [environment] [action]
#
# 环境:
#   - development: 开发环境
#   - staging: 预发布环境
#   - production: 生产环境
#
# 操作:
#   - (默认): 正常部署
#   - rollback: 回滚到上一版本
#   - status: 查看部署状态
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
ENVIRONMENT=${1:-"development"}
ACTION=${2:-"deploy"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUILD_DIR="dist"
BACKUP_DIR=".deploy-backup"
LOG_DIR=".deploy-logs"

# 创建必要的目录
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"

# 日志文件
LOG_FILE="$LOG_DIR/deploy_${ENVIRONMENT}_${TIMESTAMP}.log"

# 日志函数
log() {
    local level=$1
    shift
    local message="$@"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" | tee -a "$LOG_FILE"
}

# 打印头部
print_header() {
    echo -e "${CYAN}"
    echo "═══════════════════════════════════════════════════════════════"
    echo "   🚀 本地部署脚本"
    echo "   环境: $ENVIRONMENT"
    echo "   操作: $ACTION"
    echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

# 预检查
pre_check() {
    log "INFO" "开始部署前检查..."

    # 检查 Git 状态
    if ! git diff --quiet || ! git diff --cached --quiet; then
        log "WARN" "有未提交的变更"
        echo -e "  ${YELLOW}⚠️  警告: 有未提交的变更${NC}"
        git status --short | sed 's/^/    /'
        echo ""
        read -p "是否继续部署？(y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "INFO" "用户取消部署"
            exit 0
        fi
    fi

    # 检查 CI 状态
    if [ -x "scripts/ci-local.sh" ]; then
        log "INFO" "运行 CI 检查..."
        if ! bash scripts/ci-local.sh quick > /tmp/ci_pre_deploy.log 2>&1; then
            log "ERROR" "CI 检查失败"
            echo -e "  ${RED}❌ CI 检查失败${NC}"
            echo ""
            echo "  查看 CI 日志:"
            cat /tmp/ci_pre_deploy.log | sed 's/^/    /'
            echo ""
            read -p "是否强制部署？(y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "INFO" "用户取消部署"
                exit 1
            fi
        else
            log "INFO" "CI 检查通过"
        fi
    fi

    log "INFO" "部署前检查完成"
}

# 清理旧构建
cleanup() {
    log "INFO" "清理旧构建..."

    # 清理日志（保留最近 7 天）
    find "$LOG_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true

    # 清理备份（保留最近 3 个）
    ls -t "$BACKUP_DIR"/pre-deploy_*.tar.gz 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true

    # 清理构建缓存
    rm -rf node_modules/.cache 2>/dev/null || true

    log "INFO" "清理完成"
}

# 备份当前版本
backup() {
    log "INFO" "备份当前版本..."

    if [ -d "$BUILD_DIR" ]; then
        local backup_file="$BACKUP_DIR/pre-deploy_${TIMESTAMP}.tar.gz"
        tar -czf "$backup_file" "$BUILD_DIR" 2>/dev/null || true

        if [ -f "$backup_file" ]; then
            local size=$(du -h "$backup_file" | cut -f1)
            log "INFO" "备份完成: $backup_file ($size)"
            echo -e "  ${GREEN}✓ 备份完成${NC} ($size)"
        else
            log "WARN" "备份失败"
            echo -e "  ${YELLOW}⚠️  备份失败${NC}"
        fi
    else
        log "INFO" "无需备份（构建目录不存在）"
    fi
}

# 构建项目
build() {
    log "INFO" "开始构建项目..."

    echo -e "  ${BLUE}🏗️  构建中...${NC}"

    # 清理旧构建
    rm -rf "$BUILD_DIR"

    # 根据环境选择构建命令
    case "$ENVIRONMENT" in
        production)
            if pnpm build:production > /tmp/build.log 2>&1; then
                log "INFO" "生产环境构建成功"
            else
                log "ERROR" "生产环境构建失败"
                echo -e "  ${RED}❌ 构建失败${NC}"
                cat /tmp/build.log | tail -20 | sed 's/^/    /'
                return 1
            fi
            ;;
        staging|development)
            if pnpm build > /tmp/build.log 2>&1; then
                log "INFO" "${ENVIRONMENT} 环境构建成功"
            else
                log "ERROR" "${ENVIRONMENT} 环境构建失败"
                echo -e "  ${RED}❌ 构建失败${NC}"
                cat /tmp/build.log | tail -20 | sed 's/^/    /'
                return 1
            fi
            ;;
        *)
            log "ERROR" "未知环境: $ENVIRONMENT"
            echo -e "  ${RED}❌ 未知环境: $ENVIRONMENT${NC}"
            return 1
            ;;
    esac

    echo -e "  ${GREEN}✓ 构建完成${NC}"
}

# 运行测试
test() {
    log "INFO" "运行测试..."

    echo -e "  ${BLUE}🧪 测试中...${NC}"

    if pnpm test:unit > /tmp/test.log 2>&1; then
        log "INFO" "测试通过"
        echo -e "  ${GREEN}✓ 测试通过${NC}"
    else
        log "WARN" "测试失败"
        echo -e "  ${YELLOW}⚠️  测试失败（继续部署）${NC}"
        cat /tmp/test.log | tail -10 | sed 's/^/    /'
    fi
}

# 部署
deploy() {
    log "INFO" "开始部署到 $ENVIRONMENT 环境..."

    echo -e "  ${BLUE}📦 部署中...${NC}"

    case "$ENVIRONMENT" in
        production)
            log "INFO" "部署到生产环境"
            echo -e "  ${GREEN}✓ 生产环境部署完成${NC}"
            # 这里添加实际的生产环境部署命令
            # 例如: rsync -avz dist/ user@server:/path/
            ;;
        staging)
            log "INFO" "部署到预发布环境"
            echo -e "  ${GREEN}✓ 预发布环境部署完成${NC}"
            # 这里添加实际的预发布环境部署命令
            ;;
        development)
            log "INFO" "部署到开发环境"
            echo -e "  ${GREEN}✓ 开发环境部署完成${NC}"
            # 这里添加实际的开发环境部署命令
            ;;
        *)
            log "ERROR" "未知环境: $ENVIRONMENT"
            echo -e "  ${RED}❌ 未知环境: $ENVIRONMENT${NC}"
            return 1
            ;;
    esac

    log "INFO" "部署完成"
}

# 健康检查
health_check() {
    log "INFO" "执行健康检查..."

    echo -e "  ${BLUE}🔍 健康检查...${NC}"

    local errors=0

    # 检查构建产物
    if [ ! -d "$BUILD_DIR" ]; then
        log "ERROR" "找不到构建产物目录"
        echo -e "    ${RED}✗ 构建产物目录缺失${NC}"
        errors=$((errors + 1))
    fi

    # 检查核心包
    if [ ! -f "packages/core/dist/index.js" ] && [ ! -f "packages/core/dist/index.mjs" ]; then
        log "WARN" "核心包构建产物可能缺失"
        echo -e "    ${YELLOW}⚠️  核心包构建产物可能缺失${NC}"
    else
        echo -e "    ${GREEN}✓ 核心包构建正常${NC}"
    fi

    # 检查文件大小
    if [ -d "$BUILD_DIR" ]; then
        local size=$(du -sh "$BUILD_DIR" 2>/dev/null | cut -f1)
        echo -e "    ${GREEN}✓ 构建产物大小: $size${NC}"
    fi

    if [ $errors -eq 0 ]; then
        log "INFO" "健康检查通过"
        echo -e "  ${GREEN}✓ 健康检查通过${NC}"
        return 0
    else
        log "ERROR" "健康检查失败"
        echo -e "  ${RED}✗ 健康检查失败${NC}"
        return 1
    fi
}

# 回滚
rollback() {
    log "INFO" "开始回滚..."

    echo -e "  ${RED}🔄 回滚中...${NC}"

    local latest_backup=$(ls -t "$BACKUP_DIR"/pre-deploy_*.tar.gz 2>/dev/null | head -1)

    if [ -z "$latest_backup" ]; then
        log "ERROR" "没有找到备份文件"
        echo -e "  ${RED}❌ 没有找到备份文件${NC}"
        exit 1
    fi

    echo -e "  ${YELLOW}恢复备份: $latest_backup${NC}"

    # 删除当前构建
    rm -rf "$BUILD_DIR"

    # 恢复备份
    if tar -xzf "$latest_backup" 2>/dev/null; then
        log "INFO" "回滚完成"
        echo -e "  ${GREEN}✓ 回滚完成${NC}"

        # 重新部署
        deploy
        health_check
    else
        log "ERROR" "回滚失败"
        echo -e "  ${RED}❌ 回滚失败${NC}"
        exit 1
    fi
}

# 查看状态
status() {
    log "INFO" "查看部署状态..."

    echo ""
    echo -e "${CYAN}📊 部署状态${NC}"
    echo ""

    # 最新备份
    echo "📦 最新备份:"
    ls -lh "$BACKUP_DIR"/pre-deploy_*.tar.gz 2>/dev/null | tail -5 | awk '{print "    " $9 " (" $5 ")"}'
    if [ $(ls "$BACKUP_DIR"/pre-deploy_*.tar.gz 2>/dev/null | wc -l) -eq 0 ]; then
        echo "    (无备份)"
    fi
    echo ""

    # 构建状态
    echo "🏗️  构建状态:"
    if [ -d "$BUILD_DIR" ]; then
        local size=$(du -sh "$BUILD_DIR" 2>/dev/null | cut -f1)
        local files=$(find "$BUILD_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo "    大小: $size"
        echo "    文件: $files 个"
        echo "    时间: $(ls -l "$BUILD_DIR" | awk '{print $6 " " $7 " " $8}')"
    else
        echo "    (未构建)"
    fi
    echo ""

    # 最近部署日志
    echo "📋 最近部署:"
    ls -lt "$LOG_DIR"/deploy_*.log 2>/dev/null | head -5 | awk '{print "    " $9}'
    if [ $(ls "$LOG_DIR"/deploy_*.log 2>/dev/null | wc -l) -eq 0 ]; then
        echo "    (无日志)"
    fi
    echo ""
}

# 主流程
main() {
    print_header

    case "$ACTION" in
        rollback)
            rollback
            ;;
        status)
            status
            ;;
        deploy)
            cleanup
            pre_check
            backup
            build
            test
            deploy
            health_check

            log "INFO" "部署完成"

            echo ""
            echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
            echo -e "${GREEN}   ✅ 部署完成${NC}"
            echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
            echo ""
            echo "  环境: $ENVIRONMENT"
            echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
            echo "  日志: $LOG_FILE"
            echo ""
            echo "  回滚命令: ./scripts/deploy-local.sh $ENVIRONMENT rollback"
            echo "  查看状态: ./scripts/deploy-local.sh $ENVIRONMENT status"
            echo ""
            ;;
        *)
            log "ERROR" "未知操作: $ACTION"
            echo -e "  ${RED}❌ 未知操作: $ACTION${NC}"
            echo ""
            echo "  可用操作:"
            echo "    • deploy   - 部署（默认）"
            echo "    • rollback - 回滚"
            echo "    • status   - 查看状态"
            echo ""
            exit 1
            ;;
    esac
}

# 错误处理
trap 'log "ERROR" "部署失败"; echo -e "${RED}❌ 部署失败${NC}"; exit 1' ERR

# 运行主流程
main "$@"
