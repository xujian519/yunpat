# CI/CD 最佳实践 - 基于 Karpathy 思路

> **核心理念**: 简洁、本地优先、目标驱动

---

## 🎯 核心原则

### 1. 简洁优先

**问题**: 大多数 CI/CD 系统都过度复杂

**解决方案**:

```yaml
# ❌ 过度复杂
- 多阶段流水线
- 复杂的依赖关系
- 不必要的并行执行
- 过度的检查和验证

# ✅ 简洁有效
- 本地做所有检查
- 远程仅做备份
- 配置简单明了
```

### 2. 本地优先

**问题**: 依赖远程 CI 导致反馈慢、成本高

**解决方案**:

```bash
# ❌ 依赖远程
git push → 等待 5-10 分钟 → 发现错误 → 修复 → 重复

# ✅ 本地验证
pnpm ci → 秒级反馈 → 修复 → 推送 → 一次成功
```

### 3. 目标驱动

**问题**: 为了工具而使用工具

**解决方案**:

```yaml
# 明确目标
目标: 本地 CI/CD + GitHub 远程备份

# 成功标准
✅ 本地检查快速反馈
✅ GitHub 仅做备份
✅ 配置简单可维护
```

---

## 📋 工作流程

### 日常开发

```bash
# 1. 开发
echo "代码" > file.ts

# 2. 提交（自动检查）
git add .
git commit -m "feat: 新功能"
# → Pre-commit Hooks 自动运行
# → Prettier + ESLint + TypeScript

# 3. 推送（自动完整 CI）
git push
# → Pre-push Hooks 运行完整 CI
# → 本地部署
# → GitHub 备份
```

### 手动检查

```bash
# 快速检查（开发阶段）
pnpm ci

# 完整检查（部署前）
pnpm ci:full

# 部署
pnpm deploy
```

---

## 🛠️ 工具选择

### 为什么不引入新工具？

| 工具          | 复杂度 | 学习成本 | 维护成本 | 是否引入 |
| ------------- | ------ | -------- | -------- | -------- |
| Woodpecker CI | 高     | 高       | 中       | ❌       |
| Drone CI      | 中     | 中       | 中       | ❌       |
| Jenkins       | 高     | 高       | 高       | ❌       |
| **现有方案**  | 低     | 无       | 低       | ✅       |

### 现有方案优势

```
Husky + lint-staged + 本地脚本 = 完美组合
```

**优势**:

- ✅ 已配置完成
- ✅ 团队已熟悉
- ✅ 无学习成本
- ✅ 易于维护

---

## 📝 配置示例

### .github/workflows/backup-only.yml

```yaml
name: Backup Only

on:
  push:
    branches: [main, develop]

jobs:
  backup:
    name: 代码备份到 GitHub
    runs-on: ubuntu-latest
    timeout-minutes: 2

    steps:
      - name: 📥 检出代码
        uses: actions/checkout@v4

      - name: ✅ 备份完成
        run: |
          echo "✅ 代码已备份到 GitHub"
          echo "📦 提交: ${{ github.sha }}"
          echo "🌿 分支: ${{ github.ref_name }}"
```

### 本地 CI 脚本

```bash
#!/bin/bash
# scripts/ci-local.sh

# 快速模式（2-3 分钟）
pnpm lint
pnpm test:unit
pnpm build

# 完整模式（5-8 分钟）
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

---

## 🎓 最佳实践

### 1. 提交信息规范

```bash
# ✅ 好的提交信息
git commit -m "feat(auth): 添加 OAuth 登录"
git commit -m "fix(api): 修复用户查询 bug"
git commit -m "docs: 更新 README"

# ❌ 不好的提交信息
git commit -m "update"
git commit -m "fix bug"
git commit -m "修改了代码"
```

### 2. 分支策略

```bash
# 功能开发
git checkout -b feat/new-feature

# Bug 修复
git checkout -b fix/critical-bug

# 紧急修复
git checkout -b hotfix/security-patch
```

### 3. 检查策略

```bash
# 开发阶段：快速检查
pnpm ci

# PR 前检查：完整检查
pnpm ci:full

# 部署前检查：必须通过
pnpm ci:full && pnpm deploy:prod
```

---

## 🐛 故障排查

### Git Hooks 不工作

```bash
# 1. 检查 Husky 安装
pnpm list husky

# 2. 重新初始化
pnpm exec husky init

# 3. 检查权限
chmod +x .husky/*
```

### 检查失败

```bash
# 1. 查看详细错误
pnpm lint

# 2. 自动修复
pnpm lint:fix
pnpm format

# 3. 跳过检查（不推荐）
git commit --no-verify
```

### 推送失败

```bash
# 1. 运行完整 CI
pnpm ci:full

# 2. 修复问题

# 3. 重新推送
git add .
git commit --amend
git push
```

---

## 📊 性能优化

### 增量检查

```json
// .lintstagedrc.json
{
  "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"]
}
```

### 并行测试

```bash
# 并行运行测试
pnpm test -- --threads

# 分片运行测试
pnpm test -- --shard=1/4
```

### 缓存优化

```bash
# 使用 pnpm 离线缓存
pnpm install --prefer-offline

# 使用 TypeScript 增量编译
pnpm build:tsc --incremental
```

---

## 🔒 安全实践

### 1. 敏感信息检查

```bash
# 检查敏感文件
git ls-files | grep -E '\.(env|pem|key)$'

# 使用 .gitignore
echo "*.env" >> .gitignore
echo "*.key" >> .gitignore
```

### 2. 依赖审计

```bash
# 定期运行审计
pnpm audit

# 修复漏洞
pnpm audit --fix
```

### 3. 提交前验证

```bash
# .husky/pre-commit
# 检查是否有大文件
git diff --cached --name-only | xargs ls -lh | awk '$5 > "1M" {print $9}'
```

---

## 📈 监控和报告

### 本地 CI 状态

```bash
# 查看 CI 日志
cat .deploy-logs/deploy_*.log | tail -50

# 查看构建状态
ls -la dist/

# 查看测试覆盖率
pnpm test:coverage
```

### GitHub Actions 状态

```bash
# 查看运行状态
gh run list

# 查看详细日志
gh run view

# 重新运行
gh run rerun
```

---

## 🎓 学习资源

### 官方文档

- [Husky 文档](https://typicode.github.io/husky/)
- [lint-staged 文档](https://github.com/okonet/lint-staged)
- [GitHub Actions 文档](https://docs.github.com/en/actions)

### 社区资源

**Sources:**

- [50 Best CI/CD Tools for 2025](https://dev.to/dev_tips/50-best-cicd-tools-for-2025-the-ultimate-guide-to-automating-your-devops-pipeline-eh1)
- [智能交付时代：2025 十大CI/CD 工具对比](https://juejin.cn/post/7570984341415346191)
- [持续集成流水线搭建：Jenkins vs GitLab CI vs GitHub Actions选型对比](https://www.cloudnative-tech.com/p/7176/)
- [Woodpecker CI 轻量级持续集成系统深度解析](https://www.cnblogs.com/gccbuaa/p/19264520)

### Karpathy 原则

- [Andrej Karpathy's Tweet](https://x.com/karpathy/status/2015883857489522876)

---

## ✅ 检查清单

### 日常开发

- [ ] 提交前运行 `pnpm lint`
- [ ] 提交前运行 `pnpm format`
- [ ] 提交信息使用 Conventional Commits 格式
- [ ] 推送前运行 `pnpm ci`

### 部署前

- [ ] 运行 `pnpm ci:full`
- [ ] 所有测试通过
- [ ] 构建成功
- [ ] 安全检查通过

### 团队协作

- [ ] 所有成员配置 Husky
- [ ] 所有成员使用相同的 lint 规则
- [ ] 所有成员遵循提交信息规范
- [ ] 定期同步配置

---

## 🎉 总结

### 核心要点

1. **简洁优先** - 不引入不必要的工具
2. **本地优先** - 所有检查在本地执行
3. **目标驱动** - 明确成功标准
4. **持续改进** - 根据实际需求优化

### 最终方案

```
本地 CI/CD + GitHub 备份 = 完美方案
```

### 为什么有效？

- ✅ **简单** - 易于理解和维护
- ✅ **快速** - 秒级反馈
- ✅ **免费** - 无额外成本
- ✅ **可靠** - 不依赖网络
- ✅ **可扩展** - 可根据需求调整

---

**文档版本**: v1.0.0
**更新日期**: 2026-05-03
**维护者**: Xu Jian <xujian519@gmail.com>
