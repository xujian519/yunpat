# YunPat 文档中心

**版本**: v0.1.0 (开发中)
**更新时间**: 2026-05-06

---

## 文档导航

### 快速开始

- [项目介绍](../README.md) - YunPat 项目概述和快速开始
- [Claude Code 指南](./guides/CLAUDE.md) - 开发者协作指南（含架构详解、开发命令）
- [AI 助手指南](../AGENTS.md) - 完整技术参考（面向 AI 编程助手）
- [变更日志](../CHANGELOG.md) - 版本历史
- [发展路线图](./plans/roadmap.md) - 项目发展路线图

---

### 顶层文档

- [项目结构说明](./PROJECT_STRUCTURE.md) - 完整目录结构
- [测试迁移指南](./TEST_MIGRATION_GUIDE.md) - 测试迁移说明
- [TUI 网关实施计划](./TUI_GATEWAY_IMPLEMENTATION_PLAN.md) - TUI 网关实现方案
- [TUI 实施总结](./TUI_IMPLEMENTATION_SUMMARY.md) - TUI 实施概要

---

## 开发指南 (guides/)

- [Claude Code 指南](./guides/CLAUDE.md) - 开发者协作指南
- [AI 助手指南](./guides/AGENTS.md) - AI 助手参考
- [快速开始指南](./guides/quick-start.md) - 推理层增强功能快速上手
- [GLM 快速开始](./guides/quickstart-glm.md) - GLM 模型快速配置
- [GLM 设置指南](./guides/glm-setup.md) - GLM 环境配置详解
- [GLM 使用指南](./guides/glm-usage.md) - GLM 模型使用指南
- [GLM-4-7 设置](./guides/GLM-4-7-SETUP.md) - GLM-4-7 模型设置
- [GLM 模型总览](./guides/GLM-MODELS.md) - GLM 模型系列说明
- [GLM 快速参考](./guides/GLM-QUICKSTART.md) - GLM 快速参考卡
- [API 文档](./guides/api.md) - 智能体 API、Rust 工具 API、MCP 工具接口
- [开发指南](./guides/development.md) - 环境搭建、开发流程
- [生产环境使用指南](./guides/production-usage.md) - 生产环境最佳实践
- [智能体集成指南](./guides/agent-integration.md) - 智能体集成完整指南
- [条件激活指南](./guides/conditional-activation-guide.md) - 条件激活机制说明
- [写作风格指南](./guides/writing-style.md) - 文档写作风格规范
- [向后兼容指南](./guides/backward-compatibility.md) - 版本升级说明
- [Skills 快速开始](./guides/skills-quickstart.md) - Skills 系统上手指南
- [Orchestrator 使用指南](./guides/orchestrator-usage.md) - 编排器使用说明
- [监控系统指南](./guides/monitoring.md) - Prometheus + Grafana 监控
- [部署指南](./guides/deployment.md) - Docker 部署说明
- [贡献指南](./guides/CONTRIBUTING.md) - 项目贡献规范
- [API Key 故障排除](./guides/API-KEY-TROUBLESHOOTING.md) - API Key 常见问题
- [GitHub 设置](./guides/GITHUB_SETUP.md) - GitHub 仓库配置
- [GitHub 检查清单](./guides/GITHUB_CHECKLIST.md) - GitHub 操作检查项
- [GitHub 总结](./guides/GITHUB_SUMMARY.md) - GitHub 配置总结
- [Karpathy 原则指南](./guides/KARPATHY_PRINCIPLES_GUIDE.md) - Karpathy 编码原则
- [Karpathy CI 设计](./guides/KARPATHI_CI_DESIGN.md) - Karpathy 原则下的 CI 设计
- [团队入职指南](./guides/TEAM_ONBOARDING.md) - 新成员入职说明
- [团队入职检查清单](./guides/TEAM_ONBOARDING_CHECKLIST.md) - 入职检查项
- [立即开始](./guides/START_NOW.md) - 快速启动指引

---

## 架构文档 (architecture/)

- [架构概览](./architecture/ARCHITECTURE_AUTO.md) - 系统架构概述
- [ADR 001 目录结构](./architecture/ADR_001_directory_structure.md) - 目录结构决策记录
- [Athena 架构](./architecture/athena-first-architecture.md) - Athena 初版架构
- [Athena 复用方案](./architecture/athena-reuse-solution.md) - Athena 复用解决方案

---

## 计划文档 (plans/)

### 总览

- [计划目录](./plans/README.md) - 计划文档索引
- [发展路线图](./plans/roadmap.md) - 项目发展路线图

### 开发计划

- [知识库集成计划](./plans/knowledge-base-integration.md) - 知识库集成与提示词提炼方案
- [核心框架完成计划](./plans/core-framework-completion-plan.md) - 核心框架开发计划
- [编排器架构计划](./plans/orchestrator-architecture-implementation-plan.md) - 编排器架构实施计划
- [全集成计划](./plans/full-integration-plan.md) - 全面集成方案
- [Agent 集成报告](./plans/agent-integration-report.md) - Agent 集成进度
- [Agent 任务分配](./plans/agent-tasks-assignment.md) - Agent 任务分配方案
- [既有实现报告](./plans/existing-implementations-report.md) - 已有实现盘点
- [工具盘点报告](./plans/tools-inventory-report.md) - 工具资产盘点
- [目录重组方案](./plans/directory-reorganization-plan.md) - 目录重组方案
- [目录重组完成报告](./plans/directory-reorganization-completion-report.md) - 目录重组完成报告

### Phase 1 任务报告

- [P1-T01 专利工具报告](./plans/p1-t01-patent-tools-report.md)
- [P1-T02 内置工具报告](./plans/p1-t02-builtin-tools-report.md)
- [P1-T03 文档工具报告](./plans/p1-t03-document-tools-report.md)
- [P1-T04 Athena 工具报告](./plans/p1-t04-athena-tools-report.md)
- [P1-T06 工具去重复用计划](./plans/p1-t06-tool-deduplication-and-reuse-plan.md)
- [P1-T07 完成报告](./plans/p1-t07-completion-report.md)
- [P1-T08 完成报告](./plans/p1-t08-completion-report.md)
- [P1-T09/T10 完成报告](./plans/p1-t09-t10-completion-report.md)
- [P1-T12 第一周最终验收报告](./plans/p1-t12-week1-final-acceptance-report.md)

### 阶段报告

- [Phase 1 详细任务](./plans/phase1-detailed-tasks.md)
- [Phase 1 代码质量改进](./plans/phase1-code-quality-improvements.md)
- [Phase 1 代码质量审查](./plans/phase1-code-quality-review.md)
- [Phase 1 最终验收报告](./plans/phase1-final-acceptance-report.md)
- [Phase 1 中期验收报告](./plans/phase1-interim-acceptance-report.md)
- [Phase 2 详细计划](./plans/phase2-detailed-plan.md)
- [Phase 2 第一周完成报告](./plans/phase2-week1-completion-report.md)
- [Phase 2 第一周单元测试完成报告](./plans/phase2-week1-unit-tests-completion-report.md)
- [Phase 4 详细实施计划](./plans/phase4-detailed-implementation-plan.md)
- [Phase 4 执行摘要](./plans/phase4-executive-summary.md)
- [Phase 4 最终报告](./plans/phase4-final-report.md)
- [Phase 4 Day 1 完成报告](./plans/phase4-day1-completion-report.md)
- [Phase 4 Day 2-3 完成报告](./plans/phase4-day2-3-completion-report.md)
- [Phase 4 Day 4-5 完成报告](./plans/phase4-day4-5-completion-report.md)
- [Phase 4 第二周完成报告](./plans/phase4-week2-completion-report.md)
- [Phase 4 第三周完成报告](./plans/phase4-week3-completion-report.md)
- [Phase 6 系统集成部署计划](./plans/phase6-system-integration-deployment-plan.md)

### 周报

- [第一周总结](./plans/week1-summary.md)
- [第二周最终验收报告](./plans/week2-final-acceptance-report.md)
- [第二周中期总结](./plans/week2-interim-summary.md)

### 优化计划

- [优化执行摘要](./plans/optimization/EXECUTIVE_SUMMARY.md) - 优化方案概述
- [完整优化计划](./plans/optimization/prompt-system-optimization-plan.md) - 6 阶段 8 周详细计划

### 重构计划

- [重构计划](./plans/refactor/2026-04-refactor-plan.md)
- [重构备选计划](./plans/refactor/2026-04-refactor-plan-alt.md)
- [重构执行报告](./plans/refactor/2026-04-refactor-execution-report.md)

### 功能计划 (plans/feature/)

- [MVP 实施集成方案](./plans/feature/mvp-implementation-integrated.md)
- [专利撰写 MVP 实施](./plans/feature/patent-drafting-mvp-implementation.md)

### 实施计划 (plans/implementation/)

- [Phase 1 详细计划](./plans/implementation/phase-1-detailed-plan.md)

---

## 完成报告 (reports/)

### 2026年4月 (reports/2026-04/)

- [清理总结](./reports/2026-04/2026-04-28-cleanup-summary.md)
- [CLI/MCP 完成总结](./reports/2026-04/2026-04-28-cli-mcp-completion-summary.md)
- [代码质量审查](./reports/2026-04/2026-04-28-code-quality-review.md)
- [开发进度](./reports/2026-04/2026-04-28-development-progress.md)
- [文档更新总结](./reports/2026-04/2026-04-28-doc-update-summary.md)
- [集成工作总结](./reports/2026-04/2026-04-28-integration-work-summary.md)
- [优化第二轮报告](./reports/2026-04/2026-04-28-optimization-round2-report.md)
- [工作总结](./reports/2026-04/2026-04-28-work-summary.md)
- [完整重构总结](./reports/2026-04/2026-04-29-complete-refactor-summary.md)
- [目录结构 Karpathy 分析](./reports/2026-04/2026-04-29-directory-structure-karpathy-analysis.md)
- [空目录清理](./reports/2026-04/2026-04-29-empty-directory-cleanup.md)
- [文件清理报告](./reports/2026-04/2026-04-29-file-cleanup-report.md)
- [结构重构执行](./reports/2026-04/2026-04-29-structure-refactor-execution.md)

### 2026年5月 (reports/2026-05/)

- [CLI/MCP 实现报告](./reports/2026-05/cli-mcp-implementation-report.md)
- [核心逻辑验证报告](./reports/2026-05/core-logic-verification-report.md)
- [最终完成报告](./reports/2026-05/FINAL_COMPLETION_REPORT.md)
- [P0 关键修复报告](./reports/2026-05/P0-CRITICAL-FIXES-REPORT.md)
- [项目完成报告](./reports/2026-05/PROJECT_COMPLETION_REPORT.md)
- [项目完成摘要](./reports/2026-05/PROJECT_COMPLETION_SUMMARY.md)
- [模块完成报告](./reports/2026-05/MODULE_COMPLETION_REPORT.md)
- [模块完成计划](./reports/2026-05/MODULE_COMPLETION_PLAN.md)
- [MCP 完成报告](./reports/2026-05/MCP_COMPLETION_REPORT.md)
- [MCP 服务器完成报告](./reports/2026-05/MCP_SERVER_COMPLETION_REPORT.md)
- [Batch Optimizer 完成](./reports/2026-05/batch-optimizer-completion.md)
- [代码清理总结](./reports/2026-05/code-cleanup-summary.md)
- [代码质量审计 Karpathy](./reports/2026-05/code-quality-audit-karpathy.md)
- [代码审查总结](./reports/2026-05/code-review-summary.md)
- [综合修复报告](./reports/2026-05/comprehensive-fix-report.md)
- [目录结构审计](./reports/2026-05/directory-structure-audit.md)
- [最终总结](./reports/2026-05/final-summary.md)
- [网关进度](./reports/2026-05/gateway-progress.md)
- [GLM 测试](./reports/2026-05/glm-test.md)
- [交互层修复](./reports/2026-05/interactive-layer-fixes.md)
- [P0/P1 修复总结](./reports/2026-05/p0-p1-fixes-summary.md)
- [Phase 1 进度报告](./reports/2026-05/phase-1-progress-report.md)
- [Phase 1 总结](./reports/2026-05/phase-1-summary.md)
- [Phase 2 总结](./reports/2026-05/phase-2-summary.md)
- [Phase 3 计划](./reports/2026-05/phase-3-plan.md)
- [Phase 3 总结](./reports/2026-05/phase-3-summary.md)
- [Phase 4 计划](./reports/2026-05/phase-4-plan.md)
- [Phase 4 总结](./reports/2026-05/phase-4-summary.md)
- [Phase 1 完成](./reports/2026-05/phase1-completion.md)
- [Phase 1 最终总结](./reports/2026-05/phase1-final-summary.md)
- [提示词系统对比分析](./reports/2026-05/prompt-system-comparison-analysis.md)
- [根目录清理](./reports/2026-05/root-directory-cleanup.md)
- [安全修复](./reports/2026-05/security-fixes.md)
- [工具验证](./reports/2026-05/tools-verification.md)

### 综合报告

- [Bug 修复日志](./reports/BUG_FIX_LOG.md)
- [4 周改进进度](./reports/4-week-improvement-progress-report.md)
- [当前进度报告](./reports/current-progress-report.md)
- [最终完成总结](./reports/final-completion-summary.md)
- [GitHub CI/CD 设置报告](./reports/github-cicd-setup-report.md)
- [多 Agent 协作进度](./reports/multi-agent-collaboration-progress.md)
- [性能测试报告](./reports/performance-test-report.md)
- [Phase 1 工具层验证总结](./reports/phase1-tool-layer-validation-summary.md)
- [PR 合并完成报告](./reports/pr-merge-completion-report.md)
- [进度更新 23:10](./reports/progress-update-23-10.md)
- [项目最终总结](./reports/project-final-summary.md)
- [项目总结](./reports/project-summary.md)
- [任务完成报告](./reports/tasks-completion-report.md)
- [测试和扩展总结](./reports/test-and-extension-summary.md)
- [测试执行总结报告](./reports/test-execution-summary-report.md)
- [测试修复完成报告](./reports/test-fix-completion-report.md)
- [测试修复总结报告](./reports/test-fixes-summary-report.md)
- [工具资产盘点](./reports/tool-asset-inventory.md)
- [工具去重计划](./reports/tool-deduplication-plan.md)
- [工具补充建议](./reports/tool-supplement-recommendations.md)
- [类型错误修复进度](./reports/type-error-fix-progress.md)
- [统一知识图谱总结](./reports/unified-knowledge-graph-summary.md)
- [第二周集成完成报告](./reports/week2-integration-completion-report.md)
- [第三周性能优化报告](./reports/week3-performance-optimization-report.md)
- [第四周测试总结报告](./reports/week4-testing-summary-report.md)

### 归档报告 (reports/ARCHIVE/)

- [代码审查报告](./reports/ARCHIVE/CODE_REVIEW_REPORT.md)
- [最终项目报告](./reports/ARCHIVE/FINAL_PROJECT_REPORT.md)
- [集成测试报告](./reports/ARCHIVE/INTEGRATION_TEST_REPORT.md)
- [LLM Client Mock 修复报告](./reports/ARCHIVE/LLMCLIENT_MOCK_FIX_REPORT.md)
- [MVP Agent 验证报告](./reports/ARCHIVE/MVP-AGENTS-VERIFICATION-REPORT.md)
- [Phase 2 总结](./reports/ARCHIVE/PHASE2_SUMMARY.md)
- [Phase 5 集成测试报告](./reports/ARCHIVE/PHASE5_INTEGRATION_TEST_REPORT.md)
- [Phase 6 验收报告](./reports/ARCHIVE/PHASE6_ACCEPTANCE_REPORT.md)
- [项目完成报告](./reports/ARCHIVE/PROJECT_COMPLETION_REPORT.md)
- [TDD 完成报告](./reports/ARCHIVE/TDD_COMPLETE_REPORT.md)
- [TDD Green Phase 报告](./reports/ARCHIVE/TDD_GREEN_PHASE_REPORT.md)
- [TDD Refactor Phase 报告](./reports/ARCHIVE/TDD_REFACTOR_PHASE_REPORT.md)
- [测试总结](./reports/ARCHIVE/TESTING_SUMMARY.md)
- [测试报告](./reports/ARCHIVE/TEST_REPORT.md)
- [工具验证报告](./reports/ARCHIVE/TOOLS_VERIFICATION_REPORT.md)
- [工具选型完成报告](./reports/ARCHIVE/TOOL_SELECTION_COMPLETE_REPORT.md)
- [工具选型实施报告](./reports/ARCHIVE/TOOL_SELECTION_IMPLEMENTATION_REPORT.md)
- [第五周计划](./reports/ARCHIVE/WEEK5_PLAN.md)
- [第五周进度](./reports/ARCHIVE/WEEK5_PROGRESS.md)
- [第五周总结](./reports/ARCHIVE/WEEK5_SUMMARY.md)
- [CI/CD 检查 20260501](./reports/ARCHIVE/ci-cd-check-20260501.md)
- [CI/CD 状态](./reports/ARCHIVE/ci-cd-status.md)
- [CI 质量 20260430](./reports/ARCHIVE/ci-quality-20260430.md)
- [CI/CD 检查 2026-05-03](./reports/ARCHIVE/cicd-check-2026-05-03.md)
- [CI/CD 检查报告 2026-05-03](./reports/ARCHIVE/cicd-check-report-2026-05-03.md)
- [CI/CD 状态报告 2026-05-03](./reports/ARCHIVE/cicd-status-report-2026-05-03.md)
- [CLI 重构总结 2026-05-03](./reports/ARCHIVE/cli-refactoring-summary-2026-05-03.md)
- [代码质量审计 20260501](./reports/ARCHIVE/code-quality-audit-20260501.md)
- [代码质量审查](./reports/ARCHIVE/code-quality-review.md)
- [代码审查](./reports/ARCHIVE/code-review.md)
- [部署就绪 2026-05-03](./reports/ARCHIVE/deployment-ready-2026-05-03.md)
- [文档更新 2026-05-03](./reports/ARCHIVE/documentation-update-2026-05-03.md)
- [ESLint 和 API Key 修复 2026-05-03](./reports/ARCHIVE/eslint-and-api-key-fixes-2026-05-03.md)
- [最终 MVP 完成报告（完整版）](./reports/ARCHIVE/final-mvp-completion-report-2026-05-03-FULL.md)
- [最终 MVP 完成报告](./reports/ARCHIVE/final-mvp-completion-report-2026-05-03.md)
- [最终验证](./reports/ARCHIVE/final-verification.md)
- [Git Push 和 CI/CD 总结 2026-05-03](./reports/ARCHIVE/git-push-and-cicd-summary-2026-05-03.md)
- [GLM-4-7 设置完成 2026-05-03](./reports/ARCHIVE/glm-4-7-setup-complete-2026-05-03.md)
- [Karpathy 代码审查 2026-05-03](./reports/ARCHIVE/karpathy-code-review-2026-05-03.md)
- [Karpathy 代码审查总结 2026-05-03](./reports/ARCHIVE/karpathy-code-review-summary-2026-05-03.md)
- [Karpathy 优化最终总结 2026-05-03](./reports/ARCHIVE/karpathy-optimization-final-summary-2026-05-03.md)
- [MVP 进度和技债分析 2026-05-03](./reports/ARCHIVE/mvp-progress-and-tech-debt-analysis-2026-05-03.md)
- [MVP 进度报告 2026-05-02](./reports/ARCHIVE/mvp-progress-report-2026-05-02.md)
- [MVP 超级思考分析 v2](./reports/ARCHIVE/mvp-super-thinking-analysis-v2-enhanced.md)
- [MVP 超级思考分析](./reports/ARCHIVE/mvp-super-thinking-analysis.md)
- [Phase 0 代码审查](./reports/ARCHIVE/phase-0-code-review.md)
- [Phase 2 完成报告 2026-05-03](./reports/ARCHIVE/phase2-completion-report-2026-05-03.md)
- [Phase 2 最终总结 2026-05-03](./reports/ARCHIVE/phase2-final-summary-2026-05-03.md)
- [Phase 3 完成报告 2026-05-03](./reports/ARCHIVE/phase3-completion-report-2026-05-03.md)
- [Phase 4 完成报告 2026-05-03](./reports/ARCHIVE/phase4-completion-report-2026-05-03.md)
- [优化后任务完成 2026-05-03](./reports/ARCHIVE/post-optimization-tasks-completion-2026-05-03.md)
- [Postgres 集成总结](./reports/ARCHIVE/postgres-integration-summary.md)
- [进度总结 20260501](./reports/ARCHIVE/progress-summary-20260501.md)
- [项目总结](./reports/ARCHIVE/project-summary.md)
- [根清理 2026-05-03](./reports/ARCHIVE/root-cleanup-2026-05-03.md)
- [Runner 优化总结](./reports/ARCHIVE/runner-optimization-summary.md)
- [Runner 解锁指南](./reports/ARCHIVE/runner-unblock-guide.md)
- [Stage 5 进度](./reports/ARCHIVE/stage5-progress.md)
- [工作流修正报告 2026-05-03](./reports/ARCHIVE/workflow-correction-report-2026-05-03.md)

---

## 分析文档 (analysis/)

### 代码质量

- [技术债务评估](./analysis/TECHNICAL_DEBT_ASSESSMENT.md) - 技术债务分析
- [技术债务修复计划](./analysis/TECHNICAL_DEBT_REMEDIATION_PLAN.md) - 债务修复方案
- [技术债务解决报告](./analysis/TECHNICAL_DEBT_RESOLUTION_FINAL_REPORT.md) - 最终解决报告
- [技术债务解决摘要](./analysis/TECHNICAL_DEBT_RESOLUTION_SUMMARY.md) - 解决摘要
- [代码质量行动方案](./analysis/code-quality-action-plan.md) - 质量改进方案
- [代码质量审计](./analysis/code-quality-audit-summary.md) - 质量审计摘要
- [代码质量审查报告](./analysis/code-quality-review-report.md) - 详细审查报告
- [CI/CD 质量检查](./analysis/ci-cd-quality-check-report.md) - CI/CD 质量报告
- [最终 CI 检查](./analysis/final-ci-cd-check-report.md) - CI 检查报告
- [最终完成报告](./analysis/final-completion-report.md) - 完成情况报告
- [执行摘要](./analysis/EXECUTIVE_SUMMARY.md) - 分析执行摘要

### Karpathy 原则

- [绘图理解 Karpathy 审查](./analysis/karpathy-code-review-drawing-understanding.md) - 代码审查
- [Karpathy 重构报告](./analysis/karpathy-refactoring-report.md) - 重构总结

### 提示词系统

- [提示词模板设计](./analysis/prompt-template-design.md) - 模板设计文档
- [提示词系统架构对比](./analysis/prompt-system-architecture-comparison.md) - 架构对比分析
- [提示词系统关键洞察](./analysis/prompt-system-key-insights.md) - 关键发现
- [提示词系统快速参考](./analysis/prompt-system-quick-reference.md) - 快速参考卡
- [知识库集成](./analysis/knowledge-graph-integration.md) - 知识库集成说明
- [知识库集成最终总结](./analysis/knowledge-graph-integration-final-summary.md) - 集成最终总结
- [知识库集成测试报告](./analysis/knowledge-graph-integration-test-report.md) - 集成测试
- [统一知识图谱](./analysis/unified-knowledge-graph-integration.md) - 统一图谱集成
- [优化知识图谱](./analysis/optimized-unified-knowledge-graph.md) - 图谱优化方案

### 系统分析

- [Agent LLM 配置](./analysis/AGENT_LLM_CONFIGURATION.md) - LLM 配置说明
- [API 自动化](./analysis/API_AUTO.md) - API 自动化文档
- [示例自动化](./analysis/EXAMPLES_AUTO.md) - 示例自动化
- [OMXL 集成](./analysis/OMXL_INTEGRATION.md) - OMXL 集成说明

---

## Agent 文档 (agents/)

### 架构

- [Agent 架构](./agents/ARCHITECTURE.md) - Agent 系统架构说明

### 进度报告

- [Agent 列表与知识库集成](./agents/agent-list-and-knowledge-integration.md)
- [Agent 包进度更新](./agents/agent-packages-progress-update.md)
- [Agent 进度报告](./agents/agent-progress-report-2026-05-03.md)
- [Agent 状态诊断](./agents/agent-status-diagnosis-23-15.md)
- [Agent 分析摘要](./agents/agents-analysis-summary.md)
- [Agent 改进报告](./agents/agents-improvement-report.md)
- [Agent 改进最终报告](./agents/agents-improvement-final-report.md)

### 功能实现

- [绘图理解完成报告](./agents/drawing-understanding-completion-report.md)
- [绘图理解文档索引](./agents/drawing-understanding-doc-index.md)
- [绘图理解实现报告](./agents/drawing-understanding-implementation-report.md)
- [增强 OA 答复实现](./agents/enhanced-oa-responder-implementation.md)
- [发明理解 Agent 实现](./agents/invention-understanding-agent-implementation.md)

### 专利功能

- [专利分析器对比](./agents/patent-analyzer-responder-comparison.md)
- [专利分析器增强完成](./agents/patent-analyzer-responder-enhancement-completed.md)
- [专利数据库最终摘要](./agents/patent-database-final-summary.md)
- [专利数据库集成完成](./agents/patent-database-integration-completed.md)
- [专利数据库集成计划](./agents/patent-database-integration-plan.md)
- [专利数据库集成确认](./agents/patent-db-integration-confirmed.md)
- [专利管理器路线图](./agents/patent-manager-roadmap.md)
- [专利管理器摘要](./agents/patent-manager-summary.md)

---

## API 文档 (api/)

- [API 目录](./api/README.md) - API 文档索引
- [API 参考](./api/api-reference.md) - API 接口参考文档

---

## 设计文档 (designs/)

- [TUI v2 设计](./designs/TUI-v2-Design.md) - TUI 第二版设计方案

---

## 部署文档 (deployment/)

- [Docker 部署](./deployment/DOCKER_DEPLOYMENT.md) - Docker 部署指南

---

## 测试文档 (testing/)

- [测试指南](./testing/TESTING.md) - 测试策略说明
- [测试覆盖计划](./testing/test-coverage-plan.md) - 覆盖率规划

### 测试报告 (testing/reports/)

- [LLM 测试报告](./testing/reports/LLM_TESTING_REPORT.md) - LLM 相关测试报告

---

## CI/CD 文档 (ci/)

- [CI/CD 状态](./ci/CICD_STATUS.md) - CI/CD 状态检查
- [CI 故障调查](./ci/CI_FAILURE_INVESTIGATION.md) - CI 故障排查
- [CI 监控指南](./ci/CI_MONITORING_GUIDE.md) - 监控配置说明
- [CI 优化计划](./ci/CI_OPTIMIZATION_PLAN.md) - CI 优化方案
- [CI 优化结果](./ci/CI_OPTIMIZATION_RESULTS.md) - CI 优化成果
- [CI/CD 监控指南](./ci/cicd-monitoring-guide.md) - 监控配置说明

### CI 报告 (ci/reports/)

- [CI 监控报告 20260501](./ci/reports/CI_MONITORING_REPORT_20260501.md)

---

## CI/CD 最佳实践 (cicd/)

- [CI/CD 最佳实践](./cicd/CI_CD_BEST_PRACTICES.md) - CI/CD 最佳实践
- [CI/CD 研究总结](./cicd/CI_CD_RESEARCH_SUMMARY.md) - CI/CD 调研总结
- [CI 设置指南](./cicd/CI_SETUP_GUIDE.md) - CI 配置说明
- [CI 状态报告](./cicd/CI_STATUS_REPORT.md) - CI 状态
- [本地 CI 指南](./cicd/LOCAL_CI_GUIDE.md) - 本地 CI 使用指南
- [本地 CI 快速参考](./cicd/LOCAL_CI_QUICK_REF.md) - 本地 CI 快速参考
- [本地 CI 设置报告](./cicd/LOCAL_CI_SETUP_REPORT.md) - 本地 CI 配置报告

---

## 质量文档 (quality/)

- [代码优化第二轮](./quality/CODE_OPTIMIZATION_ROUND2.md) - 第二轮代码优化
- [代码优化第三轮](./quality/CODE_OPTIMIZATION_ROUND3.md) - 第三轮代码优化
- [代码质量检查清单](./quality/CODE_QUALITY_CHECKLIST.md) - 质量检查项
- [代码质量完成报告](./quality/CODE_QUALITY_COMPLETION_REPORT.md) - 质量完成报告
- [代码质量改进](./quality/CODE_QUALITY_IMPROVEMENTS.md) - 质量改进记录
- [代码质量优化](./quality/CODE_QUALITY_OPTIMIZATION.md) - 质量优化方案
- [代码质量验证报告](./quality/CODE_QUALITY_VERIFICATION_REPORT.md) - 质量验证结果

---

## 审查文档 (reviews/)

- [编排器统一完成报告](./reviews/orchestrator-unification-completion-report.md) - 编排器统一完成报告
- [Phase 4 代码质量审查](./reviews/phase4-code-quality-review.md) - Phase 4 代码质量审查
- [Phase 4 关键修复](./reviews/phase4-critical-fixes.md) - Phase 4 关键问题修复
- [Phase 4 修复完成报告](./reviews/phase4-fixes-completion-report.md) - Phase 4 修复完成

---

## 总结文档 (summaries/)

- [最终总结](./summaries/final-summary.md) - 项目最终总结
- [集成测试](./summaries/integration-test.md) - 集成测试总结
- [知识库集成](./summaries/knowledge-base-integration.md) - 知识库集成总结
- [专利工具实现](./summaries/patent-tools-implementation.md) - 专利工具实现总结
- [提示词模板](./summaries/prompt-templates.md) - 提示词模板总结
- [Rust 集成](./summaries/rust-integration.md) - Rust 集成总结
- [工具实现](./summaries/tools-implementation.md) - 工具实现总结

---

## 工具文档 (tools/)

- [Claude Code 专利工具](./tools/clawcode-patent-tools.md) - 专利工具使用说明
- [工具概览](./tools/overview.md) - 工具体系概览
- [选择精度改进](./tools/selection-accuracy-improvement.md) - 工具选择精度优化
- [工具状态](./tools/status.md) - 工具状态总览

---

## 进度文档 (progress/)

- [Rust 工具进度](./progress/rust-tools.md) - Rust 工具开发进度

---

## 知识库文档 (knowledge/)

- [知识库集成](./knowledge/INTEGRATION.md) - 知识库集成说明

---

## 指标文档 (metrics/)

- [质量仪表盘](./metrics/QUALITY_DASHBOARD.md) - 质量指标仪表盘

---

## 历史文档 (history/)

### 2026-04 重构历史 (history/2026-04-restructure/)

- [多语言架构 ADR](./history/2026-04-restructure/ADR_multiling_architecture.md) - 多语言架构决策
- [架构文档](./history/2026-04-restructure/ARCHITECTURE.md) - 重构架构
- [成本优化报告](./history/2026-04-restructure/COST_OPTIMIZATION_REPORT.md) - 成本优化
- [多语言最终总结](./history/2026-04-restructure/FINAL_MULTILING_SUMMARY.md) - 多语言方案总结
- [专利平台最终总结](./history/2026-04-restructure/FINAL_PATENT_PLATFORM_SUMMARY.md) - 专利平台总结
- [最终总结](./history/2026-04-restructure/FINAL_SUMMARY.md) - 重构最终总结
- [五层架构总结](./history/2026-04-restructure/FIVE_LAYER_SUMMARY.md) - 五层架构说明
- [Stage 1 实施总结](./history/2026-04-restructure/IMPLEMENTATION_SUMMARY_STAGE1.md) - Stage 1 实施概要
- [多语言架构迁移](./history/2026-04-restructure/MULTILING_ARCHITECTURE_MIGRATION.md) - 多语言迁移方案
- [P1 集成指南](./history/2026-04-restructure/P1_INTEGRATION_GUIDE.md) - P1 集成说明
- [P1 优化报告](./history/2026-04-restructure/P1_OPTIMIZATION_REPORT.md) - P1 优化结果
- [性能优化实施](./history/2026-04-restructure/PERFORMANCE_OPTIMIZATION_IMPLEMENTATION.md) - 性能优化实施
- [性能优化报告](./history/2026-04-restructure/PERFORMANCE_OPTIMIZATION_REPORT.md) - 性能优化报告
- [项目总结](./history/2026-04-restructure/PROJECT_SUMMARY.md) - 项目总结
- [多语言快速开始](./history/2026-04-restructure/QUICK_START_MULTILING.md) - 多语言快速上手
- [重构执行计划](./history/2026-04-restructure/RESTRUCTURE_EXECUTION_PLAN.md) - 重构执行方案
- [专利平台重构](./history/2026-04-restructure/RESTRUCTURE_PATENT_PLATFORM.md) - 专利平台重构方案
- [重构状态](./history/2026-04-restructure/RESTRUCTURE_STATUS.md) - 重构状态跟踪
- [稳定性报告](./history/2026-04-restructure/STABILITY_REPORT.md) - 稳定性报告
- [Stage 2 计划](./history/2026-04-restructure/STAGE2_PLAN.md) - Stage 2 计划
- [结构说明](./history/2026-04-restructure/STRUCTURE.md) - 目录结构说明
- [结构分析](./history/2026-04-restructure/STRUCTURE_ANALYSIS.md) - 结构分析
- [终极总结](./history/2026-04-restructure/ULTIMATE_SUMMARY.md) - 综合总结
- [验证文档](./history/2026-04-restructure/VERIFY.md) - 重构验证

---

## 元文档 (meta/)

- [文件管理规则](./meta/FILE_MANAGEMENT_RULES.md) - 文档组织规范
- [安全指南](./meta/SECURITY_GUIDELINES.md) - 安全最佳实践
- [文档维护指南](./meta/DOC_MAINTENANCE_GUIDE.md) - 文档维护说明
- [npm Token 设置](./meta/npm-token-setup-guide.md) - npm 发布配置
- [PR 保护设置](./meta/pr-protection-setup-guide.md) - PR 保护配置
- [Runner 配置](./meta/runner-configuration.md) - CI Runner 配置

### 元报告 (meta/reports/)

- [文档更新总结](./meta/reports/DOCS_UPDATE_SUMMARY.md) - 文档更新记录

---

## 归档文档 (archive/)

历史文档和过时内容的归档。

- [归档项目分析](./archive/ARCHIVE_PROJECTS_ANALYSIS.md) - 归档项目分析
- [归档项目总结](./archive/ARCHIVE_PROJECTS_SUMMARY.md) - 归档项目摘要
- [清理总结](./archive/CLEANUP_SUMMARY.md) - 归档清理记录
- [最终完成报告](./archive/FINAL_REPORT_COMPLETE.md) - 归档完成报告
- [生成统计](./archive/GENERATION_STATS.md) - 文档生成统计
- [归档索引](./archive/INDEX.md) - 归档文档索引
- [进度跟踪器](./archive/PROGRESS_TRACKER.md) - 归档进度跟踪
- [项目清理计划](./archive/PROJECT_CLEANUP_PLAN.md) - 项目清理方案
- [审查检查清单](./archive/REVIEW_CHECKLIST.md) - 审查检查项
- [计划任务设置](./archive/SCHEDULED_TASKS_SETUP.md) - 计划任务配置
- [无效决策嵌入生成](./archive/generate-invalid-decision-embeddings.md) - 决策嵌入生成
- [无效决策查询就绪](./archive/invalid-decisions-query-ready.md) - 决策查询就绪
- [快速改进指南](./archive/quick-improvement-guide.md) - 快速改进指引
- [类型错误修复评估](./archive/type-error-fix-assessment.md) - 类型错误评估
- [向量嵌入生成指南](./archive/vector-embeddings-generation-guide.md) - 向量嵌入生成

### 归档计划 (archive/plans-2026-05-01/)

- [进度报告 20260501-1730](./archive/plans-2026-05-01/progress-report-20260501-1730.md)
- [进度跟踪器](./archive/plans-2026-05-01/progress-tracker.md)
- [进度更新 20260501-1630](./archive/plans-2026-05-01/progress-update-20260501-1630.md)
- [进度更新 20260501-1700](./archive/plans-2026-05-01/progress-update-20260501-1700.md)
- [进度更新 20260501-1740](./archive/plans-2026-05-01/progress-update-20260501-1740.md)
- [进度更新 20260501-1750](./archive/plans-2026-05-01/progress-update-20260501-1750.md)
- [进度更新 20260501](./archive/plans-2026-05-01/progress-update-20260501.md)

### 归档报告 (archive/reports-2026-05/)

- [CI/CD 修复进度 20260501](./archive/reports-2026-05/cicd-fix-progress-20260501.md)
- [环境更新 20260501](./archive/reports-2026-05/env-update-20260501.md)
- [Git 提交报告 20260501](./archive/reports-2026-05/git-commit-report-20260501.md)
- [测试修复说明](./archive/reports-2026-05/test-fix-instructions.md)
- [测试修复最终 20260501](./archive/reports-2026-05/test-fixes-final-20260501.md)
- [测试超时修复](./archive/reports-2026-05/test-timeout-fix.md)

---

## 目录结构概览

```
docs/
├── README.md                              # 文档中心首页（本文件）
├── PROJECT_STRUCTURE.md                   # 项目结构说明
├── TEST_MIGRATION_GUIDE.md                # 测试迁移指南
├── TUI_GATEWAY_IMPLEMENTATION_PLAN.md     # TUI 网关实施计划
├── TUI_IMPLEMENTATION_SUMMARY.md          # TUI 实施总结
│
├── agents/                                # Agent 专用文档
├── analysis/                              # 分析文档
├── api/                                   # API 接口文档
├── architecture/                          # 架构文档
├── archive/                               # 归档文档
│   ├── plans-2026-05-01/                  # 归档计划
│   └── reports-2026-05/                   # 归档报告
├── ci/                                    # CI/CD 文档
│   └── reports/                           # CI 报告
├── cicd/                                  # CI/CD 最佳实践
├── deployment/                            # 部署文档
├── designs/                               # 设计文档
├── guides/                                # 开发指南
├── history/                               # 历史文档
│   └── 2026-04-restructure/               # 2026-04 重构历史
├── knowledge/                             # 知识库文档
├── meta/                                  # 元文档
│   └── reports/                           # 元报告
├── metrics/                               # 指标文档
├── plans/                                 # 开发计划
│   ├── feature/                           # 功能计划
│   ├── implementation/                    # 实施计划
│   ├── optimization/                      # 优化计划
│   └── refactor/                          # 重构计划
├── progress/                              # 进度文档
├── quality/                               # 质量文档
├── reports/                               # 完成报告
│   ├── 2026-04/                           # 2026年4月报告
│   ├── 2026-05/                           # 2026年5月报告
│   └── ARCHIVE/                           # 归档报告
├── reviews/                               # 审查文档
├── summaries/                             # 总结文档
├── testing/                               # 测试文档
│   └── reports/                           # 测试报告
└── tools/                                 # 工具文档
```

---

## 按角色查找

| 角色        | 推荐文档                                                                          |
| ----------- | --------------------------------------------------------------------------------- |
| 开发者      | [CLAUDE.md](./guides/CLAUDE.md)、[开发指南](./guides/development.md)              |
| 专利代理人  | [专利示例](../examples/patents/)                                                  |
| IP 管理人员 | [路线图](./plans/roadmap.md)                                                      |
| DevOps      | [安全指南](./meta/SECURITY_GUIDELINES.md)、[部署指南](./guides/deployment.md)     |
| 测试工程师  | [测试指南](./testing/TESTING.md)、[测试覆盖计划](./testing/test-coverage-plan.md) |
| 新成员      | [团队入职指南](./guides/TEAM_ONBOARDING.md)、[立即开始](./guides/START_NOW.md)    |
