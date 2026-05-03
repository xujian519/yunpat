# CodeGeeX 编程套餐配置和使用指南

> **智谱 CodeGeeX** 是专门针对代码任务的AI模型，使用独立的编程端点

---

## 📋 快速开始

### 步骤1：获取 API Key

1. **访问智谱AI开放平台**
   ```
   https://open.bigmodel.cn/
   ```

2. **注册/登录账号**
   - 使用手机号注册
   - 完成实名认证
   - 登录控制台

3. **开通 CodeGeeX 编程套餐**
   - 进入"产品"页面
   - 选择"CodeGeeX 编程套餐"
   - 开通服务（可能需要单独申请）

4. **创建 API Key**
   - 进入"API密钥"页面
   - 点击"新增API Key"
   - 复制生成的API Key（格式：`id.secret...`）

**注意**：CodeGeeX 编程套餐可能需要单独开通，与通用 GLM 模型不同。

---

### 步骤2：配置环境变量

#### 方式1：创建 .env 文件

在项目根目录创建 `.env` 文件：

```bash
# GLM API Key（与通用模型共用）
GLM_API_KEY=your_glm_api_key_here

# CodeGeeX 模型选择
CODEGEEX_MODEL=codegeex-4
```

#### 方式2：直接设置环境变量

```bash
export GLM_API_KEY=your_glm_api_key_here
export CODEGEEX_MODEL=codegeex-4
```

---

### 步骤3：验证配置

运行测试脚本：

```bash
npm run api:check-codegeex
```

**预期输出**：

```
🔑 正在验证智谱 CodeGeeX 编程套餐 API Key...

📋 配置信息：
   端点：https://open.bigmodel.cn/api/coding/paas/v4
   模型：codegeex-4
   API Key：1234567890...abcdef...

✅ CodeGeeX API Key 验证成功！

📊 响应状态： 200 OK
✨ 编程套餐可以正常使用

💬 代码生成示例：
──────────────────────────────────────────────────────────────
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
──────────────────────────────────────────────────────────────

💡 提示：
  - CodeGeeX 编程套餐已就绪
  - 专门用于代码生成、理解、分析等任务
  - 查看控制台：https://open.bigmodel.cn/usercenter
```

---

## 💻 使用示例

### 基础使用

```typescript
import { createZhipuCodingModel, NativeModel } from '@yunpat/core'

// 创建 CodeGeeX 模型实例
const llm = createZhipuCodingModel(process.env.GLM_API_KEY!, NativeModel.CODEGEEX_4)

// 代码生成
const response = await llm.chat([
  {
    role: 'user',
    content: '请用Python写一个快速排序算法'
  }
])

console.log(response.content)
```

### 代码理解

```typescript
const llm = createZhipuCodingModel(apiKey, NativeModel.CODEGEEX_4)

const code = `
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)
`

const response = await llm.chat([
  {
    role: 'user',
    content: `请分析以下代码的时间和空间复杂度：\n\n${code}`
  }
])
```

### 代码审查

```typescript
const llm = createZhipuCodingModel(apiKey, NativeModel.CODEGEEX_4)

const buggyCode = `
def find_duplicate(arr):
    for i in range(len(arr)):
        for j in range(i+1, len(arr)):
            if arr[i] == arr[j]:
                return arr[i]
    return None
`

const response = await llm.chat([
  {
    role: 'user',
    content: `请审查以下代码并提供优化建议：\n\n${buggyCode}`
  }
], {
  temperature: 0.2, // 代码任务建议使用较低温度
})
```

---

## 🎯 CodeGeeX 模型系列

### 可用模型

| 模型 | 特点 | 适用场景 |
|------|------|---------|
| **codegeex-4** | 最新代码模型 | 综合代码任务（推荐） |
| **codegeex-4-all** | 全能代码模型 | 多语言代码 |
| **codegeex-turbo** | 快速代码模型 | 快速响应、补全 |

### 选择建议

- **通用代码任务**：`codegeex-4`
- **多语言支持**：`codegeex-4-all`
- **快速响应**：`codegeex-turbo`

---

## 🆚 CodeGeeX vs GLM-4.7

### 适用场景对比

| 任务 | CodeGeeX | GLM-4.7 | 推荐 |
|------|----------|---------|------|
| **代码生成** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | CodeGeeX |
| **代码理解** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | CodeGeeX |
| **代码审查** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | CodeGeeX |
| **Bug修复** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | CodeGeeX |
| **专利撰写** | ⭐⭐ | ⭐⭐⭐⭐⭐ | GLM-4.7 |
| **技术分析** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | GLM-4.7 |
| **文档编写** | ⭐⭐ | ⭐⭐⭐⭐⭐ | GLM-4.7 |

### 使用建议

- **代码相关任务** → 使用 CodeGeeX（编程端点）
- **专利撰写任务** → 使用 GLM-4.7（通用端点）
- **混合任务** → 分别使用对应的最优模型

---

## 💰 定价参考

### CodeGeeX 定价（参考）

| 项目 | 价格 | 说明 |
|------|------|------|
| 输入 Token | ¥0.05/1K tokens | 约等于500个汉字 |
| 输出 Token | ¥0.1/1K tokens | 约等于500个汉字 |

### 费用估算

**代码生成示例**：
- 简单函数（100行）：约1K tokens → ¥0.05-0.1
- 复杂算法（300行）：约3K tokens → ¥0.15-0.3
- 完整模块（1000行）：约10K tokens → ¥0.5-1

**月度估算**：
- 轻度使用（100次生成）：¥5-10
- 中度使用（500次生成）：¥25-50
- 重度使用（1000次生成）：¥50-100

---

## 🔧 高级配置

### 自定义参数

```typescript
import { NativeLLMAdapter, NativeModel } from '@yunpat/core'

const llm = new NativeLLMAdapter({
  name: NativeModel.CODEGEEX_4,
  apiKey: process.env.GLM_API_KEY!,
  baseURL: 'https://open.bigmodel.cn/api/coding/paas/v4',
  temperature: 0.2, // 代码生成建议使用较低温度
  maxTokens: 2000,
  timeout: 60000,
})
```

### 参数调优

| 参数 | 代码生成推荐值 | 说明 |
|------|---------------|------|
| `temperature` | 0.2-0.4 | 代码需要确定性，不宜过高 |
| `top_p` | 0.9-0.95 | 控制多样性 |
| `max_tokens` | 1000-2000 | 根据代码长度调整 |

---

## 🧪 测试脚本

### 验证 API 连接

```bash
npm run api:check-codegeex
```

### 运行完整示例

```bash
# 设置环境变量
export GLM_API_KEY=your_api_key

# 运行所有示例
tsx examples/usage-codegeex-coding.ts
```

---

## ⚠️ 常见问题

### 问题1：403 Forbidden

**错误**：API Key 无权访问 CodeGeeX

**解决**：
1. 确认已开通 CodeGeeX 编程套餐
2. 访问 https://open.bigmodel.cn/product/coding
3. 联系客服申请开通

### 问题2：404 Not Found

**错误**：模型不存在

**解决**：
1. 确认模型名称：`codegeex-4` / `codegeex-4-all` / `codegeex-turbo`
2. 确认已开通编程套餐
3. 尝试使用通用模型：`npm run api:check-glm`

### 问题3：代码质量不佳

**问题**：生成的代码有错误或不够优化

**解决**：
1. 降低 `temperature` 到 0.2-0.3
2. 在提示词中提供更具体的要求
3. 添加示例代码作为参考
4. 分步骤生成（先生成框架，再填充细节）

---

## 📚 相关资源

### 官方文档

- **智谱AI官网**：https://open.bigmodel.cn/
- **CodeGeeX产品页**：https://open.bigmodel.cn/product/coding
- **API文档**：https://open.bigmodel.cn/dev/api#cgeex
- **控制台**：https://open.bigmodel.cn/usercenter

### 项目资源

- **验证脚本**：`scripts/check-codegeex-api.js`
- **使用示例**：`examples/usage-codegeex-coding.ts`
- **通用GLM配置**：[GLM-4-7-SETUP.md](./GLM-4-7-SETUP.md)

---

## ✅ 配置检查清单

- [ ] 已注册智谱AI账号
- [ ] 已完成实名认证
- [ ] 已开通 CodeGeeX 编程套餐
- [ ] 已创建 API Key
- [ ] 已设置环境变量
- [ ] 已运行测试脚本验证
- [ ] 已了解定价和费用
- [ ] 已测试代码生成功能

---

## 🎉 下一步

配置完成后，你可以：

1. **验证配置**：`npm run api:check-codegeex`
2. **查看示例**：`tsx examples/usage-codegeex-coding.ts`
3. **开始使用**：在项目中集成 CodeGeeX

---

## 💡 最佳实践

### 代码生成

```typescript
// ✅ 好的做法
const response = await llm.chat([
  {
    role: 'user',
    content: '请用Python写一个快速排序算法，要求：\n' +
             '1. 包含详细注释\n' +
             '2. 添加类型提示\n' +
             '3. 包含测试用例'
  }
], {
  temperature: 0.2,
  max_tokens: 1000
})
```

### 代码审查

```typescript
// ✅ 好的做法
const response = await llm.chat([
  {
    role: 'user',
    content: '请审查以下代码，关注：\n' +
             '1. 性能问题\n' +
             '2. 安全隐患\n' +
             '3. 代码规范\n' +
             '4. 可维护性\n\n' +
             code
  }
], {
  temperature: 0.3
})
```

### Bug 修复

```typescript
// ✅ 好的做法
const response = await llm.chat([
  {
    role: 'user',
    content: '以下代码存在性能问题：\n' +
             '问题描述：当n=50时运行时间过长\n\n' +
             code +
             '\n\n请提供优化后的版本，并说明改进点。'
  }
], {
  temperature: 0.2
})
```

---

**最后更新**：2026-05-03
**编程端点**：https://open.bigmodel.cn/api/coding/paas/v4
**相关文档**：
- [GLM-4.7配置指南](./GLM-4-7-SETUP.md)
- [API故障排除](./API-KEY-TROUBLESHOOTING.md)
