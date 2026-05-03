# 本地 CI/CD 配置指南

> **目标**: 在本地构建完整的 CI/CD 检查和部署流程，GitHub 仅作为远程仓库使用

## 📋 目录

- [概述](#概述)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
- [详细配置](#详细配置)
- [工作流程](#工作流程)
- [故障排查](#故障排查)
- [最佳实践](#最佳实践)

---

## 概述

### 核心理念

- **本地优先**: 所有 CI 检查在本地执行，快速反馈
- **Git Hooks 驱动**: 自动触发检查，无需手动运行
- **增量检查**: 只检查变更的文件，提升速度
- **灵活部署**: 支持多环境部署和回滚

### 技术栈

- **Husky**: Git Hooks 管理
- **lint-staged**: 增量文件检查
- **本地脚本**: CI 检查和部署
- **GitHub**: 远程仓库（仅用于代码托管）

---

## 架构设计

### 工作流程图

```
开发者
  │
  ├─→ git commit
  │   └─→ Pre-commit Hooks
  │       ├─→ Prettier 格式检查
  │       ├─→ ESLint 代码质量
  │       └─→ TypeScript 类型检查（增量）
  │
  ├─→ git push
  │   └─→ Pre-push Hooks
  │       ├─→ 运行所有测试
  │       ├─→ 完整构建
  │       └─→ 安全检查
  │
  └─→ 手动触发
      ├─→ pnpm ci              # 快速 CI 检查
      ├─→ pnpm ci:full         # 完整 CI 检查
      ├─→ pnpm deploy          # 部署到开发环境
      ├─→ pnpm deploy:staging  # 部署到预发布环境
      └─→ pnpm deploy:prod     # 部署到生产环境
```

### 文件结构

```
.
├── .husky/
│   ├── pre-commit      # 提交前检查
│   ├── pre-push        # 推送前检查
│   └── commit-msg      # 提交信息格式检查
├── scripts/
│   ├── ci-local.sh     # 本地 CI 检查脚本
│   └── deploy-local.sh # 本地部署脚本
├── .lintstagedrc.json  # lint-staged 配置
└── package.json        # 项目配置
```

---

## 快速开始

### 1. 安装依赖

```bash
# Husky 和 lint-staged 已经在 package.json 中
pnpm install
```

### 2. 初始化 Git Hooks

```bash
# Husky 会在 install 时自动初始化
pnpm install
```

### 3. 测试 Git Hooks

```bash
# 创建一个测试文件
echo "export const test = 'hello'" > test.ts

# 尝试提交（会触发 pre-commit hook）
git add test.ts
git commit -m "test: 测试 hooks"
```

### 4. 运行本地 CI

```bash
# 快速 CI 检查
pnpm ci

# 完整 CI 检查
pnpm ci:full
```

---

## 详细配置

### Git Hooks 配置

#### Pre-commit Hook

```bash
# .husky/pre-commit
- 运行 lint-staged 检查变更文件
- 失败时阻止提交
```

**功能**:

- ✅ Prettier 格式检查
- ✅ ESLint 代码质量检查
- ✅ 自动修复可修复的问题

#### Pre-push Hook

```bash
# .husky/pre-push
- 运行完整 CI 检查
- 失败时阻止推送
```

**功能**:

- ✅ 运行所有测试
- ✅ 完整构建
- ✅ 安全检查

#### Commit-msg Hook

```bash
# .husky/commit-msg
- 检查提交信息格式
- 推荐使用 Conventional Commits
```

**支持的类型**:

- `feat` - 新功能
- `fix` - Bug 修复
- `docs` - 文档更新
- `style` - 代码格式
- `refactor` - 重构
- `test` - 测试相关
- `chore` - 构建/工具链
- `ci` - CI 配置
- `perf` - 性能优化

### lint-staged 配置

```json
{
  "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```

**说明**: 只检查暂存区的文件，大幅提升检查速度。

### 本地 CI 脚本

#### 快速模式

```bash
pnpm ci
# 或
bash scripts/ci-local.sh quick
```

**检查项**:

- ✅ 环境检查（Node.js, pnpm）
- ✅ 代码格式
- ✅ ESLint 检查
- ✅ 核心单元测试
- ✅ 快速构建

**耗时**: 约 2-3 分钟

#### 完整模式

```bash
pnpm ci:full
# 或
bash scripts/ci-local.sh full
```

**检查项**:

- ✅ 所有快速模式检查
- ✅ TypeScript 类型检查
- ✅ 完整单元测试
- ✅ 测试覆盖率
- ✅ 依赖安全审计
- ✅ 敏感文件检查

**耗时**: 约 5-8 分钟

---

## 工作流程

### 日常开发流程

```bash
# 1. 创建功能分支
git checkout -b feat/new-feature

# 2. 开发和提交
git add .
git commit -m "feat: 添加新功能"
# ↑ Pre-commit hooks 自动运行

# 3. 推送前检查
git push
# ↑ Pre-push hooks 自动运行完整 CI

# 4. 如果需要手动运行 CI
pnpm ci

# 5. 部署到开发环境
pnpm deploy
```

### 部署流程

#### 开发环境

```bash
# 部署
pnpm deploy

# 查看状态
pnpm deploy:status

# 回滚
pnpm deploy:rollback
```

#### 预发布环境

```bash
# 部署
pnpm deploy:staging

# 查看状态
pnpm deploy:status

# 回滚
pnpm deploy:rollback
```

#### 生产环境

```bash
# ⚠️ 生产部署需要特别小心

# 1. 运行完整 CI
pnpm ci:full

# 2. 确认 CI 通过

# 3. 部署
pnpm deploy:prod

# 4. 监控部署状态
pnpm deploy:status

# 5. 如果需要回滚
pnpm deploy:rollback
```

---

## 故障排查

### Git Hooks 不工作

**问题**: Git Hooks 没有被触发

**解决方案**:

```bash
# 1. 检查 Husky 是否安装
pnpm list husky

# 2. 重新初始化 Husky
pnpm exec husky init

# 3. 检查 hooks 权限
ls -la .husky/
# 确保 hooks 有执行权限

# 4. 手动设置权限
chmod +x .husky/*
```

### Pre-commit 检查失败

**问题**: Pre-commit 检查失败，无法提交

**解决方案**:

```bash
# 1. 查看详细错误
pnpm lint
pnpm type-check

# 2. 自动修复问题
pnpm lint:fix
pnpm format

# 3. 如果确实需要跳过（不推荐）
git commit --no-verify -m "message"
```

### Pre-push 检查失败

**问题**: Pre-push 检查失败，无法推送

**解决方案**:

```bash
# 1. 查看详细错误
pnpm ci:full

# 2. 修复问题后重新推送
git add .
git commit --amend
git push

# 3. 如果确实需要跳过（不推荐）
git push --no-verify
```

### CI 检查速度慢

**问题**: CI 检查耗时太长

**优化方案**:

```bash
# 1. 使用快速模式
pnpm ci  # 而不是 pnpm ci:full

# 2. 只检查变更的包
pnpm --filter @yunpat/core lint

# 3. 并行运行测试
pnpm test -- --threads

# 4. 跳过某些检查
# 修改 .husky/pre-push，注释掉不需要的检查
```

### 部署失败

**问题**: 部署过程中失败

**解决方案**:

```bash
# 1. 查看部署日志
cat .deploy-logs/deploy_*.log | tail -50

# 2. 回滚到上一版本
pnpm deploy:rollback

# 3. 检查构建产物
ls -la dist/

# 4. 手动运行构建
pnpm build

# 5. 查看备份
ls -lh .deploy-backup/
```

---

## 最佳实践

### 提交信息规范

使用 Conventional Commits 格式:

```bash
# 好的提交信息
git commit -m "feat(auth): 添加 OAuth 登录"
git commit -m "fix(api): 修复用户查询 bug"
git commit -m "docs: 更新 README"
git commit -m "refactor(core): 优化智能体调度逻辑"

# 不好的提交信息
git commit -m "update"
git commit -m "fix bug"
git commit -m "修改了代码"
```

### 分支策略

```bash
# 主分支
main        # 生产环境
develop     # 开发环境

# 功能分支
feat/*      # 新功能
fix/*       # Bug 修复
hotfix/*    # 紧急修复
release/*   # 发布准备
```

### 检查策略

```bash
# 开发阶段: 使用快速检查
pnpm ci

# PR 合并前: 使用完整检查
pnpm ci:full

# 部署前: 必须通过完整检查
pnpm ci:full && pnpm deploy:prod
```

### 安全实践

```bash
# 1. 定期运行安全审计
pnpm audit

# 2. 检查敏感文件
git ls-files | grep -E '\.(env|pem|key)$'

# 3. 使用 .gitignore 保护敏感文件
echo ".env" >> .gitignore
echo "*.key" >> .gitignore
```

---

## 高级配置

### 自定义 Git Hooks

```bash
# 创建自定义 hook
cat > .husky/post-commit << 'EOF'
#!/bin/bash
echo "✅ 提交成功"
# 在这里添加自定义逻辑
EOF

chmod +x .husky/post-commit
```

### 集成其他工具

```bash
# 添加到 pre-commit
cat >> .husky/pre-commit << 'EOF'

# 自定义检查
if [ -f "scripts/custom-check.sh" ]; then
  bash scripts/custom-check.sh
fi
EOF
```

### 环境变量配置

```bash
# 创建 .env.local
echo "CI_MODE=local" >> .env.local
echo "DEPLOY_ENV=development" >> .env.local

# 在脚本中使用
# source .env.local
```

---

## GitHub 集成（可选）

如果你仍想在 GitHub 上保留一些基本功能：

### 禁用大部分 GitHub Actions

```yaml
# .github/workflows/ci-minimal.yml
name: CI (Minimal - Backup Only)

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  backup:
    name: 代码备份
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: 备份完成
        run: echo "✅ 代码已备份到 GitHub"
```

### 仅用于 Issues 和 PR

GitHub 主要用于:

- 📋 Issues 跟踪
- 🔍 PR 代码审查
- 💬 讨论和协作
- 📦 远程备份

---

## 总结

### 优势

✅ **快速反馈**: 本地检查，立即获得结果
✅ **节省成本**: 无需 GitHub Actions 配额
✅ **灵活部署**: 完全控制部署流程
✅ **隐私保护**: 代码不离开本地环境
✅ **离线工作**: 无需网络连接

### 注意事项

⚠️ **团队协作**: 确保所有开发者配置相同
⚠️ **备份策略**: 定期推送到 GitHub 备份
⚠️ **监控**: 需要自己实现 CI 状态监控
⚠️ **一致性**: 本地环境可能存在差异

### 下一步

1. **配置完成**: 按照"快速开始"配置环境
2. **测试流程**: 尝试完整的开发和部署流程
3. **团队推广**: 分享给团队成员，统一配置
4. **持续优化**: 根据项目需求调整配置

---

## 附录

### 常用命令速查

```bash
# CI 检查
pnpm ci              # 快速检查
pnpm ci:full         # 完整检查

# 代码质量
pnpm lint            # ESLint 检查
pnpm lint:fix        # 自动修复
pnpm format          # 格式化
pnpm type-check      # 类型检查

# 测试
pnpm test            # 所有测试
pnpm test:unit       # 单元测试
pnpm test:coverage   # 覆盖率

# 部署
pnpm deploy          # 开发环境
pnpm deploy:staging  # 预发布环境
pnpm deploy:prod     # 生产环境
pnpm deploy:rollback # 回滚

# Git Hooks
git commit --no-verify   # 跳过 pre-commit
git push --no-verify     # 跳过 pre-push
```

### 相关文件

- `.husky/` - Git Hooks 配置
- `.lintstagedrc.json` - lint-staged 配置
- `scripts/ci-local.sh` - 本地 CI 脚本
- `scripts/deploy-local.sh` - 本地部署脚本
- `package.json` - 项目配置

---

**文档版本**: v1.0.0
**更新日期**: 2026-05-03
**维护者**: Xu Jian <xujian519@gmail.com>
