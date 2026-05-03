# 团队配置检查清单

> **目标**: 确保所有团队成员正确配置本地 CI/CD 环境

---

## 📋 新成员入职检查清单

### 步骤 1：环境准备

- [ ] **Node.js 版本检查**

  ```bash
  node --version  # 应该是 v18+ 或 v20+
  ```

- [ ] **pnpm 安装**

  ```bash
  pnpm --version  # 应该是 v8+ 或 v9+
  ```

- [ ] **Git 配置**
  ```bash
  git --version
  git config user.name
  git config user.email
  ```

### 步骤 2：项目设置

- [ ] **克隆项目**

  ```bash
  git clone <repository-url>
  cd YunPat
  ```

- [ ] **安装依赖**

  ```bash
  pnpm install
  ```

  **注意**: 这一步会自动配置 Husky Git Hooks

- [ ] **验证 Husky 安装**

  ```bash
  pnpm list husky
  ```

  **预期输出**: `husky 9.x.x`

- [ ] **验证 lint-staged 安装**
  ```bash
  pnpm list lint-staged
  ```
  **预期输出**: `lint-staged 16.x.x`

### 步骤 3：验证配置

- [ ] **检查 Git Hooks**

  ```bash
  ls -la .husky/
  ```

  **预期输出**:

  ```
  pre-commit
  pre-push
  commit-msg
  ```

- [ ] **检查配置文件**

  ```bash
  cat .lintstagedrc.json
  cat .husky/pre-commit
  ```

- [ ] **运行快速 CI**
  ```bash
  pnpm ci
  ```
  **预期结果**: 所有检查通过

### 步骤 4：测试 Hooks

- [ ] **创建测试文件**

  ```bash
  echo "export const test = 'hello';" > test.ts
  ```

- [ ] **测试 Pre-commit Hook**

  ```bash
  git add test.ts
  git commit -m "test: 测试 hooks"
  ```

  **预期结果**:
  - ✅ 自动运行 Prettier
  - ✅ 自动运行 ESLint
  - ✅ 自动修复问题
  - ✅ 提交成功

- [ ] **验证自动修复**

  ```bash
  cat test.ts
  ```

  **预期输出**: `export const test = 'hello'`（分号被移除）

- [ ] **清理测试文件**
  ```bash
  git reset --hard HEAD~1
  rm test.ts
  ```

### 步骤 5：学习文档

- [ ] **阅读快速参考**（2 分钟）
  - [LOCAL_CI_QUICK_REF.md](LOCAL_CI_QUICK_REF.md)

- [ ] **阅读完整指南**（15 分钟）
  - [LOCAL_CI_GUIDE.md](LOCAL_CI_GUIDE.md)

- [ ] **阅读最佳实践**（10 分钟）
  - [CI_CD_BEST_PRACTICES.md](CI_CD_BEST_PRACTICES.md)

- [ ] **阅读团队推广指南**（10 分钟）
  - [TEAM_ONBOARDING.md](TEAM_ONBOARDING.md)

---

## 🔧 日常开发检查清单

### 提交前

- [ ] **运行代码检查**

  ```bash
  pnpm lint
  ```

- [ ] **运行格式化**

  ```bash
  pnpm format
  ```

- [ ] **检查提交信息格式**
  ```bash
  # 推荐格式
  feat: 新功能
  fix(api): 修复 bug
  docs: 更新文档
  ```

### 推送前

- [ ] **运行快速 CI**

  ```bash
  pnpm ci
  ```

- [ ] **运行测试**

  ```bash
  pnpm test
  ```

- [ ] **检查构建**
  ```bash
  pnpm build
  ```

### PR 前检查

- [ ] **运行完整 CI**

  ```bash
  pnpm ci:full
  ```

- [ ] **所有测试通过**

  ```bash
  pnpm test:coverage
  ```

- [ ] **代码格式正确**

  ```bash
  pnpm format:check
  ```

- [ ] **文档已更新**
  - README.md
  - CHANGELOG.md
  - 相关注释

---

## 🐛 故障排查检查清单

### Git Hooks 不工作

- [ ] **检查 Husky 安装**

  ```bash
  pnpm list husky
  ```

- [ ] **重新初始化 Husky**

  ```bash
  pnpm exec husky init
  ```

- [ ] **检查文件权限**

  ```bash
  chmod +x .husky/*
  ```

- [ ] **验证 Hooks 可执行**
  ```bash
  ls -la .husky/
  ```
  **预期**: 所有文件有 `x` 权限

### 检查失败

- [ ] **查看详细错误**

  ```bash
  pnpm lint
  pnpm type-check
  ```

- [ ] **自动修复问题**

  ```bash
  pnpm lint:fix
  pnpm format
  ```

- [ ] **查看测试失败**

  ```bash
  pnpm test
  ```

- [ ] **查看构建错误**
  ```bash
  pnpm build
  ```

### 跳过检查（紧急情况）

- [ ] **跳过 Pre-commit**

  ```bash
  git commit --no-verify -m "message"
  ```

- [ ] **跳过 Pre-push**
  ```bash
  git push --no-verify
  ```

**注意**: 仅在紧急情况下使用

---

## 📊 团队配置验证

### 定期检查（每周）

- [ ] **所有成员运行 CI**

  ```bash
  pnpm ci
  ```

- [ ] **检查配置同步**

  ```bash
  git pull
  pnpm install
  ```

- [ ] **更新依赖**
  ```bash
  pnpm update
  ```

### 新版本发布时

- [ ] **更新文档**
  - [LOCAL_CI_GUIDE.md](LOCAL_CI_GUIDE.md)
  - [TEAM_ONBOARDING.md](TEAM_ONBOARDING.md)

- [ ] **测试新配置**

  ```bash
  pnpm ci:full
  ```

- [ ] **通知团队**
  - 发送更新说明
  - 提供迁移指南

---

## ✅ 完成标准

### 个人配置完成

**完成所有检查项后，你应该能够**：

- ✅ 运行 `pnpm ci` 无错误
- ✅ 提交代码时自动触发检查
- ✅ 自动修复格式问题
- ✅ 使用正确的提交信息格式

### 团队配置完成

**所有成员配置完成后，团队应该**：

- ✅ 代码风格统一
- ✅ CI 失败率 < 5%
- ✅ PR 一次通过率 > 90%
- ✅ 部署成功率 > 95%

---

## 📞 获取帮助

**配置问题？**

1. 查看 [LOCAL_CI_GUIDE.md](LOCAL_CI_GUIDE.md)
2. 查看 [CI_CD_BEST_PRACTICES.md](CI_CD_BEST_PRACTICES.md)
3. 联系团队维护者

**文档问题？**

- 报告文档错误
- 提出改进建议
- 分享使用经验

---

**检查清单版本**: v1.0.0
**更新日期**: 2026-05-03
**维护者**: Xu Jian <xujian519@gmail.com>
