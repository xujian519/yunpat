# ADR 001: 目录结构设计

> **状态**: 已采纳
> **日期**: 2026-04-29
> **决策者**: 项目团队
> **相关**: [Karpathy 原则分析](../reports/2026-04/2026-04-29-directory-structure-karpathy-analysis.md)

---

## 背景

### 问题

原目录结构存在以下问题：

1. **过度复杂**：19 个一级目录，认知负担过重
2. **空目录存在**：`apps/`（5 个空目录）、`services/`（5 个空目录）、`infrastructure/`（5 个空目录）
3. **职责混淆**：`ai/` 和 `packages/` 职责重叠
4. **重复目录**：`prompts/` 和 `ai/prompts/` 都存在
5. **多语言混乱**：`rust/` 和 `yunpat_python/` 在根目录，缺乏统一策略

### 影响

- 新开发者需要 >30 分钟才能理解项目结构
- 每次添加新代码都需要思考"应该放在哪里？"
- 违反 Karpathy 简洁优先原则

---

## 决策

### 1. 删除空目录

```bash
rm -rf apps/
rm -rf services/
rm -rf infrastructure/
```

**理由**：空目录违反 YAGNI 原则（You Aren't Gonna Need It）

### 2. 合并重复目录

```bash
mkdir -p ai/prompts/templates
mv prompts/* ai/prompts/templates/
rm -rf prompts/
```

**理由**：避免重复，统一管理所有 prompt 相关内容

### 3. 重命名以明确职责

```bash
mv ai patents
```

**理由**：
- `patents/` 清晰表明这是专利专用业务代码
- 与 `packages/agents/`（通用智能体）区分

### 4. 统一多语言代码

```bash
mv rust packages/rust-tools
mv yunpat_python packages/python-tools
```

**理由**：
- 所有工具代码统一放在 `packages/` 下
- 清晰表明这些是"工具包"
- 符合 monorepo 最佳实践

---

## 新的目录结构

```
yunpat/
├── packages/              # 所有可复用的代码包
│   ├── core/              # 核心框架（TypeScript）
│   ├── agents/            # 通用智能体（TypeScript）
│   ├── rust-tools/        # Rust 工具（性能关键）
│   ├── python-tools/      # Python 工具（科学计算）
│   └── cli/               # 命令行工具
│
├── patents/               # 专利专用业务逻辑
│   ├── agents/            # 四大专利智能体
│   ├── prompts/           # Prompt 模板和管理器
│   ├── generation/        # 文档生成器
│   ├── retrieval/         # 检索系统
│   ├── knowledge/         # 知识库集成
│   └── mcp/               # MCP 工具服务器
│
├── knowledge-base/        # 专利知识库
├── docs/                  # 项目文档
├── examples/              # 使用示例
├── scripts/               # 维护脚本
└── test/                  # 测试文件
```

**改进**：
- 19 个一级目录 → 11 个（减少 42%）
- 消除所有空目录
- 消除重复目录
- 职责清晰

---

## 职责划分

### packages/ - 可复用代码

**适用场景**：
- 通用智能体（writer, researcher）
- 框架核心（Agent 基类、EventBus）
- 工具库（rust-tools, python-tools）

**命名规范**：
- TypeScript：`packages/{name}/`
- Rust：`packages/rust-tools/`
- Python：`packages/python-tools/`

### patents/ - 业务逻辑

**适用场景**：
- 专利专用智能体（PatentWriterAgent, PatentResponderAgent）
- 业务 prompt 模板
- 业务生成器、检索器

**命名规范**：
- 所有代码放在 `patents/` 下
- 按功能分类（agents/, prompts/, generation/）

---

## 后果

### 优点

1. **简洁性** ✅
   - 根目录从 19 个减少到 11 个
   - 新开发者 5 分钟内理解结构

2. **清晰性** ✅
   - `packages/` = 可复用代码
   - `patents/` = 业务代码
   - 职责明确，不重叠

3. **可维护性** ✅
   - 修改业务逻辑只需要改 `patents/`
   - 修改框架只需要改 `packages/core`

4. **符合 Karpathy 原则** ✅
   - 简洁优先：减少 42% 的目录
   - 编码前思考：结构反映设计理念
   - 精准修改：职责边界清晰
   - 目标驱动：不需要思考就知道代码放哪里

### 缺点

1. **迁移成本** ⚠️
   - 需要更新所有导入路径
   - 需要更新 CI/CD 配置
   - 需要更新文档

2. **学习曲线** ⚠️
   - 团队需要适应新结构
   - 需要更新开发规范

### 缓解措施

- 提供详细的迁移指南
- 更新所有相关文档
- 提供代码示例

---

## 替代方案

### 方案 A：保持原结构

**优点**：无需迁移
**缺点**：违反 Karpathy 原则，长期维护困难

### 方案 B：采用微服务结构

```
yunpat/
├── services/
│   ├── writer-service/
│   ├── responder-service/
│   └── analyzer-service/
└── packages/
    └── shared/
```

**优点**：独立部署
**缺点**：过度设计，增加复杂度

### 为什么不选 B？

- 当前规模不需要微服务
- 增加运维复杂度
- 违反简洁优先原则

---

## 未来考虑

### 短期（1 个月）

- [ ] 完成所有导入路径更新
- [ ] 更新 CI/CD 配置
- [ ] 更新开发文档

### 中期（3 个月）

- [ ] 评估结构是否满足需求
- [ ] 根据实际使用调整

### 长期（6 个月）

- [ ] 考虑是否需要进一步拆分
- [ ] 考虑是否需要独立某些模块

---

## 参考

- [Karpathy 原则分析](../reports/2026-04/2026-04-29-directory-structure-karpathy-analysis.md)
- [重构完成报告](../reports/2026-04/2026-04-29-structure-refactor-execution.md)
- [文件处置规则](../FILE_MANAGEMENT_RULES.md)

---

**决策者签名**: Claude Code (Super Thinking Mode)
**审核**: 待团队确认
**生效日期**: 2026-04-29
