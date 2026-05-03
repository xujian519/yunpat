#!/usr/bin/env node

/**
 * 专利工具 CLI (已弃用)
 *
 * ⚠️ 本 CLI 已被弃用，请使用新的 CLI 工具:
 *   npx yunpat <command>
 *
 * 新 CLI 位置: packages/cli/
 * 新 CLI 命令:
 *   - yunpat init         初始化框架
 *   - yunpat draft        发明理解 + 检索 + 分析 (Phase 0+2A)
 *   - yunpat search       专利检索 (Phase 2A)
 *   - yunpat claims       权利要求生成 (Phase 3)
 *   - yunpat analyze      现有技术深度分析 (Phase 2B)
 *   - yunpat spec         说明书撰写 (Phase 5)
 *   - yunpat check        质量检查 (Phase 6)
 *   - yunpat full         完整工作流 (Phase 0-7)
 *
 * 更多信息: 参见 packages/cli/README.md
 */

console.error('❌ 本 CLI 已被弃用')
console.error('')
console.error('请使用新的 CLI 工具:')
console.error('  npm install -g @yunpat/cli')
console.error('  yunpat --help')
console.error('')
console.error('或直接运行:')
console.error('  npx yunpat --help')
process.exit(1)
