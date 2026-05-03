# 文件处置规则 (File Management Rules)

## 规则目的

保持项目根目录整洁，建立清晰的文档分类体系，确保项目长期可维护性。

## 📁 根目录文件规范

### ✅ 允许保留在根目录的文件

**必需的核心文件：**

- `README.md` - 项目说明和快速开始
- `CHANGELOG.md` - 版本更新记录
- `CONTRIBUTING.md` - 贡献指南
- `CLAUDE.md` - Claude Code 项目配置
- `LICENSE` - 开源协议

**配置文件：**

- `.env` / `.env.example` - 环境变量
- `.gitignore` - Git 忽略规则
- `.eslintrc.json` / `.prettierrc` - 代码规范
- `tsconfig.json` - TypeScript 配置
- `package.json` - 依赖管理

### ❌ 禁止放置在根目录的文件

- 临时报告文件
- 计划文档
- 开发笔记
- 归档文档
- 技术分析报告

---

## 📂 docs 目录结构

```
docs/
├── README.md                    # 文档导航
├── reports/                     # 临时报告和总结（按日期归档）
│   ├── 2026-04/
│   │   ├── 2026-04-28-work-summary.md
│   │   ├── 2026-04-29-cleanup-summary.md
│   │   └── ...
│   └── archive/
│       └── [超过6个月的报告]
├── plans/                       # 计划和重构文档
│   ├── refactor/
│   │   ├── 2026-04-refactor-plan.md
│   │   └── 2026-04-refactor-execution.md
│   └── optimization/
│       └── optimization-round2.md
├── guides/                      # 开发指南
│   ├── api.md
│   ├── development.md
│   ├── backward-compatibility.md
│   └── security-guidelines.md
├── architecture/                # 架构文档
│   ├── five-layer-architecture.md
│   ├── multilingual-design.md
│   └── system-design.md
├── history/                     # 历史归档
│   └── 2026-04-restructure/
│       └── [历史重构文档]
└── archive/                     # 已废弃的文档
    └── [旧项目分析文档]
```

---

## 📋 文件分类规则

### 1. 报告类文件（reports/）

**特征：**

- 文件名包含 `SUMMARY`, `REPORT`, `PROGRESS`
- 描述已完成的工作或阶段性成果
- 有明确的时间戳

**命名规范：**

```
YYYY-MM-DD-{topic}-{type}.md

例如：
- 2026-04-28-integration-work-summary.md
- 2026-04-29-cleanup-report.md
- 2026-04-30-development-progress.md
```

**归档规则：**

- 6个月内的报告保留在 `docs/reports/YYYY-MM/`
- 超过6个月的移至 `docs/reports/archive/`

---

### 2. 计划类文件（plans/）

**特征：**

- 文件名包含 `PLAN`, `ROADMAP`, `STRATEGY`
- 描述未来的工作计划或重构方案
- 有明确的目标和时间线

**命名规范：**

```
{category}-{topic}-{type}.md

例如：
- refactor-multilingual-plan.md
- optimization-round2-plan.md
- migration-execution-report.md
```

**子目录分类：**

- `plans/refactor/` - 重构相关计划
- `plans/optimization/` - 性能优化计划
- `plans/migration/` - 迁移计划
- `plans/feature/` - 新功能计划

---

### 3. 指南类文件（guides/）

**特征：**

- 教程、操作指南、最佳实践
- 帮助开发者快速上手或解决特定问题
- 相对稳定，不经常变更

**命名规范：**

```
{topic}.md 或 {topic}-guide.md

例如：
- api.md
- development.md
- security-guidelines.md
- backward-compatibility.md
```

---

### 4. 架构类文件（architecture/）

**特征：**

- 系统设计、架构决策
- 技术选型说明
- ADR（Architecture Decision Records）

**命名规范：**

```
{topic}-{type}.md 或 ADR_{number}_{topic}.md

例如：
- five-layer-architecture.md
- multilingual-design.md
- ADR_001_llm_adapter_choice.md
```

---

### 5. 归档类文件（archive/ 或 history/）

**特征：**

- 已完成的历史项目
- 过时的分析文档
- 不再活跃的工作总结

**归档规则：**

- `history/` 按时间组织（如 `history/2026-04-restructure/`）
- `archive/` 存放不再参考的旧文档

---

## 🔄 文件生命周期管理

### 新文件创建流程

1. **确定文件类型**
   - 报告？→ `docs/reports/YYYY-MM/`
   - 计划？→ `docs/plans/{category}/`
   - 指南？→ `docs/guides/`
   - 架构？→ `docs/architecture/`

2. **使用标准命名**
   - 遵循上述命名规范
   - 包含日期（报告类）
   - 使用小写和连字符

3. **添加元数据**
   ```markdown
   ---
   created: 2026-04-29
   type: report/plan/guide/architecture
   status: draft/reviewed/archived
   tags: [refactor, optimization, docs]
   ---
   ```

### 定期维护

**每月任务：**

1. 将 `docs/reports/` 中超过6个月的报告移至 `archive/`
2. 检查 `docs/plans/` 中的计划，将已完成的移至 `history/`
3. 更新 `docs/README.md` 导航

**每季度任务：**

1. 审查所有文档的准确性
2. 删除或归档过时内容
3. 合并重复文档

---

## ✅ 检查清单

在创建新文件前，确认：

- [ ] 文件名符合命名规范
- [ ] 放置在正确的子目录
- [ ] 添加了必要的元数据
- [ ] 更新了相关索引（如 docs/README.md）
- [ ] 没有在根目录创建临时文件

---

## 🔧 自动化工具（建议）

### 1. 文件检查脚本

```bash
# scripts/check-file-placement.sh
# 检查根目录是否有违规文件
```

### 2. 自动归档脚本

```bash
# scripts/archive-old-reports.sh
# 自动归档超过6个月的报告
```

### 3. 文档模板

```bash
# scripts/new-doc-template.sh
# 创建符合规范的新文档
```

---

## 📝 变更日志

- **2026-04-29** - 创建文件处置规则，执行首次清理
- 后续变更在此记录
