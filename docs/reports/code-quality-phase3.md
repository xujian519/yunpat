# YunPat Agent 代码质量 Review — 第三阶段报告

**生成时间**: 2026-05-16  
**范围**: 错误处理质量 + 安全性深度审查

---

## 1. 错误处理质量评估

### 1.1 unwrap/expect 分级处理

**总体分布**:

| 级别 | 数量 | 说明 | 风险 |
|------|------|------|------|
| **Level 1 (必须修复)** | ~180 | 生产代码处理外部输入/IO | 🔴 高 |
| **Level 2 (建议修复)** | ~420 | 初始化/配置阶段 | 🟡 中 |
| **Level 3 (可接受)** | ~1,774 | 测试代码 | 🟢 低 |

**Level 1 高风险 unwrap 清单** (生产代码 + 外部输入):

| 文件 | 行号 | 代码 | 风险场景 |
|------|------|------|---------|
| `yunpat-agents/src/tools/document.rs:274` | `.chars().next().unwrap()` | 空字符串 panic |
| `yunpat-agents/src/tools/document.rs:412` | `parser.parse_file(...).unwrap()` | 文件解析失败 panic |
| `yunpat-agents/src/tools/document.rs:415` | `result.unwrap()` | 外部文件处理 panic |
| `yunpat-agents/src/tools/document.rs:497` | `generator.parse_markdown_to_docx(...).unwrap()` | 文档生成失败 panic |
| `yunpat-agents/src/tools/ocr.rs:167` | `recognize_image(..., Some("eng"))` | 未检查返回值 |
| `yunpat-agents/src/tools/ocr.rs:173` | `ocr_result.unwrap()` | OCR 失败 panic |
| `yunpat-agents/src/tools/legal_db.rs:242` | `result.unwrap()` | 数据库查询失败 panic |
| `yunpat-agents/src/tools/patent_db.rs:247` | `result.unwrap()` | 专利数据库查询失败 panic |
| `tui/src/snapshot/repo.rs:747` | `.unwrap()` | 快照持久化失败 panic |
| `tui/src/snapshot/repo.rs:763` | `.unwrap()` | 快照持久化失败 panic |
| `config/src/lib.rs:1211` | `LOCK.lock().unwrap()` | Poisoned mutex (可接受) |

**Agent execute() 中的 unwrap 模式**:

每个 agent 的测试代码都有相同的 unwrap 三联：
```rust
agent.initialize().await.unwrap();        // 初始化失败 → panic
flow.steps.last().unwrap();               // 空 steps → panic
step.quality_check.as_ref().unwrap();     // 无 quality_check → panic
```

这些是 **测试代码**（在 `#[cfg(test)]` 块中），风险可控。

### 1.2 错误类型设计

**Rust 侧**:

| Crate | 错误类型 | 评估 |
|-------|---------|------|
| `secrets` | `SecretsError` (thiserror) | 🟢 良好 — Keyring/Io/Json/InsecurePermissions |
| `tools` | `ToolError` | 🟢 良好 — 有 execution_failed, invalid_input 等变体 |
| `yunpat-agents` | 无统一错误枚举 | 🔴 差 — 使用 `anyhow::Result`  everywhere，丢失结构化错误 |
| `core` | `anyhow::Result` | 🟡 中 — 简单但丢失了错误分类 |
| `tui` | `anyhow::Result` | 🟡 中 — 同上 |

**问题**: `yunpat-agents` 的 `execute()` 返回 `Pin<Box<dyn Stream<Item = StageOutput> + Send>>`，但错误处理是通过 `StageOutput` 中的 `Error` variant 隐式传递，没有显式的错误流。这导致：
1. 调用方无法区分"流程完成"和"流程出错"
2. 无法对错误类型做模式匹配
3. 日志中缺乏错误上下文

**建议**: 将返回类型改为 `Stream<Item = Result<StageOutput, AgentError>>`。

### 1.3 Result 传播质量

**优点**:
- `?` 操作符使用广泛，错误传播链清晰
- `anyhow::Context` 在 IO 操作中添加了有意义的上下文
- `thiserror` 在核心 crate 中使用良好

**缺点**:
- 大量 `String` 错误（尤其在 TS 侧）
- `catch {}` 空块 suppress 错误（OrchestratorAgent.ts 已修复）
- 缺乏错误码体系，无法做程序化错误处理

---

## 2. 安全性审查

### 2.1 SQL 注入 — 🟢 安全

**PatentDBDataSource.ts** 审查结果:

```typescript
// ✅ 参数化查询 — 安全
const result = await this.pool.query(sql, [number])

// ✅ 参数化查询 — 安全
const result = await this.pool.query(sql, [searchQuery, limit, offset])

// ✅ 参数化查询 — 安全
const result = await this.pool.query(sql, [`%${classification}%`, limit, offset])
```

**结论**: 所有数据库查询使用 PostgreSQL 参数化查询（`$1`, `$2`），没有字符串拼接注入风险。

**Drizzle ORM**: `packages/core/src/db/` 使用 Drizzle ORM，天然防注入。

### 2.2 命令注入 — 🟡 需关注

**shell.rs (2,516 行)**:

- 使用 `std::process::Command` 执行用户命令
- 有 **沙箱支持**: `SandboxManager`, `SandboxPolicy`, `Seatbelt` (macOS), `Landlock` (Linux)
- `ToolContext` 中有 `trust_mode` 和 `allow_shell` 标志
- `CommandSpec` 用于安全分析

**潜在风险**:
1. `trust_mode = true` 时跳过命令安全分析 (`skip_safety_analysis`)
2. 沙箱配置可能不够严格（需要审查 `sandbox/` 目录的具体策略）
3. `git_history.rs` 使用 `Command::new("git")` + 用户输入作为参数，需要确认参数是否被正确转义

**建议**: 
- 审查 `sandbox/seatbelt.rs` 和 `sandbox/landlock.rs` 的具体策略
- 对 `git_history.rs` 的 `args` 进行白名单验证
- 默认禁用 `trust_mode`，需要显式 HITL 批准

### 2.3 MCP 协议安全 — 🟢 良好

- MCP 工具通过 `ToolRegistry` 注册，有 schema 验证
- 工具调用有审批流程（`ApprovalFlow`）
- `ToolContext` 中有权限检查
- 未发现权限提升漏洞

### 2.4 数据主权合规 (CON-01) — 🟢 已实施

**规则定义** (`constitutional/data-sovereignty.yaml`):
- 技术交底书特征识别：3+ 关键词 + 500+ 字符 → 标记为敏感
- 权利要求草稿检测：2+ 权利要求关键词 → 触发 CON-01B

**测试覆盖**:
- `tests/e2e/constitutional/data-sovereignty.test.ts` — 7 个测试用例
- `tests/e2e/cross-language/rust-ts-mcp-bridge.test.ts` — CON-01 拦截作为错误响应

**拦截机制**:
```typescript
// MCP 桥接层拦截
{
  error: {
    message: 'CON-01: 检测到敏感内容，禁止发送到外部 API',
    data: { ruleId: 'CON-01' }
  }
}
```

**评估**: CON-01 合规机制已经建立，有 E2E 测试覆盖。但需要注意：
1. 规则基于关键词密度和长度阈值，可能有误报/漏报
2. 需要定期审计实际拦截日志，确认规则有效性

### 2.5 Secrets 管理 — 🟢 良好

**`crates/secrets/src/lib.rs`** (776 行):

**设计**:
- 三层优先级：`keyring → env → config-file`
- 硬规则: **永远不会交换优先级**
- OS keyring 后端: macOS Keychain, Windows Credential Manager, Linux Secret Service
- 文件后备: `~/.yunpat/secrets/secrets.json`，权限检查 `0600`

**安全特性**:
```rust
#[cfg(unix)]
{
    if mode != 0o600 {
        return Err(SecretsError::InsecurePermissions { path, mode });
    }
}
```

**unsafe 审查**:
- `unsafe { std::env::set_var(...) }` 仅用于测试
- 有 `Safety` 注释: "tests serialise on env_lock()"
- 全局 `Mutex` 保护测试并发

**评估**: Secrets 管理设计良好，是项目的安全亮点。

### 2.6 unsafe 代码审查

**unsafe 分布**:

| 文件 | 数量 | 类型 | 风险 |
|------|------|------|------|
| `tui/src/config/mod.rs` | 27 | `env::set_var/remove_var` (测试) | 🟢 低 |
| `config/src/lib.rs` | 19 | `env::set_var/remove_var` (测试) | 🟢 低 |
| `secrets/src/lib.rs` | 17 | `env::set_var/remove_var` (测试) | 🟢 低 |
| `tui/src/main.rs` | 16 | `env::set_var` (测试) | 🟢 低 |
| `tui/src/session_manager.rs` | 0 | — | — |
| `tui/src/settings.rs` | 11 | `env::set_var` | 🟡 中 |
| `tui/src/snapshot/repo.rs` | 10 | 未知 | 🟡 中 |

**重点审查 `snapshot/repo.rs`**:

需要进一步确认这 10 个 unsafe 块的用途。但从文件名推断，可能是文件系统原子写入操作（`std::fs::rename` 等），而非内存安全关键代码。

### 2.7 密码学评估

**`BasicAuthProvider`** (已修复):
- 之前使用 SHA-256 + 盐，但盐生成基于 `Date.now()`（可预测）
- 已移除默认密码
- 建议: 迁移到 `bcrypt` 或 `Argon2id`

**`hashPassword` 当前实现**:
```typescript
const salt = createHash('sha256').update(Date.now().toString()).digest('hex').slice(0, 16)
const hash = createHash('sha256').update(salt + password).digest('hex')
```

**问题**:
1. SHA-256 不是密码学哈希算法（太快了，易受暴力破解）
2. 盐基于时间戳，可预测
3. 没有 key stretching（如 PBKDF2, bcrypt, Argon2）

**建议**: 使用 `bcrypt` 或 `argon2`。

---

## 3. 安全评分卡

| 维度 | 评分 | 说明 |
|------|------|------|
| SQL 注入防护 | 🟢 **A** | 全部参数化查询 |
| 命令注入防护 | 🟡 **B** | 有沙箱，但 trust_mode 可绕过 |
| 数据主权 (CON-01) | 🟢 **A** | 有规则 + E2E 测试 |
| Secrets 管理 | 🟢 **A** | 三层优先级 + 权限检查 |
| 密码学 | 🔴 **D** | SHA-256 用于密码，盐可预测 |
| unsafe 代码 | 🟡 **B** | 主要是测试 env 操作 |
| 错误处理 | 🟡 **C** | 大量 unwrap，anyhow  everywhere |

**整体安全评分: B-**

---

## 4. 第三阶段行动项

### 立即执行
- [ ] **修复 `BasicAuthProvider` 密码哈希** — 迁移到 bcrypt/Argon2
- [ ] **审查 `snapshot/repo.rs` unsafe 块** — 确认用途和安全性

### 本周内
- [ ] **替换 agent tools 中的 unwrap** — document.rs, ocr.rs, legal_db.rs, patent_db.rs
- [ ] **审查沙箱策略** — `sandbox/seatbelt.rs`, `sandbox/landlock.rs`
- [ ] **引入 `AgentError` 枚举** — 替换 `anyhow::Result` 在 agent 中的使用

### 本月内
- [ ] **建立错误码体系** — 统一 Rust + TS 的错误分类
- [ ] **审计 CON-01 拦截日志** — 确认规则有效性和误报率

---

*第三阶段完成。等待第四阶段指令。*
