# YunPat CI/CD 监控总结

**日期**: 2026-05-01
**Runner**: m4-air-runner
**状态**: ✅ 正常运行

---

## ✅ 验证结果

### Runner 状态

- **名称**: m4-air-runner
- **状态**: Online（绿色）
- **OS**: macOS ARM64
- **标签**: self-hosted, macos-arm64 ✅
- **进程**: 8 个相关进程运行中

### 最新执行

- **工作流**: Test Local Runner
- **触发时间**: 2026-05-01 14:29:40Z
- **任务**: Rust 工具链检查
- **状态**: 正在执行 ✅

### 系统资源

- **磁盘使用**: 54% (238GB/460GB)
- **内存**: 正常
- **CPU**: 正常

---

## 📋 监控命令

### 快速状态检查

```bash
# 1. Runner 状态
ssh xujian@100.91.197.114 '~/manage-runner.sh status'

# 2. 查看运行的工作流
gh run list --limit 5

# 3. 查看最新运行的详情
gh run view --log

# 4. 打开 GitHub Actions 页面
gh run view --web
```

### 实时监控

```bash
# 1. 实时查看 Runner 日志
ssh xujian@100.91.197.114 "tail -f ~/actions-runner/_diag/Runner_*.log"

# 2. 查看工作目录
ssh xujian@100.91.197.114 "ls -la ~/actions-runner/_work/yunpat/yunpat/"

# 3. 查看最新构建输出
ssh xujian@100.91.197.114 "ls -lt ~/actions-runner/_work/yunpat/yunpat/ | head -20"
```

### GitHub Actions 页面

- **Actions 首页**: https://github.com/xujian519/yunpat/actions
- **Runner 设置**: https://github.com/xujian519/yunpat/settings/actions
- **最新运行**: https://github.com/xujian519/yunpat/actions/runs/25218163064

---

## 🔧 常用操作

### 重启 Runner

```bash
ssh xujian@100.91.197.114 '~/manage-runner.sh restart'
```

### 查看 Runner 日志

```bash
ssh xujian@100.91.197.114 '~/manage-runner.sh logs'
```

### 清理工作目录

```bash
ssh xujian@100.91.197.114 '~/manage-runner.sh clean'
```

### 手动触发工作流

```bash
# 触发测试工作流
gh workflow run test-local-runner.yml

# 触发 CI 工作流
gh workflow run ci-local.yml
```

---

## 📊 工作流配置

### 当前工作流

- `.github/workflows/ci-local.yml` - 本地 CI（优化版）
- `.github/workflows/test-local-runner.yml` - 测试 Runner
- `.github/workflows/automation.yml` - 自动化任务
- `.github/workflows/release.yml` - 发布流程

### 标签匹配

- **Runner 标签**: `self-hosted, macos-arm64`
- **工作流要求**: `runs-on: [self-hosted, macos-arm64]` ✅

---

## ⚠️ 已知问题

### GitHub API 状态延迟

**现象**: API 显示 "queued"，但 Runner 实际在运行

**原因**: GitHub API 状态更新有延迟

**解决**:

- 直接查看 Runner 日志确认实际状态
- 访问 GitHub Actions 页面查看实时状态
- 等待 1-2 分钟后重新检查

### 解决方案

1. **直接查看日志**:

   ```bash
   ssh xujian@100.91.197.114 "tail -f ~/actions-runner/_diag/Runner_*.log"
   ```

2. **查看工作目录**:

   ```bash
   ssh xujian@100.91.197.114 "ls -la ~/actions-runner/_work/yunpat/yunpat/"
   ```

3. **GitHub Actions 页面**:
   - https://github.com/xujian519/yunpat/actions

---

## 📈 性能优化建议

### 1. 定期清理

```bash
# 每周清理一次工作目录
0 3 * * 0 ~/manage-runner.sh clean
```

### 2. 监控资源使用

```bash
# 查看磁盘使用
ssh xujian@100.91.197.114 "df -h ~/actions-runner"

# 查看内存使用
ssh xujian@100.91.197.114 "vm_stat | head -10"
```

### 3. 日志管理

```bash
# 定期清理旧日志
ssh xujian@100.91.197.114 "find ~/actions-runner/_diag -name '*.log' -mtime +7 -delete"
```

---

## 📞 获取帮助

### 本地帮助

```bash
# Runner 管理帮助
ssh xujian@100.91.197.114 '~/manage-runner.sh help'

# GitHub CLI 帮助
gh run --help
gh workflow --help
```

### 文档

- **完整指南**: `~/github-runner-complete-guide.md`
- **快速参考**: `~/github-runner-quickref.md`
- **本文档**: `docs/CICD_STATUS.md`

### 官方文档

- GitHub Actions: https://docs.github.com/en/actions
- Self-hosted runners: https://docs.github.com/en/actions/hosting-your-own-runners

---

**最后更新**: 2026-05-01 22:30
**下次检查**: 建议每周检查一次 Runner 状态
