# GLM-4.7 快速开始指南

> 5分钟快速配置并使用智谱 GLM-4.7 进行专利撰写

---

## 🚀 快速开始（3步）

### 步骤1：获取 API Key（2分钟）

1. **访问智谱AI开放平台**

   ```
   https://open.bigmodel.cn/
   ```

2. **注册并登录**
   - 使用手机号注册
   - 完成实名认证

3. **获取 API Key**
   - 进入"API密钥"页面
   - 点击"新增API Key"
   - 复制 API Key（格式：`1234567890.abcdef...`）

### 步骤2：配置环境变量（1分钟）

创建 `.env.glm` 文件：

```bash
# 复制示例文件
cp .env.glm.example .env.glm

# 编辑文件，填入你的 API Key
# GLM_API_KEY=1234567890.abcdef...
```

或者直接设置环境变量：

```bash
export GLM_API_KEY=your_api_key_here
export GLM_MODEL=glm-4.7
```

### 步骤3：验证配置（2分钟）

运行测试脚本：

```bash
npm run api:check-glm
```

**预期输出**：

```
🔑 正在验证智谱 GLM API Key...

📋 配置信息：
   模型：glm-4.7
   API Key：1234567890...abcdef...

✅ API Key 验证成功！

📊 响应状态： 200 OK
✨ API Key 可以正常使用

💬 模型回复：
   "你好！我是智谱AI的助手，很高兴为您服务。"

💡 提示：
  - 模型已就绪，可以开始使用
  - 查看控制台：https://open.bigmodel.cn/usercenter
  - 查看用量：https://open.bigmodel.cn/usercenter/apikeys
```

---

## 💡 立即使用

### 方式1：在代码中使用

```typescript
import { createZhipuModel, NativeModel } from '@yunpat/core'

// 创建 GLM-4.7 模型
const llm = createZhipuModel(process.env.GLM_API_KEY!, NativeModel.GLM_4_7)

// 调用模型
const response = await llm.chat([
  {
    role: 'user',
    content: '请帮我分析这个技术方案的创新点：...',
  },
])

console.log(response.content)
```

### 方式2：运行示例

```bash
# 设置环境变量
export GLM_API_KEY=your_api_key

# 运行专利撰写示例
tsx examples/usage-glm-4-7-patent.ts
```

### 方式3：在 CLI 中使用

```bash
# 设置环境变量
export GLM_API_KEY=your_api_key

# 使用 GLM-4.7 撰写专利
yunpat patent write \
  --model glm-4.7 \
  --input disclosure.md \
  --output patent.md
```

---

## 📊 费用说明

### GLM-4.7 定价

| 项目       | 价格            |
| ---------- | --------------- |
| 输入 Token | ¥0.05/1K tokens |
| 输出 Token | ¥0.1/1K tokens  |

### 费用估算

**单次专利撰写**：

- 发明理解：5K tokens → ¥0.25
- 说明书撰写：10K tokens → ¥0.5
- 权利要求：3K tokens → ¥0.15
- **总计**：约 **¥0.9**

**月度估算**：

- 10个专利：约 ¥9
- 50个专利：约 ¥45
- 100个专利：约 ¥90

---

## 🎯 推荐配置

### 专利撰写场景

```typescript
const llm = createZhipuModel(apiKey, NativeModel.GLM_4_7)

const response = await llm.chat(messages, {
  temperature: 0.3, // 低温度保证稳定性
  top_p: 0.9, // 控制多样性
  max_tokens: 4000, // 足够的输出长度
})
```

### 快速测试场景

```typescript
// 使用 glm-4-flash（更快、更便宜）
const llm = createZhipuModel(apiKey, NativeModel.GLM_4_FLASH)

const response = await llm.chat(messages, {
  temperature: 0.5,
  max_tokens: 1000,
})
```

---

## ⚠️ 常见问题

### Q1: API Key 格式错误

**错误**：`API key format error`

**解决**：

- 确认格式为 `id.secret...`
- 不要有多余空格
- 重新生成 API Key

### Q2: 余额不足

**错误**：`Insufficient balance`

**解决**：

1. 登录控制台查看余额
2. 充值或购买套餐
3. 新用户可领取免费额度

### Q3: 模型不存在

**错误**：`Model not found`

**解决**：

1. 确认模型名称：`glm-4.7`
2. 检查是否有权限访问
3. 尝试使用 `glm-4-flash`

---

## 📚 更多资源

### 完整文档

- **详细配置指南**：[GLM-4-7-SETUP.md](./GLM-4-7-SETUP.md)
- **API故障排除**：[API-KEY-TROUBLESHOOTING.md](./API-KEY-TROUBLESHOOTING.md)

### 官方资源

- **智谱AI官网**：https://open.bigmodel.cn/
- **API文档**：https://open.bigmodel.cn/dev/api
- **定价页面**：https://open.bigmodel.cn/pricing
- **控制台**：https://open.bigmodel.cn/usercenter

### 示例代码

- **专利撰写示例**：`examples/usage-glm-4-7-patent.ts`
- **其他示例**：`examples/` 目录

---

## ✅ 检查清单

配置完成后，确认以下项：

- [ ] 已注册智谱AI账号
- [ ] 已完成实名认证
- [ ] 已创建 API Key
- [ ] 已设置环境变量
- [ ] 已运行测试并通过
- [ ] 已了解定价和费用
- [ ] 已运行示例代码

---

## 🎉 开始使用

配置完成后，你可以：

1. **运行测试**：`npm run api:check-glm`
2. **查看示例**：`tsx examples/usage-glm-4-7-patent.ts`
3. **开始撰写**：使用 GLM-4.7 撰写专利

---

**预计配置时间**：5分钟
**预计费用**：单次专利撰写约 ¥1
**下一步**：运行 `npm run api:check-glm` 验证配置

---

**最后更新**：2026-05-03
