# YunPat Dockerfile
# 多阶段构建，支持 Rust Gateway + Node.js 服务栈

# ============================================================================
# 阶段0: Rust Gateway 构建
# ============================================================================
FROM rust:1.80-alpine AS rust-build

WORKDIR /rust

# 安装构建依赖
RUN apk add --no-cache musl-dev openssl-dev

# 复制 Cargo 配置
COPY packages/rust-gateway/Cargo.toml ./Cargo.toml
COPY packages/rust-gateway/Cargo.lock ./Cargo.lock 2>/dev/null || true
COPY packages/rust-gateway/src ./src

# 构建 Rust Gateway（release 模式）
RUN cargo build --release

# ============================================================================
# 阶段1: Node.js 依赖安装
# ============================================================================
FROM node:18-alpine AS deps

WORKDIR /app

# 安装构建工具和 pnpm
RUN apk add --no-cache python3 make g++ && \
    npm install -g pnpm@10 && \
    pnpm store prune

# 复制 workspace 配置
COPY pnpm-workspace.yaml ./

# 复制根 package 文件
COPY package.json pnpm-lock.yaml ./

# 复制所有 packages 目录（仅 package.json 用于依赖解析）
COPY packages/ ./packages/

# 安装所有依赖（包括 devDependencies，构建需要）
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile --prefer-offline --ignore-scripts

# 提取生产依赖到单独层
RUN pnpm install --prod --no-frozen-lockfile --ignore-scripts

# ============================================================================
# 阶段2: Node.js 构建
# ============================================================================
FROM node:18-alpine AS build

WORKDIR /app

# 安装构建工具
RUN apk add --no-cache python3 make g++

# 安装 pnpm
COPY --from=deps /root/.local/share/pnpm/store /root/.local/share/pnpm/store
RUN npm install -g pnpm@10

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/*/node_modules ./packages/*/node_modules 2>/dev/null || true

# 复制 package 文件
COPY --from=deps /app ./

# 复制额外构建配置
COPY tsconfig.base.json ./
COPY esbuild.config.mjs ./

# 复制源代码
COPY packages ./packages

# 复制修复脚本
COPY scripts/fix-imports.js /tmp/fix-imports.js

# 构建核心包
RUN pnpm --filter "@yunpat/core" build && \
    pnpm --filter "@yunpat/orchestrator" build && \
    pnpm --filter "@yunpat/orchestrator-adapter" build && \
    pnpm --filter "@yunpat/tui" build && \
    pnpm --filter "@yunpat/grpc-server" build && \
    pnpm --filter "@yunpat/mcp-server" build && \
    pnpm --filter "@yunpat/agent-patent-writer" build || true && \
    pnpm --filter "@yunpat/agent-patent-analyzer" build || true && \
    pnpm --filter "@yunpat/agent-patent-responder" build || true && \
    pnpm --filter "@yunpat/agent-search" build || true

# ============================================================================
# 阶段3: 生产镜像 - 完整服务栈
# ============================================================================
FROM node:18-alpine AS production

WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache dumb-init ca-certificates

# 创建非 root 用户
RUN addgroup -g 1001 -S yunpat && \
    adduser -S -u 1001 -G yunpat yunpat

# 复制生产依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/*/node_modules ./packages/*/node_modules 2>/dev/null || true

# 复制构建产物
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/orchestrator/dist ./packages/orchestrator/dist
COPY --from=build /app/packages/orchestrator-adapter/dist ./packages/orchestrator-adapter/dist
COPY --from=build /app/packages/tui/dist ./packages/tui/dist
COPY --from=build /app/packages/grpc-server/dist ./packages/grpc-server/dist
COPY --from=build /app/packages/mcp-server/dist ./packages/mcp-server/dist

# 复制 agents 构建产物（存在的才复制）
RUN mkdir -p packages/agents
COPY --from=build /app/packages/agents/patent-writer ./packages/agents/patent-writer 2>/dev/null || true
COPY --from=build /app/packages/agents/patent-responder ./packages/agents/patent-responder 2>/dev/null || true
COPY --from=build /app/packages/agents/patent-analyzer ./packages/agents/patent-analyzer 2>/dev/null || true
COPY --from=build /app/packages/agents/search ./packages/agents/search 2>/dev/null || true

# 复制 Rust Gateway 二进制
COPY --from=rust-build /rust/target/release/yunpat-gateway /usr/local/bin/

# 复制配置文件和模板
COPY packages/core/src/config ./packages/core/src/config
COPY packages/patent-prompts ./packages/patent-prompts

# 复制 package.json
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# 复制启动脚本
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# 设置环境变量
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    PATH="/app/node_modules/.bin:$PATH" \
    RUST_LOG=info

# 暴露端口
EXPOSE 8080 3001

# 切换到非 root 用户
USER yunpat

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q -O- http://localhost:8080/internal/health || exit 1

# 默认启动完整服务栈
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "/usr/local/bin/entrypoint.sh"]
