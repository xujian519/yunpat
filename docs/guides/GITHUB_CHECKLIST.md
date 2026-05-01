# GitHub 仓库设置快速清单

## 第一步：创建 GitHub 仓库

- [ ] 访问 GitHub 并创建新仓库
- [ ] 仓库名称：`yunpat-agent-framework`
- [ ] 描述：`通用智能体框架 - 框架笨，智能体专`
- [ ] 选择可见性（Public/Private）
- [ ] ❌ 不要初始化 README

## 第二步：连接本地仓库

```bash
cd /Users/xujian/projects/YunPat
git remote add origin https://github.com/YOUR_USERNAME/yunpat-agent-framework.git
git push -u origin main
```

- [ ] 添加远程仓库
- [ ] 推送代码到 GitHub

## 第三步：配置 GitHub Secrets

访问：`Settings` → `Secrets and variables` → `Actions`

### 必需的 Secrets

- [ ] `NPM_TOKEN` - npm 发布令牌
  ```bash
  # 创建 npm token
  npm login
  # 或访问 https://www.npmjs.com/settings/your-name/tokens
  ```

- [ ] `DOCKER_USERNAME` - Docker Hub 用户名
- [ ] `DOCKER_PASSWORD` - Docker Hub 密码/令牌
  ```bash
  # 创建 Docker Hub access token
  # 访问 https://hub.docker.com/settings/security
  ```

- [ ] `CRATES_IO_TOKEN` - Rust crates.io 令牌
  ```bash
  # 创建 crates.io token
  cargo login
  ```

### 可选的 Secrets

- [ ] `CODECOV_TOKEN` - Codecov 覆盖率令牌
- [ ] `SLACK_WEBHOOK_URL` - Slack 通知 Webhook

## 第四步：配置 GitHub Pages（可选）

用于自动部署文档：

- [ ] 访问 `Settings` → `Pages`
- [ ] Source: 选择 `GitHub Actions`
- [ ] 或者选择 `Deploy from a branch`: `gh-pages` branch

## 第五步：配置分支保护

- [ ] 访问 `Settings` → `Branches`
- [ ] 添加规则 `main`
  - [ ] ✅ Require a pull request before merging
  - [ ] ✅ Require status checks to pass before merging
  - [ ] 选择必需的检查：`Quality`, `TypeScript 测试`, `Rust 工具测试`
  - [ ] ✅ Require branches to be up to date before merging

## 第六步：配置 GitHub Actions 权限

- [ ] 访问 `Settings` → `Actions` → `General`
- [ ] Workflow permissions:
  - [ ] ✅ Read and write permissions
- [ ] ✅ 确保 CI/CD 工作流使用 Node.js 24.x
  - [ ] CI (Simplified) 工作流
  - [ ] CI (Optimized) 工作流
  - [ ] Release 工作流
  - [ ] Automation 工作流

**注意**: 项目已优化 CI/CD 配置，使用 Node.js 24.x 并解决了 canvas 依赖安装问题。

## 第七步：设置 CI 监控（推荐）

- [ ] 克隆仓库后，验证 CI 监控脚本可用
  ```bash
  ./scripts/ci-monitor.sh
  ```
- [ ] 检查 CI 成功率是否 ≥95%
- [ ] 验证构建时间是否 ≤90秒

**监控工具**:
- `./scripts/ci-monitor.sh` - 实时监控 CI 性能
- `./scripts/ci-performance-report.sh` - 生成性能报告
- 查看 [CI 监控指南](../../../CI_MONITORING_GUIDE.md)

## 第八步：测试 CI/CD 工作流

- [ ] 创建一个测试分支
  ```bash
  git checkout -b test-ci
  echo "test" > test.txt
  git add test.txt
  git commit -m "test: CI 测试"
  git push origin test-ci
  ```

- [ ] 在 GitHub 上创建 Pull Request
- [ ] 检查 Actions 标签页，确认工作流运行
- [ ] 等待所有检查通过

## 第八步：首次发布

```bash
# 确保在 main 分支
git checkout main

# 更新版本号（如需要）
# 编辑 package.json

# 创建发布标签
git tag v0.1.0

# 推送标签
git push origin main --tags
```

- [ ] 更新版本号
- [ ] 创建 Git 标签
- [ ] 推送标签到远程
- [ ] 验证 Release 工作流运行
- [ ] 检查发布的包和镜像

## 第九步：配置通知（可选）

- [ ] 访问 `Settings` → `Notifications`
- [ ] 配置邮件通知
- [ ] 配置 Slack/Teams 集成
- [ ] 设置通知频率

## 第十步：团队协作设置（可选）

如果团队协作：

- [ ] 邀请协作者（Settings → Collaborators）
- [ ] 设置团队权限
- [ ] 配置代码审查规则
- [ ] 设置分支权限

## 验证清单

### 本地验证

```bash
# 运行所有测试
pnpm install
pnpm build
pnpm test
pnpm lint

# Rust 测试
cd packages/rust-tools
cargo test
cargo build --release

# Docker 构建
docker build -f docker/python-tools/Dockerfile -t test .
```

- [ ] 所有本地测试通过
- [ ] Docker 构建成功

### GitHub 验证

- [ ] Actions 工作流运行成功
- [ ] 所有 CI 检查通过
- [ ] Release 发布成功
- [ ] 包管理器中有新版本
- [ ] Docker Hub 有新镜像

## 故障排查

如果遇到问题：

1. **检查 Actions 日志**
   - 访问仓库的 `Actions` 标签页
   - 点击失败的工作流查看详细日志

2. **检查 Secrets**
   - 确认所有 Secrets 都已正确配置
   - 重新生成过期的令牌

3. **检查权限**
   - 确认 GitHub Actions 有写权限
   - 检查仓库设置

4. **本地测试**
   - 在本地运行相同的命令
   - 使用 `act` 测试 GitHub Actions

5. **常见 CI 问题及解决方案**

   **问题 1: Canvas 依赖安装失败**
   ```
   错误: canvas@2.11.2 原生模块编译失败
   原因: 缺少 pixman-1 系统库
   ```
   **解决方案**: ✅ 已在 CI 配置中修复
   - 设置 `CANVAS_USE_NATIVE: '0'` 环境变量
   - 设置 `PUPPETEET_SKIP_DOWNLOAD: 'true'` 跳过可选依赖
   - 详见 [CI 失败调查报告](../../../CI_FAILURE_INVESTIGATION.md)

   **问题 2: Node.js 版本不兼容**
   ```
   警告: Node.js 20 actions are deprecated
   ```
   **解决方案**: ✅ 已升级到 Node.js 24
   - 所有 CI 工作流已使用 `NODE_VERSION: '24.x'`
   - 如仍有警告，设置 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`

   **问题 3: CI 成功率低**
   ```
   现象: 成功率 < 90%
   ```
   **解决方案**:
   - 运行 `./scripts/ci-monitor.sh` 查看详细统计
   - 检查失败原因，参考 [CI 优化方案](../../../CI_OPTIMIZATION_PLAN.md)
   - 当前项目成功率: 90% → 目标 ≥95%

6. **性能监控**
   ```bash
   # 实时监控 CI 性能
   ./scripts/ci-monitor.sh

   # 生成性能报告
   ./scripts/ci-performance-report.sh

   # 查看最近运行
   gh run list --limit 10

   # 查看失败运行
   gh run list --status=failure
   ```

## 下一步

设置完成后，你可以：

1. 🎉 开始正常的开发流程
2. 📝 查看完整的 [GitHub 设置指南](GITHUB_SETUP.md)
3. 🚀 创建第一个 Pull Request
4. 📦 发布第一个版本
5. 📊 **持续监控 CI 性能**
   ```bash
   # 每天至少运行一次
   ./scripts/ci-monitor.sh

   # 每周生成性能报告
   ./scripts/ci-performance-report.sh
   ```

## CI/CD 监控和维护

### 日常监控（推荐）

```bash
# 快速检查 CI 状态
gh run list --limit 5

# 查看最新运行详情
gh run view

# 实时监控
./scripts/ci-monitor.sh
```

### 性能基准

| 指标 | 目标值 | 当前状态 |
|------|--------|----------|
| **成功率** | ≥95% | 90% ✅ |
| **构建时间** | ≤90秒 | 1m20s-1m54s ✅ |
| **稳定性** | 稳定 | 稳定 ✅ |

### 相关文档

- [CI 监控指南](../../../CI_MONITORING_GUIDE.md) - 完整的 CI 监控指南
- [CI 失败调查报告](../../../CI_FAILURE_INVESTIGATION.md) - 常见问题解决方案
- [CI 优化方案](../../../CI_OPTIMIZATION_PLAN.md) - 性能优化方案
- [CI 优化结果](../../../CI_OPTIMIZATION_RESULTS.md) - 优化成果总结

## 需要帮助？

- 📖 [GitHub Actions 文档](https://docs.github.com/en/actions)
- 💬 在 Issues 中提问
- 📧 联系维护者：xujian519@gmail.com

---

**祝你设置顺利！** 🎉