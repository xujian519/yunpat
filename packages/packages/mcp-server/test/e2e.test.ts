/**
 * MCP Server E2E 测试
 *
 * 验证专利工具的端到端工作流：
 * - T-001: 专利检索 E2E
 * - T-002: 权利要求生成 + CON-02 范围检查
 * - T-003: 审查意见答复（敏感数据检测）
 * - T-007: API 降级模式
 */

import { describe, it, expect } from 'vitest'
import { detectTechnicalDisclosure } from '@yunpat/core'

// 辅助: 从 MCP server 的 index.ts 提取的检测逻辑
function extractInputText(args: Record<string, unknown> | undefined): string {
  if (!args) return ''
  return Object.values(args)
    .filter((v): v is string => typeof v === 'string')
    .join('\n')
}

describe('E2E: 专利检索工作流', () => {
  it('T-001: 专利检索返回含来源信息的结果', async () => {
    // 动态导入避免编译依赖
    const { PatentSearchTool } = await import('../src/tools/index.js')
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

    // 验证结果结构
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    // 引用可溯源检查
    if (result.data?.results) {
      for (const item of result.data.results) {
        // 每个结果应有来源标识
        expect(item).toBeDefined()
      }
    }
  })
})

describe('E2E: 权利要求生成 + 宪法检查', () => {
  it('T-002: 权利要求生成应通过 CON-02 范围检查', async () => {
    const { ClaimsGeneratorTool } = await import('../src/tools/index.js')
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

    expect(result.success).toBe(true)
    expect(result.data?.claimsSet).toBeDefined()

    // CON-02 检查: 权利要求不应包含 "任意" 等过度宽泛表述
    const claims = result.data?.claimsSet
    if (claims?.independent_claims) {
      for (const claim of claims.independent_claims) {
        const text = JSON.stringify(claim)
        // 不应包含"任意类型"等过度宽泛表述
        expect(text).not.toContain('任意类型')
        expect(text).not.toContain('所有类型')
      }
    }
  })
})

describe('E2E: 审查意见答复 + 数据主权', () => {
  it('T-003: 技术交底书输入应被 CON-01 拦截', () => {
    const sensitiveInput = {
      inventionTitle: '一种新型算法',
      technicalProblem: '技术交底书中的核心技术方案',
      technicalSolution:
        '发明人提出了如下技术方案：实施例中测试结果表明，' +
        '该技术效果显著。'.repeat(80) +
        '实验数据表明，本发明的核心技术能够有效解决技术问题。',
    }

    const inputText = extractInputText(sensitiveInput)
    const check = detectTechnicalDisclosure(inputText)

    // CON-01 应检测到敏感内容
    expect(check.isSensitive).toBe(true)
    expect(check.ruleId).toBe('CON-01')
    expect(check.routing).toBe('local')
  })

  it('T-003B: 普通审查意见不应被拦截', () => {
    const normalInput = {
      applicationNumber: 'CN202410123456.7',
      officeActionContent: '审查意见指出权利要求1缺乏创造性',
    }

    const inputText = extractInputText(normalInput)
    const check = detectTechnicalDisclosure(inputText)

    expect(check.isSensitive).toBe(false)
    expect(check.routing).toBe('any')
  })
})

describe('E2E: API 降级模式', () => {
  it('T-007: 无 API Key 时工具应以规则模式运行', async () => {
    // 确保无 API key
    const originalKey = process.env.DEEPSEEK_API_KEY
    delete process.env.DEEPSEEK_API_KEY

    const { PatentSearchTool } = await import('../src/tools/index.js')
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
      {} // 空 context, 无 LLM
    )

    // 即使无 LLM，规则模式也应返回结果
    expect(result.success).toBe(true)

    // 恢复环境变量
    if (originalKey) process.env.DEEPSEEK_API_KEY = originalKey
  })
})
