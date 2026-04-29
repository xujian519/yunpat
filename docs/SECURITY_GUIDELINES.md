# YunPat 安全指南

> **重要**: 本文档说明如何保护敏感信息和配置

---

## 🔒 敏感信息保护

### 1. 环境变量配置

**✅ 正确做法**：
```typescript
// 使用环境变量
const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH;
if (!knowledgeBasePath) {
  throw new Error('请设置环境变量 KNOWLEDGE_BASE_PATH');
}
```

**❌ 错误做法**：
```typescript
// 硬编码路径（会暴露个人信息）
const knowledgeBasePath = '/Users/xujian/Library/Mobile Documents/...';
```

### 2. 配置文件管理

**项目根目录应包含**：
```
.env.example          # 配置示例（可提交到Git）
.env                  # 实际配置（不提交，在.gitignore中）
.gitignore            # 忽略敏感文件
```

**`.env.example` 内容**：
```bash
# 知识库路径
KNOWLEDGE_BASE_PATH=/path/to/your/knowledge-base

# API密钥
DEEPSEEK_API_KEY=your-api-key-here
```

### 3. 文档中的路径处理

**✅ 文档中使用占位符**：
```markdown
# 配置知识库路径
KNOWLEDGE_BASE_PATH=/path/to/your/knowledge-base
```

**❌ 避免真实路径**：
```markdown
# 不要在文档中使用真实路径
# KNOWLEDGE_BASE_PATH=/Users/xujian/Library/Mobile Documents/...
```

---

## 🛡️ 提交前检查清单

在提交代码到Git前，检查以下内容：

### 代码检查

- [ ] 确认没有硬编码的本地路径
- [ ] 确认没有硬编码的API密钥
- [ ] 确认敏感信息从环境变量读取
- [ ] 确认 `.env` 在 `.gitignore` 中

### 文档检查

- [ ] 确认文档中使用占位符而非真实路径
- [ ] 确认没有包含用户名、邮箱等个人信息
- [ ] 确认没有包含内部IP地址或域名

### 配置检查

- [ ] 确认 `.env.example` 已更新
- [ ] 确认 `.gitignore` 包含敏感文件
- [ ] 确认没有提交实际的 `.env` 文件

---

## 🔍 常见安全问题

### 问题1: 硬编码路径

**风险**：暴露用户名、目录结构

**解决方案**：
```typescript
// ❌ 错误
const path = '/Users/xujian/projects/YunPat';

// ✅ 正确
const path = process.env.YUNPAT_ROOT || '.';
```

### 问题2: API密钥泄露

**风险**：密钥被盗用，产生费用

**解决方案**：
```typescript
// ❌ 错误
const apiKey = 'sk-abc123...';

// ✅ 正确
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  throw new Error('DEEPSEEK_API_KEY not set');
}
```

### 问题3: 个人信息泄露

**风险**：暴露邮箱、手机号等

**解决方案**：
- 使用占位符：`your-email@example.com`
- 使用示例数据：`John Doe` 而非真实姓名

---

## 📋 敏感文件列表

以下文件类型**不应提交到Git**：

```
.env                    # 环境变量
.env.local             # 本地环境变量
*.key                  # 密钥文件
*.pem                  # 证书文件
credentials.json       # 凭证文件
config/secrets.yml     # 密密配置
*.log                  # 日志文件（可能包含敏感信息）
```

---

## ✅ 安全最佳实践

### 1. 最小权限原则

只授予必要的权限，避免过度授权。

### 2. 密钥轮换

定期更换API密钥，特别是怀疑泄露时。

### 3. 审计日志

记录敏感操作，便于追踪问题。

### 4. 代码审查

提交前让同事审查，避免遗漏敏感信息。

### 5. 自动化检查

使用工具自动检测敏感信息：

```bash
# 安装 git-secrets
brew install git-secrets

# 配置检测规则
git secrets --add 'DEEPSEEK_API_KEY.*sk-'
git secrets --add '/Users/xujian'

# 扫描历史
git secrets --scan
```

---

## 🚨 事件响应

如果发现敏感信息已泄露：

1. **立即更换密钥**：所有可能泄露的API密钥
2. **修改配置**：更新访问控制
3. **审查日志**：检查是否有异常访问
4. **通知团队**：告知相关人员
5. **清理历史**：使用 `git filter-branch` 或 `BFG Repo-Cleaner` 清除Git历史

---

**© 2026 YunPat - 安全第一，保护隐私**
