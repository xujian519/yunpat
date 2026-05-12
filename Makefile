# 云熙知识产权智能体 - 统一构建系统
# 作者：徐健 <xujian519@gmail.com>

.PHONY: all build build-rust build-ts test test-rust test-ts lint format clean install dev run docker release

# 默认目标
all: build

# =============================================================================
# 安装
# =============================================================================

install:
	@echo "🚀 安装云熙知识产权智能体开发环境..."
	@echo ""
	@echo "📦 检查 Rust 工具链..."
	@rustup show 2>/dev/null || (echo "安装 Rust..." && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh)
	@echo "✅ Rust 就绪"
	@echo ""
	@echo "📦 安装 Node.js 依赖..."
	@cd packages && pnpm install
	@echo "✅ Node.js 依赖安装完成"
	@echo ""
	@echo "🎉 开发环境安装完成！"
	@echo ""
	@echo "常用命令:"
	@echo "  make build    - 构建全部"
	@echo "  make dev      - 启动开发模式"
	@echo "  make test     - 运行全部测试"
	@echo "  make run      - 启动 TUI"

# =============================================================================
# 构建
# =============================================================================

build: build-rust build-ts
	@echo ""
	@echo "✅ 全部构建完成！"

build-rust:
	@echo "🦀 构建 Rust 组件..."
	@cargo build --workspace --release
	@echo "✅ Rust 构建完成"

build-ts:
	@echo "🔷 构建 TypeScript 组件..."
	@cd packages && pnpm build
	@echo "✅ TypeScript 构建完成"

build-rust-debug:
	@echo "🦀 构建 Rust Debug 版本..."
	@cargo build --workspace

# =============================================================================
# 测试
# =============================================================================

test: test-rust test-ts
	@echo ""
	@echo "✅ 全部测试通过！"

test-rust:
	@echo "🧪 运行 Rust 测试..."
	@cargo test --workspace --all-features

test-ts:
	@echo "🧪 运行 TypeScript 测试..."
	@cd packages && pnpm test

test-ts-real:
	@echo "🧪 运行 TypeScript 真实 LLM 测试..."
	@cd packages && pnpm test:real

# =============================================================================
# 代码质量
# =============================================================================

lint:
	@echo "🔍 运行代码检查..."
	@cargo clippy --workspace --all-targets --all-features
	@cd packages && pnpm lint

format:
	@echo "✨ 格式化代码..."
	@cargo fmt --all
	@cd packages && pnpm format

format-check:
	@echo "🔍 检查代码格式..."
	@cargo fmt --all -- --check
	@cd packages && pnpm format:check

# =============================================================================
# 开发
# =============================================================================

dev:
	@echo "🔥 启动开发模式（并行构建）..."
	@echo "按 Ctrl+C 停止"
	@concurrently \
		--names "rust,tsc,mcp" \
		--prefix-colors "cyan,magenta,green" \
		--kill-others \
		"cargo watch -x 'build'" \
		"cd packages && pnpm build:watch" \
		"cd packages && pnpm --filter @yunpat/mcp-server dev" \
		|| true

run: build
	@echo "🚀 启动云熙知识产权智能体..."
	@cargo run --bin yunpat-tui --release

# =============================================================================
# 清理
# =============================================================================

clean:
	@echo "🧹 清理构建产物..."
	@cargo clean
	@rm -rf \
		packages/node_modules \
		packages/packages/*/dist \
		packages/packages/*/node_modules \
		packages/packages/agents/*/dist \
		packages/packages/agents/*/node_modules \
		node_modules
	@echo "✅ 清理完成"

# =============================================================================
# Docker
# =============================================================================

docker:
	@echo "🐳 启动 Docker 环境..."
	@docker-compose up --build

docker-down:
	@docker-compose down

# =============================================================================
# 发布
# =============================================================================

release:
	@echo "📦 准备发布..."
	@./scripts/release.sh

# =============================================================================
# 帮助
# =============================================================================

help:
	@echo "云熙知识产权智能体 - 构建系统"
	@echo ""
	@echo "安装:"
	@echo "  make install        安装开发环境"
	@echo ""
	@echo "构建:"
	@echo "  make build          构建全部（Rust + TypeScript）"
	@echo "  make build-rust     仅构建 Rust"
	@echo "  make build-ts       仅构建 TypeScript"
	@echo ""
	@echo "测试:"
	@echo "  make test           运行全部测试"
	@echo "  make test-rust      运行 Rust 测试"
	@echo "  make test-ts        运行 TypeScript 测试"
	@echo "  make test-ts-real   运行真实 LLM 测试"
	@echo ""
	@echo "开发:"
	@echo "  make dev            启动开发模式（热重载）"
	@echo "  make run            启动 TUI"
	@echo ""
	@echo "代码质量:"
	@echo "  make lint           代码检查"
	@echo "  make format         格式化代码"
	@echo "  make format-check   检查格式"
	@echo ""
	@echo "其他:"
	@echo "  make clean          清理构建产物"
	@echo "  make docker         启动 Docker 环境"
	@echo "  make release        发布新版本"
	@echo "  make help           显示此帮助"
