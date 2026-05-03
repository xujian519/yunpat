# Runner 卡住问题处理指南

**问题时间**: 2026-05-03 02:33
**影响范围**: CI/CD 任务无法执行
**严重程度**: P0 (紧急)

## 🔴 问题确认

### 症状

- **Runner 状态**: online 但显示为 busy
- **进行中的工作流**: 0 个
- **排队任务**: 3 个 (等待超过 10 分钟)
- **结论**: Runner 进程卡住，但 GitHub 认为它正在运行任务

### 诊断结果

```json
{
  "runner_name": "m4-air-runner",
  "status": "online",
  "busy": true,
  "running_workflows": 0,
  "queued_tasks": 3
}
```

## 🛠️ 解决方案

### 方案 1: SSH 到 Runner 机器手动重启 (推荐)

#### 步骤 1: 定位 Runner 机器

Runner 名称: `m4-air-runner`
可能的 hostname: `m4-air.local`, `m4-air-runner.local`, 或其他配置的主机名

#### 步骤 2: SSH 连接

```bash
# 尝试常见的 hostname
ssh user@m4-air.local
# 或
ssh user@m4-air-runner.local

# 如果不成功，检查本地网络
dns-sd -B _ssh._tcp local
```

#### 步骤 3: 运行诊断脚本

```bash
cd /path/to/YunPat
./scripts/diagnose-runner.sh
```

这将提供：

- Runner 进程状态
- CPU/内存使用情况
- 网络连接状态
- 日志文件分析

#### 步骤 4: 停止并重启 Runner

```bash
# 进入 Runner 目录 (通常是 ~/actions-runner)
cd ~/actions-runner

# 停止 Runner 服务
./svc.sh stop

# 杀死所有相关进程 (如果服务停止失败)
pkill -9 -f actions.runner

# 清理临时文件
rm -rf _work/_temp/*

# 重启 Runner 服务
./svc.sh start

# 验证状态
./svc.sh status
```

#### 步骤 5: 验证修复

```bash
# 在本地机器上检查 Runner 状态
gh api repos/xujian519/yunpat/actions/runners --jq '.runners[0] | {name: .name, busy: .busy, status: .status}'

# 应该显示: {"name": "m4-air-runner", "busy": false, "status": "online"}
```

### 方案 2: 强制重新注册 Runner (如果方案 1 失败)

#### 步骤 1: 在 Runner 机器上卸载

```bash
cd ~/actions-runner

# 停止服务
./svc.sh stop

# 卸载服务
./svc.sh uninstall

# 移除 Runner 配置
./config.sh remove --token <YOUR_TOKEN>
```

#### 步骤 2: 重新配置 Runner

```bash
# 获取新的 token
gh api repos/xujian519/yunpat/actions/runners/registration-token --jq '.token'

# 重新配置
./config.sh --url https://github.com/xujian519/yunpat --token <NEW_TOKEN>

# 安装并启动服务
./svc.sh install
./svc.sh start
```

### 方案 3: 等待超时 (不推荐)

如果 Runner 进程最终会自动清理，预计等待时间：

- **超时时间**: 通常 6-24 小时
- **风险**: CI/CD 完全不可用
- **建议**: 仅作为最后手段

## 📊 预防措施

### 短期预防

1. **添加 Runner 健康检查**
   - 定期检查 Runner 状态
   - 自动重启卡住的 Runner

2. **优化工作流配置**
   - 添加超时限制
   - 设置适当的并发控制

3. **监控脚本**
   - 定期运行 `./scripts/check-runner-remote.sh`
   - 设置告警通知

### 长期预防

1. **Runner 资源管理**
   - 增加 Runner 数量
   - 设置资源限制

2. **自动化恢复**
   - 编写自动重启脚本
   - 集成到监控系统

3. **文档完善**
   - 更新 Runner 配置文档
   - 添加故障排查指南

## 🔍 根本原因分析

### 可能的原因

1. **Deploy 工作流卡住**
   - 之前取消的 Deploy 任务未正确清理
   - 脚本执行超时但进程未终止

2. **GitHub Actions 状态不同步**
   - GitHub 认为任务在运行，但实际已完成
   - 网络问题导致状态更新失败

3. **Runner 进程问题**
   - 子进程僵死
   - 资源泄漏导致无法响应

### 调查方向

1. **检查 Runner 日志**
   - `~/actions-runner/_diag/Runner_*.log`
   - 查找错误和异常

2. **系统资源使用**
   - CPU/内存是否耗尽
   - 磁盘 I/O 是否异常

3. **网络连接**
   - 与 GitHub API 的连接状态
   - 是否有网络超时

## 📝 后续行动

### 立即行动 (今天)

- [ ] SSH 到 Runner 机器
- [ ] 运行诊断脚本
- [ ] 重启 Runner 服务
- [ ] 验证 CI 恢复正常

### 短期行动 (本周)

- [ ] 添加自动监控脚本
- [ ] 配置告警通知
- [ ] 优化工作流超时设置

### 长期行动 (本月)

- [ ] 增加 Runner 数量
- [ ] 实现自动恢复机制
- [ ] 完善监控和文档

## 📞 联系信息

如果问题持续或需要帮助：

- **Runner 机器**: m4-air (需要访问凭证)
- **GitHub 仓库**: xujian519/yunpat
- **诊断脚本**: `./scripts/diagnose-runner.sh`
- **监控脚本**: `./scripts/check-runner-remote.sh`

---

**文档版本**: 1.0
**最后更新**: 2026-05-03 02:33
