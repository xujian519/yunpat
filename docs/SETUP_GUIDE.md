# 云熙知识产权智能体 - 手动配置指南

> 完成单仓库初始化后的手动操作步骤
>
> 作者：徐健 <xujian519@gmail.com>

---

## 目录

1. [创建GitHub仓库](#1-创建github仓库)
2. [推送代码到GitHub](#2-推送代码到github)
3. [配置GitHub Secrets](#3-配置github-secrets)
4. [初始化知识库](#4-初始化知识库)
5. [配置开发环境](#5-配置开发环境)
6. [Docker配置](#6-docker配置)
7. [验证完整构建](#7-验证完整构建)
8. [常见问题](#8-常见问题)

---

## 1. 创建GitHub仓库

### 步骤1.1：在GitHub上创建新仓库

1. 打开浏览器，访问 [GitHub](https://github.com)
2. 点击右上角 **+** 按钮，选择 **New repository**
3. 填写仓库信息：
   - **Repository name**: `yunpat-agent`
   - **Description**: `云熙知识产权智能体 - 知识产权全生命周期智能体操作系统`
   - **Visibility**: `Public`（推荐开源）或 `Private`（私有）
   - **Initialize this repository with**: 勾选 **Add a README**（可选，后面会覆盖）
4. 点击 **Create repository**

### 步骤1.2：记录仓库地址

创建完成后，GitHub会显示仓库地址：
```
https://github.com/xujian519/yunpat-agent.git
```

记下这个地址，下一步需要用到。

---

## 2. 推送代码到GitHub

### 步骤2.1：添加远程仓库

打开终端，执行以下命令：

```bash
# 进入项目目录
cd /Users/xujian/projects/yunpat-agent

# 添加GitHub远程仓库（替换为你的用户名）
git remote add origin https://github.com/xujian519/yunpat-agent.git

# 验证远程仓库已添加
git remote -v
```

预期输出：
```
origin  https://github.com/xujian519/yunpat-agent.git (fetch)
origin  https://github.com/xujian519/yunpat-agent.git (push)
```

### 步骤2.2：推送代码

```bash
# 推送主分支到GitHub
git push -u origin main
```

如果提示输入用户名和密码：
- **用户名**: 你的GitHub用户名
- **密码**: 使用 **Personal Access Token**（不是GitHub密码）

### 步骤2.3：创建Personal Access Token（如果需要）

1. 访问 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. 点击 **Generate new token (classic)**
3. 填写信息：
   - **Note**: `yunpat-agent-push`
   - **Expiration**: `No expiration`（或选择有效期）
   - **Scopes**: 勾选 `repo`（完整仓库权限）
4. 点击 **Generate token**
5. **立即复制token**（页面关闭后无法再次查看）
6. 在终端推送时，使用这个token作为密码

---

## 3. 配置GitHub Secrets

GitHub Secrets用于CI/CD流水线，存储敏感信息（API密钥等）。

### 步骤3.1：进入Secrets设置

1. 打开GitHub仓库页面
2. 点击 **Settings** 标签
3. 左侧菜单选择 **Secrets and variables > Actions**
4. 点击 **New repository secret**

### 步骤3.2：添加必要的Secrets

逐个添加以下Secrets：

| Secret名称 | 说明 | 获取方式 |
|-----------|------|----------|
| `DEEPSEEK_API_KEY` | DeepSeek API密钥 | [DeepSeek平台](https://platform.deepseek.com/) |
| `DASHSCOPE_API_KEY` | 通义千问API密钥 | [阿里云](https://dashscope.aliyun.com/) |
| `NPM_TOKEN` | npm发布token | [npm设置](https://www.npmjs.com/settings/tokens) |
| `CRATES_IO_TOKEN` | crates.io发布token | [crates.io](https://crates.io/settings/tokens) |

添加方法：
1. 输入 **Name**（如 `DEEPSEEK_API_KEY`）
2. 输入 **Secret**（API密钥值）
3. 点击 **Add secret**

### 步骤3.3：验证Secrets

添加完成后，页面会显示Secrets列表（值会被隐藏）：

```
DEEPSEEK_API_KEY    Updated 2 minutes ago
DASHSCOPE_API_KEY   Updated 1 minute ago
NPM_TOKEN           Updated 30 seconds ago
```

---

## 4. 初始化知识库

### 步骤4.1：检查现有知识库

```bash
# 检查YunPat的知识库是否已复制
ls /Users/xujian/projects/yunpat-agent/packages/knowledge-base/
```

如果目录存在且有内容，说明复制成功。

### 步骤4.2：移动知识库到统一位置

```bash
# 移动知识库到仓库根目录
cd /Users/xujian/projects/yunpat-agent

# 如果packages下有knowledge-base，移动到根目录
if [ -d "packages/knowledge-base" ]; then
    mv packages/knowledge-base/* knowledge-base/ 2>/dev/null || true
    rmdir packages/knowledge-base 2>/dev/null || true
fi

# 验证
ls knowledge-base/
```

### 步骤4.3：提交知识库

```bash
git add knowledge-base/
git commit -m "📚 docs: 初始化专利知识库

- 添加4,382个专利知识库文件
- 覆盖专利法、审查指南、判例等"

git push origin main
```

---

## 5. 配置开发环境

### 步骤5.1：复制环境变量模板

```bash
cd /Users/xujian/projects/yunpat-agent

# 创建环境变量模板
cat > .env.example << 'EOF'
# LLM API密钥（至少配置一个）
DEEPSEEK_API_KEY=sk-...
DASHSCOPE_API_KEY=sk-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...

# 本地模型（可选）
OLLAMA_BASE_URL=http://localhost:11434

# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/patent_db
REDIS_URL=redis://localhost:6379

# MCP配置
MCP_TIMEOUT=300
MCP_MAX_RETRIES=3
EOF

# 创建本地环境变量文件（不提交到git）
cp .env.example .env

# 编辑.env文件，填入你的实际API密钥
# 使用你喜欢的编辑器
# code .env  # VS Code
# vim .env   # Vim
# open -e .env  # macOS TextEdit
echo "请编辑 .env 文件，填入你的API密钥"
```

### 步骤5.2：配置git忽略

确保`.env`文件不会被提交：

```bash
# 检查.gitignore是否包含.env
grep "\.env" .gitignore

# 如果没有，添加
echo ".env" >> .gitignore
```

### 步骤5.3：安装依赖

```bash
# 运行安装脚本
make install

# 或手动安装

# 1. Rust依赖
cd crates && cargo fetch

# 2. TypeScript依赖
cd ../packages && pnpm install
```

---

## 6. Docker配置

### 步骤6.1：创建Dockerfile

```bash
cat > Dockerfile << 'EOF'
# 云熙知识产权智能体 - Docker镜像
# 多阶段构建：Rust + TypeScript

# =============================================================================
# 阶段1：构建Rust
# =============================================================================
FROM rust:1.88-bookworm AS rust-builder

WORKDIR /app/crates
COPY crates/ ./
RUN cargo build --workspace --release

# =============================================================================
# 阶段2：构建TypeScript
# =============================================================================
FROM node:20-bookworm AS ts-builder

RUN npm install -g pnpm

WORKDIR /app/packages
COPY packages/package.json packages/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY packages/ ./
RUN pnpm build

# =============================================================================
# 阶段3：运行环境
# =============================================================================
FROM node:20-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y \
    libsqlite3-0 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制Rust二进制
COPY --from=rust-builder /app/crates/target/release/deepseek /usr/local/bin/deepseek

# 复制TypeScript构建产物
COPY --from=ts-builder /app/packages/*/dist ./packages/

# 复制知识库
COPY knowledge-base/ ./knowledge-base/

# 复制配置
COPY constitutional/ ./constitutional/
COPY config/ ./config/

EXPOSE 8080

CMD ["deepseek", "serve", "--http"]
EOF
```

### 步骤6.2：创建docker-compose.yml

```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # 云熙知识产权智能体主服务
  yunpat-agent:
    build: .
    container_name: yunpat-agent
    ports:
      - "8080:8080"
    environment:
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/patent_db
    volumes:
      - ./knowledge-base:/app/knowledge-base:ro
      - ./constitutional:/app/constitutional:ro
    depends_on:
      - postgres
      - redis
    networks:
      - yunpat-network

  # PostgreSQL数据库
  postgres:
    image: postgres:16-alpine
    container_name: yunpat-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: patent_db
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    networks:
      - yunpat-network

  # Redis缓存
  redis:
    image: redis:7-alpine
    container_name: yunpat-redis
    ports:
      - "6379:6379"
    networks:
      - yunpat-network

  # 监控：Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: yunpat-prometheus
    volumes:
      - ./docker/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    ports:
      - "9090:9090"
    networks:
      - yunpat-network

  # 监控：Grafana
  grafana:
    image: grafana/grafana:latest
    container_name: yunpat-grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    ports:
      - "3001:3000"
    networks:
      - yunpat-network

volumes:
  postgres-data:

networks:
  yunpat-network:
    driver: bridge
EOF
```

### 步骤6.3：提交Docker配置

```bash
git add Dockerfile docker-compose.yml
git commit -m "🐳 chore: 添加Docker配置

- 多阶段构建Dockerfile（Rust + TypeScript）
- docker-compose.yml包含完整服务栈
- 集成PostgreSQL、Redis、Prometheus、Grafana"

git push origin main
```

---

## 7. 验证完整构建

### 步骤7.1：本地构建测试

```bash
cd /Users/xujian/projects/yunpat-agent

# 1. 构建Rust
make build-rust

# 2. 构建TypeScript
make build-ts

# 3. 运行测试
make test
```

### 步骤7.2：Docker构建测试

```bash
# 构建Docker镜像
docker-compose build

# 启动服务
docker-compose up -d

# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs -f yunpat-agent

# 停止服务
docker-compose down
```

### 步骤7.3：验证GitHub CI

1. 推送代码到GitHub：
```bash
git push origin main
```

2. 打开GitHub仓库页面
3. 点击 **Actions** 标签
4. 查看CI流水线是否成功运行
5. 如果失败，点击失败的job查看日志并修复

---

## 8. 常见问题

### Q1: 推送时提示权限错误

**错误信息**：
```
remote: Permission to xujian519/yunpat-agent.git denied to xxx.
fatal: unable to access 'https://github.com/xujian519/yunpat-agent.git/': The requested URL returned error: 403
```

**解决方案**：
1. 检查是否使用Personal Access Token（不是GitHub密码）
2. 确认token有`repo`权限
3. 如果启用了2FA，必须使用token

### Q2: CI/CD流水线失败

**检查清单**：
- [ ] GitHub Secrets是否正确配置
- [ ] `.env`文件是否被`.gitignore`排除
- [ ] Rust版本是否>=1.88
- [ ] pnpm版本是否>=8

### Q3: Docker构建失败

**常见原因**：
- 网络问题（下载依赖超时）
- 磁盘空间不足
- 内存不足（Rust编译需要大量内存）

**解决方案**：
```bash
# 增加Docker内存限制（Docker Desktop设置）
# 清理Docker缓存
docker system prune -a

# 重新构建
docker-compose build --no-cache
```

### Q4: 知识库文件太大，GitHub拒绝推送

**解决方案**：
```bash
# 使用Git LFS管理大文件
git lfs install
git lfs track "knowledge-base/**/*.pdf"
git lfs track "knowledge-base/**/*.docx"
git add .gitattributes
git commit -m "📦 chore: 使用Git LFS管理大文件"
```

### Q5: 如何更新代码后重新部署

```bash
# 本地开发
git add .
git commit -m "feat: xxx"
git push origin main

# 服务器部署
git pull origin main
make build
docker-compose up -d --build
```

---

## 完成清单

完成以下步骤后，项目就完整配置好了：

- [ ] 1. 创建GitHub仓库
- [ ] 2. 推送代码到GitHub
- [ ] 3. 配置GitHub Secrets（DEEPSEEK_API_KEY等）
- [ ] 4. 初始化知识库
- [ ] 5. 配置开发环境（.env文件）
- [ ] 6. Docker配置（Dockerfile + docker-compose.yml）
- [ ] 7. 验证完整构建（make build通过）
- [ ] 8. 验证CI/CD（GitHub Actions通过）

---

**作者**: 徐健 <xujian519@gmail.com>  
**项目**: 云熙知识产权智能体 (YunPat Agent)
