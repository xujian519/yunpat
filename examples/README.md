# PatentWriterAgent 集成测试

本目录包含 PatentWriterAgent 的集成测试示例，用于验证知识库增强和提示词模板懒加载功能。

## 前置条件

### 1. 环境变量配置

在项目根目录创建 `.env` 文件：

```bash
# DeepSeek API Key (必需)
DEEPSEEK_API_KEY=sk-your-api-key-here

# 宝宸知识库路径 (必需)
KNOWLEDGE_BASE_PATH=/path/to/your/baochen-knowledge-base

# 提示词模板目录 (可选，默认为 ./prompts/patent-drafting)
PROMPT_TEMPLATES_DIR=./prompts/patent-drafting
```

### 2. 安装依赖

```bash
pnpm install
pnpm build
```

### 3. 准备知识库

确保宝宸知识库已下载到本地，并设置正确的路径。

知识库应该包含以下结构：
```
baochen-knowledge-base/
├── Wiki/
│   ├── 专利实务/
│   │   ├── 撰写/
│   │   ├── 创造性/
│   │   ├── 说明书/
│   │   └── ...
│   └── 复审无效/
│       ├── 创造性/
│       ├── 新颖性/
│       └── ...
└── ...
```

## 运行测试

### 方式1: 使用 ts-node 直接运行

```bash
# 安装 ts-node (如果尚未安装)
pnpm add -D ts-node

# 运行集成测试
npx ts-node examples/integration-test.ts
```

### 方式2: 编译后运行

```bash
# 编译项目
pnpm build

# 运行编译后的测试
node examples/dist/integration-test.js
```

### 方式3: 使用 VS Code 调试

1. 在 VS Code 中打开 `examples/integration-test.ts`
2. 按 F5 开始调试
3. 在代码中设置断点进行调试

## 测试内容

### 1. 完整集成测试 (`runIntegrationTest`)

测试完整的专利撰写流程，包括：
- ✅ 知识库增强
- ✅ 提示词模板懒加载
- ✅ 权利要求生成
- ✅ 说明书撰写
- ✅ 质量评估

**输出**：
- 撰写耗时
- 权利要求数量
- 说明书字数
- 质量评分
- 权利要求预览
- 摘要预览

### 2. 懒加载策略测试 (`testLazyLoadingStrategy`)

专门测试提示词模板的分步加载策略：
- Stage 1: 预加载创造性分析模板
- Stage 2: 按需加载权利要求模板
- Stage 3: 按需加载说明书模板
- Stage 4: 懒加载所有模板

**输出**：
- 各阶段的模板加载情况
- 缓存统计信息
- 加载时间

### 3. 知识库增强测试 (`testKnowledgeEnhancement`)

专门测试知识库查询和增强功能：
- 查询"什么是创造性"
- 查询"什么是充分公开"
- 知识卡片内容增强

**输出**：
- 知识库查询结果
- 增强后的分析内容

## 测试案例

### 睿羿科技案例 - 便携式智能牙刷

这是一个真实的技术交底书案例，包含：

**技术领域**：日用品/智能家居

**核心创新点**：
1. 磁吸式防水充电接口
2. 压力传感器保护牙龈
3. 手机APP数据记录
4. 超声波震动技术

**技术效果**：
- 便携性提升30%
- 防水等级IPX7
- 清洁效率提升50%
- 续航90天

## 预期输出

```
🧪 [集成测试] PatentWriterAgent 知识库增强 + 懒加载

1️⃣ 初始化 LLM...
   ✅ LLM 初始化完成

2️⃣ 初始化 PatentWriterAgent...
[PatentWriterAgent] 知识库已启用
[PatentWriterAgent] 提示词模板已启用
   ✅ Agent 初始化完成

3️⃣ 检查初始缓存状态...
   提示词模板缓存: { templates: 0, loadedAt: [] }
   知识库缓存: { cards: 0, pages: 0 }

4️⃣ 执行专利撰写...
   ========================================

📝 [专利撰写] 步骤1: 规划阶段
   发明名称: 一种便携式智能牙刷及其控制方法
   技术领域: 日用品/智能家居
   申请人: 睿羿科技有限公司
[PatentWriterAgent] 已预加载创造性分析模板
[PatentWriterAgent] 使用知识库增强分析

✍️ [专利撰写] 步骤2: 执行阶段
   1️⃣ 生成权利要求...
[PatentWriterAgent] 加载权利要求生成模板...
      ✅ 生成了 5 项权利要求
   2️⃣ 生成说明书...
[PatentWriterAgent] 加载说明书撰写模板...
      ✅ 说明书长度：3500 字
   3️⃣ 生成摘要...
      ✅ 摘要长度：180 字
   4️⃣ 生成附图说明...
      ✅ 附图说明完成

🤔 [专利撰写] 步骤3: 质量检查
[PatentWriterAgent] 加载所有模板用于质量评估...

   ========================================
   ✅ 专利撰写完成

5️⃣ 撰写结果统计:
   ⏱️  耗时: 45秒
   📝 权利要求数: 5
   📄 说明书字数: 3500
   ⭐ 质量评分: 90/100

6️⃣ 检查最终缓存状态...
   提示词模板缓存:
     已加载: 3个
     - 01-claims-generation: 2026-04-28T10:30:00.000Z
     - 02-specification-drafting: 2026-04-28T10:30:15.000Z
     - 03-creativity-analysis: 2026-04-28T10:29:55.000Z
   知识库缓存:
     卡片: 2个
     页面: 5个

7️⃣ 权利要求预览:
   1. [独立]
      一种便携式智能牙刷，其特征在于，包括：手柄部，内置可充电电池...
   2. [从属]
      根据权利要求1所述的便携式智能牙刷，其特征在于，所述刷头部...

8️⃣ 摘要预览:
      本发明公开了一种便携式智能牙刷及其控制方法，包括手柄部...

✅ 集成测试完成！
```

## 故障排查

### 问题1: 知识库路径错误

```
Error: ENOENT: no such file or directory
```

**解决方法**：
- 检查 `.env` 文件中的 `KNOWLEDGE_BASE_PATH` 是否正确
- 确保知识库目录存在且可访问

### 问题2: API Key 无效

```
Error: Invalid API key
```

**解决方法**：
- 检查 `.env` 文件中的 `DEEPSEEK_API_KEY` 是否正确
- 确保账号有足够的额度

### 问题3: 提示词模板加载失败

```
Error: Template 01-claims-generation.md not found
```

**解决方法**：
- 检查 `prompts/patent-drafting/` 目录是否存在
- 确保三个模板文件都已创建：
  - `01-claims-generation.md`
  - `02-specification-drafting.md`
  - `03-creativity-analysis.md`

### 问题4: 编译错误

```
Error: Cannot find module '@yunpat/core'
```

**解决方法**：
- 运行 `pnpm install` 安装依赖
- 运行 `pnpm build` 构建项目

## 性能指标

根据设计目标，预期性能：

| 指标 | 目标值 | 实际值 |
|------|--------|--------|
| 撰写耗时 | < 60秒 | 待测试 |
| 权利要求数 | 3-5项 | 待测试 |
| 说明书字数 | 2000-5000字 | 待测试 |
| 质量评分 | > 80分 | 待测试 |
| 内存占用 | < 500MB | 待测试 |
| 模板加载时间 | < 100ms/个 | 待测试 |

## 下一步

测试通过后，可以：

1. **优化性能**
   - 调整模板加载策略
   - 优化知识库查询
   - 实现结果缓存

2. **扩展功能**
   - 添加更多提示词模板
   - 支持更多发明类型
   - 实现多语言支持

3. **实际应用**
   - 用于真实专利撰写
   - 收集用户反馈
   - 持续改进质量

## 联系方式

如有问题，请联系：
- 项目维护者: 徐健 (xujian519@gmail.com)
- 项目地址: /Users/xujian/projects/YunPat
