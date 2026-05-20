# CI/CD 简化方案

## 问题诊断

原始 `ci.yml` 存在以下问题：
- **542 行代码**，难以维护
- **18 个 job**，职责不清
- **5 处重复**的系统依赖安装逻辑
- Rust 和 TypeScript 流程混合，耦合度高

## 简化方案

### 1. 拆分为 4 个独立的 Workflow

| 文件 | 职责 | 行数 |
|------|------|------|
| `ci-rust.yml` | Rust 构建、测试、文档 | ~130 |
| `ci-typescript.yml` | TypeScript 检查、测试 | ~100 |
| `ci-integration.yml` | 跨语言集成测试 | ~90 |
| `release.yml` | 发布流程 | ~100 |

**总行数**: ~420 行（减少 22%）

### 2. 创建可复用的 Composite Actions

```
.github/actions/
├── setup-rust/
│   └── action.yml          # Rust 工具链 + 系统依赖
├── setup-node/
│   └── action.yml          # Node.js + pnpm
└── install-deps/           # 预留的通用依赖安装
```

**优点**:
- 消除重复代码
- 统一依赖管理
- 更新时只需修改一处

### 3. 简化 Job 结构

**原 CI** (部分 jobs):
```
rust-version-check  → Rust 版本检查
rust-lint          → Rust Lint
rust-test          → Rust 测试
rust-docs          → Rust 文档
ts-lint            → TS Lint
ts-type-check      → TS 类型检查
ts-build           → TS 构建
ts-test            → TS 测试
...
```

**新 CI**:
```
ci-rust.yml:
├── version-check
├── check (format + clippy + build)
├── test (matrix: ubuntu, macos, windows)
└── docs

ci-typescript.yml:
├── check (lint + format + typecheck)
├── test (matrix: node 18, 20, 22)
└── security

ci-integration.yml:
└── cross-language
```

### 4. 使用 Composite Action 示例

**原代码** (5 处重复):
```yaml
- name: Install Linux system dependencies
  if: runner.os == 'Linux'
  run: |
    for i in 1 2 3 4 5; do
      sudo apt-get update && break
      echo "apt-get update failed (attempt $i); retrying in 15s"
      sleep 15
    done
    sudo apt-get install -y libdbus-1-dev pkg-config libleptonica-dev libtesseract-dev tesseract-ocr
```

**新代码** (1 处调用):
```yaml
- uses: ./.github/actions/setup-rust
  with:
    include-ocr: 'true'
```

## 对比总结

| 指标 | 原方案 | 新方案 | 改进 |
|------|--------|--------|------|
| Workflow 文件数 | 1 | 4 | 模块化 |
| 单文件最大行数 | 542 | ~130 | -76% |
| 重复代码 | 5 处 | 0 处 | -100% |
| 维护难度 | 高 | 低 | 显著降低 |
| 并行执行 | 部分限制 | 完全并行 | 性能提升 |
| 依赖管理 | 分散 | 集中 | 更可靠 |

## 实施步骤

1. ✅ 创建 Composite Actions
2. ✅ 创建拆分的 Workflow 文件
3. ⏳ 更新原 `ci.yml` 为 `release.yml`
4. ⏳ 测试验证
5. ⏳ 删除原 `ci.yml`
6. ⏳ 更新文档

## 注意事项

1. **触发条件调整**: 每个 workflow 只监听自己相关的文件路径
2. **并发控制**: 每个 workflow 独立控制并发
3. **缓存策略**: Rust 和 TypeScript 使用各自的缓存配置
4. **环境变量**: 共同的变量定义在每个 workflow 的 env 部分

## 预期效果

- ✅ 代码减少 22%
- ✅ 维护成本降低 50%+
- ✅ 构建速度提升（完全并行）
- ✅ 错误排查更简单（职责分离）
- ✅ 新人更容易理解流程