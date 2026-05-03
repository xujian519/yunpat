/**
 * 交互式专利撰写命令
 *
 * 支持人机协作的工作流程：
 * 1. 发明理解分析
 * 2. 人类确认（y/c/s/r）
 * 3. 保存结果或修正重生成
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { createInterface } from 'readline'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { EventBus, ShortTermMemory, ToolRegistry, createDeepSeekModel } from '@yunpat/core'
import { InventionUnderstandingAgent, HumanReadableRenderer } from '@yunpat/agent-invention'

interface DraftOptions {
  title: string
  field: string
  disclosure: string
  output?: string
  interactive?: boolean
}

/**
 * 交互式专利撰写命令
 */
export async function interactiveDraftPatent(options: DraftOptions): Promise<void> {
  const spinner = ora('启动交互式专利撰写流程...').start()

  try {
    // 检查API密钥
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      spinner.fail(chalk.red('错误: 未找到 API 密钥'))
      console.log(chalk.gray('\n请设置环境变量: export DEEPSEEK_API_KEY=your_key'))
      return
    }

    // 初始化组件
    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)
    const llm = createDeepSeekModel(apiKey)

    spinner.succeed(chalk.green('✓ 专利撰写智能体已启动'))

    // 第一次分析
    spinner.start(chalk.blue('正在分析技术交底书...'))

    const agent = new InventionUnderstandingAgent({
      name: 'invention-understanding',
      description: '发明理解智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    let result = await agent.execute({
      title: options.title,
      field: options.field,
      technicalDisclosure: options.disclosure,
    })

    spinner.succeed(chalk.green('✓ 发明理解完成'))

    // 渲染报告
    const renderer = new HumanReadableRenderer()
    let report = renderer.render(result)

    // 交互式确认循环
    let confirmed = false
    let iteration = 0
    const maxIterations = 5

    while (!confirmed && iteration < maxIterations) {
      iteration++

      console.log(chalk.green('\n=== 发明理解报告 ===\n'))
      console.log(report)
      console.log(chalk.gray(`\n置信度: ${(result.confidence * 100).toFixed(1)}%`))

      if (result.confidence < 0.7) {
        console.log(chalk.yellow('\n⚠️  注意: AI置信度较低，建议仔细审核'))
      }

      // 人类确认
      const action = await waitForUserChoice()

      switch (action) {
        case 'yes':
          // 通过并保存
          confirmed = true
          spinner.start(chalk.blue('正在保存结果...'))

          if (options.output) {
            const outputPath = resolve(options.output)
            await mkdir(dirname(outputPath), { recursive: true })
            await writeFile(outputPath, report, 'utf-8')
            spinner.succeed(chalk.green(`✓ 结果已保存到: ${outputPath}`))
          } else {
            // 生成默认文件名
            const timestamp = new Date().toISOString().slice(0, 10)
            const defaultFileName = `invention-understanding-${timestamp}.md`
            const outputPath = resolve(process.cwd(), 'data', 'drafts', defaultFileName)
            await mkdir(dirname(outputPath), { recursive: true })
            await writeFile(outputPath, report, 'utf-8')
            spinner.succeed(chalk.green(`✓ 结果已保存到: ${outputPath}`))
          }

          // 同时保存JSON格式
          const timestamp = new Date().toISOString().slice(0, 10)
          const jsonFileName = `invention-understanding-${timestamp}.json`
          const jsonPath = resolve(process.cwd(), 'data', 'drafts', jsonFileName)
          await writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf-8')
          console.log(chalk.gray(`JSON数据已保存到: ${jsonPath}`))

          console.log(chalk.green('\n✅ 发明理解阶段完成！'))
          break

        case 'correct':
          // 修正部分内容
          console.log(
            chalk.gray(
              '\n可用字段: technicalField, backgroundArt, technicalProblem, technicalSolution, beneficialEffects, keyFeatures'
            )
          )
          const correction = await waitForInput('请输入修正内容（格式：字段名: 新内容）: ')

          spinner.start(chalk.blue('正在应用修正...'))

          // 解析修正内容
          const colonIndex = correction.indexOf(':')
          if (colonIndex === -1) {
            spinner.fail(chalk.red('格式错误，应该是 "字段名: 新内容"'))
            continue
          }
          const fieldName = correction.substring(0, colonIndex).trim()
          const newContent = correction.substring(colonIndex + 1).trim()

          // 应用修正
          if (fieldName in result) {
            ;(result as any)[fieldName] = newContent
            spinner.succeed(chalk.green(`✓ 已更新 ${fieldName}`))

            // 重新渲染报告
            report = renderer.render(result)
          } else {
            spinner.fail(chalk.red(`未知字段: ${fieldName}`))
            console.log(
              chalk.gray(
                '可用字段: technicalField, backgroundArt, technicalProblem, technicalSolution, beneficialEffects, keyFeatures'
              )
            )
          }
          break

        case 'supplement':
          // 补充更多信息
          const supplement = await waitForInput('请输入补充信息（将添加到技术方案中）: ')

          spinner.start(chalk.blue('正在重新分析...'))

          // 将补充信息添加到交底书，重新分析
          const enhancedDisclosure = `${options.disclosure}\n\n补充信息：\n${supplement}`

          result = await agent.execute({
            title: options.title,
            field: options.field,
            technicalDisclosure: enhancedDisclosure,
          })

          spinner.succeed(chalk.green('✓ 重新分析完成'))

          // 重新渲染报告
          report = renderer.render(result)
          break

        case 'regenerate':
          // 重新分析
          spinner.start(chalk.blue('正在重新分析...'))

          result = await agent.execute({
            title: options.title,
            field: options.field,
            technicalDisclosure: options.disclosure,
          })

          spinner.succeed(chalk.green('✓ 重新分析完成'))

          // 重新渲染报告
          report = renderer.render(result)
          break

        case 'cancel':
          console.log(chalk.yellow('\n❌ 已取消，结果未保存'))
          return
      }
    }

    if (iteration >= maxIterations) {
      console.log(chalk.yellow('\n⚠️  达到最大迭代次数，请稍后再试'))
    }
  } catch (error) {
    spinner.fail(chalk.red('执行失败'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}

/**
 * 等待用户选择操作
 */
async function waitForUserChoice(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    console.log(chalk.gray('\n请选择操作:'))
    console.log(chalk.green('  y') + ' - 通过 (确认结果并保存)')
    console.log(chalk.yellow('  c') + ' - 修正 (修正部分内容)')
    console.log(chalk.blue('  s') + ' - 补充 (补充更多信息)')
    console.log(chalk.magenta('  r') + ' - 重来 (重新分析)')
    console.log(chalk.red('  q') + ' - 取消 (退出不保存)')

    rl.question(chalk.gray('\n你的选择 (y/c/s/r/q): '), (answer) => {
      rl.close()
      const choice = answer.trim().toLowerCase()
      switch (choice) {
        case 'y':
        case 'yes':
          resolve('yes')
          break
        case 'c':
        case 'correct':
          resolve('correct')
          break
        case 's':
        case 'supplement':
          resolve('supplement')
          break
        case 'r':
        case 'regenerate':
          resolve('regenerate')
          break
        case 'q':
        case 'quit':
        case 'cancel':
          resolve('cancel')
          break
        default:
          console.log(chalk.yellow('无效选择，请重试'))
          resolve(waitForUserChoice())
      }
    })
  })
}

/**
 * 等待用户输入
 */
async function waitForInput(prompt: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(chalk.gray(prompt), (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/**
 * 注册交互式专利撰写命令
 */
export function registerInteractiveDraftCommand(program: Command): void {
  program
    .command('draft-interactive')
    .description('交互式专利撰写（支持人机协作）')
    .requiredOption('--title <title>', '发明名称')
    .requiredOption('--field <field>', '技术领域')
    .requiredOption('--disclosure <file>', '技术交底书文件路径')
    .option('-o, --output <file>', '输出报告文件路径')
    .action(async (options) => {
      // 读取技术交底书
      let disclosure: string
      try {
        const resolvedPath = resolve(options.disclosure)
        disclosure = await readFile(resolvedPath, 'utf-8')
      } catch (err) {
        console.error(
          chalk.red(`读取技术交底书失败: ${err instanceof Error ? err.message : String(err)}`)
        )
        process.exit(1)
      }

      await interactiveDraftPatent({
        title: options.title,
        field: options.field,
        disclosure,
        output: options.output,
      })
    })
}
