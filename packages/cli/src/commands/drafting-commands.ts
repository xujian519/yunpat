import chalk from 'chalk'
import ora from 'ora'
import { EventBus, ShortTermMemory, ToolRegistry, createDeepSeekModel } from '@yunpat/core'

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
    console.log(chalk.green('\n=== v2.0 完整专利撰写工作流 ===\n'))

    const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
    const { PriorArtSearchAgent } = await import('@yunpat/agent-prior-art-search')
    const { SpecificationDrafterAgent } = await import('@yunpat/agent-specification-drafter')
    const { ClaimGeneratorAgent } = await import('@yunpat/agent-claim-generator')
    const { AbstractDrafterAgent } = await import('@yunpat/agent-abstract-drafter')
    const { QualityCheckerAgent } = await import('@yunpat/agent-quality')

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
    console.log(chalk.gray(`   创造性评估: ${searchResult.creativityAssessment.level}`))

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
      specification: specResult.specification,
    })

    spinner.succeed(chalk.green('✓ 权利要求撰写完成'))
    console.log(
      chalk.gray(`   独立权利要求: ${claimsResult.claimsSet.independent_claims.length} 项`)
    )
    console.log(chalk.gray(`   从属权利要求: ${claimsResult.claimsSet.dependent_claims.length} 项`))

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
  } catch (error) {
    spinner.fail(chalk.red('执行失败'))
    console.error(error)
  }
}
