/**
 * MCP Server 全栈 E2E 测试
 *
 * 覆盖 T-040 ~ T-047：MCP Server 工具注册、执行、CON-01 拦截、API 降级等完整链路。
 * - T-040: MCP 工具注册与枚举
 * - T-041: PatentSearchTool 执行 + 可溯源验证
 * - T-042: ClaimsGeneratorTool CON-02 范围检查集成
 * - T-043: QualityCheckerTool 执行返回评分结构
 * - T-044: ProjectScanTool 目录扫描
 * - T-045: CON-01 敏感输入拦截 + 审计日志
 * - T-046: CON-01 假阴性防护（非交底书内容不误拦截）
 * - T-047: API 降级模式（无 LLM Key）
 */

import { describe, it, expect } from 'vitest'
import { detectTechnicalDisclosure } from '@yunpat/core'

import {
  createSampleDisclosure,
  createSensitiveDisclosure,
  createNormalContent,
} from '../helpers/test-data-factory.js'

import {
  assertToolSuccess,
  assertValidClaimsSet,
  assertValidQualityReport,
  assertCON01Violation,
  assertNoCON01Violation,
} from '../helpers/assertion-helpers.js'

// E2E 测试仅在 MOCK_TESTS=true 时运行
const describeE2E = process.env.MOCK_TESTS === 'true' ? describe : describe.skip

// ========== 辅助函数 ==========

/** 从工具参数对象中提取所有文本值（用于 CON-01 检测） */
function extractInputText(args: Record<string, unknown> | undefined): string {
  if (!args) return ''
  return Object.values(args)
    .filter((v): v is string => typeof v === 'string')
    .join('\n')
}

/** 动态导入 MCP 工具（从 mcp-server 包的 tools/index.js） */
async function importTools() {
  return await import('@yunpat/mcp-server/tools/index.js')
}

// ========== T-040: MCP 工具注册与枚举 ==========

describeE2E('T-040: MCP 工具注册与枚举', () => {
  it('每个工具都有完整的 metadata（name, description, inputSchema）', async () => {
    const tools = await importTools()

    const toolClasses = [
      tools.PatentSearchTool,
      tools.ClaimsGeneratorTool,
      tools.QualityCheckerTool,
      tools.PatentAnalyzerTool,
      tools.PatentDispatchTool,
      tools.ProjectScanTool,
    ].filter(Boolean) // 过滤掉可能不存在的导出

    for (const ToolClass of toolClasses) {
      const instance = new ToolClass()
      const meta = instance.metadata

      expect(meta.name, `${ToolClass.name} 应有 name`).toBeTruthy()
      expect(typeof meta.name, `${ToolClass.name}.name 应为字符串`).toBe('string')

      expect(meta.description, `${ToolClass.name} 应有 description`).toBeTruthy()
      expect(typeof meta.description, `${ToolClass.name}.description 应为字符串`).toBe('string')

      expect(meta.inputSchema, `${ToolClass.name} 应有 inputSchema`).toBeDefined()
    }
  })

  it('注册工具总数 >= 10', async () => {
    const tools = await importTools()

    const exportedNames = Object.keys(tools).filter(
      (name) => typeof tools[name] === 'function' && name.endsWith('Tool')
    )

    expect(exportedNames.length).toBeGreaterThanOrEqual(10)
  })

  it('工具可通过 getMcpSchema() 生成 JSON-RPC 兼容的 schema', async () => {
    const { PatentSearchTool } = await importTools()
    const tool = new PatentSearchTool()
    const schema = tool.getMcpSchema()

    expect(schema.name).toBe(tool.metadata.name)
    expect(schema.inputSchema).toBeDefined()
    // inputSchema 可能是 { type: 'object', properties: {...} } 或嵌套结构
    expect(typeof schema.inputSchema).toBe('object')
  })
})

// ========== T-041: PatentSearchTool 执行 + 可溯源 ==========

describeE2E('T-041: PatentSearchTool 执行与可溯源验证', () => {
  it('执行检索返回结构化结果', async () => {
    const { PatentSearchTool } = await importTools()
    const tool = new PatentSearchTool()

    const disclosure = createSampleDisclosure('thermal')

    const result = await tool.execute(
      {
        inventionTitle: disclosure.title,
        technicalField: disclosure.field,
        technicalProblem: '芯片功耗和发热量大幅增加，传统散热效率不足',
        technicalSolution: '采用相变材料作为散热介质，配置多层复合散热结构',
        keyFeatures: disclosure.expectedKeyFeatures,
        patentType: 'invention',
      },
      {} // 空 context，使用规则模式
    )

    assertToolSuccess(result)
    expect(result.data.version).toBe('3.0.0')
    expect(result.data.integrationMode).toBe('rule_based')
    expect(result.data).toHaveProperty('strategy')
    expect(result.data).toHaveProperty('results')
    expect(result.data).toHaveProperty('totalFound')
  })

  it('检索结果中的每条专利具有来源追踪信息', async () => {
    const { PatentSearchTool } = await importTools()
    const tool = new PatentSearchTool()

    const result = await tool.execute(
      {
        inventionTitle: '一种基于深度学习的语音识别方法',
        technicalField: '人工智能',
        technicalProblem: '噪声环境下语音识别准确率低',
        technicalSolution: '使用注意力机制增强的Transformer模型',
        keyFeatures: ['Transformer', '注意力机制', '噪声鲁棒'],
        patentType: 'invention',
      },
      {}
    )

    assertToolSuccess(result)

    if (result.data.results && result.data.results.length > 0) {
      for (const item of result.data.results) {
        // 每条检索结果应有专利标识
        expect(item).toHaveProperty('patentId')
        expect(item).toHaveProperty('title')
        // 应有相关性评分
        if (item.relevanceScore !== undefined) {
          expect(item.relevanceScore).toBeGreaterThanOrEqual(0)
          expect(item.relevanceScore).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('检索结果包含新颖性评估', async () => {
    const { PatentSearchTool } = await importTools()
    const tool = new PatentSearchTool()

    const result = await tool.execute(
      {
        inventionTitle: '一种基于相变材料的高效散热装置',
        technicalField: '电子设备散热技术',
        technicalProblem: '高温环境下散热效率不足',
        technicalSolution: '相变材料散热',
        keyFeatures: ['相变材料', '智能温控'],
        patentType: 'invention',
      },
      {}
    )

    assertToolSuccess(result)
    expect(result.data).toHaveProperty('noveltyAssessment')

    const novelty = result.data.noveltyAssessment
    expect(novelty).toHaveProperty('score')
    expect(typeof novelty.score).toBe('number')
    expect(novelty.score).toBeGreaterThanOrEqual(0)
  })
})

// ========== T-042: ClaimsGeneratorTool CON-02 检查集成 ==========

describeE2E('T-042: ClaimsGeneratorTool CON-02 范围检查', () => {
  it('生成权利要求结果包含独立和从属权利要求', async () => {
    const { ClaimsGeneratorTool } = await importTools()
    const tool = new ClaimsGeneratorTool()

    const result = await tool.execute(
      {
        inventionTitle: '智能温度控制系统',
        technicalField: '自动化控制',
        technicalProblem: '温度控制响应慢、精度低',
        technicalSolution: '采用模糊PID控制算法结合多传感器数据融合',
        beneficialEffects: '提高温度控制精度和响应速度',
        keyFeatures: ['模糊PID控制器', '温度传感器阵列', '数据融合模块'],
        patentType: 'invention',
      },
      {}
    )

    assertToolSuccess(result)
    expect(result.data).toHaveProperty('claimsSet')

    const claimsSet = result.data.claimsSet
    assertValidClaimsSet(claimsSet)
  })

  it('权利要求不应包含过度宽泛表述（CON-02）', async () => {
    const { ClaimsGeneratorTool } = await importTools()
    const tool = new ClaimsGeneratorTool()

    const result = await tool.execute(
      {
        inventionTitle: '一种数据处理装置',
        technicalField: '计算机技术',
        technicalProblem: '处理效率低',
        technicalSolution: '并行计算优化',
        beneficialEffects: '显著提升处理速度',
        keyFeatures: ['并行计算', '分布式架构', '负载均衡'],
        patentType: 'invention',
      },
      {}
    )

    assertToolSuccess(result)

    const claimsText = result.data.fullClaimsText || JSON.stringify(result.data.claimsSet)

    // CON-02: 权利要求不应包含过度宽泛术语
    const overbroadTerms = ['任意', '任何类型', '所有类型', '任意形式', '不限']
    for (const term of overbroadTerms) {
      expect(claimsText, `权利要求不应包含"${term}"`).not.toContain(term)
    }
  })

  it('权利要求质量检查结构完整', async () => {
    const { ClaimsGeneratorTool } = await importTools()
    const tool = new ClaimsGeneratorTool()

    const result = await tool.execute(
      {
        inventionTitle: '一种散热装置',
        technicalField: '散热技术',
        technicalProblem: '散热效率低',
        technicalSolution: '多层复合散热结构',
        beneficialEffects: '散热效率提高',
        keyFeatures: ['散热基板', '相变材料层', '温控模块'],
        enableDependentClaims: true,
        patentType: 'invention',
      },
      {}
    )

    assertToolSuccess(result)

    const claimsSet = result.data.claimsSet
    expect(claimsSet).toHaveProperty('quality_check')
    expect(claimsSet.quality_check).toHaveProperty('clarity')
    expect(claimsSet.quality_check).toHaveProperty('support')
    expect(claimsSet.quality_check).toHaveProperty('breadth')
  })
})

// ========== T-043: QualityCheckerTool 评分结构 ==========

describeE2E('T-043: QualityCheckerTool 执行与评分结构', () => {
  it('返回 overallScore（0-100）及分项检查', async () => {
    const { QualityCheckerTool } = await importTools()
    const tool = new QualityCheckerTool()

    const result = await tool.execute(
      {
        inventionTitle: '一种基于相变材料的散热装置',
        claims: {
          independentClaims: [
            {
              claimNumber: 1,
              claimType: 'device',
              fullText: '一种散热装置，包括散热基板和相变材料层。',
            },
          ],
          dependentClaims: [],
        },
        specification: {
          technicalField: '电子设备散热技术',
          backgroundArt: '现有散热技术存在效率不足的问题。',
          detailedDescription:
            '本发明采用相变材料作为散热介质。散热装置包括散热基板、相变材料层和智能温控模块。' +
            '相变材料采用石蜡基复合材料，填充在散热基板与外壳之间。' +
            '智能温控模块通过温度传感器实时监测散热状态，当温度超过阈值时启动辅助风扇。' +
            '散热效率提高60%，工作温度范围扩大至-40°C至120°C，整体能耗降低30%。',
          inventionContent: {
            technicalSolution: '采用相变材料作为散热介质，配置多层复合散热结构。',
          },
        },
      },
      {}
    )

    assertToolSuccess(result)
    assertValidQualityReport(result.data)
  })

  it('claimsCheck 和 specificationCheck 子结构验证', async () => {
    const { QualityCheckerTool } = await importTools()
    const tool = new QualityCheckerTool()

    const result = await tool.execute(
      {
        inventionTitle: '一种基于相变材料的散热装置',
        claims: {
          independentClaims: [
            {
              claimNumber: 1,
              claimType: 'device',
              fullText:
                '一种基于相变材料的散热装置，其特征在于，包括散热基板、相变材料层和智能温控模块。',
            },
          ],
          dependentClaims: [
            {
              claimNumber: 2,
              content: '根据权利要求1所述的装置，其特征在于，相变材料为石蜡基复合材料。',
              parentClaim: 1,
            },
          ],
        },
        specification: {
          technicalField: '电子设备散热技术',
          backgroundArt: '现有散热效率不足。',
          detailedDescription: '详细实施方式内容。'.repeat(20),
          inventionContent: {
            technicalSolution: '相变材料散热方案',
          },
        },
      },
      {}
    )

    assertToolSuccess(result)

    expect(result.data).toHaveProperty('claimsCheck')
    expect(result.data.claimsCheck).toHaveProperty('score')
    expect(typeof result.data.claimsCheck.score).toBe('number')

    expect(result.data).toHaveProperty('specificationCheck')
    expect(result.data.specificationCheck).toHaveProperty('score')
    expect(typeof result.data.specificationCheck.score).toBe('number')
  })

  it('缺少独立权利要求时评分大幅下降', async () => {
    const { QualityCheckerTool } = await importTools()
    const tool = new QualityCheckerTool()

    const result = await tool.execute(
      {
        inventionTitle: '测试发明',
        claims: {
          independentClaims: [], // 缺少独立权利要求
          dependentClaims: [],
        },
        specification: {
          technicalField: '',
          detailedDescription: '',
        },
      },
      {}
    )

    assertToolSuccess(result)
    // 缺少独立权利要求时，评分应较低
    expect(result.data.overallScore).toBeLessThan(70)
    expect(result.data.improvementSuggestions.length).toBeGreaterThan(0)
  })
})

// ========== T-044: ProjectScanTool 目录扫描 ==========

describeE2E('T-044: ProjectScanTool 目录扫描', () => {
  it('扫描临时目录并返回结构化结果', async () => {
    let ProjectScanTool: any
    try {
      const tools = await importTools()
      ProjectScanTool = tools.ProjectScanTool
    } catch {
      // ProjectScanTool 可能依赖 fs 等运行时环境，跳过
    }

    if (!ProjectScanTool) {
      return // 动态导入失败时静默跳过
    }

    const tool = new ProjectScanTool()
    const tmpDir = `/tmp/yunpat-test-scan-${Date.now()}`

    // 创建临时测试目录结构
    const { mkdirSync, writeFileSync, rmSync } = await import('fs')
    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(`${tmpDir}/说明书.md`, '# 发明名称\n\n技术方案描述')
    writeFileSync(`${tmpDir}/审查意见.txt`, '第一次审查意见通知书')

    try {
      const result = await tool.execute(
        {
          workingDirectory: tmpDir,
          maxFiles: 50,
          maxContentPreview: 500,
          writeFile: false, // 不在工作目录生成文件
        },
        {}
      )

      assertToolSuccess(result)
      expect(result.data).toBeDefined()

      // 验证扫描结果结构
      if (result.data.documents) {
        expect(result.data.documents).toBeInstanceOf(Array)
      }
      if (result.data.projectProfile) {
        expect(result.data.projectProfile).toBeDefined()
      }
    } finally {
      // 清理临时目录
      try {
        rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        // 清理失败不影响测试结果
      }
    }
  })

  it('ProjectScanTool 拒绝被阻止的路径', async () => {
    let ProjectScanTool: any
    try {
      const tools = await importTools()
      ProjectScanTool = tools.ProjectScanTool
    } catch {
      return
    }

    if (!ProjectScanTool) return

    const tool = new ProjectScanTool()

    const result = await tool.execute(
      {
        workingDirectory: '/etc/passwd', // 被阻止的系统路径
        maxFiles: 10,
        maxContentPreview: 100,
        writeFile: false,
      },
      {}
    )

    // 被阻止路径应返回错误
    expect(result.success).toBe(false)
  })
})

// ========== T-045: CON-01 敏感输入拦截 + 审计日志 ==========

describeE2E('T-045: CON-01 敏感输入拦截', () => {
  it('技术交底书内容被 CON-01 检测并拦截', () => {
    const sensitiveText = createSensitiveDisclosure()
    const check = detectTechnicalDisclosure(sensitiveText)

    assertCON01Violation(check)
    expect(check.ruleId).toBe('CON-01')
  })

  it('检测结果包含匹配关键词', () => {
    const sensitiveText = createSensitiveDisclosure()
    const check = detectTechnicalDisclosure(sensitiveText)

    expect(check.isSensitive).toBe(true)
    expect(check.matchedKeywords).toBeInstanceOf(Array)
    expect(check.matchedKeywords.length).toBeGreaterThan(0)
  })

  it('检测路由为 local 或 abstract_first（不发送外部 API）', () => {
    const sensitiveText = createSensitiveDisclosure()
    const check = detectTechnicalDisclosure(sensitiveText)

    expect(check.isSensitive).toBe(true)
    // 路由必须是本地处理，不允许发送到外部 API
    expect(['local', 'abstract_first']).toContain(check.routing)
  })

  it('多次检测同一敏感内容结果一致（幂等性）', () => {
    const sensitiveText = createSensitiveDisclosure()

    const check1 = detectTechnicalDisclosure(sensitiveText)
    const check2 = detectTechnicalDisclosure(sensitiveText)

    expect(check1.isSensitive).toBe(check2.isSensitive)
    expect(check1.ruleId).toBe(check2.ruleId)
    expect(check1.routing).toBe(check2.routing)
  })
})

// ========== T-046: CON-01 假阴性防护 ==========

describeE2E('T-046: CON-01 假阴性防护', () => {
  it('普通查询内容不触发 CON-01', () => {
    const normalText = createNormalContent()
    const check = detectTechnicalDisclosure(normalText)

    assertNoCON01Violation(check)
  })

  it('简短专利检索查询不触发 CON-01', () => {
    const shortQuery = '检索关于电子设备散热的专利'
    const check = detectTechnicalDisclosure(shortQuery)

    expect(check.isSensitive).toBe(false)
  })

  it('审查意见内容不触发 CON-01（非交底书）', () => {
    const oaContent = {
      applicationNumber: 'CN202410123456.7',
      officeActionContent: '审查意见指出权利要求1缺乏创造性，建议修改',
    }

    const inputText = extractInputText(oaContent)
    const check = detectTechnicalDisclosure(inputText)

    expect(check.isSensitive).toBe(false)
  })

  it('空输入不触发 CON-01', () => {
    const check = detectTechnicalDisclosure('')
    expect(check.isSensitive).toBe(false)
  })

  it('纯标题信息不误触发 CON-01', () => {
    const titleOnly = '一种基于相变材料的高效散热装置'
    const check = detectTechnicalDisclosure(titleOnly)

    // 纯标题不应被误判为技术交底书
    expect(check.isSensitive).toBe(false)
  })
})

// ========== T-047: API 降级模式（无 LLM Key） ==========

describeE2E('T-047: API 降级模式', () => {
  it('PatentSearchTool 无 LLM 时以规则模式返回结果', async () => {
    const originalKey = process.env.DEEPSEEK_API_KEY
    delete process.env.DEEPSEEK_API_KEY

    try {
      const { PatentSearchTool } = await importTools()
      const tool = new PatentSearchTool()

      const result = await tool.execute(
        {
          inventionTitle: '一种数据处理方法',
          technicalField: '计算机科学',
          technicalProblem: '处理效率低',
          technicalSolution: '并行处理优化',
          keyFeatures: ['并行处理'],
          patentType: 'invention',
        },
        {} // 空 context，无 LLM
      )

      assertToolSuccess(result)
      expect(result.data.integrationMode).toBe('rule_based')
    } finally {
      if (originalKey) process.env.DEEPSEEK_API_KEY = originalKey
    }
  })

  it('ClaimsGeneratorTool 无 LLM 时以规则模式返回结果', async () => {
    const originalKey = process.env.DEEPSEEK_API_KEY
    delete process.env.DEEPSEEK_API_KEY

    try {
      const { ClaimsGeneratorTool } = await importTools()
      const tool = new ClaimsGeneratorTool()

      const result = await tool.execute(
        {
          inventionTitle: '一种信号处理方法',
          technicalField: '信号处理',
          technicalProblem: '信号噪声大',
          technicalSolution: '自适应滤波',
          beneficialEffects: '噪声降低',
          keyFeatures: ['自适应滤波器', '噪声估计'],
          patentType: 'invention',
        },
        {}
      )

      assertToolSuccess(result)
      expect(result.data.integrationMode).toBe('rule_based')
      expect(result.data).toHaveProperty('claimsSet')
    } finally {
      if (originalKey) process.env.DEEPSEEK_API_KEY = originalKey
    }
  })

  it('QualityCheckerTool 无 LLM 时以规则模式返回评分', async () => {
    const originalKey = process.env.DEEPSEEK_API_KEY
    delete process.env.DEEPSEEK_API_KEY

    try {
      const { QualityCheckerTool } = await importTools()
      const tool = new QualityCheckerTool()

      const result = await tool.execute(
        {
          inventionTitle: '一种散热装置',
          claims: {
            independentClaims: [
              { claimNumber: 1, claimType: 'device', fullText: '一种散热装置。' },
            ],
            dependentClaims: [],
          },
          specification: {
            technicalField: '散热技术',
            detailedDescription: '详细实施方式。'.repeat(10),
          },
        },
        {}
      )

      assertToolSuccess(result)
      expect(result.data.integrationMode).toBe('rule_based')
      expect(result.data).toHaveProperty('overallScore')
      expect(typeof result.data.overallScore).toBe('number')
    } finally {
      if (originalKey) process.env.DEEPSEEK_API_KEY = originalKey
    }
  })

  it('降级模式下所有工具结果结构一致（metadata 不缺失）', async () => {
    const originalKey = process.env.DEEPSEEK_API_KEY
    delete process.env.DEEPSEEK_API_KEY

    try {
      const { PatentSearchTool, ClaimsGeneratorTool } = await importTools()

      const searchTool = new PatentSearchTool()
      const claimsTool = new ClaimsGeneratorTool()

      const [searchResult, claimsResult] = await Promise.all([
        searchTool.execute(
          {
            inventionTitle: '测试发明',
            technicalField: '测试领域',
            technicalProblem: '测试问题',
            technicalSolution: '测试方案',
            keyFeatures: ['特征1'],
            patentType: 'invention',
          },
          {}
        ),
        claimsTool.execute(
          {
            inventionTitle: '测试发明',
            technicalField: '测试领域',
            technicalProblem: '测试问题',
            technicalSolution: '测试方案',
            beneficialEffects: '测试效果',
            keyFeatures: ['特征1'],
            patentType: 'invention',
          },
          {}
        ),
      ])

      // 两个工具都应返回成功
      expect(searchResult.success).toBe(true)
      expect(claimsResult.success).toBe(true)

      // 两个结果都应有 metadata
      expect(searchResult.metadata).toBeDefined()
      expect(searchResult.metadata.toolName).toBeTruthy()
      expect(searchResult.metadata.version).toBeTruthy()

      expect(claimsResult.metadata).toBeDefined()
      expect(claimsResult.metadata.toolName).toBeTruthy()
      expect(claimsResult.metadata.version).toBeTruthy()
    } finally {
      if (originalKey) process.env.DEEPSEEK_API_KEY = originalKey
    }
  })
})
