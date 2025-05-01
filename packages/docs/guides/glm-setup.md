# GLM 模型配置和使用指南

> **智谱 GLM** 系列 - 包含最新 GLM-5.1、GLM-4.7-Flash、GLM-4.7、GLM-4.6-V

---

## 📋 支持的模型

### GLM 模型系列

| 模型              | 特点                       | 适用场景                   | 推荐度     |
| ----------------- | -------------------------- | -------------------------- | ---------- |
| **glm-5.1**       | 2026最新旗舰，综合能力最强 | 复杂专利撰写、深度技术分析 | ⭐⭐⭐⭐⭐ |
| **glm-4.7-flash** | 极速响应，性价比最高       | 快速专利撰写、实时分析     | ⭐⭐⭐⭐⭐ |
| **glm-4.7**       | 2025旗舰，综合能力强       | 标准专利撰写、技术分析     | ⭐⭐⭐⭐   |
| **glm-4.6-v**     | 视觉增强版                 | 图像相关专利、多模态任务   | ⭐⭐⭐⭐   |

### 推荐配置

- **最佳质量**：glm-5.1
- **性价比最高**：glm-4.7-flash
- **快速响应**：glm-4.7-flash

---

## 🚀 快速开始

### 步骤1：获取 API Key

1. 访问 https://open.bigmodel.cn/
2. 注册并完成实名认证
3. 创建 API Key（格式：id.secret...）

### 步骤2：配置环境变量

```bash
export GLM_API_KEY=your_api_key
export GLM_MODEL=glm-4.7-flash
```

### 步骤3：验证配置

```bash
npm run api:check-glm
```

---

## 💻 使用示例

```typescript
import { createZhipuModel, NativeModel } from '@yunpat/core'

// 性价比最高（推荐）
const llm = createZhipuModel(apiKey, NativeModel.GLM_4_7_FLASH)

// 最佳质量
const llmBest = createZhipuModel(apiKey, NativeModel.GLM_5_1)

// 视觉增强
const llmVision = createZhipuModel(apiKey, NativeModel.GLM_4_6_V)
```

---

## 💰 定价参考

| 模型              | 输入     | 输出     | 单次专利     |
| ----------------- | -------- | -------- | ------------ |
| **glm-5.1**       | ¥0.05/1K | ¥0.1/1K  | ¥0.9         |
| **glm-4.7-flash** | ¥0.01/1K | ¥0.02/1K | **¥0.18** ⭐ |
| **glm-4.7**       | ¥0.05/1K | ¥0.1/1K  | ¥0.9         |
| **glm-4.6-v**     | ¥0.05/1K | ¥0.1/1K  | ¥0.9         |

---

## 🎯 推荐配置

**快速批量生成（推荐）**：

```typescript
const llm = createZhipuModel(apiKey, NativeModel.GLM_4_7_FLASH)
```

**高质量专利撰写**：

```typescript
const llm = createZhipuModel(apiKey, NativeModel.GLM_5_1)
```

---

**最后更新**：2026-05-03
**推荐模型**：glm-4.7-flash（性价比最高）
