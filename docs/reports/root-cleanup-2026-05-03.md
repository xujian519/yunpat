# 根目录清理报告 - 2026-05-03

## 清理概述

按照标准项目文件存放规范，对 YunPat 项目根目录进行了全面清理和整理，将散落文件移动到合理的文件夹中。

## 清理日期

2026-05-03

## 清理前状态

根目录包含以下文件（18个）：
- 配置文件：package.json, tsconfig.json, esbuild.config.mjs 等
- 文档文件：README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md, CHANGELOG.md
- 测试文件：test-deepclone.ts, test-glm.ts, test-glm.sh
- 脚本文件：verify-env.sh, verify-glm-setup.sh
- 环境配置：.env, .env.test, .env.glm.example, .env.quickstart.example
- 重复文件：.prettierrc（与 .prettierrc.json 重复）
- 构建产物：.tsbuildinfo

## 整理操作

### 1. 文档文件移动 → docs/guides/

| 源文件 | 目标文件 | 说明 |
|--------|---------|------|
| CLAUDE.md | docs/guides/CLAUDE.md | Claude Code 协作指南 |
| AGENTS.md | docs/guides/AGENTS.md | AI 编程助手指南 |
| CONTRIBUTING.md | docs/guides/CONTRIBUTING.md | 贡献指南 |

### 2. 测试文件移动 → test/

| 源文件 | 目标文件 | 说明 |
|--------|---------|------|
| test-deepclone.ts | test/test-deepclone.ts | 深拷贝测试 |
| test-glm.ts | test/test-glm.ts | GLM 测试 |
| test-glm.sh | test/test-glm.sh | GLM 测试脚本 |

### 3. 脚本文件移动 → scripts/

| 源文件 | 目标文件 | 说明 |
|--------|---------|------|
| verify-env.sh | scripts/verify-env.sh | 环境验证脚本 |
| verify-glm-setup.sh | scripts/verify-glm-setup.sh | GLM 设置验证脚本 |

### 4. 环境配置移动 → config/

| 源文件 | 目标文件 | 说明 |
|--------|---------|------|
| .env | config/.env | 环境变量（本地，不在 git 中） |
| .env.test | config/.env.test | 测试环境变量（本地，不在 git 中） |
| .env.glm.example | config/.env.glm.example | GLM 环境示例 |
| .env.quickstart.example | config/.env.quickstart.example | 快速开始环境示例 |

### 5. 清理重复和构建产物

| 文件 | 操作 | 说明 |
|------|------|------|
| .prettierrc | 删除 | 与 .prettierrc.json 重复，保留 JSON 格式 |
| .tsbuildinfo | 删除 | TypeScript 构建产物 |
| .prettierignore | 移动到 config/ | Prettier 忽略配置 |

### 6. 更新 .gitignore

添加 `.tsbuildinfo` 到 .gitignore，防止构建产物被提交。

## 清理后状态

根目录现在只包含必要的配置和文档文件（9个）：

```
.
├── CHANGELOG.md              # 版本历史
├── LICENSE                   # 许可证
├── README.md                 # 项目说明
├── esbuild.config.mjs        # 构建配置
├── package.json              # 项目配置
├── pnpm-lock.yaml            # 依赖锁定
├── pnpm-workspace.yaml       # 工作空间配置
├── tsconfig.base.json        # TypeScript 基础配置
└── tsconfig.json             # TypeScript 配置
```

## 目录结构优化

### docs/guides/ - 指南文档

```
docs/guides/
├── CLAUDE.md              # Claude Code 协作指南
├── AGENTS.md              # AI 编程助手指南
├── CONTRIBUTING.md        # 贡献指南
├── api.md                 # API 文档
└── development.md         # 开发指南
```

### test/ - 测试文件

```
test/
├── test-deepclone.ts      # 深拷贝测试
├── test-glm.ts            # GLM 测试
├── test-glm.sh            # GLM 测试脚本
├── integration/           # 集成测试
├── knowledge/             # 知识库测试
├── scripts/               # 测试脚本
└── unit/                  # 单元测试
```

### scripts/ - 维护脚本

```
scripts/
├── verify-env.sh          # 环境验证脚本
├── verify-glm-setup.sh    # GLM 设置验证
├── build-rust.sh          # Rust 构建脚本
├── cleanup.sh             # 清理脚本
└── ...                    # 其他维护脚本
```

### config/ - 配置文件

```
config/
├── .env                   # 环境变量（本地）
├── .env.test              # 测试环境（本地）
├── .env.glm.example       # GLM 环境示例
├── .env.quickstart.example # 快速开始示例
├── .prettierignore        # Prettier 忽略配置
├── writing-style-xujian.js # 写作风格配置
└── writing-style-xujian.ts # 写作风格配置
```

## 标准化收益

### 1. 清晰的目录结构

根目录简洁明了，只包含核心配置文件，符合开源项目标准。

### 2. 更好的可维护性

- 文档集中在 docs/ 目录
- 测试文件集中在 test/ 目录
- 脚本文件集中在 scripts/ 目录
- 配置文件集中在 config/ 目录

### 3. 减少认知负担

新贡献者可以快速了解项目结构，找到所需文件。

### 4. 符合最佳实践

遵循 Node.js/TypeScript 项目的标准文件组织方式。

## Git 变更

### 移动的文件（使用 git mv）

```bash
R  .env.glm.example -> config/.env.glm.example
R  .env.quickstart.example -> config/.env.quickstart.example
R  .prettierignore -> config/.prettierignore
R  AGENTS.md -> docs/guides/AGENTS.md
RM CLAUDE.md -> docs/guides/CLAUDE.md
R  CONTRIBUTING.md -> docs/guides/CONTRIBUTING.md
R  verify-env.sh -> scripts/verify-env.sh
R  verify-glm-setup.sh -> scripts/verify-glm-setup.sh
R  test-deepclone.ts -> test/test-deepclone.ts
R  test-glm.sh -> test/test-glm.sh
R  test-glm.ts -> test/test-glm.ts
```

### 修改的文件

```bash
M .gitignore              # 添加 .tsbuildinfo
M README.md               # 更新文档路径引用
```

### 删除的文件

```bash
D .prettierrc             # 重复文件
D .env.test               # 移动到 config/
```

## 需要更新的引用

由于文件移动，需要更新以下引用：

### 1. README.md

更新文档链接：
- `CLAUDE.md` → `docs/guides/CLAUDE.md`
- `AGENTS.md` → `docs/guides/AGENTS.md`
- `CONTRIBUTING.md` → `docs/guides/CONTRIBUTING.md`

### 2. 其他文档

检查所有文档中的文件路径引用，确保指向新位置。

### 3. CI/CD 配置

更新 GitHub Actions 和其他 CI/CD 配置中的脚本路径：
- `verify-env.sh` → `scripts/verify-env.sh`
- `verify-glm-setup.sh` → `scripts/verify-glm-setup.sh`

## 后续行动

1. **更新文档引用**：检查并更新所有文档中的文件路径
2. **更新 CI/CD 配置**：修改脚本路径
3. **测试构建**：确保构建和测试脚本正常工作
4. **更新贡献指南**：在 CONTRIBUTING.md 中说明新的目录结构

## 验证清单

- [x] 根目录只包含必要的配置文件
- [x] 所有文档文件都在 docs/ 目录
- [x] 所有测试文件都在 test/ 目录
- [x] 所有脚本文件都在 scripts/ 目录
- [x] 所有配置文件都在 config/ 目录
- [x] 删除重复和构建产物文件
- [x] 更新 .gitignore
- [ ] 更新文档引用
- [ ] 更新 CI/CD 配置
- [ ] 测试构建和脚本

## 总结

本次根目录清理大幅提升了项目的组织结构和可维护性。根目录从 18 个文件减少到 9 个核心配置文件，所有散落文件都归档到合理的目录中。项目现在更符合标准开源项目的文件组织规范。

---

**清理人**: Claude Code
**审核**: 待审核
**下次审查**: 完成引用更新后
