import chalk from 'chalk'
import ora from 'ora'
import { EventBus, ShortTermMemory, ToolRegistry, createDeepSeekModel } from '@yunpat/core'
import { WriterAgent, WritingTask } from '@yunpat/agent-writer'
import { ResearcherAgent, ResearchQuery } from '@yunpat/agent-researcher'
import type { PatentRecord } from '@yunpat/patent-tools'
import type { IndependentClaim, DependentClaim } from '@yunpat/agent-claims'
import type {
  PatentTechnicalAnalysis,
  ComparisonReport,
  RefinedInventionUnderstanding,
} from '@yunpat/agent-analysis'
import type { PatentSpecification } from '@yunpat/agent-specification'
import type { QualityCheckResult } from '@yunpat/agent-quality'

/**
 * 创建智能体框架
 */
export async function createAgentFramework(options: {
  model?: string
  apiKey?: string
}): Promise<void> {
  const spinner = ora('初始化智能体框架...').start()

  try {
    // 获取 API 密钥（优先 DeepSeek）
    const apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY

    if (!apiKey) {
      spinner.fail(chalk.red('错误: 未找到 API 密钥'))
      console.log(chalk.gray('\n请通过以下方式提供 API 密钥:'))
      console.log(chalk.gray('1. 设置环境变量: export DEEPSEEK_API_KEY=your_key'))
      console.log(chalk.gray('2. 使用参数: yunpat init --api-key your_key'))
      return
    }

    const eventBus = new EventBus()
    new ShortTermMemory()
    new ToolRegistry(eventBus)
    createDeepSeekModel(apiKey)

    // 订阅事件用于显示
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
    spinner.fail(chalk.red('初始化失败'))
    console.error(error)
  }
}

/**
 * 运行智能体
 */
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
    // 获取 API 密钥（优先 DeepSeek）
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY

    if (!apiKey) {
      spinner.fail(chalk.red('错误: 未找到 API 密钥'))
      console.log(chalk.gray('\n请设置环境变量: export DEEPSEEK_API_KEY=your_key'))
      return
    }

    // 初始化框架
    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)
    const llm = createDeepSeekModel(apiKey)

    spinner.succeed(chalk.green(`✓ ${agentName} 智能体已启动`))

    // 执行任务
    spinner.start(chalk.blue('执行中...'))

    // 订阅进度事件
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

    // 输出结果
    console.log(chalk.green('\n执行结果:'))
    console.log(JSON.stringify(result, null, 2))

    // 保存到文件
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

/**
 * 列出所有智能体
 */
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

/**
 * 解析任务
 */
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

/**
 * 专利撰写（发明理解阶段）
 */
export async function draftPatent(options: {
  title: string
  field: string
  disclosure: string
  output?: string
}): Promise<void> {
  const spinner = ora('启动专利撰写流程...').start()

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

    spinner.succeed(chalk.green('✓ 专利撰写智能体已启动'))

    spinner.start(chalk.blue('正在分析技术交底书...'))

    const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
    const { HumanReadableRenderer } = await import('@yunpat/agent-invention')

    const agent = new InventionUnderstandingAgent({
      name: 'invention-understanding',
      description: '发明理解智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const result = await agent.execute({
      title: options.title,
      field: options.field,
      technicalDisclosure: options.disclosure,
    })

    spinner.succeed(chalk.green('✓ 发明理解完成'))

    const renderer = new HumanReadableRenderer()
    const report = renderer.render(result)

    console.log(chalk.green('\n=== 发明理解报告 ===\n'))
    console.log(report)

    if (options.output) {
      const fs = await import('fs/promises')
      await fs.writeFile(options.output, report, 'utf-8')
      console.log(chalk.green(`\n✓ 报告已保存到: ${options.output}`))
    }
  } catch (error) {
    spinner.fail(chalk.red('执行失败'))
    console.error(error)
  }
}

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

export async function generateClaims(options: {
  title: string
  field: string
  disclosure: string
  output?: string
}): Promise<void> {
  const spinner = ora('启动权利要求生成流程...').start()

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

    spinner.succeed(chalk.green('✓ 权利要求生成智能体已启动'))

    spinner.start(chalk.blue('步骤1/2: 发明理解...'))

    const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
    const { ClaimsGenerationAgent } = await import('@yunpat/agent-claims')

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

    spinner.start(chalk.blue('步骤2/2: 生成权利要求...'))

    const claimsAgent = new ClaimsGenerationAgent({
      name: 'claims-generation',
      description: '权利要求生成智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const claimsResult = await claimsAgent.execute({
      inventionUnderstanding: inventionResult,
    })

    spinner.succeed(chalk.green('✓ 权利要求生成完成'))

    console.log(chalk.green('\n=== 权利要求书 ===\n'))

    claimsResult.independentClaims.forEach((claim: IndependentClaim) => {
      console.log(chalk.blue(`${claim.claimNumber}. ${claim.fullText}`))
      console.log(chalk.gray(`   类型: ${claim.claimType}`))
      console.log(chalk.gray(`   必要特征: ${claim.essentialFeatures.join(', ')}`))
      console.log()
    })

    claimsResult.dependentClaims.forEach((claim: DependentClaim) => {
      console.log(chalk.blue(`${claim.claimNumber}. ${claim.content}`))
      console.log(chalk.gray(`   引用权利要求: ${claim.parentClaim}`))
      console.log(chalk.gray(`   附加特征: ${claim.additionalFeatures.join(', ')}`))
      console.log()
    })

    console.log(chalk.green('=== 布局策略 ==='))
    console.log(chalk.gray(claimsResult.layoutStrategy))

    console.log(chalk.green('\n=== 保护范围分析 ==='))
    console.log(chalk.gray(claimsResult.protectionScopeAnalysis))

    if (options.output) {
      const fs = await import('fs/promises')
      const report = {
        invention: inventionResult,
        claims: claimsResult,
      }
      await fs.writeFile(options.output, JSON.stringify(report, null, 2), 'utf-8')
      console.log(chalk.green(`\n✓ 权利要求报告已保存到: ${options.output}`))
    }
  } catch (error) {
    spinner.fail(chalk.red('执行失败'))
    console.error(error)
  }
}

export async function analyzePatent(options: {
  title: string
  field: string
  disclosure: string
  output?: string
}): Promise<void> {
  const spinner = ora('启动专利深度分析流程...').start()

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

    spinner.succeed(chalk.green('✓ 专利分析智能体已启动'))

    spinner.start(chalk.blue('步骤1/3: 发明理解...'))

    const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
    const { PatentSearchAgent } = await import('@yunpat/agent-search')
    const { PatentTechnicalAnalyzerAgent } = await import('@yunpat/agent-analysis')
    const { ComparisonReportGeneratorAgent } = await import('@yunpat/agent-analysis')
    const { DisclosureRefinerAgent } = await import('@yunpat/agent-analysis')

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

    spinner.start(chalk.blue('步骤2/3: 检索策略与执行...'))

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
    console.log(chalk.gray(`   找到 ${searchResult.totalFound} 条相关专利`))

    spinner.start(chalk.blue('步骤3/3: 深度技术分析...'))

    const analyzerAgent = new PatentTechnicalAnalyzerAgent({
      name: 'patent-analyzer',
      description: '专利技术分析智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const priorArtAnalysis: PatentTechnicalAnalysis[] = []
    for (const patent of searchResult.results.slice(0, 3)) {
      const analysis = await analyzerAgent.execute({
        patent: {
          publicationNumber: patent.applicationNumber,
          title: patent.patentName,
          abstract: patent.abstract || '',
          applicant: patent.applicant,
        },
        inventionUnderstanding: {
          technicalProblem: inventionResult.technicalProblem,
          technicalSolution: inventionResult.technicalSolution,
          keyFeatures: inventionResult.keyFeatures,
        },
      })
      priorArtAnalysis.push(analysis)
    }

    const comparisonAgent = new ComparisonReportGeneratorAgent({
      name: 'comparison-report',
      description: '对比分析报告生成智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const comparisonReport: ComparisonReport = await comparisonAgent.execute({
      inventionUnderstanding: {
        technicalProblem: inventionResult.technicalProblem,
        technicalSolution: inventionResult.technicalSolution,
        technicalEffects: inventionResult.beneficialEffects,
        keyFeatures: inventionResult.keyFeatures,
      },
      priorArtAnalysis,
    })

    const refinerAgent = new DisclosureRefinerAgent({
      name: 'disclosure-refiner',
      description: '交底书再分析智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const refinedInvention: RefinedInventionUnderstanding = await refinerAgent.execute({
      originalInvention: inventionResult,
      comparisonReport: {
        distinctFeatures: comparisonReport.distinctFeatures,
        technicalProblem: comparisonReport.technicalProblem,
        technicalSolution: comparisonReport.technicalSolution,
        technicalEffects: comparisonReport.technicalEffects,
        inventiveness: comparisonReport.inventiveness,
      },
    })

    spinner.succeed(chalk.green('✓ 深度分析完成'))

    console.log(chalk.green('\n=== 对比分析报告 ===\n'))
    console.log(chalk.blue('最接近现有技术:'))
    console.log(
      chalk.gray(
        `  ${comparisonReport.closestPriorArt.publicationNumber} - ${comparisonReport.closestPriorArt.title}`
      )
    )
    console.log(
      chalk.gray(`  相似度: ${(comparisonReport.closestPriorArt.similarity * 100).toFixed(1)}%`)
    )
    console.log(chalk.gray(`  理由: ${comparisonReport.closestPriorArt.reason}`))

    console.log(chalk.blue('\n区别特征:'))
    comparisonReport.distinctFeatures.forEach((feature) => {
      console.log(chalk.gray(`  • ${feature.feature} (新颖性: ${feature.novelty})`))
    })

    console.log(chalk.blue('\n创造性评估:'))
    console.log(chalk.gray(`  评分: ${(comparisonReport.inventiveness.score * 100).toFixed(1)}%`))
    comparisonReport.inventiveness.keyFactors.forEach((factor) => {
      console.log(chalk.gray(`  • ${factor}`))
    })

    console.log(chalk.green('\n=== 提炼后的发明理解 ===\n'))
    console.log(chalk.blue('发明名称:'))
    console.log(chalk.gray(`  ${refinedInvention.refined.inventionTitle}`))
    console.log(chalk.blue('核心创新:'))
    console.log(chalk.gray(`  ${refinedInvention.refined.coreInnovation}`))
    console.log(chalk.blue('技术问题:'))
    console.log(chalk.gray(`  ${refinedInvention.refined.technicalProblem}`))
    console.log(chalk.blue('创新特征:'))
    refinedInvention.refined.features.innovative.forEach((f) => {
      console.log(chalk.gray(`  • ${f.feature}`))
    })

    if (refinedInvention.improvements.length > 0) {
      console.log(chalk.blue('\n改进建议:'))
      refinedInvention.improvements.forEach((imp) => {
        console.log(chalk.gray(`  [${imp.priority}] ${imp.category}: ${imp.description}`))
      })
    }

    if (options.output) {
      const fs = await import('fs/promises')
      const report = {
        invention: inventionResult,
        search: searchResult,
        priorArtAnalysis,
        comparisonReport,
        refinedInvention,
      }
      await fs.writeFile(options.output, JSON.stringify(report, null, 2), 'utf-8')
      console.log(chalk.green(`\n✓ 分析报告已保存到: ${options.output}`))
    }
  } catch (error) {
    spinner.fail(chalk.red('执行失败'))
    console.error(error)
  }
}

export async function generateSpecification(options: {
  title: string
  field: string
  disclosure: string
  output?: string
}): Promise<void> {
  const spinner = ora('启动说明书撰写流程...').start()

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

    spinner.succeed(chalk.green('✓ 说明书撰写智能体已启动'))

    spinner.start(chalk.blue('步骤1/3: 发明理解...'))

    const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
    const { ClaimsGenerationAgent } = await import('@yunpat/agent-claims')
    const { SpecificationDrafterAgent } = await import('@yunpat/agent-specification')

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

    spinner.start(chalk.blue('步骤2/3: 生成权利要求...'))

    const claimsAgent = new ClaimsGenerationAgent({
      name: 'claims-generation',
      description: '权利要求生成智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const claimsResult = await claimsAgent.execute({
      inventionUnderstanding: inventionResult,
    })

    spinner.succeed(chalk.green('✓ 权利要求生成完成'))

    spinner.start(chalk.blue('步骤3/3: 撰写说明书...'))

    const specAgent = new SpecificationDrafterAgent({
      name: 'specification-drafter',
      description: '说明书撰写智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const specResult = await specAgent.execute({
      inventionUnderstanding: inventionResult,
      claims: {
        independentClaims: claimsResult.independentClaims.map((c: IndependentClaim) => ({
          claimNumber: c.claimNumber,
          fullText: c.fullText,
          claimType: c.claimType,
        })),
        dependentClaims: claimsResult.dependentClaims.map((c: DependentClaim) => ({
          claimNumber: c.claimNumber,
          content: c.content,
          parentClaim: c.parentClaim,
        })),
      },
    })

    spinner.succeed(chalk.green('✓ 说明书撰写完成'))

    console.log(chalk.green('\n=== 专利说明书 ===\n'))

    console.log(chalk.blue('【摘要】'))
    console.log(chalk.gray(specResult.abstract))

    console.log(chalk.blue('\n【技术领域】'))
    console.log(chalk.gray(specResult.technicalField))

    console.log(chalk.blue('\n【背景技术】'))
    console.log(chalk.gray(specResult.backgroundArt))

    console.log(chalk.blue('\n【发明内容】'))
    console.log(chalk.blue('  技术问题：'))
    console.log(chalk.gray(specResult.inventionContent.technicalProblem))
    console.log(chalk.blue('  技术方案：'))
    console.log(chalk.gray(specResult.inventionContent.technicalSolution))
    console.log(chalk.blue('  有益效果：'))
    console.log(chalk.gray(specResult.inventionContent.beneficialEffects))

    console.log(chalk.blue('\n【附图说明】'))
    console.log(chalk.gray(specResult.drawingsDescription))

    console.log(chalk.blue('\n【具体实施方式】'))
    console.log(chalk.gray(specResult.detailedDescription.substring(0, 500) + '...'))

    console.log(chalk.blue('\n【质量检查】'))
    console.log(chalk.gray(`充分公开: ${specResult.qualityCheck.disclosure}`))
    console.log(chalk.gray(`清楚性: ${specResult.qualityCheck.clarity}`))
    console.log(chalk.gray(`完整性: ${specResult.qualityCheck.completeness}`))
    console.log(chalk.gray(`支持性: ${specResult.qualityCheck.support}`))
    if (specResult.qualityCheck.potentialIssues.length > 0) {
      console.log(chalk.yellow('\n潜在问题:'))
      specResult.qualityCheck.potentialIssues.forEach((issue: string) => {
        console.log(chalk.yellow(`  • ${issue}`))
      })
    }

    if (options.output) {
      const fs = await import('fs/promises')
      const report = {
        invention: inventionResult,
        claims: claimsResult,
        specification: specResult,
      }
      await fs.writeFile(options.output, JSON.stringify(report, null, 2), 'utf-8')
      console.log(chalk.green(`\n✓ 说明书报告已保存到: ${options.output}`))
    }
  } catch (error) {
    spinner.fail(chalk.red('执行失败'))
    console.error(error)
  }
}

export async function checkPatent(options: {
  title: string
  field: string
  disclosure: string
  output?: string
}): Promise<void> {
  const spinner = ora('启动专利质量检查流程...').start()

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

    spinner.succeed(chalk.green('✓ 质量检查智能体已启动'))

    spinner.start(chalk.blue('步骤1/3: 发明理解...'))

    const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
    const { ClaimsGenerationAgent } = await import('@yunpat/agent-claims')
    const { SpecificationDrafterAgent } = await import('@yunpat/agent-specification')
    const { QualityCheckerAgent } = await import('@yunpat/agent-quality')

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

    spinner.start(chalk.blue('步骤2/3: 生成权利要求与说明书...'))

    const claimsAgent = new ClaimsGenerationAgent({
      name: 'claims-generation',
      description: '权利要求生成智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const claimsResult = await claimsAgent.execute({
      inventionUnderstanding: inventionResult,
    })

    const specAgent = new SpecificationDrafterAgent({
      name: 'specification-drafter',
      description: '说明书撰写智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const specResult = await specAgent.execute({
      inventionUnderstanding: inventionResult,
      claims: {
        independentClaims: claimsResult.independentClaims.map((c: IndependentClaim) => ({
          claimNumber: c.claimNumber,
          fullText: c.fullText,
          claimType: c.claimType,
        })),
        dependentClaims: claimsResult.dependentClaims.map((c: DependentClaim) => ({
          claimNumber: c.claimNumber,
          content: c.content,
          parentClaim: c.parentClaim,
        })),
      },
    })

    spinner.succeed(chalk.green('✓ 权利要求与说明书生成完成'))

    spinner.start(chalk.blue('步骤3/3: 质量检查...'))

    const qualityAgent = new QualityCheckerAgent({
      name: 'quality-checker',
      description: '质量检查智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const qualityResult = await qualityAgent.execute({
      claims: {
        independentClaims: claimsResult.independentClaims.map((c: IndependentClaim) => ({
          claimNumber: c.claimNumber,
          fullText: c.fullText,
          claimType: c.claimType,
          essentialFeatures: c.essentialFeatures,
        })),
        dependentClaims: claimsResult.dependentClaims.map((c: DependentClaim) => ({
          claimNumber: c.claimNumber,
          content: c.content,
          parentClaim: c.parentClaim,
          additionalFeatures: c.additionalFeatures,
        })),
      },
      specification: specResult,
    })

    spinner.succeed(chalk.green('✓ 质量检查完成'))

    console.log(chalk.green('\n=== 质量检查报告 ===\n'))
    console.log(chalk.blue(`综合评分: ${qualityResult.overallScore}/100`))

    console.log(chalk.blue('\n权利要求检查:'))
    console.log(chalk.gray(`  得分: ${qualityResult.claimsCheck.score}/100`))
    console.log(chalk.gray(`  保护范围: ${qualityResult.claimsCheck.protectionScope.status}`))
    console.log(chalk.gray(`  清楚性: ${qualityResult.claimsCheck.clarity.status}`))
    console.log(chalk.gray(`  支持性: ${qualityResult.claimsCheck.support.status}`))

    console.log(chalk.blue('\n说明书检查:'))
    console.log(chalk.gray(`  得分: ${qualityResult.specificationCheck.score}/100`))
    console.log(chalk.gray(`  充分公开: ${qualityResult.specificationCheck.disclosure.status}`))
    console.log(
      chalk.gray(`  术语一致性: ${qualityResult.specificationCheck.termConsistency.status}`)
    )
    console.log(chalk.gray(`  完整性: ${qualityResult.specificationCheck.completeness.status}`))

    console.log(chalk.blue('\n形式检查:'))
    console.log(chalk.gray(`  得分: ${qualityResult.formalCheck.score}/100`))
    console.log(chalk.gray(`  错误数: ${qualityResult.formalCheck.errors.length}`))
    qualityResult.formalCheck.errors.forEach(
      (error: QualityCheckResult['formalCheck']['errors'][0]) => {
        const color = error.severity === 'error' ? chalk.red : chalk.yellow
        console.log(color(`  [${error.severity}] ${error.type}: ${error.description}`))
      }
    )

    if (qualityResult.improvementSuggestions.length > 0) {
      console.log(chalk.blue('\n改进建议:'))
      qualityResult.improvementSuggestions.forEach(
        (suggestion: QualityCheckResult['improvementSuggestions'][0]) => {
          const priorityColor = suggestion.priority === 'high' ? chalk.red : chalk.yellow
          console.log(
            priorityColor(
              `  [${suggestion.priority}] ${suggestion.category}: ${suggestion.description}`
            )
          )
        }
      )
    }

    if (options.output) {
      const fs = await import('fs/promises')
      const report = {
        invention: inventionResult,
        claims: claimsResult,
        specification: specResult,
        quality: qualityResult,
      }
      await fs.writeFile(options.output, JSON.stringify(report, null, 2), 'utf-8')
      console.log(chalk.green(`\n✓ 质量检查报告已保存到: ${options.output}`))
    }
  } catch (error) {
    spinner.fail(chalk.red('执行失败'))
    console.error(error)
  }
}

export async function fullPatentWorkflow(options: {
  title: string
  field: string
  disclosure: string
  output?: string
}): Promise<void> {
  const spinner = ora('启动完整专利撰写流程...').start()

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

    spinner.succeed(chalk.green('✓ 专利撰写工作流已启动'))

    console.log(chalk.green('\n=== v2.0 完整专利撰写工作流（符合专业规范） ===\n'))

    // 导入所有智能体
    const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
    const { PriorArtSearchAgent } = await import('@yunpat/agent-prior-art-search')
    const { SpecificationDrafterAgent } = await import('@yunpat/agent-specification-drafter')
    const { ClaimGeneratorAgent } = await import('@yunpat/agent-claim-generator')
    const { AbstractDrafterAgent } = await import('@yunpat/agent-abstract-drafter')
    const { QualityCheckerAgent } = await import('@yunpat/agent-quality')

    // ===== 步骤1: 发明理解 =====
    spinner.start(chalk.blue('步骤1/6: 发明理解...'))

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

    // ===== 步骤2: 现有技术检索 =====
    spinner.start(chalk.blue('步骤2/6: 现有技术检索...'))

    const searchAgent = new PriorArtSearchAgent({
      name: 'prior-art-search',
      description: '现有技术检索智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const searchResult = await searchAgent.execute({
      inventionUnderstanding: inventionResult,
    })

    spinner.succeed(chalk.green('✓ 现有技术检索完成'))
    console.log(
      chalk.gray(`   最接近现有技术: ${searchResult.comparisonAnalysis.closestPriorArt.title}`)
    )

    // ===== 步骤3: 说明书撰写 =====
    // 注意：说明书必须在权利要求之前撰写（A26.4支持性原则）
    spinner.start(chalk.blue('步骤3/6: 撰写说明书...'))

    const specAgent = new SpecificationDrafterAgent({
      name: 'specification-drafter',
      description: '说明书撰写智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const specResult = await specAgent.execute({
      inventionUnderstanding: inventionResult,
      priorArtSearch: searchResult,
    })

    spinner.succeed(chalk.green('✓ 说明书撰写完成'))
    console.log(chalk.gray(`   总字数: ${specResult.metrics.totalWordCount}`))
    console.log(chalk.gray(`   章节数: ${specResult.metrics.chapterCount}`))

    // ===== 步骤4: 权利要求撰写 =====
    // 注意：权利要求以说明书为依据（A26.4），因此在说明书之后撰写
    spinner.start(chalk.blue('步骤4/6: 撰写权利要求...'))

    const claimsAgent = new ClaimGeneratorAgent({
      name: 'claim-generator',
      description: '权利要求撰写智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const claimsResult = await claimsAgent.execute({
      inventionUnderstanding: inventionResult,
      priorArtSearch: searchResult,
      specificationDraft: specResult.specification,
    })

    spinner.succeed(chalk.green('✓ 权利要求撰写完成'))
    console.log(
      chalk.gray(`   独立权利要求: ${claimsResult.claimsSet.independent_claims.length} 项`)
    )
    console.log(chalk.gray(`   从属权利要求: ${claimsResult.claimsSet.dependent_claims.length} 项`))

    // ===== 步骤5: 摘要撰写 =====
    // 注意：摘要在最后撰写，用于总结整个发明
    spinner.start(chalk.blue('步骤5/6: 撰写摘要...'))

    const abstractAgent = new AbstractDrafterAgent({
      name: 'abstract-drafter',
      description: '摘要撰写智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const abstractResult = await abstractAgent.execute({
      inventionUnderstanding: inventionResult,
      specification: specResult.specification,
      claims: claimsResult.claimsSet,
    })

    spinner.succeed(chalk.green('✓ 摘要撰写完成'))
    console.log(chalk.gray(`   字数: ${abstractResult.abstract.wordCount}`))

    // ===== 步骤6: 质量检查 =====
    spinner.start(chalk.blue('步骤6/6: 质量检查...'))

    const qualityAgent = new QualityCheckerAgent({
      name: 'quality-checker',
      description: '质量检查智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    const qualityResult = await qualityAgent.execute({
      claims: claimsResult.claimsSet,
      specification: specResult.specification,
      inventionUnderstanding: inventionResult,
    })

    spinner.succeed(chalk.green('✓ 质量检查完成'))
    console.log(chalk.gray(`   综合评分: ${qualityResult.overallScore}/100`))

    console.log(chalk.green('\n=== 完整专利申请文件 ===\n'))

    console.log(chalk.blue('【发明理解】'))
    console.log(chalk.gray(`  技术问题: ${inventionResult.technicalProblem}`))
    console.log(chalk.gray(`  核心创新: ${inventionResult.keyFeatures.join(', ')}`))

    console.log(chalk.blue('\n【检索结果】'))
    console.log(chalk.gray(`  检索策略: ${searchResult.searchStrategy.searchQuery}`))

    console.log(chalk.blue('\n【权利要求书】'))
    claimsResult.claimsSet.independent_claims.forEach((claim: any) => {
      console.log(chalk.gray(`  ${claim.claim_number}. ${claim.full_text.substring(0, 100)}...`))
    })

    console.log(chalk.blue('\n【说明书】'))
    console.log(
      chalk.gray(
        `  技术领域: ${specResult.specification.technical_field.content.substring(0, 100)}...`
      )
    )
    console.log(
      chalk.gray(
        `  发明内容: ${specResult.specification.invention_content.content.substring(0, 100)}...`
      )
    )

    console.log(chalk.blue('\n【摘要】'))
    console.log(chalk.gray(`  ${abstractResult.abstract.content.substring(0, 200)}...`))

    console.log(chalk.blue('\n【质量评分】'))
    console.log(chalk.gray(`  综合评分: ${qualityResult.overallScore}/100`))
    if (qualityResult.claimsCheck) {
      console.log(chalk.gray(`  权利要求: ${qualityResult.claimsCheck.score}/100`))
    }
    if (qualityResult.specificationCheck) {
      console.log(chalk.gray(`  说明书: ${qualityResult.specificationCheck.score}/100`))
    }
    if (qualityResult.formalCheck) {
      console.log(chalk.gray(`  形式: ${qualityResult.formalCheck.score}/100`))
    }

    if (qualityResult.improvementSuggestions && qualityResult.improvementSuggestions.length > 0) {
      console.log(chalk.yellow('\n【待改进项】'))
      qualityResult.improvementSuggestions.slice(0, 5).forEach((suggestion: any) => {
        console.log(chalk.yellow(`  [${suggestion.priority}] ${suggestion.description}`))
      })
    }

    if (options.output) {
      const fs = await import('fs/promises')
      const report = {
        version: 'v2.0',
        timestamp: new Date().toISOString(),
        invention: inventionResult,
        search: searchResult,
        specification: specResult.specification,
        claims: claimsResult.claimsSet,
        abstract: abstractResult.abstract,
        quality: qualityResult,
      }
      await fs.writeFile(options.output, JSON.stringify(report, null, 2), 'utf-8')
      console.log(chalk.green(`\n✓ 完整专利文件已保存到: ${options.output}`))
    }

    console.log(chalk.green('\n🎉 v2.0 完整专利撰写工作流已完成!'))
    console.log(
      chalk.gray('   符合专业专利代理人工作流程：发明理解 → 检索 → 说明书 → 权利要求 → 摘要')
    )
  } catch (error) {
    spinner.fail(chalk.red('执行失败'))
    console.error(error)
  }
}
