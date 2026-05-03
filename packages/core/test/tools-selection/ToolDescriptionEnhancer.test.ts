/**
 * ToolDescriptionEnhancer 测试
 *
 * TDD方式：
 * 1. 先写测试（红色 - 失败）
 * 2. 修复代码
 * 3. 运行测试（绿色 - 通过）
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ToolDescriptionEnhancer } from '../../src/tools/ToolDescriptionEnhancer.js'
import type { EnhancedTool } from '../../src/tools/types.js'

describe('ToolDescriptionEnhancer', () => {
  let enhancer: ToolDescriptionEnhancer

  beforeEach(() => {
    enhancer = new ToolDescriptionEnhancer()
  })

  describe('enhanceMetadata', () => {
    it('应该为工具生成增强的元数据', () => {
      const mockTool: EnhancedTool = {
        metadata: {
          name: 'PdfToMarkdownTool',
          description: '将PDF文件转换为Markdown格式',
          category: 'document',
        },
        execute: async () => ({ markdown: '#' }),
      }

      const enhanced = enhancer.enhanceMetadata(mockTool)

      expect(enhanced).toBeDefined()
      expect(enhanced.name).toBe('PdfToMarkdownTool')
      expect(enhanced.description).toBe('将PDF文件转换为Markdown格式')
      expect(enhanced.detailedDescription).toBeDefined()
      expect(enhanced.examples).toBeDefined()
      expect(enhanced.commonUseCases).toBeDefined()
      expect(enhanced.capabilities).toBeDefined()
      expect(enhanced.dataTypes).toBeDefined()
      expect(enhanced.limitations).toBeDefined()
      expect(enhanced.prerequisites).toBeDefined()
      expect(enhanced.relatedTools).toBeDefined()
    })

    it('应该生成详细的描述', () => {
      const mockTool: EnhancedTool = {
        metadata: {
          name: 'PdfToMarkdownTool',
          description: '将PDF文件转换为Markdown格式',
          category: 'document',
        },
        execute: async () => ({ markdown: '#' }),
      }

      const enhanced = enhancer.enhanceMetadata(mockTool)

      expect(enhanced.detailedDescription).toContain('将PDF文件转换为Markdown格式')
      expect(enhanced.detailedDescription).toContain('功能说明')
      expect(enhanced.detailedDescription).toContain('主要特点')
    })

    it('应该生成使用示例', () => {
      const mockTool: EnhancedTool = {
        metadata: {
          name: 'PdfToMarkdownTool',
          description: '将PDF文件转换为Markdown格式',
          category: 'document',
        },
        execute: async () => ({ markdown: '#' }),
      }

      const enhanced = enhancer.enhanceMetadata(mockTool)

      expect(enhanced.examples).toBeInstanceOf(Array)
      expect(enhanced.examples.length).toBeGreaterThan(0)

      const example = enhanced.examples[0]
      expect(example.description).toBeDefined()
      expect(example.scenario).toBeDefined()
      expect(example.input).toBeDefined()
      expect(example.output).toBeDefined()
    })

    it('应该生成常见用例', () => {
      const mockTool: EnhancedTool = {
        metadata: {
          name: 'PdfToMarkdownTool',
          description: '将PDF文件转换为Markdown格式',
          category: 'document',
        },
        execute: async () => ({ markdown: '#' }),
      }

      const enhanced = enhancer.enhanceMetadata(mockTool)

      expect(enhanced.commonUseCases).toBeInstanceOf(Array)
      expect(enhanced.commonUseCases.length).toBeGreaterThan(0)
      expect(enhanced.commonUseCases[0]).toBeDefined()
    })

    it('应该生成能力列表', () => {
      const mockTool: EnhancedTool = {
        metadata: {
          name: 'PdfToMarkdownTool',
          description: '将PDF文件转换为Markdown格式',
          category: 'document',
        },
        execute: async () => ({ markdown: '#' }),
      }

      const enhanced = enhancer.enhanceMetadata(mockTool)

      expect(enhanced.capabilities).toBeInstanceOf(Array)
      expect(enhanced.capabilities.length).toBeGreaterThan(0)
    })

    it('应该生成数据类型', () => {
      const mockTool: EnhancedTool = {
        metadata: {
          name: 'PdfToMarkdownTool',
          description: '将PDF文件转换为Markdown格式',
          category: 'document',
        },
        execute: async () => ({ markdown: '#' }),
      }

      const enhanced = enhancer.enhanceMetadata(mockTool)

      expect(enhanced.dataTypes).toBeInstanceOf(Array)
      expect(enhanced.dataTypes).toContain('application/pdf')
    })

    it('应该生限制说明', () => {
      const mockTool: EnhancedTool = {
        metadata: {
          name: 'PdfToMarkdownTool',
          description: '将PDF文件转换为Markdown格式',
          category: 'document',
        },
        execute: async () => ({ markdown: '#' }),
      }

      const enhanced = enhancer.enhanceMetadata(mockTool)

      expect(enhanced.limitations).toBeInstanceOf(Array)
      expect(enhanced.limitations.length).toBeGreaterThan(0)
    })

    it('应该根据工具类型生成不同的示例', () => {
      const pdfTool: EnhancedTool = {
        metadata: {
          name: 'PdfToMarkdownTool',
          description: '将PDF文件转换为Markdown格式',
          category: 'document',
        },
        execute: async () => ({ markdown: '#' }),
      }

      const webTool: EnhancedTool = {
        metadata: {
          name: 'WebNavigateTool',
          description: '导航到指定URL',
          category: 'web',
        },
        execute: async () => ({ success: true }),
      }

      const pdfEnhanced = enhancer.enhanceMetadata(pdfTool)
      const webEnhanced = enhancer.enhanceMetadata(webTool)

      expect(pdfEnhanced.examples[0].scenario).not.toBe(webEnhanced.examples[0].scenario)
    })
  })

  describe('enhanceTools', () => {
    it('应该批量增强多个工具', () => {
      const mockTools: EnhancedTool[] = [
        {
          metadata: {
            name: 'PdfToMarkdownTool',
            description: '将PDF文件转换为Markdown格式',
            category: 'document',
          },
          execute: async () => ({ markdown: '#' }),
        },
        {
          metadata: {
            name: 'ImageOcrTool',
            description: '图片OCR识别',
            category: 'image',
          },
          execute: async () => ({ text: 'text' }),
        },
      ]

      const enhancedMap = enhancer.enhanceTools(mockTools)

      expect(enhancedMap).toBeInstanceOf(Map)
      expect(enhancedMap.size).toBe(2)
      expect(enhancedMap.has('PdfToMarkdownTool')).toBe(true)
      expect(enhancedMap.has('ImageOcrTool')).toBe(true)

      const pdfEnhanced = enhancedMap.get('PdfToMarkdownTool')
      expect(pdfEnhanced?.detailedDescription).toBeDefined()
    })

    it('应该保留原始工具元数据', () => {
      const mockTool: EnhancedTool = {
        metadata: {
          name: 'PdfToMarkdownTool',
          description: '将PDF文件转换为Markdown格式',
          category: 'document',
        },
        execute: async () => ({ markdown: '#' }),
      }

      const enhanced = enhancer.enhanceMetadata(mockTool)

      expect(enhanced.name).toBe(mockTool.metadata.name)
      expect(enhanced.description).toBe(mockTool.metadata.description)
      expect(enhanced.category).toBe(mockTool.metadata.category)
    })
  })

  describe('generateDocumentation', () => {
    it('应该生成工具文档', () => {
      const mockTools: EnhancedTool[] = [
        {
          metadata: {
            name: 'PdfToMarkdownTool',
            description: '将PDF文件转换为Markdown格式',
            category: 'document',
          },
          execute: async () => ({ markdown: '#' }),
        },
      ]

      const enhancedMap = enhancer.enhanceTools(mockTools)
      const documentation = enhancer.generateDocumentation(enhancedMap)

      expect(documentation).toBeDefined()
      expect(typeof documentation).toBe('string')
      expect(documentation).toContain('# 工具描述文档')
      expect(documentation).toContain('PdfToMarkdownTool')
      expect(documentation).toContain('将PDF文件转换为Markdown格式')
    })

    it('应该包含所有增强字段', () => {
      const mockTools: EnhancedTool[] = [
        {
          metadata: {
            name: 'PdfToMarkdownTool',
            description: '将PDF文件转换为Markdown格式',
            category: 'document',
          },
          execute: async () => ({ markdown: '#' }),
        },
      ]

      const enhancedMap = enhancer.enhanceTools(mockTools)
      const documentation = enhancer.generateDocumentation(enhancedMap)

      expect(documentation).toContain('详细说明')
      expect(documentation).toContain('常见用例')
      expect(documentation).toContain('能力')
      expect(documentation).toContain('使用示例')
    })
  })
})
