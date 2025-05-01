# GitHub 远程仓库设置和 CI/CD 完整指南

## 目录

1. [GitHub 仓库创建](#github-仓库创建)
2. [Secrets 配置](#secrets-配置)
3. [CI/CD 工作流说明](#cicd-工作流说明)
4. [发布流程](#发布流程)
5. [最佳实践](#最佳实践)

## GitHub 仓库创建

### 1. 在 GitHub 上创建新仓库

1. 访问 [GitHub](https://github.com) 并登录
2. 点击右上角的 "+" → "New repository"
3. 填写仓库信息：
   - **Repository name**: `yunpat-agent-framework`
   - **Description**: `通用智能体框架 - 框架笨，智能体专`
   - **Visibility**: 选择 Public 或 Private（根据项目需求）
   - **Initialize**: ❌ 不要勾选任何选项

### 2. 连接本地仓库到远程仓库

```bash
# 在项目根目录执行
cd /Users/xujian/projects/YunPat

# 添加远程仓库（替换 YOUR_USERNAME）
git remote add origin https://github.com/YOUR_USERNAME/yunpat-agent-framework.git

# 推送到远程仓库
git push -u origin main
```

## Secrets 配置

在 GitHub 仓库中配置以下 Secrets：

### 路径

`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

### 必需的 Secrets

#### 1. NPM Token（用于发布 npm 包）

```bash
# 在本地创建 npm token
npm login
# 或访问 https://www.npmjs.com/settings/your-name/tokens
```

**Secret 名称**: `NPM_TOKEN`
**值**: 你的 npm 访问令牌（自动化令牌）

#### 2. Docker Hub 凭证（用于发布 Docker 镜像）

```bash
# Docker Hub 用户名
docker login
```

**Secret 名称**: `DOCKER_USERNAME`
**值**: 你的 Docker Hub 用户名

**Secret 名称**: `DOCKER_PASSWORD`
**值**: 你的 Docker Hub 密码或访问令牌

#### 3. Rust Crates.io Token（用于发布 Rust crate）

```bash
# 在本地创建 crates.io token
cargo login
```

**Secret 名称**: `CRATES_IO_TOKEN`
**值**: 你的 crates.io 访问令牌

### 可选的 Secrets

#### 1. Codecov Token（用于上传覆盖率报告）

**Secret 名称**: `CODECOV_TOKEN`
**值**: 从 [Codecov](https://codecov.io) 获取的仓库令牌

#### 2. Slack Webhook（用于通知）

**Secret 名称**: `SLACK_WEBHOOK_URL`
**值**: Slack 传入 Webhook URL

## CI/CD 工作流说明

### 1. CI 工作流 ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))

**触发条件**：

- Push 到 `main` 或 `develop` 分支
- 创建 Pull Request 到 `main` 或 `develop` 分支
- 手动触发

**包含的 Job**：

#### 代码质量检查

- ESLint 代码规范检查
- TypeScript 类型检查
- Prettier 代码格式检查

#### TypeScript 测试

- 多 Node.js 版本测试（18.x, 20.x）
- 单元测试执行
- 覆盖率报告生成和上传

#### Rust 工具测试

- Rust 代码格式检查（`cargo fmt`）
- Rust 静态分析（`cargo clippy`）
- Rust 单元测试
- Rust 文档生成

#### Python 工具测试

- Python 单元测试
- 覆盖率报告

#### Docker 构建测试

- Docker 镜像构建
- 容器运行测试

#### 安全检查

- npm 审计（依赖漏洞检查）
- 安全漏洞扫描

#### 构建产物

- TypeScript 代码构建
- Rust 项目构建
- 构建产物打包和上传

### 2. Release 工作流 ([`.github/workflows/release.yml`](.github/workflows/release.yml))

**触发条件**：

- 推送以 `v` 开头的标签（如 `v0.2.0`）
- 手动触发

**包含的 Job**：

#### 创建 GitHub Release

- 自动生成 Changelog
- 创建 GitHub Release 页面

#### 发布到 npm

- 发布所有包到 npm registry
- 支持 @yunpat/\* scope

#### 发布 Docker 镜像

- 构建并推送 Docker 镜像到 Docker Hub
- 支持多标签版本管理

#### 发布 Rust Crate

- 发布 Rust crate 到 crates.io

#### 发布文档

- 生成 API 文档
- 部署到 GitHub Pages

### 3. Automation 工作流 ([`.github/workflows/automation.yml`](.github/workflows/automation.yml))

**触发条件**：

- 每周一上午 10 点（北京时间）自动运行
- 手动触发

**包含的 Job**：

#### 依赖安全检查

- 检查依赖中的安全漏洞
- 生成安全报告

#### 代码质量检查

- 检查过期依赖
- 运行代码检查

#### 清理旧的 Issue

- 自动标记 30 天无活动的 Issue
- 关闭 14 天后仍无响应的 Issue

#### 生成项目统计

- 代码行数统计
- 提交历史统计
- 项目规模分析

## 发布流程

### 1. 创建发布版本

```bash
# 确保在 main 分支
git checkout main

# 更新版本号
# 1. 修改根目录 package.json 的 version
# 2. 修改各个包的 package.json version
# 3. 更新 CHANGELOG.md

# 提交变更
git add .
git commit -m "chore: 发布 v0.2.0"

# 创建标签
git tag v0.2.0

# 推送标签到远程
git push origin main --tags
```

### 2. 自动发布流程

推送标签后，GitHub Actions 会自动：

1. ✅ 创建 GitHub Release
2. ✅ 发布到 npm
3. ✅ 构建和发布 Docker 镜像
4. ✅ 发布 Rust crate
5. ✅ 生成和发布文档

### 3. 验证发布

```bash
# 检查 npm 包
npm view @yunpat/core

# 检查 Docker 镜像
docker pull yunpat/python-tools:v0.2.0

# 检查 GitHub Release
# 访问 https://github.com/YOUR_USERNAME/yunpat-agent-framework/releases
```

## 最佳实践

### 1. 分支管理

```bash
# 主要分支
main      # 生产环境代码
develop   # 开发环境代码

# 功能分支
feature/xxx    # 新功能开发
bugfix/xxx     # Bug 修复
hotfix/xxx     # 紧急修复
release/xxx    # 发布准备
```

### 2. Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: 新功能
fix: Bug 修复
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具链相关
```

### 3. Pull Request 流程

1. 从 `develop` 创建功能分支
2. 开发和测试
3. 创建 PR 到 `develop`
4. 代码审查
5. CI 检查通过
6. 合并到 `develop`
7. 定期从 `develop` 合并到 `main`

### 4. 版本号规范

遵循 [Semantic Versioning](https://semver.org/)：

```
MAJOR.MINOR.PATCH

0.1.0  → 0.2.0  # MINOR：向后兼容的新功能
0.2.0  → 1.0.0  # MAJOR：不兼容的 API 变更
1.0.0  → 1.0.1  # PATCH：向后兼容的 Bug 修复
```

### 5. 监控和维护

- **定期检查 CI 失败**: 设置 GitHub 通知
- **依赖更新**: 每周检查 `pnpm outdated`
- **安全审计**: 定期查看 GitHub Security 标签
- **性能监控**: 关注构建时间和成功率

#### CI 性能监控（重要）

项目已配置完整的 CI 监控体系：

**实时监控**:

```bash
# 查看当前 CI 性能
./scripts/ci-monitor.sh

# 输出示例:
# 📊 总体统计 (最近20次):
#   总运行次数: 20 次
#   成功次数: 18 次
#   成功率: 90.0%
```

**性能报告**:

```bash
# 生成详细性能报告
./scripts/ci-performance-report.sh

# 报告包含:
# - 构建时间趋势
# - 成功率分析
# - 失败原因统计
# - 优化建议
```

**快速检查**:

```bash
# 查看最近运行
gh run list --limit 10

# 查看失败运行
gh run list --status=failure

# 查看特定运行详情
gh run view <run-id>
```

**性能基准**:

- ✅ 成功率目标: ≥95%（当前: 90%）
- ✅ 构建时间目标: ≤90秒（当前: 1m20s-1m54s）
- ✅ 稳定性: 连续成功（最近 8 次 100%）

#### CI 优化成果（2026-05-01）

项目已完成 CI/CD 优化，主要成果：

1. **解决 Canvas 依赖问题**
   - ✅ 添加 `CANVAS_USE_NATIVE: '0'` 跳过原生模块编译
   - ✅ 添加 `PUPPETEET_SKIP_DOWNLOAD: 'true'` 跳过可选依赖
   - ✅ 成功率从 70% 提升到 90%

2. **升级 Node.js 版本**
   - ✅ 从 Node.js 22 升级到 24.x
   - ✅ 所有 CI 工作流已更新
   - ✅ 消除弃用警告

3. **优化构建流程**
   - ✅ 添加超时配置（5分钟）
   - ✅ 优化依赖安装策略
   - ✅ 构建时间降低 ~25%

详见:

- [CI 失败调查报告](../../CI_FAILURE_INVESTIGATION.md)
- [CI 优化方案](../../CI_OPTIMIZATION_PLAN.md)
- [CI 优化结果](../../CI_OPTIMIZATION_RESULTS.md)

## 故障排查

### 常见问题

#### 1. CI 构建失败

```bash
# 本地运行相同的命令
pnpm install
pnpm build
pnpm test
```

#### 2. Canvas 依赖安装失败（已解决）

```
错误信息:
Package 'pixman-1', required by 'virtual:world', not found
canvas@2.11.2 原生模块编译失败
```

**解决方案**: ✅ 已在 CI 配置中修复

如果遇到此问题，检查 `.github/workflows/*.yml` 文件是否包含：

```yaml
env:
  CANVAS_USE_NATIVE: '0' # 跳过原生模块编译
  PUPPETEET_SKIP_DOWNLOAD: 'true' # 跳过可选依赖
```

详细说明: [CI 失败调查报告](../../CI_FAILURE_INVESTIGATION.md)

#### 3. Node.js 版本警告（已解决）

```
警告: Node.js 20 actions are deprecated
```

**解决方案**: ✅ 已升级到 Node.js 24

确保所有工作流文件使用：

```yaml
env:
  NODE_VERSION: '24.x'
```

如仍有警告，可在 workflow 中添加：

```yaml
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'
```

#### 4. Docker 构建失败

```bash
# 本地构建 Docker 镜像
docker build -t test .
docker run test
```

#### 5. 发布失败

- 检查 Secrets 是否正确配置
- 确认版本号是否已存在
- 检查 package.json 配置

#### 6. 权限问题

- 确认 GitHub Actions 有足够的权限
- 检查仓库设置 → Actions → General → Workflow permissions
- 确保选择 "Read and write permissions"

#### 7. CI 成功率低

```bash
# 运行监控脚本分析原因
./scripts/ci-monitor.sh

# 查看失败运行详情
gh run list --status=failure
gh run view <failed-run-id> --log
```

**常见原因**:

- 依赖安装失败 → 检查网络和依赖版本
- 测试超时 → 增加超时时间配置
- 内存不足 → 优化测试或增加资源

## 进阶配置

### 1. 自定义工作流

你可以根据项目需求修改 `.github/workflows/*.yml` 文件。

### 2. 添加通知

在重要工作流中添加 Slack/Email 通知：

```yaml
- name: 发送通知
  uses: 8398a7/action-slack@v3
  with:
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
    text: '构建成功！'
```

### 3. 性能优化

- 使用 `actions/cache` 缓存依赖
- 并行执行独立的 Job
- 使用 `matrix` 策略测试多个版本

### 4. 环境管理

```yaml
environments:
  production:
    url: https://yunpat.example.com
  staging:
    url: https://yunpat-staging.example.com
```

## 参考资源

### 官方文档

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [GitHub Actions 入门](https://docs.github.com/en/actions/learn-github-actions/introduction-to-github-actions)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Docker Build Push Action](https://github.com/docker/build-push-action)

### 项目 CI/CD 文档

- [CI 监控指南](../../CI_MONITORING_GUIDE.md) - 完整的 CI 监控和性能分析指南
- [CI 失败调查报告](../../CI_FAILURE_INVESTIGATION.md) - 常见 CI 问题及解决方案
- [CI 优化方案](../../CI_OPTIMIZATION_PLAN.md) - CI/CD 性能优化方案
- [CI 优化结果](../../CI_OPTIMIZATION_RESULTS.md) - 优化成果总结
- [CI 实时监控报告](../../CI_MONITORING_REPORT_20260501.md) - 最新监控报告

### GitHub 快速参考

- [GitHub 设置清单](GITHUB_CHECKLIST.md) - 快速设置检查清单
- [GitHub 总结](GITHUB_SUMMARY.md) - GitHub 集成总结

---

**维护者**: Xu Jian <xujian519@gmail.com>
**最后更新**: 2026-05-01
**版本**: v1.1.0

**更新内容**:

- ✅ 添加 CI 监控和性能分析章节
- ✅ 更新故障排查，添加 canvas 依赖问题解决方案
- ✅ 添加 CI 优化成果说明
- ✅ 更新 Node.js 版本到 24.x
- ✅ 添加项目 CI/CD 文档链接
