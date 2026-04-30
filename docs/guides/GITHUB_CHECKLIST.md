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

## 第七步：测试 CI/CD 工作流

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

## 下一步

设置完成后，你可以：

1. 🎉 开始正常的开发流程
2. 📝 查看完整的 [GitHub 设置指南](GITHUB_SETUP.md)
3. 🚀 创建第一个 Pull Request
4. 📦 发布第一个版本

## 需要帮助？

- 📖 [GitHub Actions 文档](https://docs.github.com/en/actions)
- 💬 在 Issues 中提问
- 📧 联系维护者：xujian519@gmail.com

---

**祝你设置顺利！** 🎉