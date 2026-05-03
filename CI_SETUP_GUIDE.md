# YunPat CI/CD 配置指南

## 📋 概述

YunPat 项目使用 **M4 MacBook Air 自托管 GitHub Actions Runner** 进行持续集成和持续部署。

---

## 🖥️ 自托管 Runner 信息

### 硬件配置
- **设备**: MacBook Air (M4 芯片)
- **架构**: ARM64
- **操作系统**: macOS
- **Runner 名称**: `xujiandeMacBook-Air`
- **状态**: ✅ online

### 优势
- ✅ **不受 GitHub Actions 配额限制**
- ✅ **强大的 M4 性能**
- ✅ **ARM64 原生支持**
- ✅ **更灵活的配置**
- ✅ **零成本运行**

---

## 🔄 CI 工作流

### 唯一 CI 工作流：ci-stable.yml

**文件**: [`.github/workflows/ci-stable.yml`](.github/workflows/ci-stable.yml)

**触发条件**:
- Push 到 `main` 或 `develop` 分支
- Pull Request 到 `main` 或 `develop` 分支
- 手动触发 (workflow_dispatch)

### 任务列表

#### 1. 代码质量检查 (quality)
- ✅ ESLint 代码规范检查
- ✅ TypeScript 类型检查
- ✅ Prettier 代码格式检查
- ⏱️ 超时: 20 分钟

#### 2. TypeScript 测试 (test-typescript)
- ✅ 构建项目
- ✅ 运行所有测试 (vitest)
- ✅ 生成测试覆盖率报告
- ⏱️ 超时: 30 分钟

#### 3. Rust 工具测试 (test-rust)
- ✅ Rust 格式检查 (fmt)
- ✅ Rust Clippy 检查
- ✅ 构建 Rust 项目
- ✅ 运行 Rust 测试
- ✅ 生成 Rust 文档
- ⏱️ 超时: 25 分钟

#### 4. 安全检查 (security)
- ✅ npm audit 依赖漏洞检查
- ✅ 安全审计报告
- ⏱️ 超时: 10 分钟

#### 5. 构建验证 (build)
- ✅ 构建所有 TypeScript 包
- ✅ 构建 Rust 项目 (Release 模式)
- ✅ 生成构建信息
- ✅ 构建摘要报告
- ⏱️ 超时: 30 分钟

#### 6. Python 工具测试 (test-python) 🆕
- ✅ Python 测试运行
- ✅ 代码覆盖率报告
- ⏱️ 超时: 15 分钟
- 🔄 失败不阻塞主流程

#### 7. Docker 构建测试 (test-docker) 🆕
- ✅ 构建 Docker 镜像
- ✅ 测试 Docker 镜像
- ⏱️ 超时: 15 分钟
- 🔄 失败不阻塞主流程

---

## 🚀 任务依赖关系

```
quality (质量检查)
  ├─> test-typescript (TypeScript 测试)
  ├─> test-rust (Rust 测试)
  ├─> security (安全检查)
  ├─> test-python (Python 测试, 可选)
  └─> test-docker (Docker 测试, 可选)

test-typescript + test-rust
  └─> build (构建验证)
```

**说明**:
- 所有任务依赖 `quality` 检查通过
- `build` 任务依赖 `test-typescript` 和 `test-rust` 通过
- `test-python` 和 `test-docker` 失败不会阻塞主流程

---

## ⚙️ 并发控制

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true  # 取消旧的运行
```

**行为**:
- 同一分支的新推送会取消旧的 CI 运行
- 避免资源浪费
- 加快反馈速度

---

## 🔧 环境配置

### Node.js 环境
```yaml
NODE_VERSION: '20.x'
PNPM_VERSION: 9
NODE_OPTIONS: '--max-old-space-size=4096'
```

### Rust 环境
```yaml
RUST_BACKTRACE: '1'
```

### Git 网络优化
```bash
git config --global http.version HTTP/1.1
git config --global https.version HTTP/1.1
git config --global http.postBuffer 524288000
```

---

## 📊 监控 CI 运行

### 查看当前运行状态
```bash
# 查看最近 5 次运行
gh run list --limit 5

# 查看特定运行的详情
gh run view <run-id>

# 在浏览器中打开
gh run view <run-id> --web
```

### 查看 Runner 状态
```bash
# 查看所有 runner
gh api repos/xujian519/yunpat/actions/runners

# 查看 runner 详细信息
gh api repos/xujian519/yunpat/actions/runners --jq '.runners[]'
```

### 实时日志监控
```bash
# 查看运行日志
gh run view <run-id> --log

# 查看失败的日志
gh run view <run-id> --log-failed
```

---

## 🛠️ 本地测试

### 运行预提交检查
```bash
# 类型检查
pnpm build:tsc

# 运行测试
pnpm test

# 代码规范检查
pnpm lint

# 格式检查
pnpm exec prettier --check "**/*.{ts,js,json,md}"
```

### 完整 CI 模拟
```bash
# 构建所有包
pnpm build

# 运行所有测试
pnpm test -- --run

# Rust 测试
cd packages/rust-tools
cargo fmt -- --check
cargo clippy -- -D warnings
cargo test
```

---

## 📁 已禁用的工作流

### ci.yml.disabled
- **原因**: GitHub Actions 配额限制
- **状态**: 已禁用
- **替代方案**: 使用 ci-stable.yml

### ci-local-optimized.yml.disabled
- **原因**: 本地测试专用
- **状态**: 已禁用

### ci-local.yml.disabled
- **原因**: 本地测试专用
- **状态**: 已禁用

---

## 🔐 安全性

### 依赖漏洞扫描
- 自动运行 `pnpm audit`
- 审计级别: moderate
- 失败不阻塞主流程

### 私有信息保护
- ✅ 不在日志中输出敏感信息
- ✅ 使用 GitHub Secrets 存储密钥
- ✅ 限制 runner 访问权限

---

## 🐛 故障排查

### Runner 离线
```bash
# 检查 runner 服务
sudo launchctl list | grep actions

# 重启 runner 服务
cd ~/actions-runner
./svc.sh restart
```

### CI 任务卡住
```bash
# 查看占用资源的进程
ps aux | grep -E "(node|cargo|vitest)"

# 清理僵尸进程
pkill -f "node.*vitest"
pkill -f "node.*esbuild"
```

### 磁盘空间不足
```bash
# 清理工作目录
rm -rf ~/actions-runner/_work/_temp/*

# 清理 Docker 缓存
docker system prune -af
```

---

## 📈 性能优化

### Git 网络优化
```bash
git config --global http.version HTTP/1.1
git config --global http.useHTTP2 false
```

### 缓存策略
- pnpm 缓存: 自动管理
- Cargo 缓存: 自动管理
- Node 模块缓存: 通过 setup-node@v4

### 资源限制
- 内存: 4GB (NODE_OPTIONS)
- 超时: 每个任务 10-30 分钟
- 并发: 串行执行（稳定性优先）

---

## 🎯 最佳实践

### 1. 提交前本地测试
```bash
# 运行完整检查
pnpm lint
pnpm build:tsc
pnpm test -- --run
```

### 2. 使用有意义的提交信息
```bash
# 好的提交信息
git commit -m "feat: 添加专利分析智能体"

# 避免的提交信息
git commit -m "update"
```

### 3. 小步快跑，频繁提交
- ✅ 每个功能单独提交
- ✅ 提交前本地测试
- ✅ 及时修复 CI 失败

### 4. 关注 CI 反馈
- ✅ 及时查看 CI 结果
- ✅ 修复失败的测试
- ✅ 优化 CI 性能

---

## 📞 支持

### GitHub Actions 文档
- [官方文档](https://docs.github.com/en/actions)
- [自托管 runner](https://docs.github.com/en/actions/hosting-your-own-runners)

### 项目特定问题
- 查看 [CI 运行历史](https://github.com/xujian519/yunpat/actions)
- 检查 [Runner 状态](https://github.com/xujian519/yunpat/settings/actions)

---

## ✨ 总结

使用 M4 MacBook Air 自托管 runner 为 YunPat 项目提供：
- ✅ **无限制的 CI/CD**
- ✅ **强大的性能**
- ✅ **完整的测试覆盖**
- ✅ **灵活的配置**
- ✅ **零成本运行**

**项目已达到生产级 CI/CD 标准！** 🎉
