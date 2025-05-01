# DeepSeek API Key 故障排除指南

## ✅ 当前状态

- **API Key 验证**：✅ 成功
- **API Key 格式**：✅ 正确（以 `sk-` 开头）
- **基本连接**：✅ 正常
- **问题**：❌ "Insufficient balance or no resource package. Please recharge."

---

## 🔍 问题分析

### 错误含义

```
Insufficient balance or no resource package. Please recharge.
```

这个错误表示：

1. **账户余额不足** - API调用费用超出账户余额
2. **未购买资源包** - DeepSeek可能需要购买资源包才能使用
3. **配额限制** - 达到了免费额度或付费额度上限

---

## 💡 解决方案

### 方案1：检查并充值余额（推荐）

#### 步骤1：登录DeepSeek控制台

```
https://platform.deepseek.com/
```

#### 步骤2：查看余额和使用情况

```
https://platform.deepseek.com/usage
```

#### 步骤3：充值（如余额不足）

```
https://platform.deepseek.com/topup
```

**充值建议**：

- **最低额度**：¥10-50（个人测试用）
- **推荐额度**：¥100-500（小型项目）
- **生产环境**：¥1000+（根据实际用量）

---

### 方案2：购买资源包

DeepSeek可能提供资源包（预付费套餐），通常比按需付费更优惠。

#### 如何购买

1. 登录控制台：https://platform.deepseek.com/
2. 进入"套餐"或"资源包"页面
3. 选择适合的套餐

---

### 方案3：优化API使用以减少费用

#### 1. 使用更便宜的模型

```typescript
// 当前代码可能使用（较贵）
const llm = createDeepSeekModel(apiKey, {
  model: 'deepseek-coder', // 编码模型，可能更贵
})

// 改为使用（更便宜）
const llm = createDeepSeekModel(apiKey, {
  model: 'deepseek-chat', // 标准聊天模型
})
```

#### 2. 减少Token使用

```typescript
// 优化前（使用大量token）
const llm = createDeepSeekModel(apiKey, {
  model: 'deepseek-chat',
  maxTokens: 4000, // 每次请求最多4000个输出token
})

// 优化后（减少token）
const llm = createDeepSeekModel(apiKey, {
  model: 'deepseek-chat',
  maxTokens: 1000, // 减少到1000个token
})
```

#### 3. 启用缓存（如果支持）

```typescript
// 检查是否支持缓存功能
const llm = createDeepSeekModel(apiKey, {
  model: 'deepseek-chat',
  cache: true, // 某些API提供缓存可以减少费用
})
```

---

### 方案4：使用备用API提供商

如果DeepSeek费用过高，可以考虑切换到其他提供商：

```typescript
// 选项1：使用OpenAI（需要API Key）
import { createOpenAIModel } from '@yunpat/llm'
const llm = createOpenAIModel(process.env.OPENAI_API_KEY)

// 选项2：使用智谱AI（GLM）
import { createGLMModel } from '@yunpat/llm'
const llm = createGLMModel(process.env.GLM_API_KEY)

// 选项3：使用Ollama（本地免费）
import { createOllamaModel } from '@yunpat/llm'
const llm = createOllamaModel('http://localhost:11434')
```

---

## 📊 费用参考

### DeepSeek定价（参考）

| 模型           | 输入费用         | 输出费用         |
| -------------- | ---------------- | ---------------- |
| deepseek-chat  | ¥0.001/1K tokens | ¥0.002/1K tokens |
| deepseek-coder | ¥0.002/1K tokens | ¥0.004/1K tokens |

**估算示例**：

- 一次专利撰写（约10K tokens）：约 ¥0.02-0.05
- 100次专利撰写：约 ¥2-5
- 月度小型项目：约 ¥10-50

---

## 🧪 测试API调用

### 测试脚本

运行以下命令测试API调用：

```bash
node scripts/check-api-key.js
```

### 诊断测试

如果仍有问题，运行详细诊断：

```bash
# 设置详细日志
export DEBUG=deepseek:*

# 运行测试
node scripts/check-api-key.js
```

---

## 📝 后续步骤

### 立即行动

1. ✅ **登录控制台**：https://platform.deepseek.com/
2. ✅ **检查余额**：https://platform.deepseek.com/usage
3. ✅ **充值或购买资源包**：https://platform.deepseek.com/topup
4. ✅ **重新测试**：运行 `node scripts/check-api-key.js`

### 预防措施

1. **监控用量**：定期查看控制台的用量统计
2. **设置预算**：在控制台设置消费上限和告警
3. **优化代码**：减少不必要的API调用
4. **使用缓存**：对重复请求使用缓存

---

## 🆘 仍然无法解决？

### 联系DeepSeek支持

- **官网**：https://www.deepseek.com/
- **文档**：https://platform.deepseek.com/docs
- **客服**：通过控制台的"帮助"或"客服"入口

### 临时解决方案

在解决API问题期间，可以：

1. 使用模拟数据进行开发和测试
2. 切换到本地模型（如Ollama）
3. 使用其他免费或低价API提供商

---

## 📋 快速检查清单

使用此清单快速诊断问题：

- [ ] API Key格式正确（以`sk-`开头）
- [ ] API Key未过期
- [ ] 账户余额 > ¥0
- [ ] 已购买资源包（如需要）
- [ ] 网络连接正常
- [ ] 防火墙未阻止API调用
- [ ] 使用了正确的API端点
- [ ] 未超过并发限制
- [ ] 未超过速率限制

---

**最后更新**：2026-05-03
**相关文档**：

- [DeepSeek API文档](https://platform.deepseek.com/docs)
- [DeepSeek定价页面](https://platform.deepseek.com/pricing)
