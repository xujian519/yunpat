# YunPat 文档索引

> 最后更新：2026-05-03  
> 文档总数：177 个

本文档提供了 YunPat 项目文档的完整索引和组织结构。

---

## 📑 快速导航

| 类别                      | 文件数 | 说明           |
| ------------------------- | ------ | -------------- |
| [🚀 CI/CD](#-cicd-文档)   | 11     | 持续集成与部署 |
| [📖 指南](#-开发指南)     | 20     | 开发与协作指南 |
| [🔍 质量保证](#-质量保证) | 7      | 代码质量与优化 |
| [📊 报告](#-项目报告)     | 48     | 各类项目报告   |
| [🏗️ 架构](#-架构设计)     | 1      | 系统架构文档   |
| [🔧 工具](#-工具文档)     | 4      | 工具相关文档   |
| [📋 计划](#-项目计划)     | 7      | 开发计划       |
| [📝 总结](#-技术总结)     | 6      | 技术总结       |
| [🧪 测试](#-测试文档)     | 1      | 测试文档       |
| [📦 资产](#-资产引入)     | 5      | 数据资产引入   |

---

## 🚀 CI/CD 文档

### 主要 CI/CD 文档 (`docs/cicd/`)

- **[CI_CD_BEST_PRACTICES.md](cicd/CI_CD_BEST_PRACTICES.md)** - CI/CD 最佳实践
- **[CI_CD_RESEARCH_SUMMARY.md](cicd/CI_CD_RESEARCH_SUMMARY.md)** - CI/CD 研究总结
- **[CI_SETUP_GUIDE.md](cicd/CI_SETUP_GUIDE.md)** - CI 设置指南
- **[CI_STATUS_REPORT.md](cicd/CI_STATUS_REPORT.md)** - CI 状态报告
- **[LOCAL_CI_GUIDE.md](cicd/LOCAL_CI_GUIDE.md)** - 本地 CI 指南
- **[LOCAL_CI_QUICK_REF.md](cicd/LOCAL_CI_QUICK_REF.md)** - 本地 CI 快速参考
- **[LOCAL_CI_SETUP_REPORT.md](cicd/LOCAL_CI_SETUP_REPORT.md)** - 本地 CI 设置报告

### CI 监控与优化 (`docs/ci/`)

- **[CI_FAILURE_INVESTIGATION.md](ci/CI_FAILURE_INVESTIGATION.md)** - CI 失败调查
- **[CI_MONITORING_GUIDE.md](ci/CI_MONITORING_GUIDE.md)** - CI 监控指南
- **[CI_OPTIMIZATION_PLAN.md](ci/CI_OPTIMIZATION_PLAN.md)** - CI 优化计划
- **[CI_OPTIMIZATION_RESULTS.md](ci/CI_OPTIMIZATION_RESULTS.md)** - CI 优化结果
- **[cicd-monitoring-guide.md](cicd-monitoring-guide.md)** - CI/CD 监控指南

### 根目录 CI 文档

- **[CICD_STATUS.md](CICD_STATUS.md)** - CI/CD 状态总览
- **[runner-configuration.md](runner-configuration.md)** - Runner 配置说明

---

## 📖 开发指南

### 快速开始

- **[START_NOW.md](guides/START_NOW.md)** - ⚡ 快速开始
- **[quick-start.md](guides/quick-start.md)** - 快速入门指南
- **[quickstart-glm.md](guides/quickstart-glm.md)** - GLM 快速开始

### 团队协作

- **[TEAM_ONBOARDING.md](guides/TEAM_ONBOARDING.md)** - 团队入职指南
- **[TEAM_ONBOARDING_CHECKLIST.md](guides/TEAM_ONBOARDING_CHECKLIST.md)** - 入职检查清单
- **[CONTRIBUTING.md](guides/CONTRIBUTING.md)** - 贡献指南

### 开发指南

- **[development.md](guides/development.md)** - 开发流程指南
- **[api.md](guides/api.md)** - API 使用指南
- **[writing-style.md](guides/writing-style.md)** - 文档写作风格
- **[agent-integration.md](guides/agent-integration.md)** - Agent 集成指南

### GLM 相关

- **[glm-setup.md](guides/glm-setup.md)** - GLM 环境设置
- **[glm-usage.md](guides/glm-usage.md)** - GLM 使用指南
- **[production-usage.md](guides/production-usage.md)** - 生产环境使用

### GitHub 设置

- **[GITHUB_SETUP.md](guides/GITHUB_SETUP.md)** - GitHub 配置
- **[GITHUB_SUMMARY.md](guides/GITHUB_SUMMARY.md)** - GitHub 总结
- **[GITHUB_CHECKLIST.md](guides/GITHUB_CHECKLIST.md)** - GitHub 检查清单

### 其他指南

- **[AGENTS.md](guides/AGENTS.md)** - Agent 介绍
- **[CLAUDE.md](guides/CLAUDE.md)** - Claude 使用指南
- **[backward-compatibility.md](guides/backward-compatibility.md)** - 向后兼容性说明
- **[KARPATHI_CI_DESIGN.md](guides/KARPATHI_CI_DESIGN.md)** - Karpathy CI 设计
- **[KARPATHY_PRINCIPLES_GUIDE.md](guides/KARPATHY_PRINCIPLES_GUIDE.md)** - Karpathy 原则指南

---

## 🔍 质量保证

### 代码质量文档 (`docs/quality/`)

- **[CODE_QUALITY_OPTIMIZATION.md](quality/CODE_QUALITY_OPTIMIZATION.md)** - 代码质量优化
- **[CODE_QUALITY_IMPROVEMENTS.md](quality/CODE_QUALITY_IMPROVEMENTS.md)** - 代码质量改进
- **[CODE_QUALITY_COMPLETION_REPORT.md](quality/CODE_QUALITY_COMPLETION_REPORT.md)** - 质量完成报告
- **[CODE_QUALITY_VERIFICATION_REPORT.md](quality/CODE_QUALITY_VERIFICATION_REPORT.md)** - 质量验证报告
- **[CODE_QUALITY_CHECKLIST.md](quality/CODE_QUALITY_CHECKLIST.md)** - 代码质量检查清单

### 代码优化

- **[CODE_OPTIMIZATION_ROUND2.md](quality/CODE_OPTIMIZATION_ROUND2.md)** - 代码优化第二轮
- **[CODE_OPTIMIZATION_ROUND3.md](quality/CODE_OPTIMIZATION_ROUND3.md)** - 代码优化第三轮

---

## 📊 项目报告

### 主要报告 (`docs/reports/`)

- **[FINAL_PROJECT_REPORT.md](reports/FINAL_PROJECT_REPORT.md)** - 最终项目报告
- **[PROJECT_COMPLETION_REPORT.md](reports/PROJECT_COMPLETION_REPORT.md)** - 项目完成报告
- **[TESTING_SUMMARY.md](reports/TESTING_SUMMARY.md)** - 测试总结
- **[TEST_REPORT.md](reports/TEST_REPORT.md)** - 测试报告
- **[INTEGRATION_TEST_REPORT.md](reports/INTEGRATION_TEST_REPORT.md)** - 集成测试报告

### TDD 报告

- **[TDD_COMPLETE_REPORT.md](reports/TDD_COMPLETE_REPORT.md)** - TDD 完整报告
- **[TDD_GREEN_PHASE_REPORT.md](reports/TDD_GREEN_PHASE_REPORT.md)** - TDD 绿色阶段报告
- **[TDD_REFACTOR_PHASE_REPORT.md](reports/TDD_REFACTOR_PHASE_REPORT.md)** - TDD 重构阶段报告

### 工具相关报告

- **[TOOLS_VERIFICATION_REPORT.md](reports/TOOLS_VERIFICATION_REPORT.md)** - 工具验证报告
- **[TOOL_SELECTION_COMPLETE_REPORT.md](reports/TOOL_SELECTION_COMPLETE_REPORT.md)** - 工具选择完成报告
- **[TOOL_SELECTION_IMPLEMENTATION_REPORT.md](reports/TOOL_SELECTION_IMPLEMENTATION_REPORT.md)** - 工具选择实施报告

### CI/CD 报告

- **[ci-cd-status.md](reports/ci-cd-status.md)** - CI/CD 状态
- **[ci-cd-check-20260501.md](reports/ci-cd-check-20260501.md)** - CI/CD 检查报告
- **[cicd-status-report-2026-05-03.md](reports/cicd-status-report-2026-05-03.md)** - CI/CD 状态报告
- **[ci-quality-20260430.md](reports/ci-quality-20260430.md)** - CI 质量报告
- **[runner-optimization-summary.md](reports/runner-optimization-summary.md)** - Runner 优化总结
- **[runner-unblock-guide.md](reports/runner-unblock-guide.md)** - Runner 解阻塞指南

### 代码质量报告

- **[code-quality-review.md](reports/code-quality-review.md)** - 代码质量审查
- **[code-quality-audit-20260501.md](reports/code-quality-audit-20260501.md)** - 代码质量审计
- **[code-review-summary.md](reports/code-review-summary.md)** - 代码审查总结
- **[code-review.md](reports/code-review.md)** - 代码审查报告
- **[phase-0-code-review.md](reports/phase-0-code-review.md)** - Phase 0 代码审查

### 2026年4月报告 (`docs/reports/2026-04/`)

包含28个4月份的开发、优化和重构报告。

### 2026年5月报告 (`docs/reports/2026-05/`)

包含15个5月份的开发进度、代码清理和功能完成报告。

---

## 🏗️ 架构设计

- **[ADR_001_directory_structure.md](architecture/ADR_001_directory_structure.md)** - 目录结构架构决策记录

---

## 🔧 工具文档

- **[overview.md](tools/overview.md)** - 工具概览
- **[status.md](tools/status.md)** - 工具状态
- **[selection-accuracy-improvement.md](tools/selection-accuracy-improvement.md)** - 选择准确性改进
- **[clawcode-patent-tools.md](tools/clawcode-patent-tools.md)** - ClawCode 专利工具

---

## 📋 项目计划

### 主要计划 (`docs/plans/`)

- **[README.md](plans/README.md)** - 计划文档说明
- **[agent-tasks-assignment.md](plans/agent-tasks-assignment.md)** - Agent 任务分配
- **[core-framework-completion-plan.md](plans/core-framework-completion-plan.md)** - 核心框架完成计划
- **[knowledge-base-integration.md](plans/knowledge-base-integration.md)** - 知识库集成计划

### 功能计划 (`docs/plans/feature/`)

- **[mvp-implementation-integrated.md](plans/feature/mvp-implementation-integrated.md)** - MVP 集成实施计划
- **[patent-drafting-mvp-implementation.md](plans/feature/patent-drafting-mvp-implementation.md)** - 专利撰写 MVP 实施

### 重构计划 (`docs/plans/refactor/`)

- **[2026-04-refactor-plan.md](plans/refactor/2026-04-refactor-plan.md)** - 2026年4月重构计划
- **[2026-04-refactor-plan-alt.md](plans/refactor/2026-04-refactor-plan-alt.md)** - 重构计划备选方案
- **[2026-04-refactor-execution-report.md](plans/refactor/2026-04-refactor-execution-report.md)** - 重构执行报告

---

## 📝 技术总结

- **[final-summary.md](summaries/final-summary.md)** - 最终总结
- **[tools-implementation.md](summaries/tools-implementation.md)** - 工具实现总结
- **[patent-tools-implementation.md](summaries/patent-tools-implementation.md)** - 专利工具实现总结
- **[rust-integration.md](summaries/rust-integration.md)** - Rust 集成总结
- **[knowledge-base-integration.md](summaries/knowledge-base-integration.md)** - 知识库集成总结
- **[integration-test.md](summaries/integration-test.md)** - 集成测试总结
- **[prompt-templates.md](summaries/prompt-templates.md)** - Prompt 模板总结

---

## 🧪 测试文档

- **[LLM_TESTING_REPORT.md](testing/reports/LLM_TESTING_REPORT.md)** - LLM 测试报告

---

## 📦 资产引入

- **[YunPat数据资产引入计划.md](资产引入/YunPat数据资产引入计划.md)** - 数据资产引入计划
- **[YunPat数据资产引入完成报告.md](资产引入/YunPat数据资产引入完成报告.md)** - 资产引入完成报告
- **[YunPat数据资产引入最终报告.md](资产引入/YunPat数据资产引入最终报告.md)** - 资产引入最终报告
- **[YunPat数据资产引入完成报告-完整版.md](资产引入/YunPat数据资产引入完成报告-完整版.md)** - 完整版报告
- **[YunPat-Athena-Integration-Plan.md](资产引入/YunPat-Athena-Integration-Plan.md)** - Athena 集成计划
- **[专利智能体可复用资产报告\_RustTS版.md](资产引入/专利智能体可复用资产报告_RustTS版.md)** - 可复用资产报告

---

## 🗂️ 其他重要文档

### 项目核心文档

- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - 📁 项目结构说明
- **[README.md](README.md)** - 📖 文档目录说明
- **[FILE_MANAGEMENT_RULES.md](FILE_MANAGEMENT_RULES.md)** - 📋 文件管理规则
- **[SECURITY_GUIDELINES.md](SECURITY_GUIDELINES.md)** - 🔒 安全指南

### 项目管理

- **[roadmap.md](roadmap.md)** - 🗺️ 项目路线图
- **[PROJECT_CLEANUP_PLAN.md](PROJECT_CLEANUP_PLAN.md)** - 🧹 项目清理计划
- **[CLEANUP_SUMMARY.md](CLEANUP_SUMMARY.md)** - 清理总结

---

## 📚 归档文档

### 历史文档 (`docs/history/`)

包含2026年4月重构期间的历史文档（27个文件）

### 归档文档 (`docs/archive/`)

包含归档的计划和报告（12个文件）

---

## 🔗 外部链接

- **[项目主 README](../README.md)** - YunPat 项目主文档
- **[更新日志](../CHANGELOG.md)** - 版本更新记录
- **[许可证](../LICENSE)** - MIT License

---

## 📊 文档统计

| 类别       | 数量    |
| ---------- | ------- |
| CI/CD 文档 | 11      |
| 开发指南   | 20      |
| 质量保证   | 7       |
| 项目报告   | 48      |
| 架构设计   | 1       |
| 工具文档   | 4       |
| 项目计划   | 7       |
| 技术总结   | 6       |
| 测试文档   | 1       |
| 资产引入   | 5       |
| 核心文档   | 4       |
| 项目管理   | 3       |
| 归档文档   | 39      |
| **总计**   | **177** |

---

## 💡 使用建议

### 新手入门

1. 阅读 [START_NOW.md](guides/START_NOW.md) 快速开始
2. 查看 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) 了解项目结构
3. 参考 [quick-start.md](guides/quick-start.md) 进行环境配置

### 开发者

1. 阅读 [development.md](guides/development.md) 了解开发流程
2. 查看 [FILE_MANAGEMENT_RULES.md](FILE_MANAGEMENT_RULES.md) 遵循文件规范
3. 参考 [CODE_QUALITY_CHECKLIST.md](quality/CODE_QUALITY_CHECKLIST.md) 保证代码质量

### 贡献者

1. 阅读 [CONTRIBUTING.md](guides/CONTRIBUTING.md) 了解贡献流程
2. 查看 [TEAM_ONBOARDING.md](guides/TEAM_ONBOARDING.md) 团队协作指南
3. 遵循 [writing-style.md](guides/writing-style.md) 文档风格

---

**维护提示**：当新增或移动文档时，请及时更新本索引以保持准确性。
