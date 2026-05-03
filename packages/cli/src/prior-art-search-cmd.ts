/**
 * 先导技术检索命令
 *
 * 支持从发明理解结果继续执行检索策略构建
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core'
import { createDeepSeekModel } from '@yunpat/llm'
import { PriorArtSearchAgent, SearchStrategyRenderer } from '@yunpat/agent-prior-art-search'
import type { InventionUnderstandingOutput } from '@yunpat/agent-invention'

interface SearchOptions {
  /** 发明理解JSON文件路径 */
  inventionJson?: string
  /** 发明理解Markdown文件路径 */
  inventionMarkdown?: string
  /** 技术交底书文件路径（直接执行） */
  disclosure?: string
  /** 发明名称 */
  title?: string
  /** 技术领域 */
  field?: string
  /** 输出文件路径 */
  output?: string
  /** 交互模式 */
  interactive?: boolean
}

/**
 * 先导技术检索命令
 */
export async function priorArtSearch(options: SearchOptions): Promise<void> {
  const spinner = ora('启动先导技术检索流程...').start()

  try {
    // 检查API密钥
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      spinner.fail(chalk.red('错误: 未找到 API 密钥'))
      console.log(chalk.gray('\n请设置环境变量: export DEEPSEEK_API_KEY=your_key'))
      return
    }

    // 获取发明理解结果
    let inventionUnderstanding: InventionUnderstandingOutput

    if (options.inventionJson) {
      // 从JSON文件读取
      spinner.start(chalk.blue('正在读取发明理解结果...'))
      const jsonContent = await readFile(resolve(options.inventionJson), 'utf-8')
      inventionUnderstanding = JSON.parse(jsonContent)
      spinner.succeed(chalk.green('✓ 发明理解结果已加载'))
    } else if (options.disclosure && options.title && options.field) {
      // 直接执行发明理解 + 检索
      spinner.info(chalk.blue('将先执行发明理解，再进行检索...'))

      const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')

      const eventBus = new EventBus()
      const memory = new ShortTermMemory()
      const tools = new ToolRegistry(eventBus)
      const llm = createDeepSeekModel(apiKey)

      // 执行发明理解
      spinner.start(chalk.blue('正在分析技术交底书...'))

      const disclosureContent = await readFile(resolve(options.disclosure), 'utf-8')

      const inventionAgent = new InventionUnderstandingAgent({
        name: 'invention-understanding',
        description: '发明理解智能体',
        llm,
        memory,
        tools,
        eventBus,
      })

      inventionUnderstanding = await inventionAgent.execute({
        title: options.title,
        field: options.field,
        technicalDisclosure: disclosureContent,
      })

      spinner.succeed(chalk.green('✓ 发明理解完成'))
    } else {
      spinner.fail(chalk.red('错误: 必须提供发明理解结果或技术交底书'))
      console.log(chalk.gray('\n两种方式:'))
      console.log(chalk.gray('1. 使用已有结果: --invention-json result.json'))
      console.log(chalk.gray('2. 从头开始: --disclosure file.md --title "..." --field "..."'))
      return
    }

    // 执行先导技术检索
    spinner.start(chalk.blue('正在构建检索策略并分析现有技术...'))

    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)
    const llm = createDeepSeekModel(apiKey)

    const searchAgent = new PriorArtSearchAgent({
      name: 'prior-art-search',
      description: '先导技术检索智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const searchResult = await searchAgent.execute({
      inventionUnderstanding,
    })

    spinner.succeed(chalk.green('✓ 先导技术检索完成'))

    // 渲染报告
    const renderer = new SearchStrategyRenderer()
    const report = renderer.render(searchResult)

    console.log(chalk.green('\n=== 先导技术检索报告 ===\n'))
    console.log(report)

    // 保存结果
    if (options.output) {
      spinner.start(chalk.blue('正在保存结果...'))
      const fs = await import('fs/promises')
      const path = await import('path')
      const outputPath = resolve(options.output)
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(outputPath, report, 'utf-8')

      // 同时保存JSON
      const jsonPath = outputPath.replace(/\\.md$/, '.json')
      await fs.writeFile(jsonPath, JSON.stringify(searchResult, null, 2), 'utf-8')

      spinner.succeed(chalk.green(`✓ 结果已保存到: ${outputPath}`))
      console.log(chalk.gray(`JSON数据已保存到: ${jsonPath}`))
    }

    console.log(chalk.green('\n✅ 先导技术检索阶段完成！'))
  } catch (error) {
    spinner.fail(chalk.red('执行失败'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}

/**
 * 注册先导技术检索命令
 */
export function registerPriorArtSearchCommand(program: Command): void {
  program
    .command('search')
    .description('先导技术检索（基于发明理解构建检索策略）')
    .option('--invention-json <file>', '发明理解JSON文件路径')
    .option('--invention-markdown <file>', '发明理解Markdown文件路径')
    .option('--disclosure <file>', '技术交底书文件路径（从头开始）')
    .option('--title <title>', '发明名称（从头开始时必需）')
    .option('--field <field>', '技术领域（从头开始时必需）')
    .option('-o, --output <file>', '输出报告文件路径')
    .option('-i, --interactive', '启用交互模式')
    .action(async (options) => {
      await priorArtSearch({
        inventionJson: options.inventionJson,
        inventionMarkdown: options.inventionMarkdown,
        disclosure: options.disclosure,
        title: options.title,
        field: options.field,
        output: options.output,
        interactive: options.interactive,
      })
    })
}
