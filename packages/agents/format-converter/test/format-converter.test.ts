import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PatentFormatConverterAgent } from '../src/PatentFormatConverterAgent.js'
import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import { existsSync, unlinkSync } from 'fs'

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {} as any,
}

describe('PatentFormatConverterAgent', () => {
  let agent: PatentFormatConverterAgent
  let tempDir: string
  const createdFiles: string[] = []

  beforeEach(() => {
    agent = new PatentFormatConverterAgent({
      name: 'test-format-converter',
      description: '测试格式转换Agent',
      eventBus: mockContext.eventBus,
      memory: mockContext.memory,
      tools: mockContext.registry,
      llm: mockContext.llm,
    })

    // 创建临时目录
    tempDir = `/tmp/test-format-converter-${randomUUID()}`
  })

  afterEach(async () => {
    // 清理创建的文件
    for (const file of createdFiles) {
      try {
        if (existsSync(file)) {
          unlinkSync(file)
        }
      } catch (error) {
        // 忽略删除错误
      }
    }
  })

  describe('初始化', () => {
    it('应该成功初始化', () => {
      expect(agent).toBeDefined()
      expect(agent.name).toBe('test-format-converter')
    })
  })

  describe('结构化内容转换', () => {
    it('应该能转换结构化内容为DOCX', async () => {
      const input = {
        inputFormat: 'structured' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'CNIPA' as const,
        content: {
          structured: {
            inventionTitle: '测试发明',
            technicalField: '本发明涉及测试技术领域',
            backgroundArt: '现有技术的不足',
            inventionContent: '本发明的技术方案包括测试组件',
            claims: [
              {
                type: 'independent' as const,
                number: 1,
                content: '一种测试装置，其特征在于包括测试组件',
              },
            ],
            abstract: '本发明公开了一种测试装置',
          },
        },
        outputPath: `${tempDir}/test_output.docx`,
        metadata: {
          applicant: '测试申请人',
          inventor: '测试发明人',
        },
        autoFormatCheck: true,
      }

      // 创建临时目录
      await fs.mkdir(tempDir, { recursive: true })

      // 执行转换
      const result = await agent.execute(input)

      // 验证结果
      expect(result.success).toBe(true)
      expect(result.outputFormat).toBe('docx')
      expect(result.conversionTimeMs).toBeGreaterThan(0)
      expect(result.pages).toBeGreaterThan(0)

      // 验证文件已创建
      expect(existsSync(result.outputPath)).toBe(true)
      createdFiles.push(result.outputPath)

      // 验证格式检查
      expect(result.formatCheckReport).toBeDefined()
      expect(result.formatCheckReport?.passed).toBe(true)
      expect(result.formatCheckReport?.errors.length).toBe(0)
    }, 30000)

    it('应该处理完整的结构化内容', async () => {
      const input = {
        inputFormat: 'structured' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'CNIPA' as const,
        content: {
          structured: {
            inventionTitle: '一种智能测试装置',
            technicalField: '本发明涉及测试技术领域，特别涉及一种智能测试装置',
            backgroundArt: '现有技术中，测试装置通常存在精度低、效率低的问题',
            inventionContent: '本发明提供了一种智能测试装置，包括控制器、传感器和执行机构',
            drawingsDescription: '图1为本发明结构示意图',
            embodiment: '如图1所示，本发明包括控制器1、传感器2和执行机构3',
            claims: [
              {
                type: 'independent' as const,
                number: 1,
                content: '一种智能测试装置，其特征在于包括控制器、传感器和执行机构',
              },
              {
                type: 'dependent' as const,
                number: 2,
                content: '根据权利要求1所述的智能测试装置，其特征在于所述控制器为单片机',
                dependsOn: 1,
              },
            ],
            abstract: '本发明公开了一种智能测试装置，具有精度高、效率高的优点',
          },
        },
        outputPath: `${tempDir}/test_full_output.docx`,
        autoFormatCheck: false,
      }

      await fs.mkdir(tempDir, { recursive: true })

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      expect(result.pages).toBeGreaterThan(1) // 至少2页（说明书+权利要求书）
      createdFiles.push(result.outputPath)
    }, 30000)
  })

  describe('Markdown内容转换', () => {
    it('应该能解析并转换Markdown内容', async () => {
      const markdown = `
# 发明名称
一种智能测试装置

# 技术领域
本发明涉及测试技术领域

# 背景技术
现有技术的不足

# 发明内容
本发明的技术方案

# 附图说明
图1为本发明结构示意图

# 具体实施方式
如图1所示，本发明包括控制器1。

# 权利要求书
1. 一种智能测试装置，其特征在于包括控制器。

2. 根据权利要求1所述的智能测试装置，其特征在于所述控制器为单片机。

# 摘要
本发明公开了一种智能测试装置。
`

      const input = {
        inputFormat: 'markdown' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'CNIPA' as const,
        content: {
          markdown,
        },
        outputPath: `${tempDir}/test_markdown_output.docx`,
      }

      await fs.mkdir(tempDir, { recursive: true })

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      expect(result.pages).toBeGreaterThan(0)
      createdFiles.push(result.outputPath)
    }, 30000)

    it('应该正确解析权利要求书', async () => {
      const markdown = `
# 发明名称
测试

# 权利要求书
1. 一种测试装置，其特征在于包括测试组件。

2. 根据权利要求1所述的测试装置，其特征在于所述测试组件为传感器。

3. 根据权利要求2所述的测试装置，其特征在于还包括控制器。

# 摘要
测试摘要
`

      const input = {
        inputFormat: 'markdown' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'CNIPA' as const,
        content: {
          markdown,
        },
        outputPath: `${tempDir}/test_claims_output.docx`,
      }

      await fs.mkdir(tempDir, { recursive: true })

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      expect(result.pages).toBeGreaterThanOrEqual(3) // 至少3个权利要求
      createdFiles.push(result.outputPath)
    }, 30000)
  })

  describe('格式检查功能', () => {
    it('应该检测到必填字段缺失', async () => {
      const input = {
        inputFormat: 'structured' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'CNIPA' as const,
        content: {
          structured: {
            inventionTitle: '', // 空
            technicalField: '', // 空
            backgroundArt: '',
            inventionContent: '',
            claims: [], // 空
            abstract: '', // 空
          },
        },
        outputPath: `${tempDir}/test_missing_fields.docx`,
        autoFormatCheck: true,
      }

      await fs.mkdir(tempDir, { recursive: true })

      const result = await agent.execute(input)

      // 应该有错误
      expect(result.formatCheckReport).toBeDefined()
      expect(result.formatCheckReport?.passed).toBe(false)
      expect(result.formatCheckReport?.errors.length).toBeGreaterThan(0)
      createdFiles.push(result.outputPath)
    }, 30000)

    it('应该检测到字段长度超限', async () => {
      const input = {
        inputFormat: 'structured' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'CNIPA' as const,
        content: {
          structured: {
            inventionTitle: '测试发明名称很长很长很长很长很长很长很长很长很长很长很长很长很长', // 超过40字
            technicalField: '测试技术领域',
            backgroundArt: '测试背景技术',
            inventionContent: '测试发明内容',
            claims: [
              {
                type: 'independent' as const,
                number: 1,
                content: '测试权利要求',
              },
            ],
            abstract:
              '测试摘要内容很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长', // 超过300字
          },
        },
        outputPath: `${tempDir}/test_length_check.docx`,
        autoFormatCheck: true,
      }

      await fs.mkdir(tempDir, { recursive: true })

      const result = await agent.execute(input)

      // 应该有警告（但无错误）
      expect(result.formatCheckReport).toBeDefined()
      expect(result.formatCheckReport?.passed).toBe(true)
      expect(result.formatCheckReport?.warnings.length).toBeGreaterThan(0)
      expect(result.formatCheckReport?.warnings.some((w) => w.includes('发明名称'))).toBe(true)
      expect(result.formatCheckReport?.warnings.some((w) => w.includes('摘要'))).toBe(true)
      createdFiles.push(result.outputPath)
    }, 30000)

    it('应该检测到权利要求数量超限', async () => {
      const claims = Array.from({ length: 15 }, (_, i) => ({
        type: 'independent' as const,
        number: i + 1,
        content: `第${i + 1}项权利要求`,
      }))

      const input = {
        inputFormat: 'structured' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'CNIPA' as const,
        content: {
          structured: {
            inventionTitle: '测试发明',
            technicalField: '测试技术领域',
            backgroundArt: '测试背景技术',
            inventionContent: '测试发明内容',
            claims,
            abstract: '测试摘要',
          },
        },
        outputPath: `${tempDir}/test_claims_count.docx`,
        autoFormatCheck: true,
      }

      await fs.mkdir(tempDir, { recursive: true })

      const result = await agent.execute(input)

      // 应该有警告
      expect(
        result.formatCheckReport?.warnings.some((w) => w.includes('权利要求') && w.includes('15'))
      ).toBe(true)
      createdFiles.push(result.outputPath)
    }, 30000)
  })

  describe('不同专利局格式', () => {
    it('应该支持CNIPA格式', async () => {
      const input = {
        inputFormat: 'structured' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'CNIPA' as const,
        content: {
          structured: {
            inventionTitle: '测试发明',
            technicalField: '测试技术领域',
            backgroundArt: '测试背景技术',
            inventionContent: '测试发明内容',
            claims: [
              {
                type: 'independent' as const,
                number: 1,
                content: '测试权利要求',
              },
            ],
            abstract: '测试摘要',
          },
        },
        outputPath: `${tempDir}/test_cnipa.docx`,
      }

      await fs.mkdir(tempDir, { recursive: true })

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      createdFiles.push(result.outputPath)
    }, 30000)

    it('应该支持USPTO格式', async () => {
      const input = {
        inputFormat: 'structured' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'USPTO' as const,
        content: {
          structured: {
            inventionTitle: 'Test Invention',
            technicalField: 'Test Field',
            backgroundArt: 'Background Art',
            inventionContent: 'Test Content',
            claims: [
              {
                type: 'independent' as const,
                number: 1,
                content: 'Test claim',
              },
            ],
            abstract: 'Test abstract',
          },
        },
        outputPath: `${tempDir}/test_uspto.docx`,
      }

      await fs.mkdir(tempDir, { recursive: true })

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      createdFiles.push(result.outputPath)
    }, 30000)

    it('应该支持EPO格式', async () => {
      const input = {
        inputFormat: 'structured' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'EPO' as const,
        content: {
          structured: {
            inventionTitle: 'Test Invention',
            technicalField: 'Test Field',
            backgroundArt: 'Background Art',
            inventionContent: 'Test Content',
            claims: [
              {
                type: 'independent' as const,
                number: 1,
                content: 'Test claim',
              },
            ],
            abstract: 'Test abstract',
          },
        },
        outputPath: `${tempDir}/test_epo.docx`,
      }

      await fs.mkdir(tempDir, { recursive: true })

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      createdFiles.push(result.outputPath)
    }, 30000)
  })

  describe('错误处理', () => {
    it('应该处理无效的输入格式', async () => {
      const input = {
        inputFormat: 'markdown' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'CNIPA' as const,
        content: {
          markdown: '', // 空内容
        },
        outputPath: `${tempDir}/test_invalid_input.docx`,
      }

      await fs.mkdir(tempDir, { recursive: true })

      await expect(agent.execute(input)).rejects.toThrow()
    }, 30000)

    it('应该处理无效的输出路径', async () => {
      const input = {
        inputFormat: 'structured' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'CNIPA' as const,
        content: {
          structured: {
            inventionTitle: '测试',
            technicalField: '测试',
            backgroundArt: '测试',
            inventionContent: '测试',
            claims: [
              {
                type: 'independent' as const,
                number: 1,
                content: '测试',
              },
            ],
            abstract: '测试',
          },
        },
        outputPath: '/invalid/path/test.docx', // 无效路径
      }

      await expect(agent.execute(input)).rejects.toThrow()
    }, 30000)
  })

  describe('性能测试', () => {
    it('应该在合理时间内完成转换', async () => {
      const input = {
        inputFormat: 'structured' as const,
        outputFormat: 'docx' as const,
        patentOfficeFormat: 'CNIPA' as const,
        content: {
          structured: {
            inventionTitle: '测试发明',
            technicalField: '测试技术领域',
            backgroundArt: '测试背景技术',
            inventionContent: '测试发明内容',
            claims: [
              {
                type: 'independent' as const,
                number: 1,
                content: '测试权利要求',
              },
            ],
            abstract: '测试摘要',
          },
        },
        outputPath: `${tempDir}/test_performance.docx`,
      }

      await fs.mkdir(tempDir, { recursive: true })

      const startTime = Date.now()
      const result = await agent.execute(input)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(result.conversionTimeMs).toBeLessThan(5000) // 应该在5秒内完成
      expect(endTime - startTime).toBeLessThan(5000)
      createdFiles.push(result.outputPath)
    }, 30000)
  })
})
