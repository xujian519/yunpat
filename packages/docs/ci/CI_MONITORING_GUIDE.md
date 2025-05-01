# GitHub Actions CI/CD 性能监控指南

## 📊 监控指标

### 关键性能指标 (KPIs)

| 指标             | 目标值 | 当前值  | 状态 |
| ---------------- | ------ | ------- | ---- |
| **构建成功率**   | ≥95%   | 100%    | ✅   |
| **平均构建时间** | ≤3分钟 | 1分39秒 | ✅   |
| **测试通过率**   | 100%   | 100%    | ✅   |
| **代码质量检查** | 通过   | 通过    | ✅   |

---

## 🔍 监控方法

### 1. 使用 GitHub CLI 监控

```bash
# 查看最近的 CI 运行
gh run list --limit 10

# 查看特定工作流的运行
gh run list --workflow="CI (Simplified)" --limit 10

# 查看运行详情
gh run view <run-id>

# 查看失败的运行
gh run list --status=failure --limit 5

# 实时监控最新运行
gh run watch
```

### 2. 性能分析脚本

```bash
#!/bin/bash
# ci-monitor.sh - CI 性能监控脚本

echo "🔍 YunPat CI/CD 性能监控"
echo "===================="
echo ""

# 获取最近20次运行
RUNS=$(gh run list --json databaseId,conclusion,name,status,durationMs,updatedAt --limit 20)

# 分析成功率
SUCCESS_COUNT=$(echo "$RUNS" | jq '[.[] | select(.conclusion == "success")] | length')
TOTAL_COUNT=$(echo "$RUNS" | jq 'length')
SUCCESS_RATE=$(echo "scale=1; $SUCCESS_COUNT * 100 / $TOTAL_COUNT" | bc)

echo "📊 最近20次运行统计："
echo "  总运行次数: $TOTAL_COUNT"
echo "  成功次数: $SUCCESS_COUNT"
echo "  成功率: ${SUCCESS_RATE}%"
echo ""

# 分析平均耗时
AVG_DURATION=$(echo "$RUNS" | jq '[.[] | select(.durationMs != null)] | .durationMs | add / length')
AVG_DURATION_SECONDS=$(echo "scale=0; $AVG_DURATION / 1000" | bc)

echo "⏱️  平均构建时间: ${AVG_DURATION_SECONDS}秒"
echo ""

# 列出失败的运行
FAILED_RUNS=$(echo "$RUNS" | jq '[.[] | select(.conclusion == "failure")]')
FAILED_COUNT=$(echo "$FAILED_RUNS" | jq 'length')

if [ "$FAILED_COUNT" -gt 0 ]; then
  echo "❌ 失败的运行 ($FAILED_COUNT):"
  echo "$FAILED_RUNS" | jq -r '.[] | "  - \(.name) (\(.updatedAt))"'
else
  echo "✅ 没有失败的运行"
fi

echo ""
echo "===================="
echo "💡 建议:"

if (( $(echo "$SUCCESS_RATE < 95" | bc -l) )); then
  echo "  ⚠️  成功率低于95%，需要关注"
fi

if (( $(echo "$AVG_DURATION_SECONDS > 180" | bc -l) )); then
  echo "  ⚠️  构建时间超过3分钟，考虑优化"
fi

echo "  定期运行此脚本以监控 CI 性能"
```

### 3. 使用 GitHub Actions 自定义监控

在 `.github/workflows/ci-monitor.yml` 中创建性能监控工作流：

```yaml
name: CI 性能监控

on:
  schedule:
    # 每天早上8点运行
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  monitor:
    name: 监控 CI 性能
    runs-on: ubuntu-latest

    steps:
      - name: 检出代码
        uses: actions/checkout@v4

      - name: 分析 CI 性能
        run: |
          # 获取最近100次运行
          RUNS=$(gh run list --json databaseId,conclusion,status,durationMs --limit 100)

          # 计算成功率
          SUCCESS_COUNT=$(echo "$RUNS" | jq '[.[] | select(.conclusion == "success")] | length')
          TOTAL_COUNT=$(echo "$RUNS" | jq 'length')
          SUCCESS_RATE=$(echo "scale=1; $SUCCESS_COUNT * 100 / $TOTAL_COUNT" | bc)

          # 计算平均耗时
          AVG_DURATION=$(echo "$RUNS" | jq '[.[] | select(.durationMs != null)] | .durationMs | add / length')

          echo "✅ 成功率: ${SUCCESS_RATE}%"
          echo "⏱️  平均耗时: $(echo "scale=0; $AVG_DURATION / 1000" | bc)秒"

          # 检查是否需要告警
          if (( $(echo "$SUCCESS_RATE < 90" | bc -l) )); then
            echo "::warning::成功率低于90%，需要关注"
          fi

          if (( $(echo "$AVG_DURATION > 180000" | bc -l) )); then
            echo "::warning::平均构建时间超过3分钟"
          fi
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 📈 性能优化建议

### 1. 构建时间优化

**当前状态**: 1分39秒 ✅ (优秀)

**优化方向**:

- 使用 pnpm 缓存优化
- 并行运行独立的 job
- 使用 GitHub Actions 缓存

### 2. 成功率优化

**当前状态**: 100% ✅ (完美)

**维护建议**:

- 定期检查失败的运行
- 修复 flaky 测试
- 更新依赖版本

### 3. 资源使用优化

**建议**:

- 使用 `ubuntu-latest` (最新版本)
- 考虑使用 `actions/cache` 优化依赖安装
- 优化 pnpm 安装参数

---

## 🚨 性能告警

### 告警阈值

| 指标         | 警告阈值 | 严重阈值 |
| ------------ | -------- | -------- |
| **成功率**   | <95%     | <90%     |
| **构建时间** | >3分钟   | >5分钟   |
| **失败次数** | 连续2次  | 连续3次  |

### 告警方式

1. **GitHub Actions Annotations**

   ```yaml
   - name: 性能检查
     run: |
       if [ "$BUILD_TIME" -gt 300 ]; then
         echo "::warning::构建时间超过3分钟"
       fi
   ```

2. **Slack/Email 通知** (可选)
   ```yaml
   - name: 发送通知
     if: failure()
     uses: 8398a7/action-slack@v3
     with:
       status: ${{ job.status }}
       text: 'CI 构建失败'
     env:
       SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
   ```

---

## 📋 监控检查清单

### 日常监控 (每日)

- [ ] 检查最新的 CI 运行状态
- [ ] 查看是否有失败的构建
- [ ] 检查构建时间趋势

### 周期监控 (每周)

- [ ] 分析最近7天的构建成功率
- [ ] 识别性能瓶颈
- [ ] 检查依赖更新

### 深度分析 (每月)

- [ ] 生成月度 CI 性能报告
- [ ] 分析失败原因分布
- [ ] 优化构建流程

---

## 🔧 工具和脚本

### 快速监控命令

```bash
# 查看最新运行状态
gh run view --json conclusion,status | jq '{conclusion, status}'

# 查看最近失败次数
gh run list --status=failure --count 5

# 查看平均构建时间
gh run list --json durationMs --limit 20 | \
  jq '[.[] | select(.durationMs != null)] | .durationMs | add / length / 1000'

# 实时监控
watch -n 10 'gh run list --limit 1'

# 性能趋势分析
gh run list --json conclusion,durationMs,updatedAt --limit 50 | \
  jq -r '.[] | "\(.updatedAt),\(.conclusion),\(.durationMs)"' > ci-data.csv
```

---

## 📊 性能报告模板

```markdown
## CI/CD 性能报告 - YYYY年MM月

### 总体概况

- 统计周期: YYYY-MM-DD 至 YYYY-MM-DD
- 总运行次数: X次
- 成功率: XX%
- 平均构建时间: XX秒

### 性能趋势

- 构建成功率变化: 📈📉
- 平均构建时间变化: 📈📉

### 失败分析

- 主要失败原因:
  - 测试失败: X次
  - 构建失败: X次
  - 超时失败: X次

### 优化建议

- 1. ...
- 2. ...
- 3. ...

### 下月目标

- 成功率目标: ≥95%
- 构建时间目标: ≤3分钟
```

---

## 🎯 Node.js 24 升级验证

### 升级内容

✅ **已更新的 workflow 文件**:

- `.github/workflows/ci-simplified.yml`
- `.github/workflows/ci-optimized.yml`
- `.github/workflows/automation.yml`
- `.github/workflows/release.yml`

### 验证清单

- [x] 所有 workflow 文件已更新到 Node.js 24.x
- [x] 保持环境变量一致性
- [x] 维护向后兼容性
- [ ] 等待下一次 CI 运行验证
- [ ] 监控升级后的性能表现

### 预期效果

1. **消除弃用警告**
   - 不再显示 Node.js 20 actions 弃用提示
   - 符合 GitHub Actions 最新要求

2. **性能提升**
   - Node.js 24 性能比 Node.js 22 提升 ~10-20%
   - 更快的 V8 引擎优化
   - 改进的内存管理

3. **长期稳定性**
   - 支持到 2027年
   - 及时获得安全更新
   - 与生态系统保持同步

---

## 📞 支持和反馈

如果遇到 CI/CD 问题，请：

1. 查看运行日志：`gh run view <run-id> --log`
2. 检查 workflow 配置：`.github/workflows/`
3. 提交 Issue：GitHub Issues
4. 联系维护者：xujian519@gmail.com

---

**最后更新**: 2026-05-01
**维护者**: YunPat Team
