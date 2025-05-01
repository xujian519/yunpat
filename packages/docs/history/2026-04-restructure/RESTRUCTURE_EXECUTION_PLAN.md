# YunPat 项目架构重构计划

**执行时间**: 立即执行
**预计时间**: 2-3 小时

---

## 📋 重构步骤

### 第 1 步：创建新目录结构（5 分钟）

```bash
# 创建新的 monorepo 结构
mkdir -p apps services infrastructure

# 创建应用层
mkdir -p apps/{patent-writer,office-action,patent-analyzer,patent-manager,client-portal}

# 创建服务层
mkdir -p services/{patent-lifecycle,workflow-engine,knowledge-base,document-service,user-service}

# 创建 AI 能力层
mkdir -p ai/{agents,retrieval,generation,knowledge,core}

# 创建基础设施层
mkdir -p infrastructure/{api,database,queue,cache,monitoring}

# 创建文档和测试
mkdir -p docs/{architecture,api,user-guides,business}
mkdir -p tests/{unit,integration,e2e,performance}
```

### 第 2 步：迁移现有代码（1 小时）

#### 2.1 迁移核心框架

```bash
# 将 packages/core 迁移到 ai/core
mv packages/core ai/core

# 将 packages/agents 迁移到 ai/agents
mv packages/agents/writer ai/agents/writer
mv packages/agents/researcher ai/agents/researcher
```

#### 2.2 创建专利专用智能体

```bash
# 创建专利撰写智能体
mkdir -p ai/agents/writer
# 继承自通用 WriterAgent，添加专利专业能力

# 创建审查答复智能体
mkdir -p ai/agents/responder
# 新建专用智能体
```

#### 2.3 迁移配置文件

```bash
# 更新 package.json
# 调整 monorepo 配置
```

### 第 3 步：创建新应用（1 小时）

#### 3.1 专利撰写应用

```bash
# 初始化项目
cd apps/patent-writer
pnpm init
```

**package.json**:

```json
{
  "name": "@yunpat/patent-writer",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc",
    "preview": "vite preview"
  },
  "dependencies": {
    "@yunpat/ai-core": "workspace:*",
    "@yunpat/patent-lifecycle": "workspace:*"
  }
}
```

#### 3.2 客户门户

```bash
cd apps/client-portal
pnpm create vite@latest
```

### 第 4 步：更新文档（30 分钟）

#### 4.1 创建业务文档

```bash
# 专利代理人指南
mkdir -p docs/business/patent-writers
echo "# 专利代理人使用指南" > README.md

# 专利工程师指南
mkdir -p docs/business/patent-engineers
echo "# 专利工程师使用指南" > README.md

# IP 管理指南
mkdir -p docs/business/ip-managers
echo "# IP 管理人员使用指南" > README.md
```

### 第 5 步：更新 CI/CD（30 分钟）

#### 5.1 更新构建配置

```yaml
# .github/workflows/build.yml
name: Build

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
```

---

## ✅ 验证清单

### 结构验证

- [ ] 新目录结构创建完成
- [ ] 现有代码迁移完成
- [ ] 新应用初始化完成
- [ ] 文档更新完成

### 功能验证

- [ ] 构建成功
- [ ] 测试通过
- [ ] 应用可启动

---

## 🎯 预期成果

### 新项目结构

```
yunpat/
├── apps/                    # 5 个应用
├── services/                # 5 个服务
├── ai/                      # AI 能力层
├── infrastructure/          # 基础设施
└── docs/                    # 完整文档
```

### 核心应用

1. **Patent Writer** - 专利撰写（核心）
2. **Office Action** - 审查答复
3. **Patent Analyzer** - 专利分析
4. **Patent Manager** - 专利管理
5. **Client Portal** - 客户门户

---

## 🚀 立即执行

### 第 1 步：创建目录结构

```bash
# 执行目录创建
mkdir -p apps services infrastructure
mkdir -p apps/{patent-writer,office-action,patent-analyzer,patent-manager,client-portal}
mkdir -p services/{patent-lifecycle,workflow-engine,knowledge-base}
mkdir -p ai/{agents,retrieval,generation,knowledge,core}
mkdir -p infrastructure/{api,database,queue,cache,monitoring}
```

### 第 2 步：开始代码迁移

```bash
# 准备迁移
echo "🚀 开始项目重构..."
```

---

**状态**: 📝 计划完成，准备执行
**建议**: 立即开始重构
