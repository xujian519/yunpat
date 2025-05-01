/**
 * 集成示例：在智能体中使用 PatentDatabaseAdapter
 * Integration Example: Using PatentDatabaseAdapter in Agents
 */

import { PatentDatabaseAdapter } from '@yunpat/patent-database'

/**
 * 示例 1: 在 PatentSearchAgent 中集成
 */
export class PatentSearchAgentWithDB {
  private database: PatentDatabaseAdapter

  constructor(config: any) {
    // 初始化数据库适配器
    this.database = new PatentDatabaseAdapter({
      patent_db: {
        host: config.patent_db?.host || 'localhost',
        port: config.patent_db?.port || 5432,
        database: config.patent_db?.database || 'patent_db',
        user: config.patent_db?.user || 'postgres',
        password: config.patent_db?.password || '',
        poolSize: config.patent_db?.poolSize || 10,
      },
      google_patents: {
        enabled: config.google_patents?.enabled !== false,
        rateLimit: config.google_patents?.rateLimit || 1.0,
        timeout: config.google_patents?.timeout || 10000,
      },
    })
  }

  /**
   * 根据关键词检索专利
   */
  async searchByKeywords(keywords: string[], options: any = {}) {
    console.log(`[PatentSearchAgent] 检索关键词: ${keywords.join(' ')}`)

    // 使用真实数据库检索
    const results = await this.database.queryPatents({
      keywords: keywords,
      limit: options.limit || 20,
      language: options.language || 'zh',
    })

    console.log(`[PatentSearchAgent] 找到 ${results.length} 条相关专利`)

    return {
      results: results,
      totalFound: results.length,
      searchTimeMs: Date.now(),
      dataSource: results.length > 0 ? results[0].source : 'none',
    }
  }

  /**
   * 根据申请人检索专利
   */
  async searchByApplicant(applicant: string, options: any = {}) {
    console.log(`[PatentSearchAgent] 检索申请人: ${applicant}`)

    const results = await this.database.queryByApplicant(applicant, {
      limit: options.limit || 50,
      startDate: options.startDate,
      endDate: options.endDate,
    })

    return {
      applicant: applicant,
      results: results,
      totalFound: results.length,
    }
  }

  /**
   * 根据专利号精确查询
   */
  async getByPublicationNumber(publicationNumber: string) {
    console.log(`[PatentSearchAgent] 查询专利号: ${publicationNumber}`)

    const results = await this.database.queryByPublicationNumber(publicationNumber)

    if (results.length > 0) {
      return {
        found: true,
        patent: results[0],
        source: results[0].source,
      }
    } else {
      return {
        found: false,
        patent: null,
        source: 'none',
      }
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    return await this.database.healthCheck()
  }

  /**
   * 关闭连接
   */
  async close() {
    await this.database.close()
  }
}

/**
 * 示例 2: 在 PatentAnalyzerAgent 中集成
 */
export class PatentAnalyzerAgentWithDB {
  private database: PatentDatabaseAdapter

  constructor(config: any) {
    this.database = new PatentDatabaseAdapter({
      patent_db: config.patent_db,
      google_patents: config.google_patents,
    })
  }

  /**
   * 分析专利技术方案
   */
  async analyzePatentTechnicalSolution(publicationNumber: string) {
    console.log(`[PatentAnalyzerAgent] 分析专利: ${publicationNumber}`)

    // 1. 从数据库获取专利信息
    const patents = await this.database.queryByPublicationNumber(publicationNumber)

    if (patents.length === 0) {
      return {
        success: false,
        error: '未找到该专利',
      }
    }

    const patent = patents[0]

    // 2. 检索相关专利（用于对比分析）
    const relatedPatents = await this.database.queryByKeywords(
      [patent.title.split(' ')[0]], // 使用标题第一个词作为关键词
      { limit: 10 }
    )

    // 3. 返回分析结果
    return {
      success: true,
      patent: {
        publicationNumber: patent.publicationNumber,
        title: patent.title,
        abstract: patent.abstract,
        applicant: patent.applicant,
        ipcCodes: patent.ipcCodes,
      },
      relatedPatents: relatedPatents.length,
      analysis: {
        hasClaims: !!patent.claims,
        hasDescription: !!patent.description,
        technicalField: this.extractTechnicalField(patent),
      },
    }
  }

  /**
   * 提取技术领域
   */
  private extractTechnicalField(patent: any): string {
    if (patent.ipcCodes && patent.ipcCodes.length > 0) {
      const ipcCode = patent.ipcCodes[0]
      const section = ipcCode.charAt(0) // IPC 部（A-H）

      const sections: Record<string, string> = {
        A: '人类生活需要',
        B: '作业；运输',
        C: '化学；冶金',
        D: '纺织；造纸',
        E: '固定建筑物',
        F: '机械工程；照明；加热；武器；爆破',
        G: '物理',
        H: '电学',
      }

      return sections[section] || '其他'
    }

    return '未分类'
  }

  /**
   * 关闭连接
   */
  async close() {
    await this.database.close()
  }
}

/**
 * 示例 3: 使用环境变量配置
 */
export function createDatabaseAdapterFromEnv(): PatentDatabaseAdapter {
  return new PatentDatabaseAdapter({
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
  })
}

/**
 * 示例 4: 完整的使用流程
 */
export async function exampleWorkflow() {
  // 1. 创建智能体
  const agent = new PatentSearchAgentWithDB({
    patent_db: {
      host: 'localhost',
      port: 5432,
      database: 'patent_db',
      user: 'postgres',
      password: '',
    },
    google_patents: {
      enabled: true,
      rateLimit: 1.0,
      timeout: 10000,
    },
  })

  try {
    // 2. 健康检查
    console.log('=== 健康检查 ===')
    const health = await agent.healthCheck()
    console.log('patent_db:', health.patent_db ? '✓ 正常' : '✗ 异常')
    console.log('google_patents:', health.google_patents ? '✓ 正常' : '✗ 异常')

    // 3. 关键词检索
    console.log('\n=== 关键词检索 ===')
    const searchResults = await agent.searchByKeywords(['深度学习', '图像识别'], {
      limit: 5,
    })
    console.log(`找到 ${searchResults.totalFound} 条专利`)
    searchResults.results.forEach((patent, index) => {
      console.log(`${index + 1}. ${patent.publicationNumber} - ${patent.title}`)
    })

    // 4. 申请人检索
    console.log('\n=== 申请人检索 ===')
    const applicantResults = await agent.searchByApplicant('腾讯', {
      limit: 3,
    })
    console.log(`腾讯有 ${applicantResults.totalFound} 条专利`)

    // 5. 精确查询
    console.log('\n=== 精确查询 ===')
    if (searchResults.results.length > 0) {
      const patentNumber = searchResults.results[0].publicationNumber
      const patent = await agent.getByPublicationNumber(patentNumber)
      if (patent.found) {
        console.log(`找到专利: ${patent.patent.title}`)
      }
    }
  } finally {
    // 6. 关闭连接
    await agent.close()
    console.log('\n=== 连接已关闭 ===')
  }
}

// 导出工厂函数
export default {
  PatentSearchAgentWithDB,
  PatentAnalyzerAgentWithDB,
  createDatabaseAdapterFromEnv,
  exampleWorkflow,
}
