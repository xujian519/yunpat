# 定期任务配置指南

## Cron 配置（Linux/macOS）

### 1. 编辑 crontab

```bash
crontab -e
```

### 2. 添加定时任务

```bash
# YunPat 定期任务

# 每天凌晨 2 点运行文档同步检查
0 2 * * * cd /Users/xujian/projects/YunPat && bash scripts/schedule-tasks.sh doc-check >> logs/cron.log 2>&1

# 每周一上午 9 点运行每周审查
0 9 * * 1 cd /Users/xujian/projects/YunPat && bash scripts/schedule-tasks.sh weekly-review >> logs/cron.log 2>&1

# 每月 1 号凌晨 3 点生成文档
0 3 1 * * cd /Users/xujian/projects/YunPat && bash scripts/schedule-tasks.sh generate-docs >> logs/cron.log 2>&1

# 每周日晚上 8 点评估完成度
0 20 * * 0 cd /Users/xujian/projects/YunPat && bash scripts/schedule-tasks.sh evaluate-completion >> logs/cron.log 2>&1
```

### 3. 查看 cron 日志

```bash
tail -f logs/cron.log
```

---

## macOS Launchd 配置

### 1. 创建 plist 文件

创建文件: `~/Library/LaunchAgents/com.yunpat.weekly-review.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.yunpat.weekly-review</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/xujian/projects/YunPat/scripts/schedule-tasks.sh</string>
        <string>weekly-review</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Users/xujian/projects/YunPat</string>

    <key>StandardOutPath</key>
    <string>/Users/xujian/projects/YunPat/logs/weekly-review.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/xujian/projects/YunPat/logs/weekly-review.error.log</string>

    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
        <key>Weekday</key>
        <integer>1</integer>
    </dict>
</dict>
</plist>
```

### 2. 加载服务

```bash
# 加载服务
launchctl load ~/Library/LaunchAgents/com.yunpat.weekly-review.plist

# 启动服务
launchctl start com.yunpat.weekly-review

# 查看状态
launchctl list | grep yunpat

# 卸载服务
launchctl unload ~/Library/LaunchAgents/com.yunpat.weekly-review.plist
```

---

## GitHub Actions 配置

### 1. 创建工作流文件

文件: `.github/workflows/scheduled-tasks.yml`

```yaml
name: Scheduled Tasks

on:
  schedule:
    # 每周一上午 9 点 (UTC) 运行
    - cron: '0 1 * * 1'

  workflow_dispatch: # 允许手动触发

jobs:
  weekly-review:
    name: Weekly Review
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run weekly review
        run: node scripts/weekly-review.js

      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: weekly-review-report
          path: docs/reports/WEEKLY_REVIEWS/
          retention-days: 90

      - name: Create Issue if needed
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `📅 每周审查失败 - ${new Date().toISOString().split('T')[0]}`,
              body: '每周审查任务失败，请查看日志了解详情。',
              labels: ['bug', 'weekly-review']
            })
```

---

## 手动运行

### 运行所有任务

```bash
bash scripts/schedule-tasks.sh all
```

### 运行特定任务

```bash
# 文档同步检查
bash scripts/schedule-tasks.sh doc-check

# 每周审查
bash scripts/schedule-tasks.sh weekly-review

# 生成文档
bash scripts/schedule-tasks.sh generate-docs

# 评估完成度
bash scripts/schedule-tasks.sh evaluate-completion
```

---

## 日志管理

### 查看日志

```bash
# 查看最新的日志
ls -lt logs/scheduled-tasks/ | head -5

# 查看特定日志
cat logs/scheduled-tasks/doc-check-20260505.log

# 实时查看日志
tail -f logs/scheduled-tasks/doc-check-20260505.log
```

### 清理旧日志

```bash
# 删除 30 天前的日志
find logs/scheduled-tasks/ -name "*.log" -mtime +30 -delete
```

---

## 通知配置

### 邮件通知（可选）

安装依赖：

```bash
npm install nodemailer
```

创建脚本: `scripts/send-notification.js`

```javascript
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

async function sendReport(reportPath) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'xujian519@gmail.com',
    subject: `YunPat 每周审查报告 - ${new Date().toISOString().split('T')[0]}`,
    text: `请查看附件中的每周审查报告。`,
    attachments: [
      {
        path: reportPath,
      },
    ],
  }

  await transporter.sendMail(mailOptions)
  console.log('✅ 邮件已发送')
}

sendReport(process.argv[2])
```

### Slack 通知（可选）

创建脚本: `scripts/send-slack-notification.js`

```javascript
import fetch from 'node-fetch'

async function sendSlackNotification(summary) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  const message = {
    text: '📅 YunPat 每周审查报告',
    attachments: [
      {
        color: summary.issues > 0 ? 'warning' : 'good',
        text: summary.text,
        fields: [
          { title: '文档同步问题', value: summary.docSyncIssues, short: true },
          { title: '低完成度 Agents', value: summary.lowCompletionAgents, short: true },
        ],
      },
    ],
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })

  console.log('✅ Slack 通知已发送')
}

sendSlackNotification({
  issues: 0,
  docSyncIssues: '0',
  lowCompletionAgents: '3',
  text: '本周审查完成，发现 3 个低完成度 Agent 需要关注',
})
```

---

## 故障排查

### 任务没有运行

1. **检查 cron 服务**

   ```bash
   # Linux
   sudo systemctl status cron

   # macOS
   sudo launchctl list | grep cron
   ```

2. **检查日志**

   ```bash
   cat logs/cron.log
   ```

3. **手动运行测试**
   ```bash
   bash scripts/schedule-tasks.sh all
   ```

### 任务执行失败

1. **查看错误日志**

   ```bash
   cat logs/scheduled-tasks/*.error.log
   ```

2. **检查权限**

   ```bash
   chmod +x scripts/schedule-tasks.sh
   chmod +x scripts/*.js
   ```

3. **检查环境变量**
   ```bash
   # 确保在 crontab 中设置了正确的 PATH
   PATH=/usr/local/bin:/usr/bin:/bin
   ```

---

## 最佳实践

1. **定期检查**: 每月检查一次定时任务是否正常运行
2. **日志轮转**: 定期清理旧日志，避免占用过多磁盘空间
3. **备份配置**: 备份 cron 和 launchd 配置文件
4. **测试变更**: 在修改任务配置后，先手动测试
5. **监控告警**: 配置任务失败时的通知机制

---

**更新时间**: 2026-05-05
**维护人**: 开发团队
