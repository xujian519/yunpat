# CI/CD 监控和告警配置指南

> **更新时间**: 2026-05-03  
> **目的**: 配置高级监控和告警系统

---

## 📊 监控架构

```
┌─────────────────────────────────────┐
│   GitHub Actions                   │
│   - 自动触发监控                    │
│   - 定时任务                        │
│   - 手动触发                        │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   监控脚本                          │
│   - scripts/monitoring.sh          │
│   - scripts/monitor-resources.sh    │
│   - CI 统计分析                    │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   告警系统                          │
│   - Slack Webhook                   │
│   - Email 通知                      │
│   - 状态变更通知                    │
└─────────────────────────────────────┘
```

---

## 🔧 监控配置

### 1. 性能监控

#### 自动监控
```yaml
# .github/workflows/monitoring.yml
schedule:
  - cron: '0 * * * *'  # 每小时
```

#### 手动监控
```bash
# 运行完整监控
./scripts/monitoring.sh [webhook_url]

# 仅监控资源
./scripts/monitor-resources.sh
```

### 2. 告警配置

#### Slack 通知
```bash
# 设置 Slack Webhook
export SLACK_WEBHOOK="https://hooks.slack.com/services/..."

# 发送测试通知
./scripts/monitoring.sh $SLACK_WEBHOOK
```

#### Email 通知
在 GitHub Actions 中配置：
```yaml
- name: 📧 发送邮件通知
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.example.com
    server_port: 587
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: "CI 失败 - ${{ github.repository }}"
    to: admin@example.com
```

### 3. 关键指标监控

#### CI 成功率
- **目标**: > 95%
- **告警**: < 90%
- **严重告警**: < 80%

#### 平均执行时间
- **快速检查**: < 15 分钟
- **完整测试**: < 45 分钟
- **构建**: < 25 分钟

#### Runner 资源
- **CPU 使用率**: < 80%
- **内存使用率**: < 85%
- **磁盘空间**: > 20GB 可用

---

## 📈 监控仪表板

### GitHub Actions Dashboard

**访问**: https://github.com/xujian519/yunpat/actions

**功能**:
- 查看所有运行记录
- 过滤特定的工作流
- 查看日志和输出
- 重新运行失败的任务

### Runner 状态监控

```bash
# 实时监控 Runner
watch -n 10 ./scripts/monitor-resources.sh

# 检查 Runner 日志
ssh xujian@m4-air "tail -f ~/actions-runner/_diag/Worker_*.log"
```

---

## 🚨 告警规则

### 告警级别

| 级别 | 条件 | 通知方式 |
|------|------|---------|
| 🟢 INFO | CI 成功 | 不通知 |
| 🟡 WARNING | 成功率 < 90% | Slack |
| 🟠 WARNING | 执行时间超标 | Slack |
| 🔴 ERROR | CI 失败 | Slack + Email |
| 🚨 CRITICAL | 3 次连续失败 | Slack + Email + 短信 |

### 自动修复

某些告警会触发自动修复：
- **磁盘空间不足**: 自动清理临时文件
- **内存不足**: 重启 Runner 服务
- **网络问题**: 自动重试连接

---

## 🔧 高级监控功能

### 1. 日志聚合

```bash
# 收集最近的错误日志
gh run list --repo xujian519/yunpat --limit 20 | \
  jq -r '.[].databaseId' | \
  while read run_id; do
    gh run view "$run_id" --repo xujian519/yunpat --log 2>/dev/null | \
      grep -i "error\|failed" | head -5
  done
```

### 2. 性能趋势分析

```bash
# 分析最近 30 天的性能
./scripts/monitoring.sh | \
  grep "平均执行时间" | \
  tail -30
```

### 3. 异常检测

自动检测：
- 连续失败模式
- 性能突然下降
- 资源使用异常
- 网络连接问题

---

## 📊 监控报告

### 日报
- 当天 CI 运行统计
- 成功率和失败原因
- 性能指标变化
- 异常事件记录

### 周报
- 一周性能趋势
- 失败原因分析
- 改进建议
- 下周计划

### 月报
- 月度性能总结
- 容量规划建议
- 技术债务评估
- 优化路线图

---

## 🎯 监控最佳实践

### DO (推荐)
1. **多层次监控**: 应用 → 基础设施 → 业务
2. **实时告警**: 关键问题立即通知
3. **定期审查**: 每周审查监控效果
4. **持续优化**: 根据监控数据优化配置

### DON'T (避免)
1. **过度告警**: 避免告警疲劳
2. **忽略告警**: 所有的告警都需要处理
3. **监控不足**: 不要只监控表面指标
4. **缺乏行动**: 监控必须有对应的改进措施

---

## 🔧 配置示例

### Slack 集成

```yaml
# .github/workflows/monitoring.yml
- name: 📢 发送 Slack 通知
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: |
      CI 运行 ${{ job.status }}
      提交: ${{ github.sha }}
      作者: ${{ github.actor }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Discord 集成

```yaml
- name: 📢 发送 Discord 通知
  if: always()
  uses: sarisia/actions-status-discord@v1
  with:
    webhook: ${{ secrets.DISCORD_WEBHOOK }}
    status: ${{ job.status }}
    description: |
      CI 运行 ${{ job.status }}
      提交: ${{ github.sha }}
```

---

## 📞 联系方式

**监控负责人**: xujian519@gmail.com  
**紧急联系**: 如发现严重问题，请立即联系

---

**配置完成时间**: 2026-05-03  
**下次审查**: 1 个月后
