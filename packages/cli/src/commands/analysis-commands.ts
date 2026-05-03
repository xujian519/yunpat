import chalk from 'chalk'
import ora from 'ora'
import { EventBus, ShortTermMemory, ToolRegistry, createDeepSeekModel } from '@yunpat/core'
import type { PatentRecord } from '@yunpat/patent-tools'

export async function searchPatents(options: {
  title: string
  field: string
  disclosure: string
  output?: string
}): Promise<void> {
  const spinner = ora('启动专利检索流程...').start()

  try {
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY

    if (!apiKey) {
      spinner.fail(chalk.red('错误: 未找到 API 密钥'))
      console.log(chalk.gray('\n请设置环境变量: export DEEPSEEK_API_KEY=your_key'))
      return
    }

    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)
    const llm = createDeepSeekModel(apiKey)

    spinner.succeed(chalk.green('✓ 专利检索智能体已启动'))

    spinner.start(chalk.blue('步骤1/2: 发明理解...'))

    const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
    const { PatentSearchAgent } = await import('@yunpat/agent-search')

    const inventionAgent = new InventionUnderstandingAgent({
      name: 'invention-understanding',
      description: '发明理解智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const inventionResult = await inventionAgent.execute({
      title: options.title,
      field: options.field,
      technicalDisclosure: options.disclosure,
    })

    spinner.succeed(chalk.green('✓ 发明理解完成'))
    console.log(chalk.gray(`   技术领域: ${inventionResult.technicalField}`))
    console.log(chalk.gray(`   关键特征: ${inventionResult.keyFeatures.length} 个`))

    spinner.start(chalk.blue('步骤2/2: 生成检索策略并执行检索...'))

    const searchAgent = new PatentSearchAgent({
      name: 'patent-search',
      description: '专利检索智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const searchResult = await searchAgent.execute({
      title: options.title,
      field: options.field,
      technicalProblem: inventionResult.technicalProblem,
      technicalSolution: inventionResult.technicalSolution,
      keyFeatures: inventionResult.keyFeatures,
    })

    spinner.succeed(chalk.green('✓ 专利检索完成'))

    console.log(chalk.green('\n=== 检索策略 ===\n'))
    console.log(chalk.blue(`检索查询: ${searchResult.strategy.searchQuery}`))
    console.log(chalk.gray(`关键词: ${searchResult.strategy.keywords.join(', ')}`))
    if (searchResult.strategy.ipcCodes.length > 0) {
      console.log(chalk.gray(`IPC分类: ${searchResult.strategy.ipcCodes.join(', ')}`))
    }
    console.log(chalk.gray(`策略理由: ${searchResult.strategy.rationale}`))

    console.log(chalk.green('\n=== 检索结果 ===\n'))
    console.log(
      chalk.gray(`找到 ${searchResult.totalFound} 条相关专利 (耗时 ${searchResult.searchTimeMs}ms)`)
    )
    console.log()

    if (searchResult.results.length > 0) {
      searchResult.results.forEach((patent: PatentRecord, index: number) => {
        console.log(chalk.blue(`${index + 1}. ${patent.patentName}`))
        console.log(chalk.gray(`   申请号: ${patent.applicationNumber}`))
        console.log(chalk.gray(`   申请人: ${patent.applicant}`))
        if (patent.abstract) {
          console.log(chalk.gray(`   摘要: ${patent.abstract.substring(0, 100)}...`))
        }
        console.log()
      })
    } else {
      console.log(chalk.yellow('未找到相关专利'))
    }

    if (options.output) {
      const fs = await import('fs/promises')
      const report = {
        invention: inventionResult,
        search: searchResult,
      }
      await fs.writeFile(options.output, JSON.stringify(report, null, 2), 'utf-8')
      console.log(chalk.green(`✓ 检索报告已保存到: ${options.output}`))
    }
  } catch (error) {
    spinner.fail(chalk.red('执行失败'))
    console.error(error)
  }
}
