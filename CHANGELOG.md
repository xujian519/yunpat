# 云熙知识产权智能体

## 开发日志

### v0.1.0 (2026-05-08)

**🎉 项目初始化**

- 建立 Monorepo 架构
- 整合 DeepSeek-TUI（Rust 交互层）
- 整合 YunPat（TypeScript 业务层）
- 统一品牌：云熙知识产权智能体
- 作者：徐健 <xujian519@gmail.com>

**架构**

- `crates/` - Rust 基础设施层（TUI/CLI/核心运行时）
- `packages/` - TypeScript 业务层（29 个专业 Agent）
- `knowledge-base/` - 专利知识库（4382 个文件）
- `constitutional/` - 宪法规则引擎

**技术栈**

- Rust 1.88+（交互层、宪法引擎）
- TypeScript 5.3+（业务逻辑、Agent 编排）
- Node.js 18+ + pnpm 8+
- PostgreSQL + Neo4j + Milvus

---

**作者**: 徐健 <xujian519@gmail.com>  
**许可证**: MIT
