/**
 * PatentSearchAgentV3 使用示例
 * 展示如何使用集成真实数据库的专利检索智能体
 */

import { PatentSearchAgentV3 } from '@yunpat/agent-search'
import {
  SimpleEventBus,
  SimpleMemoryStore,
  SimpleToolRegistry,
  ClaudeLLMAdapter,
} from '@yunpat/core'

/**
 * 示例 1: 基本使用
 */
export async function example1_BasicUsage() {
  console.log('=== 示例 1: 基本使用 ===\n')

  // 1. 初始化框架组件
  const eventBus = new SimpleEventBus()
  const memory = new SimpleMemoryStore()
  const tools = new SimpleToolRegistry()
  const llm = new ClaudeLLMAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
  })

  // 2. 创建专利检索智能体（使用真实数据库）
  const agent = new PatentSearchAgentV3({
    name: 'patent-search-agent',
    description: '专利检索智能体（v3 - 真实数据库）',
    eventBus,
    memory,
    tools,
    llm,
    databaseConfig: {
      patent_db: {
        host: process.env.PATENT_DB_HOST || 'localhost',
        port: parseInt(process.env.PATENT_DB_PORT || '5432'),
        database: process.env.PATENT_DB_NAME || 'patent_db',
        user: process.env.PATENT_DB_USER || 'postgres',
        password: process.env.PATENT_DB_PASSWORD || '',
        poolSize: 10,
      },
      google_patents: {
        enabled: true,
        rateLimit: 1.0,
        timeout: 10000,
      },
    },
  })

  try {
    // 3. 健康检查
    console.log('步骤1: 健康检查')
    const health = await agent.healthCheck()
    console.log('patent_db:', health.patent_db ? '✓ 正常' : '✗ 异常')
    console.log('google_patents:', health.google_patents ? '✓ 正常' : '✗ 异常')
    console.log('')

    // 4. 执行检索
    console.log('步骤2: 执行专利检索')
    const result = await agent.run(
      {
        title: '基于深度学习的图像识别方法',
        field: '计算机视觉',
        technicalProblem: '传统图像识别方法准确率低、泛化能力差',
        technicalSolution: '使用卷积神经网络提取图像特征，通过多层网络结构提高识别准确率',
        keyFeatures: ['卷积神经网络', '特征提取', '深度学习', '图像分类', '反向传播算法'],
      },
      {
        llm,
      }
    )

    // 5. 输出结果
    console.log('\n步骤3: 检索结果')
    console.log(`检索策略: ${result.strategy.searchQuery}`)
    console.log(`关键词: ${result.strategy.keywords.join(', ')}`)
    console.log(`找到专利: ${result.totalFound} 条`)
    console.log(`数据来源: ${result.dataSource}`)
    console.log(`耗时: ${result.searchTimeMs}ms`)

    if (result.results.length > 0) {
      console.log('\n前 5 条专利:')
      result.results.slice(0, 5).forEach((patent, index) => {
        console.log(`${index + 1}. ${patent.publicationNumber} - ${patent.patentName}`)
        console.log(`   申请人: ${patent.applicant || '未知'}`)
        console.log(`   摘要: ${patent.abstract?.substring(0, 100) || '无'}...`)
        console.log('')
      })
    }

    if (result.academicPapers && result.academicPapers.length > 0) {
      console.log(`\n学术论文: ${result.academicPapers.length} 篇`)
      result.academicPapers.slice(0, 3).forEach((paper, index) => {
        console.log(`${index + 1}. ${paper.title}`)
        console.log(`   作者: ${paper.authors}`)
        console.log(`   年份: ${paper.year}`)
        console.log('')
      })
    }
  } finally {
    // 6. 关闭连接
    await agent.close()
    console.log('智能体已关闭')
  }
}

/**
 * 示例 2: 使用环境变量配置
 */
export async function example2_EnvConfig() {
  console.log('=== 示例 2: 使用环境变量配置 ===\n')

  // 从环境变量创建数据库配置
  const databaseConfig = {
    patent_db: {
      host: process.env.PATENT_DB_HOST || 'localhost',
      port: parseInt(process.env.PATENT_DB_PORT || '5432'),
      database: process.env.PATENT_DB_NAME || 'patent_db',
      user: process.env.PATENT_DB_USER || 'postgres',
      password: process.env.PATENT_DB_PASSWORD || '',
      poolSize: parseInt(process.env.PATENT_DB_POOL_SIZE || '10'),
    },
    google_patents: {
      enabled: process.env.GOOGLE_PATENTS_ENABLED !== 'false',
      rateLimit: parseFloat(process.env.GOOGLE_PATENTS_RATE_LIMIT || '1.0'),
      timeout: parseInt(process.env.GOOGLE_PATENTS_TIMEOUT || '10000'),
    },
  }

  console.log('数据库配置:')
  console.log(`  PatentDB: ${databaseConfig.patent_db.host}:${databaseConfig.patent_db.port}`)
  console.log(`  Google Patents: ${databaseConfig.google_patents.enabled ? '启用' : '禁用'}`)
  console.log('')

  // 创建智能体
  const agent = new PatentSearchAgentV3({
    name: 'patent-search-agent',
    description: '专利检索智能体',
    eventBus: new SimpleEventBus(),
    memory: new SimpleMemoryStore(),
    tools: new SimpleToolRegistry(),
    llm: new ClaudeLLMAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-sonnet-4-20250514',
    }),
    databaseConfig,
  })

  try {
    // 获取数据源列表
    const dataSources = agent.getDataSources()
    console.log(`可用数据源: ${dataSources.join(', ')}`)

    // 获取统计数据（仅 PatentDB 支持）
    const stats = await agent.getStatistics()
    if (stats) {
      console.log(`\nPatentDB 统计:`)
      console.log(`  总数: ${stats.total}`)
      console.log(`  按状态: ${JSON.stringify(stats.byStatus)}`)
    }
  } finally {
    await agent.close()
  }
}

/**
 * 示例 3: 仅使用 Google Patents（无本地数据库）
 */
export async function example3_OnlineOnly() {
  console.log('=== 示例 3: 仅使用在线数据源 ===\n')

  const agent = new PatentSearchAgentV3({
    name: 'patent-search-agent',
    description: '专利检索智能体（仅在线）',
    eventBus: new SimpleEventBus(),
    memory: new SimpleMemoryStore(),
    tools: new SimpleToolRegistry(),
    llm: new ClaudeLLMAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-sonnet-4-20250514',
    }),
    databaseConfig: {
      // 不配置 patent_db，仅使用 Google Patents
      google_patents: {
        enabled: true,
        rateLimit: 1.0,
        timeout: 10000,
      },
    },
  })

  try {
    console.log('数据源:', agent.getDataSources().join(', '))

    const result = await agent.run(
      {
        title: 'Neural Network Image Recognition',
        field: 'Computer Vision',
        technicalProblem: 'Low accuracy in image recognition',
        technicalSolution: 'Using convolutional neural networks for feature extraction',
        keyFeatures: ['CNN', 'Deep Learning', 'Image Classification'],
      },
      {
        llm: agent['llm'], // 访问私有属性（示例代码）
      }
    )

    console.log(`\n找到 ${result.totalFound} 条专利`)
    console.log(`数据来源: ${result.dataSource}`)
  } finally {
    await agent.close()
  }
}

/**
 * 示例 4: 完整工作流程
 */
export async function example4_FullWorkflow() {
  console.log('=== 示例 4: 完整工作流程 ===\n')

  const agent = new PatentSearchAgentV3({
    name: 'patent-search-agent',
    description: '专利检索智能体',
    eventBus: new SimpleEventBus(),
    memory: new SimpleMemoryStore(),
    tools: new SimpleToolRegistry(),
    llm: new ClaudeLLMAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-sonnet-4-20250514',
    }),
    databaseConfig: {
      patent_db: {
        host: 'localhost',
        port: 5432,
        database: 'patent_db',
        user: 'postgres',
        password: '',
      },
      google_patents: {
        enabled: true,
      },
    },
  })

  try {
    // 1. 健康检查
    console.log('1️⃣  健康检查')
    const health = await agent.healthCheck()
    console.log(`   PatentDB: ${health.patent_db ? '✓' : '✗'}`)
    console.log(`   Google Patents: ${health.google_patents ? '✓' : '✗'}`)

    // 2. 执行检索
    console.log('\n2️⃣  执行专利检索')
    const result = await agent.run(
      {
        title: '基于区块链的分布式数据存储方法',
        field: '区块链技术',
        technicalProblem: '中心化存储存在单点故障风险',
        technicalSolution: '使用区块链技术实现分布式存储，提高数据可靠性和安全性',
        keyFeatures: ['区块链', '分布式存储', '共识机制', '加密算法', '智能合约'],
      },
      {
        llm: agent['llm'],
      }
    )

    // 3. 分析结果
    console.log('\n3️⃣  分析结果')
    console.log(`   找到专利: ${result.totalFound} 条`)
    console.log(`   数据来源: ${result.dataSource}`)
    console.log(`   耗时: ${result.searchTimeMs}ms`)

    // 4. 统计申请人
    if (result.results.length > 0) {
      const applicantCount: Record<string, number> = {}
      result.results.forEach((patent) => {
        const applicant = patent.applicant || '未知'
        applicantCount[applicant] = (applicantCount[applicant] || 0) + 1
      })

      console.log('\n4️⃣  申请人统计')
      Object.entries(applicantCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([applicant, count]) => {
          console.log(`   ${applicant}: ${count} 条`)
        })
    }

    // 5. 统计分类号
    if (result.results.length > 0) {
      const ipcCount: Record<string, number> = {}
      result.results.forEach((patent) => {
        if (patent.ipcCode) {
          const ipcs = patent.ipcCode.split(', ')
          ipcs.forEach((ipc) => {
            ipcCount[ipc] = (ipcCount[ipc] || 0) + 1
          })
        }
      })

      console.log('\n5️⃣  IPC分类号统计')
      Object.entries(ipcCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([ipc, count]) => {
          console.log(`   ${ipc}: ${count} 条`)
        })
    }
  } finally {
    await agent.close()
    console.log('\n✅ 工作流程完成')
  }
}

// 导出所有示例
export default {
  example1_BasicUsage,
  example2_EnvConfig,
  example3_OnlineOnly,
  example4_FullWorkflow,
}
