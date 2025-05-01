# YunPat MVP - 快速开始指南

> **版本**: v0.1.0 MVP
> **更新时间**: 2026-05-03

---

## 🚀 5分钟快速上手

### 1. 环境准备

```bash
# 克隆项目
git clone https://github.com/your-org/yunpat.git
cd yunpat

# 安装依赖
pnpm install

# 设置API密钥
export DEEPSEEK_API_KEY=your_key_here
# 或
export OPENAI_API_KEY=your_key_here
```

### 2. 初始化框架

```bash
yunpat init
```

### 3. 运行第一个专利撰写

#### 方式1: 端到端（推荐）

```bash
yunpat draft-full \
  --title "一种基于深度学习的图像识别方法" \
  --field "人工智能" \
  --disclosure examples/disclosure-example.md \
  --output patent-application.json
```

**输出**: 完整的专利申请文件（权利要求书 + 说明书 + 摘要）

#### 方式2: 分步执行（专业用户）

```bash
# Step 1: 发明理解
yunpat draft --title "..." --field "..." --disclosure ... --output invention.json

# Step 2: 现有技术检索
yunpat search --title "..." --field "..." --disclosure ... --output search.json

# Step 3: 说明书撰写（重要：说明书必须在权利要求之前）
yunpat specification \
  --invention-json invention.json \
  --search-json search.json \
  --output specification.json

# Step 4: 权利要求撰写（以说明书为依据）
yunpat claims \
  --invention-json invention.json \
  --search-json search.json \
  --specification-json specification.json \
  --output claims.json

# Step 5: 摘要撰写（总结全文）
yunpat abstract \
  --invention-json invention.json \
  --specification-json specification.json \
  --claims-json claims.json \
  --output abstract.json
```

---

## 📚 核心命令

### 1. 初始化框架

```bash
yunpat init
```

### 2. 完整专利撰写工作流

```bash
yunpat draft-full \
  --title "发明名称" \
  --field "技术领域" \
  --disclosure <技术交底书文件> \
  --output <输出文件>
```

**流程**: 发明理解 → 检索 → 说明书 → 权利要求 → 摘要

### 3. 专利检索

```bash
yunpat search \
  --title "发明名称" \
  --field "技术领域" \
  --disclosure <技术交底书文件> \
  --output <检索报告>
```

### 4. 列出可用智能体

```bash
yunpat list
```

---

## 💡 使用技巧

### 1. 准备高质量的技术交底书

````markdown
# 技术交底书

## 发明名称

[清晰、具体的名称]

## 技术领域

[明确的技术领域]

## 背景技术

[现有技术及其问题]

## 技术问题

## 💡 使用技巧

### 1. 准备高质量的技术交底书

```markdown
# 技术交底书

## 发明名称

[清晰、具体的名称]

## 技术领域

[明确的技术领域]

## 背景技术

[现有技术及其问题]

## 技术问题

[要解决的具体问题]

## 技术方案

[详细的解决方案]

## 技术效果

[量化的效果数据]

## 附图说明

[各附图的内容描述]
```
````

### 2. 利用交互式命令

交互式命令支持5种操作：

- **y (通过)**: 确认结果并保存
- **c (修正)**: 修正特定字段
- **s (补充)**: 补充更多信息，重新分析
- **r (重来)**: 不提供反馈，重新分析
- **q (取消)**: 退出不保存

### 3. 迭代优化

建议使用3轮迭代：

1. **第一轮**: 查看初步结果
2. **第二轮**: 使用"s"补充信息
3. **第三轮**: 使用"c"修正细节
4. **第四轮**: "y"通过并保存

---

## 🎯 典型使用场景

### 场景1: 快速验证想法

```bash
# 粗略的技术交底书
yunpat draft-interactive --title "..." --field "..." --disclosure rough-idea.md

# 查看发明理解和检索结果，评估创造性
# 选择"q"取消，不保存
```

### 场景2: 完整专利撰写

```bash
# 完整的技术交底书
yunpat draft-interactive --title "..." --field "..." --disclosure full-disclosure.md

# 迭代优化发明理解
# 继续检索策略
# 生成权利要求
# 最终保存所有结果
```

### 场景3: 批量处理

```bash
# 处理多个技术交底书
for file in disclosures/*.md; do
  yunpat draft \
    --title "$(basename $file .md)" \
    --field "人工智能" \
    --disclosure "$file" \
    --output "outputs/$(basename $file .md).json"
done
```

---

## ⚠️ 常见问题

### Q1: API密钥错误

```bash
错误: 未找到 API 密钥

解决:
export DEEPSEEK_API_KEY=your_key_here
# 或
export OPENAI_API_KEY=your_key_here
```

### Q2: 文件路径错误

```bash
错误: 读取技术交底书失败

解决:
# 使用绝对路径
--disclosure /path/to/file.md

# 或相对路径
--disclosure ./examples/file.md
```

### Q3: 输出质量不理想

```bash
解决:
1. 改进技术交底书质量
2. 使用交互式命令迭代优化
3. 使用"s"补充更多信息
4. 使用"c"修正不准确的部分
```

---

## 📖 更多文档

- [完整MVP报告](docs/reports/final-mvp-completion-report-2026-05-03.md)
- [交互式CLI指南](examples/phase2-interactive-cli-guide.md)
- [端到端示例](examples/phase2-invention-understanding-example.md)
- [Phase 2完成报告](docs/reports/phase2-completion-report-2026-05-03.md)

---

**更新时间**: 2026-05-03  
**文档版本**: v1.0
