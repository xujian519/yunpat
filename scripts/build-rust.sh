#!/bin/bash
# Rust 构建和测试脚本（带重试机制）
# 用法: ./scripts/build-rust.sh [build|test|clean]

set -e

# 配置
MAX_ATTEMPTS=3
RETRY_DELAY=5
PROJECT_DIR="packages/rust-tools"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 带重试的执行函数
execute_with_retry() {
    local command=$1
    local description=$2
    local attempt=1

    while [ $attempt -le $MAX_ATTEMPTS ]; do
        log_info "$description (尝试 $attempt/$MAX_ATTEMPTS)"

        if eval "$command"; then
            log_info "$description 成功！"
            return 0
        else
            exit_code=$?
            log_error "$description 失败 (退出码: $exit_code)"

            if [ $attempt -lt $MAX_ATTEMPTS ]; then
                log_warn "等待 ${RETRY_DELAY} 秒后重试..."
                sleep $RETRY_DELAY

                # 清理可能的中间状态
                if [ -d "$PROJECT_DIR/target" ]; then
                    log_info "清理中间构建产物..."
                    cd "$PROJECT_DIR"
                    cargo clean || true
                    cd - > /dev/null
                fi
            else
                log_error "达到最大重试次数，放弃"
                return 1
            fi

            attempt=$((attempt + 1))
        fi
    done

    return 1
}

# 检查Rust环境
check_rust_env() {
    log_info "检查 Rust 环境..."

    if ! command -v rustc &> /dev/null; then
        log_error "Rust 未安装"
        log_info "请访问 https://rustup.rs/ 安装 Rust"
        exit 1
    fi

    log_info "Rust 版本: $(rustc --version)"
    log_info "Cargo 版本: $(cargo --version)"

    # 检查项目目录
    if [ ! -d "$PROJECT_DIR" ]; then
        log_error "Rust 项目目录不存在: $PROJECT_DIR"
        exit 1
    fi

    cd "$PROJECT_DIR"
}

# 构建Rust项目
build_rust() {
    check_rust_env

    log_info "开始构建 Rust 项目..."

    # 使用优化的构建配置
    export CARGO_PROFILE_RELEASE_DEBUG=0
    export RUST_BACKTRACE=1

    execute_with_retry \
        "cargo build --release" \
        "构建 Rust 项目"

    if [ $? -eq 0 ]; then
        log_info "构建产物: $(find target/release -maxdepth 1 -type f -executable 2>/dev/null | head -5)"
    fi
}

# 测试Rust项目
test_rust() {
    check_rust_env

    log_info "运行 Rust 测试..."

    export RUST_BACKTRACE=1

    execute_with_retry \
        "cargo test --release" \
        "运行 Rust 测试"
}

# 代码检查
check_rust() {
    check_rust_env

    log_info "运行 Rust 代码检查..."

    # 代码格式检查
    log_info "检查代码格式..."
    cargo fmt -- --check || true

    # Clippy 检查
    log_info "运行 Clippy..."
    cargo clippy -- -D warnings || true

    # 编译检查
    log_info "编译检查..."
    cargo check --all-targets || true
}

# 清理构建产物
clean_rust() {
    if [ ! -d "$PROJECT_DIR" ]; then
        log_warn "Rust 项目目录不存在"
        return
    fi

    cd "$PROJECT_DIR"

    log_info "清理构建产物..."
    cargo clean

    log_info "清理完成"
}

# 显示帮助
show_help() {
    cat << EOF
Rust 构建和测试脚本（带重试机制）

用法: $0 [命令]

命令:
  build    构建 Rust 项目（带重试）
  test     运行 Rust 测试（带重试）
  check    代码检查（格式、Clippy、编译检查）
  clean    清理构建产物
  help     显示此帮助信息

配置:
  MAX_ATTEMPTS=$MAX_ATTEMPTS (最大重试次数)
  RETRY_DELAY=$RETRY_DELAY (重试延迟秒数)

示例:
  $0 build
  $0 test
  $0 clean

EOF
}

# 主函数
main() {
    local command=${1:-help}

    case $command in
        build)
            build_rust
            ;;
        test)
            test_rust
            ;;
        check)
            check_rust
            ;;
        clean)
            clean_rust
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
