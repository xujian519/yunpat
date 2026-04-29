# 贡献指南

感谢您对 YunPat 项目的关注！我们欢迎各种形式的贡献。

---

## 🤝 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议：

1. 检查 [Issues](https://github.com/your-org/yunpat/issues) 是否已有类似问题
2. 如果没有，创建新的 Issue，包含：
   - 清晰的标题
   - 问题描述
   - 复现步骤（如果是 bug）
   - 预期行为
   - 环境信息（Node 版本、操作系统等）

### 提交代码

#### 1. Fork 项目

```bash
# Fork 并克隆您的仓库
git clone https://github.com/your-username/yunpat.git
cd yunpat
```

#### 2. 安装依赖

```bash
pnpm install
```

#### 3. 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

#### 4. 开发和测试

```bash
# 构建项目
pnpm build

# 运行测试
pnpm test

# 代码检查
pnpm lint
```

#### 5. 提交代码

```bash
git add .
git commit -m "feat: 添加新功能"
# 或
git commit -m "fix: 修复bug"
```

**提交信息格式**：
- `feat:` - 新功能
- `fix:` - 修复 bug
- `docs:` - 文档更新
- `style:` - 代码格式（不影响功能）
- `refactor:` - 重构
- `test:` - 测试相关
- `chore:` - 构建/工具相关

#### 6. 推送并创建 Pull Request

```bash
git push origin feature/your-feature-name
```

然后在 GitHub 上创建 Pull Request。

---

## 📋 开发规范

### 代码风格

- 使用 TypeScript 编写代码
- 遵循 ESLint 配置
- 使用 Prettier 格式化代码
- 添加必要的注释和文档

### 智能体开发

开发新智能体时：

1. 继承 `Agent` 基类
2. 实现必需的生命周期方法
3. 添加类型定义
4. 编写测试用例
5. 提供使用示例

```typescript
import { Agent } from '@yunpat/core';

export class MyAgent extends Agent<Input, Output> {
  constructor(config: any) {
    super({
      ...config,
      name: 'my-agent',
      description: '我的智能体描述',
    });
  }

  protected async plan(input: Input, context: any): Promise<Plan> {
    // 规划逻辑
  }

  protected async act(plan: Plan, context: any): Promise<Output> {
    // 执行逻辑
  }
}
```

### 测试要求

- 单元测试覆盖率 > 80%
- 所有测试必须通过
- 新功能必须包含测试

```bash
# 运行测试
pnpm test

# 查看覆盖率
pnpm test:coverage
```

### 文档要求

- 更新相关文档
- 添加使用示例
- 更新 API 文档
- 更新 CHANGELOG.md

---

## 🏗️ 项目结构

```
yunpat/
├── apps/              # 应用层
├── services/          # 服务层
├── ai/                # AI 能力层
│   └── agents/        # ← 新智能体放这里
├── infrastructure/    # 基础设施
├── packages/          # 核心框架（一般不改）
├── docs/              # 文档
├── examples/          # 示例
└── tests/             # 测试
```

---

## 📝 Pull Request 检查清单

提交 PR 前，请确认：

- [ ] 代码通过所有测试
- [ ] 代码符合项目规范
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 提交信息清晰明确
- [ ] PR 描述详细说明了改动

---

## 🎯 优先级标签

- `critical` - 关键 bug，阻塞发布
- `high` - 重要功能或 bug
- `medium` - 一般功能或优化
- `low` - 错别字、小改进

---

## 📧 联系方式

如有疑问，欢迎联系：

- GitHub Issues: [提交问题](https://github.com/your-org/yunpat/issues)
- 邮箱: dev@yunpat.ai
- 微信群: YunPat 开发者群

---

## 📄 许可证

提交代码即表示您同意将代码以 MIT 许可证发布。

---

**感谢您的贡献！** 🎉
