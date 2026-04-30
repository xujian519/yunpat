# YunPat 贡献指南

感谢您对 YunPat 项目的关注！我们欢迎各种形式的贡献。

---

## 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议：

1. 检查 [Issues](https://github.com/YOUR_USERNAME/yunpat-agent-framework/issues) 是否已有类似问题
2. 如果没有，创建新的 Issue，包含：
   - 清晰的标题
   - 问题描述
   - 复现步骤（如果是 bug）
   - 预期行为
   - 环境信息（Node 版本、操作系统等）

### 提交代码

#### 1. Fork 项目

```bash
# 1. 在 GitHub 上 Fork 仓库
# 2. 克隆你的 fork
git clone https://github.com/your-username/yunpat-agent-framework.git
cd yunpat-agent-framework

# 3. 添加上游仓库
git remote add upstream https://github.com/ORIGINAL_OWNER/yunpat-agent-framework.git
```

#### 2. 安装依赖

```bash
# 确保使用 pnpm
pnpm install
```

#### 3. 创建分支

```bash
# 功能分支
git checkout -b feature/your-feature-name

# Bug 修复分支
git checkout -b fix/your-bug-fix

# 紧急修复分支
git checkout -b hotfix/your-hotfix
```

#### 4. 开发和测试

```bash
# 构建项目
pnpm build

# 运行测试
pnpm test

# 代码检查
pnpm lint

# 类型检查
pnpm build:tsc
```

#### 5. 提交代码

```bash
git add .
git commit -m "feat: 添加新功能"
```

**提交信息格式**：
- `feat:` - 新功能
- `fix:` - 修复 bug
- `docs:` - 文档更新
- `style:` - 代码格式（不影响功能）
- `refactor:` - 重构
- `test:` - 测试相关
- `chore:` - 构建/工具相关

#### 6. 推送和创建 PR

```bash
# 推送到你的 fork
git push origin feature/your-feature-name

# 在 GitHub 上创建 Pull Request
```

---

## 开发规范

### 代码风格

- 使用 TypeScript 编写代码
- 遵循 ESLint 配置（`.eslintrc.json`）
- 使用 Prettier 格式化代码（`.prettierrc.json`）
- TypeScript 导入需带 `.js` 扩展名（ESM 规范）

### 智能体开发

开发新智能体时：

1. 继承 `Agent` 基类（来自 `@yunpat/core`）
2. 实现必需的 `plan` 和 `act` 方法
3. 可选实现 `before`、`init`、`reflect`、`after` 钩子
4. 添加类型定义
5. 编写测试用例

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
    return plan;
  }

  protected async act(plan: Plan, context: any): Promise<Output> {
    // 执行逻辑
    return result;
  }
}
```

### 智能体放置位置

- **通用智能体**：放在 `packages/agents/` 下
- **专利专用智能体**：放在 `patents/agents/` 下
- **禁止**修改 `packages/core` 除非要改变框架能力
- 智能体之间**禁止**直接调用，使用 EventBus

### 智能体通信

智能体之间通过 EventBus 通信：

```typescript
// 监听事件
this.on('agent:completed', async (event) => {
  console.log('智能体完成:', event.data);
});

// 发送消息
await this.send('target-agent', { data: 'message' });
```

### 测试要求

- 所有测试必须通过
- 新功能应包含测试
- 测试覆盖率应达到 80% 以上
- 测试框架：Vitest

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
pnpm --filter @yunpat/core test

# 生成覆盖率报告
pnpm test -- --coverage

# 监听模式
pnpm test -- --watch
```

### Rust 代码规范

- 使用 `cargo fmt` 格式化代码
- 通过 `cargo clippy` 检查
- 编写单元测试
- 添加文档注释

```bash
# 格式化
cargo fmt

# 检查
cargo clippy -- -D warnings

# 测试
cargo test

# 构建
cargo build --release
```

### 文档要求

- 更新相关文档
- 添加使用示例
- 更新 CHANGELOG.md
- 为公共 API 添加 JSDoc 注释

---

## 项目结构

```
yunpat-agent-framework/
├── packages/              # 可复用代码包（pnpm workspace）
│   ├── core/              # 核心框架（不包含业务逻辑）
│   ├── agents/            # 通用智能体
│   │   ├── writer/        # 技术写作助手
│   │   └── researcher/    # 研究分析师
│   ├── patent-tools/      # 专利工具集
│   ├── builtin-tools/     # 内置基础工具
│   ├── document-tools/    # 文档解析工具
│   ├── grpc-server/       # gRPC 服务器
│   ├── cli/               # 命令行工具
│   └── rust-tools/        # Rust 工具链
│
├── patents/               # 专利专用业务逻辑
│   ├── agents/            # 四大专利智能体
│   ├── prompts/           # Prompt 模板
│   ├── knowledge/         # 知识库集成
│   ├── core/              # Rust 桥接层
│   └── mcp/               # MCP 工具服务器
│
├── cli/patent-cli/        # 独立 CLI 工具
├── knowledge-base/        # 专利知识库
├── docs/                  # 项目文档
│   └── guides/            # 开发指南
├── examples/              # 使用示例
├── scripts/               # 维护脚本
├── .github/               # GitHub 配置
│   ├── workflows/         # CI/CD 工作流
│   └── ISSUE_TEMPLATE/    # Issue 模板
└── test/                  # 测试文件
```

---

## 开发工作流

### 功能开发流程

1. **规划阶段**
   - 创建 Issue 讨论功能需求
   - 等待维护者确认和反馈

2. **开发阶段**
   - 创建功能分支
   - 实现功能
   - 编写测试
   - 更新文档

3. **测试阶段**
   - 本地测试
   - 确保 CI 检查通过
   - 代码审查

4. **合并阶段**
   - 创建 Pull Request
   - 等待审查和合并

### Bug 修复流程

1. 在 Issue 中描述 bug
2. 创建修复分支
3. 编写复现测试
4. 修复 bug
5. 确保测试通过
6. 创建 PR

---

## Pull Request 检查清单

提交 PR 前请确认：

- [ ] 代码通过所有测试（`pnpm test`）
- [ ] 代码符合 ESLint 规范（`pnpm lint`）
- [ ] 代码通过类型检查（`pnpm build:tsc`）
- [ ] 新功能包含测试
- [ ] 测试覆盖率达标（80%+）
- [ ] 更新了相关文档
- [ ] 提交信息清晰明确
- [ ] 遵循 Commit 规范
- [ ] 没有提交 `.env` 或敏感文件
- [ ] PR 描述清晰完整

### PR 标题格式

```
<type>: <short description>
```

示例：
```
feat: 添加专利分析智能体
fix: 修复知识库查询性能问题
docs: 更新 API 文档
refactor: 优化事件总线实现
```

### PR 描述模板

创建 PR 时，请填写以下信息：

```markdown
## 变更类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 破坏性变更
- [ ] 文档更新

## 变更内容
- 变更1
- 变更2

## 相关 Issue
关闭 #issue_number

## 测试计划
- [ ] 单元测试
- [ ] 集成测试
- [ ] 手动测试

## 截图（如果适用）
```

---

## 代码审查

### 审查原则

- **功能正确性**：代码是否实现了预期功能
- **代码质量**：代码是否清晰、可维护
- **测试覆盖**：是否有足够的测试
- **文档完整**：文档是否更新
- **性能影响**：是否影响性能

### 反馈处理

- 及时响应审查意见
- 保持友好和尊重
- 解释技术决策
- 必要时修改代码

---

## 发布流程

### 版本号规范

遵循 [Semantic Versioning](https://semver.org/)：

```
MAJOR.MINOR.PATCH

0.1.0  → 0.2.0  # MINOR：向后兼容的新功能
0.2.0  → 1.0.0  # MAJOR：不兼容的 API 变更
1.0.0  → 1.0.1  # PATCH：向后兼容的 Bug 修复
```

### 发布步骤

```bash
# 1. 更新版本号
# 编辑 package.json

# 2. 更新 CHANGELOG.md

# 3. 提交变更
git add .
git commit -m "chore: 发布 v0.2.0"

# 4. 创建标签
git tag v0.2.0

# 5. 推送到远程
git push origin main --tags
```

---

## 社区准则

- 尊重所有贡献者
- 建设性的反馈
- 友好和包容
- 关注问题，而非个人
- 遵循代码 of conduct

---

## 获取帮助

- 📖 查看 [文档](docs/)
- 💬 在 [Issues](https://github.com/YOUR_USERNAME/yunpat-agent-framework/issues) 中提问
- 📧 联系维护者：xujian519@gmail.com

---

## 许可证

提交代码即表示您同意将代码以 MIT 许可证发布。

---

**感谢你的贡献！** 🎉

**维护者**: Xu Jian <xujian519@gmail.com>
**最后更新**: 2026-04-30