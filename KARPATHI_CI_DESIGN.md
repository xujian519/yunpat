# 基于 Karpathy 思路的 CI/CD 设计

> **核心理念**: 简洁优先，不过度设计，只做必要的事情

---

## 🧠 设计思路

### 按照 Karpathy 四大原则

#### 1. 编码前思考

**明确问题：**

- ✅ 你已经有了完整的本地 CI/CD
- ✅ 你需要 GitHub 只作为远程仓库
- ❓ 是否需要引入新工具？

**假设验证：**

| 假设                 | 验证结果          | 决策       |
| -------------------- | ----------------- | ---------- |
| 需要 Woodpecker CI?  | ❌ 本地脚本已够用 | 不引入     |
| 需要 GitHub Actions? | ⚠️ 仅用于备份     | 最小化配置 |
| 需要自托管 Runner?   | ❌ 本地已完善     | 不配置     |
| 需要复杂流水线?      | ❌ 违背简洁原则   | 拒绝       |

#### 2. 简洁优先

**最简单的架构：**

```
本地开发 → 本地检查 → 本地部署 → GitHub 备份
   ↓          ↓          ↓          ↓
 Husky    ci-local.sh  deploy.sh  backup-only.yml
```

**复杂度对比：**

| 方案                 | 组件数 | 配置文件 | 维护成本   |
| -------------------- | ------ | -------- | ---------- |
| **简洁方案（推荐）** | 4      | 4        | ⭐         |
| Woodpecker CI        | 10+    | 10+      | ⭐⭐⭐     |
| Jenkins              | 20+    | 20+      | ⭐⭐⭐⭐⭐ |

#### 3. 精准修改

**需要做的：**

- ✅ 保留现有本地 CI/CD
- ✅ 创建最小化 GitHub Actions
- ✅ 文档化最佳实践

**不需要做的：**

- ❌ 不引入新工具
- ❌ 不改变现有配置
- ❌ 不添加不必要的功能

#### 4. 目标驱动

**成功标准：**

1. ✅ 本地 CI/CD 完全工作
2. ✅ GitHub 仅作为远程仓库
3. ✅ 配置简单，易于维护

**验证方法：**

```bash
# 1. 本地检查工作
pnpm ci

# 2. Git Hooks 工作
git commit -m "test: 测试"

# 3. 推送到 GitHub
git push

# 4. GitHub Actions 备份
# 访问 GitHub Actions 页面确认
```

---

## 📁 最终架构

### 本地 CI/CD（已有）

```
.
├── .husky/
│   ├── pre-commit      # 提交前检查
│   ├── pre-push        # 推送前完整 CI
│   └── commit-msg      # 提交信息格式
├── scripts/
│   ├── ci-local.sh     # 本地 CI 脚本
│   └── deploy-local.sh # 本地部署脚本
└── .lintstagedrc.json  # 增量检查配置
```

### GitHub（最小化）

```
.
└── .github/workflows/
    └── backup-only.yml # 仅备份，不做检查
```

---

## 🎯 工作流程

### 日常开发

```bash
# 1. 开发
echo "代码" > file.ts

# 2. 提交（自动触发 pre-commit）
git add .
git commit -m "feat: 新功能"
# → Prettier 检查
# → ESLint 检查
# → 自动修复

# 3. 推送（自动触发 pre-push）
git push
# → 完整 CI 检查
# → 本地部署
# → GitHub 备份
```

### 部署流程

```bash
# 开发环境
pnpm deploy

# 生产环境
pnpm deploy:prod

# 回滚
pnpm deploy:rollback
```

---

## 📊 方案对比

### 为什么不引入 Woodpecker CI？

| 维度       | 简洁方案 | Woodpecker CI |
| ---------- | -------- | ------------- |
| 组件数     | 4        | 10+           |
| 配置复杂度 | ⭐       | ⭐⭐⭐        |
| 学习曲线   | 平缓     | 陡峭          |
| 维护成本   | 低       | 中-高         |
| 功能需求   | ✅ 满足  | ✅ 过度       |

### 为什么不用 GitHub Actions 做 CI？

| 维度     | 本地 CI | GitHub Actions CI |
| -------- | ------- | ----------------- |
| 反馈速度 | 秒级    | 分钟级            |
| 成本     | 免费    | 消耗配额          |
| 隐私     | 本地    | 云端              |
| 网络依赖 | 无      | 必须              |
| 调试难度 | 简单    | 复杂              |

---

## ✅ 最佳实践

### 1. 保持简洁

```yaml
# ❌ 不要这样做
- 复杂的多阶段流水线
- 不必要的并行任务
- 过度的检查和验证

# ✅ 应该这样做
- 本地做所有检查
- GitHub 仅做备份
- 配置简单明了
```

### 2. 本地优先

```bash
# ❌ 不要依赖远程 CI
git push && 等待 GitHub Actions

# ✅ 本地验证后再推送
pnpm ci && git push
```

### 3. 文档化

```markdown
# 每个配置文件都有说明

# 每个脚本都有注释

# 每个决策都有理由
```

---

## 🔧 故障排查

### 本地 CI 失败

```bash
# 查看 CI 日志
pnpm ci

# 修复问题
pnpm lint:fix
pnpm format
```

### Git Hooks 不工作

```bash
# 重新初始化
pnpm exec husky init

# 检查权限
chmod +x .husky/*
```

### GitHub Actions 失败

```bash
# 查看日志
gh run view

# 重新运行
gh run rerun
```

---

## 📚 参考资料

### 开源 CI/CD 工具对比

**Sources:**

- [50 Best CI/CD Tools for 2025](https://dev.to/dev_tips/50-best-cicd-tools-for-2025-the-ultimate-guide-to-automating-your-devops-pipeline-eh1)
- [6 Open Source CI/CD Tools in 2025 - Estuary](https://estuary.dev/blog/open-source-ci-cd-tools/)
- [智能交付时代：2025 十大CI/CD 工具对比](https://juejin.cn/post/7570984341415346191)
- [持续集成流水线搭建：Jenkins vs GitLab CI vs GitHub Actions选型对比](https://www.cloudnative-tech.com/p/7176/)
- [Woodpecker CI 轻量级持续集成系统深度解析](https://www.cnblogs.com/gccbuaa/p/19264520)

### Karpathy 原则

**Sources:**

- [Andrej Karpathy's Tweet](https://x.com/karpathy/status/2015883857489522876)
- [完整的 Karpathy 原则文档](~/.claude/CLAUDE_KARPATHY_INTEGRATION.md)

---

## 🎉 总结

### 核心原则

1. **简洁优先** - 不引入不必要的工具
2. **本地优先** - 所有检查在本地执行
3. **精准修改** - 只做必要的改动
4. **目标驱动** - 明确成功标准

### 最终方案

```
本地 CI/CD（已有）+ GitHub 备份（最小化）= 完美方案
```

### 为什么这个方案好？

- ✅ **简单** - 只有 4 个核心组件
- ✅ **快速** - 本地检查，秒级反馈
- ✅ **免费** - 无需额外成本
- ✅ **可靠** - 不依赖网络
- ✅ **可维护** - 配置简单明了

---

**设计时间**: 2026-05-03
**设计原则**: Karpathy 编程哲学
**维护者**: Xu Jian <xujian519@gmail.com>
