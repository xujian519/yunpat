/**
 * 工具完整性验证脚本
 *
 * 验证所有新增工具的可用性
 */

import * as fs from 'fs'
import * as path from 'path'

interface ToolVerification {
  name: string
  category: string
  hasMetadata: boolean
  hasExecute: boolean
  inputSchemaValid: boolean
  outputSchemaValid: boolean
  errors: string[]
}

const results: ToolVerification[] = []

// 验证单个工具
function verifyTool(ToolClass: any, name: string, category: string): ToolVerification {
  const verification: ToolVerification = {
    name,
    category,
    hasMetadata: false,
    hasExecute: false,
    inputSchemaValid: false,
    outputSchemaValid: false,
    errors: [],
  }

  try {
    // 检查是否可以实例化
    const instance = new ToolClass()

    // 检查元数据
    if (instance.metadata) {
      verification.hasMetadata = true

      // 检查必需的元数据字段
      const requiredFields = ['name', 'description', 'category']
      for (const field of requiredFields) {
        if (!instance.metadata[field]) {
          verification.errors.push(`Missing metadata field: ${field}`)
        }
      }

      // 检查inputSchema
      if (instance.metadata.inputSchema) {
        verification.inputSchemaValid = true
      } else {
        verification.errors.push('Missing inputSchema')
      }

      // 检查outputSchema
      if (instance.metadata.outputSchema) {
        verification.outputSchemaValid = true
      } else {
        verification.errors.push('Missing outputSchema')
      }
    } else {
      verification.errors.push('Missing metadata')
    }

    // 检查execute方法
    if (typeof instance.execute === 'function') {
      verification.hasExecute = true
    } else {
      verification.errors.push('Missing execute method')
    }

    // 检查并发安全设置
    if (instance.metadata.isConcurrencySafe === undefined) {
      verification.errors.push('Missing isConcurrencySafe field')
    }
  } catch (error) {
    verification.errors.push(
      `Instantiation error: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  return verification
}

// 打印验证结果
function printResults(results: ToolVerification[]) {
  console.log('\n========================================')
  console.log('工具完整性验证报告')
  console.log('========================================\n')

  let totalTools = 0
  let validTools = 0
  let totalErrors = 0

  const byCategory: Record<string, ToolVerification[]> = {}

  for (const result of results) {
    totalTools++
    totalErrors += result.errors.length

    if (result.errors.length === 0) {
      validTools++
    }

    if (!byCategory[result.category]) {
      byCategory[result.category] = []
    }
    byCategory[result.category].push(result)
  }

  // 按类别打印
  for (const [category, tools] of Object.entries(byCategory)) {
    console.log(`\n【${category}】(${tools.length}个工具)`)
    console.log('----------------------------------------')

    for (const tool of tools) {
      const icon = tool.errors.length === 0 ? '✅' : '❌'
      console.log(`${icon} ${tool.name}`)

      if (tool.errors.length > 0) {
        console.log(`   错误:`)
        tool.errors.forEach((err) => console.log(`   - ${err}`))
      }
    }
  }

  // 打印总结
  console.log('\n========================================')
  console.log('验证总结')
  console.log('========================================')
  console.log(`总工具数: ${totalTools}`)
  console.log(`有效工具: ${validTools} (${((validTools / totalTools) * 100).toFixed(1)}%)`)
  console.log(`错误总数: ${totalErrors}`)
  console.log('========================================\n')

  return { totalTools, validTools, totalErrors }
}

async function verifyBrowserTools() {
  console.log('\n📱 验证浏览器工具...\n')

  try {
    const browserTools = await import('../packages/builtin-tools/src/browser/WebTools.js')

    const tools = [
      { Class: browserTools.WebNavigateTool, name: 'WebNavigateTool' },
      { Class: browserTools.WebFindTabTool, name: 'WebFindTabTool' },
      { Class: browserTools.WebSnapshotTool, name: 'WebSnapshotTool' },
      { Class: browserTools.WebClickTool, name: 'WebClickTool' },
      { Class: browserTools.WebFillTool, name: 'WebFillTool' },
      { Class: browserTools.WebEvaluateTool, name: 'WebEvaluateTool' },
      { Class: browserTools.WebScreenshotTool, name: 'WebScreenshotTool' },
      { Class: browserTools.WebWaitTool, name: 'WebWaitTool' },
      { Class: browserTools.WebExtractTextTool, name: 'WebExtractTextTool' },
      { Class: browserTools.WebScrollTool, name: 'WebScrollTool' },
    ]

    for (const { Class, name } of tools) {
      const verification = verifyTool(Class, name, '浏览器工具')
      results.push(verification)
    }
  } catch (error) {
    console.error('浏览器工具导入失败:', error)
  }
}

async function verifyDocumentTools() {
  console.log('\n📄 验证文档解析工具...\n')

  try {
    // PDF工具
    const pdfTools = await import('../packages/document-tools/src/tools/PdfTools.js')
    const pdfToolList = [
      { Class: pdfTools.PdfExtractTextTool, name: 'PdfExtractTextTool' },
      { Class: pdfTools.PdfParseTool, name: 'PdfParseTool' },
      { Class: pdfTools.PdfToMarkdownTool, name: 'PdfToMarkdownTool' },
      { Class: pdfTools.PdfOcrTool, name: 'PdfOcrTool' },
    ]

    for (const { Class, name } of pdfToolList) {
      const verification = verifyTool(Class, name, 'PDF工具')
      results.push(verification)
    }

    // DOCX工具
    const docxTools = await import('../packages/document-tools/src/tools/DocxTools.js')
    const docxToolList = [
      { Class: docxTools.DocxExtractTextTool, name: 'DocxExtractTextTool' },
      { Class: docxTools.DocxToHtmlTool, name: 'DocxToHtmlTool' },
      { Class: docxTools.DocxToMarkdownTool, name: 'DocxToMarkdownTool' },
      { Class: docxTools.DocxParseTool, name: 'DocxParseTool' },
    ]

    for (const { Class, name } of docxToolList) {
      const verification = verifyTool(Class, name, 'DOCX工具')
      results.push(verification)
    }

    // Excel工具
    const excelTools = await import('../packages/document-tools/src/tools/ExcelTools.js')
    const excelToolList = [
      { Class: excelTools.ExcelReadTool, name: 'ExcelReadTool' },
      { Class: excelTools.ExcelToJsonTool, name: 'ExcelToJsonTool' },
      { Class: excelTools.ExcelToMarkdownTool, name: 'ExcelToMarkdownTool' },
      { Class: excelTools.ExcelParseTool, name: 'ExcelParseTool' },
    ]

    for (const { Class, name } of excelToolList) {
      const verification = verifyTool(Class, name, 'Excel工具')
      results.push(verification)
    }

    // OCR工具
    const ocrTools = await import('../packages/document-tools/src/tools/OcrTools.js')
    const ocrToolList = [
      { Class: ocrTools.ImageOcrTool, name: 'ImageOcrTool' },
      { Class: ocrTools.BatchImageOcrTool, name: 'BatchImageOcrTool' },
      { Class: ocrTools.ImageToMarkdownTool, name: 'ImageToMarkdownTool' },
    ]

    for (const { Class, name } of ocrToolList) {
      const verification = verifyTool(Class, name, 'OCR工具')
      results.push(verification)
    }

    // 音频工具
    const audioTools = await import('../packages/document-tools/src/tools/AudioTools.js')
    const audioToolList = [
      { Class: audioTools.AudioTranscriptionTool, name: 'AudioTranscriptionTool' },
      { Class: audioTools.AudioToSrtTool, name: 'AudioToSrtTool' },
      { Class: audioTools.AudioToVttTool, name: 'AudioToVttTool' },
      { Class: audioTools.AudioToMarkdownTool, name: 'AudioToMarkdownTool' },
    ]

    for (const { Class, name } of audioToolList) {
      const verification = verifyTool(Class, name, '音频工具')
      results.push(verification)
    }

    // 通用工具
    const universalTools =
      await import('../packages/document-tools/src/tools/UniversalDocumentTool.js')
    const universalToolList = [
      { Class: universalTools.UniversalDocumentParserTool, name: 'UniversalDocumentParserTool' },
      { Class: universalTools.BatchDocumentParserTool, name: 'BatchDocumentParserTool' },
      { Class: universalTools.DocumentConverterTool, name: 'DocumentConverterTool' },
    ]

    for (const { Class, name } of universalToolList) {
      const verification = verifyTool(Class, name, '通用文档工具')
      results.push(verification)
    }
  } catch (error) {
    console.error('文档工具导入失败:', error)
  }
}

async function verifyExports() {
  console.log('\n📦 验证包导出...\n')

  const errors: string[] = []
  const scriptDir = new URL('.', import.meta.url).pathname

  // 检查builtin-tools导出
  try {
    const builtinIndex = fs.readFileSync(
      path.join(scriptDir, '../packages/builtin-tools/src/index.ts'),
      'utf-8'
    )

    const requiredBrowserExports = [
      'WebNavigateTool',
      'WebFindTabTool',
      'WebSnapshotTool',
      'WebClickTool',
      'WebFillTool',
      'WebEvaluateTool',
      'WebScreenshotTool',
      'WebWaitTool',
      'WebExtractTextTool',
      'WebScrollTool',
    ]

    for (const exportName of requiredBrowserExports) {
      if (!builtinIndex.includes(exportName)) {
        errors.push(`builtin-tools 缺少导出: ${exportName}`)
      }
    }
  } catch (error) {
    errors.push(`无法读取 builtin-tools/index.ts: ${error}`)
  }

  // 检查document-tools导出
  try {
    const documentIndex = fs.readFileSync(
      path.join(scriptDir, '../packages/document-tools/src/index.ts'),
      'utf-8'
    )

    const requiredDocumentExports = [
      'PdfExtractTextTool',
      'PdfParseTool',
      'PdfToMarkdownTool',
      'PdfOcrTool',
      'DocxExtractTextTool',
      'DocxToHtmlTool',
      'DocxToMarkdownTool',
      'DocxParseTool',
      'ExcelReadTool',
      'ExcelToJsonTool',
      'ExcelToMarkdownTool',
      'ExcelParseTool',
      'ImageOcrTool',
      'BatchImageOcrTool',
      'ImageToMarkdownTool',
      'AudioTranscriptionTool',
      'AudioToSrtTool',
      'AudioToVttTool',
      'AudioToMarkdownTool',
      'UniversalDocumentParserTool',
      'BatchDocumentParserTool',
      'DocumentConverterTool',
    ]

    for (const exportName of requiredDocumentExports) {
      if (!documentIndex.includes(exportName)) {
        errors.push(`document-tools 缺少导出: ${exportName}`)
      }
    }
  } catch (error) {
    errors.push(`无法读取 document-tools/index.ts: ${error}`)
  }

  if (errors.length === 0) {
    console.log('✅ 所有包导出正确')
  } else {
    console.log('❌ 导出错误:')
    errors.forEach((err) => console.log(`   - ${err}`))
  }

  return errors.length === 0
}

async function verifyBuilds() {
  console.log('\n🔨 验证构建产物...\n')

  const errors: string[] = []
  const scriptDir = new URL('.', import.meta.url).pathname

  // 检查builtin-tools构建
  const builtinDist = path.join(scriptDir, '../packages/builtin-tools/dist')
  if (!fs.existsSync(builtinDist)) {
    errors.push('builtin-tools 缺少构建产物')
  } else {
    console.log('✅ builtin-tools 构建产物存在')
  }

  // 检查document-tools构建
  const documentDist = path.join(scriptDir, '../packages/document-tools/dist')
  if (!fs.existsSync(documentDist)) {
    errors.push('document-tools 缺少构建产物')
  } else {
    console.log('✅ document-tools 构建产物存在')
  }

  return errors.length === 0
}

// 主函数
async function main() {
  console.log('========================================')
  console.log('开始工具完整性验证')
  console.log('========================================')

  // 验证构建产物
  const buildValid = await verifyBuilds()

  // 验证导出
  const exportsValid = await verifyExports()

  // 验证浏览器工具
  await verifyBrowserTools()

  // 验证文档工具
  await verifyDocumentTools()

  // 打印结果
  const summary = printResults(results)

  // 最终结论
  console.log('\n========================================')
  console.log('验证结论')
  console.log('========================================')

  const allValid =
    buildValid &&
    exportsValid &&
    summary.totalErrors === 0 &&
    summary.validTools === summary.totalTools

  if (allValid) {
    console.log('✅ 所有验证通过！工具完全可用。\n')
    process.exit(0)
  } else {
    console.log('❌ 验证发现问题，请检查上述错误。\n')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('验证脚本执行失败:', error)
  process.exit(1)
})
