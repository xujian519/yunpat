# GLM 模型快速开始

## 1 分钟配置

```bash
# 1. 设置 API Key
export GLM_API_KEY=your_api_key_here

# 2. 运行测试
./test-glm.sh
```

## 5 分钟示例

```typescript
import { createZhipuModel, NativeModel } from '@yunpat/core'

// 创建模型
const glm = createZhipuModel(process.env.GLM_API_KEY!, NativeModel.GLM_4_FLASH)

// 代码生成
const response = await glm.chat({
  messages: [
    {
      role: 'user',
      content: '用 TypeScript 写一个快速排序算法',
    },
  ],
  temperature: 0.2,
})

console.log(response.content)
```

## 支持的模型

- `glm-4-flash` - 快速响应（推荐测试）
- `glm-4-plus` - 平衡性能（推荐日常）
- `glm-4.7` - 最新旗舰（推荐生产）

## 更多文档

完整使用指南: [docs/guides/glm-usage.md](docs/guides/glm-usage.md)
