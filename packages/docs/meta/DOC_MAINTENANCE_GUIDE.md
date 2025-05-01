# 📚 YunPat 文档维护快速指南

本指南帮助你快速使用新建立的文档维护工具。

---

## 🚀 快速开始

### 1. 检查文档同步

```bash
# 检查文档与代码是否同步
npm run doc:check

# 或直接运行
node scripts/check-doc-sync.js
```

**输出**: 文档同步检查报告

### 2. 评估代码完成度

```bash
# 评估所有包的完成度
npm run doc:review

# 或直接运行
node scripts/evaluate-completion.js
```

**输出**: 27 个 Agents 的详细完成度报告

### 3. 生成文档

```bash
# 自动生成文档
node scripts/generate-docs.js
```

**输出**:

- `docs/ARCHITECTURE_AUTO.md` - 架构文档
- `docs/API_AUTO.md` - API 文档
- `docs/EXAMPLES_AUTO.md` - 使用示例

### 4. 运行每周审查

```bash
# 运行完整的每周审查
bash scripts/schedule-tasks.sh weekly-review
```

**输出**: `docs/reports/WEEKLY_REVIEWS/` 目录下的审查报告

### 5. 查看质量仪表板

```bash
# 生成质量仪表板
node scripts/quality-metrics.js

# 查看仪表板
cat docs/metrics/QUALITY_DASHBOARD.md
```

**输出**: 质量指标可视化仪表板

---

## 📅 定期任务

### 每周任务 (建议每周一上午 9:00)

```bash
# 运行所有每周任务
bash scripts/schedule-tasks.sh all
```

包括:

- 文档同步检查
- 完成度评估
- 文档生成
- 质量监控

### 配置自动运行

**方式 1: Cron (Linux/macOS)**

```bash
# 编辑 crontab
crontab -e

# 添加以下行
0 9 * * 1 cd /Users/xujian/projects/YunPat && bash scripts/schedule-tasks.sh all
```

**方式 2: macOS Launchd**

```bash
# 参考 docs/SCHEDULED_TASKS_SETUP.md
```

**方式 3: GitHub Actions**

```yaml
# .github/workflows/weekly-review.yml
on:
  schedule:
    - cron: '0 1 * * 1' # 每周一上午 9:00 (UTC+8)
```

---

## 📂 文档结构

```
docs/
├── agents/
│   └── ARCHITECTURE.md          # Agents 架构文档 (100+ 页)
├── knowledge/
│   └── INTEGRATION.md            # 知识库集成文档 (80+ 页)
├── metrics/
│   ├── QUALITY_DASHBOARD.md     # 质量仪表板
│   └── history.csv              # 历史数据
├── reports/
│   ├── WEEKLY_REVIEWS/          # 每周审查报告
│   └── ARCHIVE/                 # 归档的旧报告 (59 个)
├── REVIEW_CHECKLIST.md          # 审查清单
├── SCHEDULED_TASKS_SETUP.md     # 定期任务配置
├── PROGRESS_TRACKER.md          # 进度追踪
├── PROJECT_STRUCTURE.md         # 项目结构 (已更新)
├── TECHNICAL_DEBT_*.md          # 技术债务系列
└── FINAL_REPORT_COMPLETE.md     # 最终报告
```

---

## 🔧 工具列表

| 工具                     | 功能         | 用途         |
| ------------------------ | ------------ | ------------ |
| `evaluate-completion.js` | 评估完成度   | 了解项目状态 |
| `check-doc-sync.js`      | 检查文档同步 | 确保文档准确 |
| `generate-docs.js`       | 生成文档     | 自动创建文档 |
| `weekly-review.js`       | 每周审查     | 定期审查     |
| `quality-metrics.js`     | 质量监控     | 查看质量指标 |
| `schedule-tasks.sh`      | 任务调度     | 定期运行     |

---

## 📊 质量指标

### 当前状态 (2026-05-05)

- 🟢 **文档质量**: 95/100
- 🟢 **代码质量**: 87/100
- 🟢 **性能表现**: 98/100
- 🟢 **综合评分**: **93/100**

### 目标

- 文档准确性 ≥ 95%
- 文档覆盖率 ≥ 80%
- 测试覆盖率 ≥ 85%

---

## 💡 最佳实践

### 日常开发

1. **提交代码前**

   ```bash
   npm run doc:check
   ```

2. **完成功能后**

   ```bash
   node scripts/generate-docs.js
   ```

3. **每周一上午**
   ```bash
   bash scripts/schedule-tasks.sh all
   ```

### 文档维护

1. **新增包时**
   - 添加 README.md
   - 更新 PROJECT_STRUCTURE.md
   - 运行 `npm run doc:check`

2. **修改接口时**
   - 更新 API 文档
   - 更新使用示例
   - 运行 `npm run doc:check`

3. **发现问题时**
   - 查看 REVIEW_CHECKLIST.md
   - 运行相应的检查工具
   - 修复后再次检查

---

## 🆘 故障排查

### 问题: 文档检查失败

**原因**: 文档与代码不同步

**解决**:

```bash
# 1. 查看详细错误
npm run doc:check

# 2. 更新文档
node scripts/generate-docs.js

# 3. 再次检查
npm run doc:check
```

### 问题: 定期任务没有运行

**原因**: Cron 或 Launchd 配置问题

**解决**:

```bash
# 1. 检查服务状态
# Linux
sudo systemctl status cron

# macOS
sudo launchctl list | grep cron

# 2. 手动运行测试
bash scripts/schedule-tasks.sh all

# 3. 查看日志
cat logs/scheduled-tasks/*.log
```

### 问题: 质量指标下降

**原因**: 代码质量下降

**解决**:

```bash
# 1. 查看质量仪表板
cat docs/metrics/QUALITY_DASHBOARD.md

# 2. 运行评估工具
npm run doc:review

# 3. 修复问题
# 根据报告中的建议进行改进
```

---

## 📞 获取帮助

### 文档资源

- [完整技术债务报告](docs/FINAL_REPORT_COMPLETE.md)
- [Agents 架构文档](docs/agents/ARCHITECTURE.md)
- [知识库集成文档](docs/knowledge/INTEGRATION.md)
- [定期任务配置](docs/SCHEDULED_TASKS_SETUP.md)

### 技术支持

- **问题反馈**: GitHub Issues
- **功能建议**: GitHub Discussions
- **紧急联系**: xujian519@gmail.com

---

## 🎉 总结

现在你有了：

✅ **完整的文档体系** (180+ 页)
✅ **自动化工具链** (7 个工具)
✅ **定期审查机制** (每周/每月/每季度)
✅ **质量监控仪表板** (实时指标)
✅ **清晰的维护指南** (本文档)

**使用这些工具，保持项目文档的高质量！** 🚀

---

**更新时间**: 2026-05-05
**维护人**: 开发团队
