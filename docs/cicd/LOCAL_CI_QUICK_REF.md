# 本地 CI/CD 快速参考

> **一句话**: 在本地运行完整的 CI/CD 检查和部署，GitHub 只作为远程仓库

## 🚀 快速开始

### 1️⃣ 安装和配置

```bash
# 安装依赖（包含 Husky 和 lint-staged）
pnpm install

# ✅ Git Hooks 自动配置完成
```

### 2️⃣ 测试 Hooks

```bash
# 创建测试文件
echo "export const test = 'hello'" > test.ts

# 提交（会自动触发 pre-commit 检查）
git add test.ts
git commit -m "test: 测试 hooks"
```

### 3️⃣ 日常使用

```bash
# 开发和提交（自动检查）
git add .
git commit -m "feat: 新功能"

# 推送前（自动运行完整 CI）
git push

# 手动运行 CI
pnpm ci
```

---

## 📋 常用命令

### CI 检查

```bash
pnpm ci              # 快速 CI（2-3分钟）
pnpm ci:full         # 完整 CI（5-8分钟）
```

### 代码质量

```bash
pnpm lint            # 检查代码质量
pnpm lint:fix        # 自动修复问题
pnpm format          # 格式化代码
pnpm type-check      # TypeScript 类型检查
```

### 测试

```bash
pnpm test            # 运行所有测试
pnpm test:unit       # 单元测试
pnpm test:coverage   # 测试覆盖率
```

### 部署

```bash
pnpm deploy          # 部署到开发环境
pnpm deploy:staging  # 部署到预发布环境
pnpm deploy:prod     # 部署到生产环境
pnpm deploy:rollback # 回滚
pnpm deploy:status   # 查看状态
```

---

## 🔧 Git Hooks 说明

### Pre-commit（提交前）

**触发时机**: `git commit`

**检查项**:

- ✅ Prettier 格式检查
- ✅ ESLint 代码质量
- ✅ 自动修复可修复的问题

**失败处理**: 阻止提交

### Pre-push（推送前）

**触发时机**: `git push`

**检查项**:

- ✅ 运行所有测试
- ✅ 完整构建
- ✅ 安全检查

**失败处理**: 阻止推送

### Commit-msg（提交信息）

**触发时机**: `git commit`

**检查项**:

- ✅ 提交信息格式（Conventional Commits）

**失败处理**: 提示确认

---

## 📝 提交信息格式

推荐使用 Conventional Commits 格式:

```bash
feat: 新功能
fix: Bug 修复
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试相关
chore: 构建/工具链
ci: CI 配置
perf: 性能优化
```

**示例**:

```bash
git commit -m "feat(auth): 添加 OAuth 登录"
git commit -m "fix(api): 修复用户查询 bug"
git commit -m "docs: 更新 README"
```

---

## 🎯 工作流程

### 日常开发

```bash
# 1. 创建分支
git checkout -b feat/new-feature

# 2. 开发和提交（自动检查）
git add .
git commit -m "feat: 添加新功能"

# 3. 推送（自动 CI）
git push

# 4. 手动 CI（可选）
pnpm ci
```

### 部署流程

```bash
# 1. 运行完整 CI
pnpm ci:full

# 2. 确认通过

# 3. 部署
pnpm deploy      # 开发环境
pnpm deploy:prod # 生产环境

# 4. 监控状态
pnpm deploy:status
```

---

## 🐛 故障排查

### Hooks 不工作

```bash
# 重新初始化 Husky
pnpm exec husky init

# 检查权限
chmod +x .husky/*
```

### 检查失败

```bash
# 查看详细错误
pnpm lint
pnpm type-check

# 自动修复
pnpm lint:fix
pnpm format
```

### 跳过检查（不推荐）

```bash
# 跳过 pre-commit
git commit --no-verify

# 跳过 pre-push
git push --no-verify
```

---

## 📚 文档

- **完整指南**: [LOCAL_CI_GUIDE.md](./LOCAL_CI_GUIDE.md)
- **CI 脚本**: [scripts/ci-local.sh](./scripts/ci-local.sh)
- **部署脚本**: [scripts/deploy-local.sh](./scripts/deploy-local.sh)

---

## ✅ 优势

- ✅ **快速反馈**: 本地检查，立即获得结果
- ✅ **节省成本**: 无需 GitHub Actions 配额
- ✅ **灵活部署**: 完全控制部署流程
- ✅ **隐私保护**: 代码不离开本地环境
- ✅ **离线工作**: 无需网络连接

---

**版本**: v1.0.0
**更新**: 2026-05-03
