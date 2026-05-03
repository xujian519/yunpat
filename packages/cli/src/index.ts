#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import {
  createAgentFramework,
  runAgent,
  listAgents,
  fullPatentWorkflow,
  searchPatents,
} from './commands/index.js'
import { registerInteractiveDraftCommand } from './interactive-draft.js'
import { registerPriorArtSearchCommand } from './prior-art-search-cmd.js'

const program = new Command()

program.name('yunpat').description('YunPat 智能体框架 CLI').version('0.1.0')

program
  .command('init')
  .description('初始化智能体框架')
  .option('-m, --model <model>', 'LLM 模型名称', 'gpt-4')
  .option('-k, --api-key <key>', 'API 密钥')
  .action(createAgentFramework)

program
  .command('run')
  .description('运行智能体')
  .argument('<agent>', '智能体名称 (writer/researcher)')
  .option('-t, --task <task>', '任务描述')
  .option('-i, --input <file>', '输入文件 (JSON)')
  .option('-o, --output <file>', '输出文件')
  .action(runAgent)

program.command('list').description('列出所有可用智能体').action(listAgents)

registerInteractiveDraftCommand(program)
registerPriorArtSearchCommand(program)

program
  .command('search')
  .description('专利检索')
  .requiredOption('--title <title>', '发明名称')
  .requiredOption('--field <field>', '技术领域')
  .requiredOption('--disclosure <file>', '技术交底书文件路径')
  .option('-o, --output <file>', '输出检索报告文件路径 (JSON)')
  .action(async (options) => {
    const fs = await import('fs/promises')
    const path = await import('path')

    let disclosure: string
    try {
      const resolvedPath = path.resolve(options.disclosure)
      disclosure = await fs.readFile(resolvedPath, 'utf-8')
    } catch (err) {
      console.error(
        chalk.red(`读取技术交底书失败: ${err instanceof Error ? err.message : String(err)}`)
      )
      process.exit(1)
    }

    await searchPatents({
      title: options.title,
      field: options.field,
      disclosure,
      output: options.output,
    })
  })

program
  .command('draft-full')
  .description('完整专利撰写工作流（发明理解 → 检索 → 说明书 → 权利要求 → 摘要）')
  .requiredOption('--title <title>', '发明名称')
  .requiredOption('--field <field>', '技术领域')
  .requiredOption('--disclosure <file>', '技术交底书文件路径')
  .option('-o, --output <file>', '输出完整专利申请文件 (JSON)')
  .action(async (options) => {
    const fs = await import('fs/promises')
    const path = await import('path')

    let disclosure: string
    try {
      const resolvedPath = path.resolve(options.disclosure)
      disclosure = await fs.readFile(resolvedPath, 'utf-8')
    } catch (err) {
      console.error(
        chalk.red(`读取技术交底书失败: ${err instanceof Error ? err.message : String(err)}`)
      )
      process.exit(1)
    }

    await fullPatentWorkflow({
      title: options.title,
      field: options.field,
      disclosure,
      output: options.output,
    })
  })

program.parse()
