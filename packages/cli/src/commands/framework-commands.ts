import chalk from 'chalk'
import ora from 'ora'
import { EventBus, ShortTermMemory, ToolRegistry, createDeepSeekModel } from '@yunpat/core'
import { WriterAgent, WritingTask } from '@yunpat/agent-writer'
import { ResearcherAgent, ResearchQuery } from '@yunpat/agent-researcher'
import { CLIError, handleError } from '../utils/errors.js'

export async function createAgentFramework(options: {
  model?: string
  apiKey?: string
}): Promise<void> {
  const spinner = ora('初始化智能体框架...').start()

  try {
    const apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY

    if (!apiKey) {
      spinner.fail('初始化失败')
      throw new CLIError(
        '未找到 API 密钥',
        'NO_API_KEY',
        [
          '设置环境变量: export DEEPSEEK_API_KEY=your_key',
          '使用参数: yunpat init --api-key your_key',
        ]
      )
    }

    const eventBus = new EventBus()
    new ShortTermMemory()
    new ToolRegistry(eventBus)
    createDeepSeekModel(apiKey)

    eventBus.subscribe('agent:*', (event) => {
      console.log(chalk.gray(`[事件] ${event.type}`))
    })

    spinner.succeed(chalk.green('✓ 框架初始化成功'))

    console.log(chalk.blue('\n可用组件:'))
    console.log(chalk.gray('  - 事件总线: ✓'))
    console.log(chalk.gray('  - 记忆存储: ✓'))
    console.log(chalk.gray('  - 工具注册: ✓'))
    console.log(chalk.gray('  - LLM 适配器: ✓'))

    console.log(chalk.green('\n框架已就绪! 使用 `yunpat run <agent>` 启动智能体'))
  } catch (error) {
    spinner.fail('初始化失败')
    handleError(error, 'createAgentFramework')
  }
}

export async function runAgent(
  agentName: string,
  options: {
    task?: string
    input?: string
    output?: string
  }
): Promise<void> {
  const spinner = ora(`启动 ${agentName} 智能体...`).start()

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

    spinner.succeed(chalk.green(`✓ ${agentName} 智能体已启动`))

    spinner.start(chalk.blue('执行中...'))

    eventBus.subscribe('agent:progress', (event) => {
      const data = event.data as { iteration: number }
      spinner.text = chalk.blue(`执行中... 迭代 ${data.iteration}`)
    })

    let result: unknown
    const taskInput = options.task || options.input

    if (!taskInput) {
      spinner.fail(chalk.red('请提供任务描述 (--task) 或输入文件 (--input)'))
      return
    }

    if (agentName === 'writer') {
      const agent = new WriterAgent({ eventBus, memory, tools, llm })
      const task = parseTask(agentName, taskInput) as WritingTask
      result = await agent.execute(task)
    } else if (agentName === 'researcher') {
      const agent = new ResearcherAgent({ eventBus, memory, tools, llm })
      const task = parseTask(agentName, taskInput) as ResearchQuery
      result = await agent.execute(task)
    } else {
      spinner.fail(chalk.red(`未知的智能体: ${agentName}`))
      return
    }

    spinner.succeed(chalk.green('✓ 执行完成'))

    console.log(chalk.green('\n执行结果:'))
    console.log(JSON.stringify(result, null, 2))

    if (options.output) {
      throw new Error(
        '文件保存功能尚未实现。请移除 --output 参数，或等待此功能实现。\n' +
          '临时方案：使用命令行重定向保存结果，例如：yunpat chat > output.json'
      )
    }
  } catch (error) {
    spinner.fail(chalk.red('执行失败'))
    console.error(error)
  }
}

export async function listAgents(): Promise<void> {
  console.log(chalk.blue('\n可用智能体:\n'))

  const agents = [
    {
      name: 'writer',
      description: '技术写作助手',
      capabilities: ['文档生成', '格式转换', '内容优化'],
    },
    {
      name: 'researcher',
      description: '研究分析师',
      capabilities: ['信息搜集', '数据整理', '报告生成'],
    },
  ]

  agents.forEach((agent) => {
    console.log(chalk.green(`${agent.name} - ${agent.description}`))
    agent.capabilities.forEach((cap) => {
      console.log(chalk.gray(`  • ${cap}`))
    })
    console.log()
  })

  console.log(chalk.gray('使用 `yunpat run <agent>` 启动智能体'))
}

function parseTask(agentName: string, taskString: string): WritingTask | ResearchQuery {
  if (agentName === 'writer') {
    return {
      type: 'generate',
      topic: taskString,
      format: 'markdown',
    }
  } else {
    return {
      question: taskString,
      depth: 'standard',
      sources: ['web'],
    }
  }
}
