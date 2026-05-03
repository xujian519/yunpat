# GLM-4.7 配置和使用指南

> **智谱 GLM-4.7** 是2025年最新的旗舰模型，在专利撰写、技术分析等任务中表现优异

---

## 📋 快速开始

### 步骤1：获取 API Key

1. **访问智谱AI开放平台**
   ```
   https://open.bigmodel.cn/
   ```

2. **注册/登录账号**
   - 使用手机号注册
   - 完成实名认证（需要身份证）
   - 登录控制台

3. **创建 API Key**
   - 进入"API密钥"页面
   - 点击"新增API Key"
   - 复制生成的API Key（格式：`id.secret...`）

4. **领取免费额度**
   - 新用户通常有免费试用额度
   - 查看"账户中心"了解余额

---

### 步骤2：配置环境变量

#### 方式1：创建 .env 文件（推荐）

在项目根目录创建 `.env` 文件：

```bash
# GLM (智谱 AI) API 配置
GLM_API_KEY=your_glm_api_key_here
GLM_MODEL=glm-4.7
```

**替换 `your_glm_api_key_here` 为你的实际 API Key**

#### 方式2：直接设置环境变量

```bash
export GLM_API_KEY=your_glm_api_key_here
export GLM_MODEL=glm-4.7
```

---

### 步骤3：验证配置

运行测试脚本：

```bash
node scripts/check-glm-api.js
```

**预期输出**：
```
🔑 正在验证智谱 GLM API Key...

✅ API Key 格式正确
✅ API 连接成功
✅ GLM-4.7 模型可用

📊 账户信息：
  - 模型：glm-4.7
  - 状态：正常
```

---

## 💻 使用示例

### 基础使用

```typescript
import { createZhipuModel } from '@yunpat/core'

// 创建 GLM-4.7 模型实例
const llm = createZhipuModel(process.env.GLM_API_KEY, 'glm-4.7')

// 调用模型
const response = await llm.chat([
  {
    role: 'user',
    content: '请帮我分析这个技术方案的创新点：...'
  }
])

console.log(response.content)
```

### 在专利撰写中使用

```typescript
import { PatentWriterAgent } from '@yunpat/agent-patent-writer'
import { createZhipuModel } from '@yunpat/core'

// 使用 GLM-4.7 进行专利撰写
const llm = createZhipuModel(process.env.GLM_API_KEY, 'glm-4.7')

const agent = new PatentWriterAgent({
  name: 'patent-writer-glm',
  llm: llm,
  // ... 其他配置
})

// 执行专利撰写任务
const result = await agent.execute({
  inventionTitle: '一种基于深度学习的图像识别方法',
  technicalField: '人工智能',
  // ... 其他参数
})
```

### CLI 使用

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

## 🎯 GLM-4.7 优势

### 专利撰写场景

| 能力 | GLM-4.7 | 说明 |
|------|---------|------|
| **技术理解** | ⭐⭐⭐⭐⭐ | 深度理解复杂技术方案 |
| **专业术语** | ⭐⭐⭐⭐⭐ | 准确使用专利术语 |
| **逻辑结构** | ⭐⭐⭐⭐⭐ | 符合专利撰写规范 |
| **创新点分析** | ⭐⭐⭐⭐⭐ | 精准识别技术创新点 |
| **权利要求** | ⭐⭐⭐⭐⭐ | 撰写清晰的权利要求 |

### 与其他模型对比

| 模型 | 技术理解 | 文本质量 | 速度 | 成本 |
|------|---------|---------|------|------|
| **GLM-4.7** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 中等 |
| DeepSeek | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 低 |
| Qwen | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 中等 |

**推荐**：专利撰写使用 GLM-4.7，成本敏感场景使用 DeepSeek

---

## 💰 定价参考

### GLM-4.7 定价（2025年）

| 计费项 | 价格 | 说明 |
|--------|------|------|
| **输入 Token** | ¥0.05/1K tokens | 约等于500个汉字 |
| **输出 Token** | ¥0.1/1K tokens | 约等于500个汉字 |

### 费用估算

**专利撰写示例**：
- 发明理解：约5K tokens → ¥0.25-0.5
- 说明书撰写：约10K tokens → ¥0.5-1
- 权利要求：约3K tokens → ¥0.15-0.3
- **单次专利撰写总计**：约 ¥1-2

**月度估算**：
- 小型项目（10个专利）：¥10-20
- 中型项目（50个专利）：¥50-100
- 大型项目（100个专利）：¥100-200

---

## 🔧 高级配置

### 自定义配置

```typescript
import { NativeLLMAdapter, NativeModel } from '@yunpat/core'

const llm = new NativeLLMAdapter({
  name: NativeModel.GLM_4_7,
  apiKey: process.env.GLM_API_KEY!,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4/', // 自定义端点
  timeout: 60000, // 超时时间（毫秒）
  maxRetries: 3, // 最大重试次数
})
```

### 模型参数调优

```typescript
const response = await llm.chat(
  [
    {
      role: 'user',
      content: '请撰写专利说明书...'
    }
  ],
  {
    temperature: 0.3, // 控制随机性（0-1，专利撰写建议0.3-0.5）
    top_p: 0.9, // 核采样
    max_tokens: 4000, // 最大输出长度
  }
)
```

### 参数说明

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `temperature` | 0.3-0.5 | 专利撰写需要确定性输出 |
| `top_p` | 0.9-0.95 | 控制多样性 |
| `max_tokens` | 2000-4000 | 根据输出需求调整 |

---

## 🧪 测试脚本

### 运行完整测试

```bash
# 测试 API 连接
node scripts/check-glm-api.js

# 测试专利撰写功能
pnpm test -- --grep "GLM"
```

### 手动测试

创建测试文件 `test-glm.js`：

```javascript
import { createZhipuModel } from './packages/core/dist/index.js'

const llm = createZhipuModel(process.env.GLM_API_KEY, 'glm-4.7')

async function test() {
  const response = await llm.chat([
    {
      role: 'user',
      content: '请简要说明什么是人工智能？'
    }
  ])

  console.log('回答：', response.content)
}

test().catch(console.error)
```

运行测试：

```bash
node test-glm.js
```

---

## 📊 性能优化

### 提速技巧

1. **使用 GLM-4-Flash**（快速响应）
   ```typescript
   const llm = createZhipuModel(apiKey, 'glm-4-flash')
   ```

2. **减少 Token 使用**
   ```typescript
   // 精简提示词
   const prompt = '撰写专利说明书' // 而不是长篇大论的说明
   ```

3. **启用缓存**（如果支持）
   ```typescript
   const llm = createZhipuModel(apiKey, 'glm-4.7', {
     cache: true
   })
   ```

### 降本技巧

1. **混合使用模型**
   - 技术理解：GLM-4.7
   - 初稿撰写：GLM-4-Flash
   - 格式调整：DeepSeek

2. **批量处理**
   ```typescript
   // 一次请求处理多个任务
   const tasks = [
     '撰写权利要求1',
     '撰写权利要求2',
     '撰写权利要求3'
   ].join('\n')

   const response = await llm.chat([{ role: 'user', content: tasks }])
   ```

---

## ⚠️ 常见问题

### 问题1：API Key 无效

**错误**：`API key format error`

**解决**：
1. 检查 API Key 格式（应为 `id.secret...`）
2. 确认没有多余的空格
3. 重新生成 API Key

### 问题2：余额不足

**错误**：`Insufficient balance`

**解决**：
1. 登录控制台查看余额
2. 充值或购买套餐
3. 领取新用户免费额度

### 问题3：模型不存在

**错误**：`Model not found`

**解决**：
1. 确认模型名称正确（`glm-4.7`）
2. 检查是否有权限访问该模型
3. 尝试使用 `glm-4-flash` 测试

### 问题4：超时错误

**错误**：`Request timeout`

**解决**：
1. 增加超时时间配置
2. 检查网络连接
3. 减少请求内容长度

---

## 📚 相关资源

### 官方文档

- **智谱AI开放平台**：https://open.bigmodel.cn/
- **API文档**：https://open.bigmodel.cn/dev/api
- **定价页面**：https://open.bigmodel.cn/pricing
- **控制台**：https://open.bigmodel.cn/usercenter

### 项目资源

- **测试脚本**：`scripts/check-glm-api.js`
- **使用示例**：`examples/usage-*.ts`
- **配置示例**：`.env.example`

---

## ✅ 配置检查清单

使用此清单确认配置完成：

- [ ] 已注册智谱AI账号
- [ ] 已完成实名认证
- [ ] 已创建 API Key
- [ ] 已设置环境变量（`GLM_API_KEY`）
- [ ] 已运行测试脚本验证
- [ ] 已了解定价和费用
- [ ] 已配置超时和重试参数
- [ ] 已测试专利撰写功能

---

## 🎉 下一步

配置完成后，你可以：

1. **运行测试**：`node scripts/check-glm-api.js`
2. **查看示例**：`examples/` 目录下的使用示例
3. **开始撰写**：使用 GLM-4.7 撰写第一个专利
4. **优化配置**：根据实际需求调整参数

---

**最后更新**：2026-05-03
**相关文档**：
- [DeepSeek配置指南](API-KEY-TROUBLESHOOTING.md)
- [模型选择指南](MODEL-SELECTION.md)
