# CodeGeeX 快速配置和测试指南

## 🚀 快速开始（3步）

### 步骤1：获取智谱AI API Key

1. **访问智谱AI开放平台**
   ```
   https://open.bigmodel.cn/
   ```

2. **注册并登录**
   - 使用手机号注册
   - 完成实名认证

3. **创建API Key**
   - 进入"API密钥"页面
   - 点击"新增API Key"
   - 复制生成的API Key（格式：`id.secret...`）

4. **开通CodeGeeX编程套餐**（重要！）
   - 进入"产品"页面
   - 选择"CodeGeeX 编程套餐"
   - 开通服务（可能需要单独申请）

### 步骤2：配置环境变量

**方式1：创建.env文件（推荐）**

```bash
# 在项目根目录创建.env文件
cat > .env << 'EOF'
GLM_API_KEY=your_glm_api_key_here
CODEGEEX_MODEL=codegeex-4
EOF
```

**方式2：直接设置环境变量**

```bash
export GLM_API_KEY=your_glm_api_key_here
export CODEGEEX_MODEL=codegeex-4
```

### 步骤3：验证配置

```bash
# 验证CodeGeeX编程套餐
npm run api:check-codegeex

# 如果出现403错误，说明未开通编程套餐
# 如果出现404错误，检查模型名称是否正确
```

---

## ✅ 预期成功输出

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
──────────────────────────────────────────────────
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
──────────────────────────────────────────────────
```

---

## ⚠️ 常见错误

### 错误1：未设置 GLM_API_KEY

**错误**：
```
❌ 错误：未设置 GLM_API_KEY 环境变量
```

**解决**：
1. 创建.env文件并设置GLM_API_KEY
2. 或使用export命令设置环境变量

### 错误2：403 Forbidden

**错误**：
```
❌ API Key 无权访问 CodeGeeX 编程套餐
📋 响应状态： 403 Forbidden
```

**原因**：未开通CodeGeeX编程套餐

**解决**：
1. 访问 https://open.bigmodel.cn/product/coding
2. 申请开通编程套餐
3. 联系客服：https://open.bigmodel.cn/contact

### 错误3：404 Not Found

**错误**：
```
❌ 模型不存在或端点错误
📋 响应状态： 404 Not Found
```

**原因**：
1. 模型名称不正确
2. 未开通编程套餐
3. 端点地址已变更

**解决**：
1. 确认模型名称：codegeex-4 / codegeex-4-all / codegeex-turbo
2. 确认已开通编程套餐
3. 尝试使用通用模型：npm run api:check-glm

---

## 💻 运行示例

配置成功后，运行完整示例：

```bash
# 设置环境变量（如果使用.env文件可以跳过）
export GLM_API_KEY=your_api_key

# 运行示例
tsx examples/usage-codegeex-coding.ts
```

**示例包含**：
1. 代码生成
2. 代码理解
3. 代码审查
4. Bug修复
5. 代码注释
6. 代码转换

---

## 📋 配置检查清单

使用此清单确认配置完成：

- [ ] 已注册智谱AI账号
- [ ] 已完成实名认证
- [ ] **已开通CodeGeeX编程套餐**
- [ ] 已创建API Key
- [ ] 已设置环境变量（.env文件或export）
- [ ] 已运行验证脚本
- [ ] 验证成功（200 OK）

---

## 🔧 代码中使用

验证成功后，在代码中使用：

```typescript
import { createZhipuCodingModel, NativeModel } from '@yunpat/core'

// 创建CodeGeeX模型
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

---

## 📚 相关资源

- **配置指南**：docs/guides/CODEGEEX-SETUP.md
- **使用示例**：examples/usage-codegeex-coding.ts
- **产品页**：https://open.bigmodel.cn/product/coding
- **API文档**：https://open.bigmodel.cn/dev/api#cgeex

---

## 💡 提示

1. **API Key格式**：应该是 `id.secret...` 格式
2. **编程套餐**：可能需要单独开通，与通用模型不同
3. **费用**：参考 https://open.bigmodel.cn/pricing
4. **使用限制**：查看控制台的配额和限制

---

**最后更新**：2026-05-03
