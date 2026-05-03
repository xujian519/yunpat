import { describe, it, expect } from 'vitest'
import {
  // PDF
  PdfExtractTextTool,
  PdfParseTool,
  PdfToMarkdownTool,
  PdfOcrTool,
  // DOCX
  DocxExtractTextTool,
  DocxToHtmlTool,
  DocxToMarkdownTool,
  DocxParseTool,
  // Excel
  ExcelReadTool,
  ExcelToJsonTool,
  ExcelToMarkdownTool,
  ExcelParseTool,
  // OCR
  ImageOcrTool,
  BatchImageOcrTool,
  ImageToMarkdownTool,
  // Audio
  AudioTranscriptionTool,
  AudioToSrtTool,
  AudioToVttTool,
  AudioToMarkdownTool,
  // Universal
  UniversalDocumentParserTool,
  BatchDocumentParserTool,
  DocumentConverterTool,
  // Official Doc
  OfficialDocParserTool,
  OfficialDocFields,
  OfficialDocParseResult,
  OfficialDocType,
  OFFICIAL_DOC_PROMPTS,
  OfficialDocParserToolV2,
  OfficialDocFieldsV2,
  OfficialDocParseResultV2,
  // Types
  OutputFormat,
  DocumentType,
  ElementType,
  // Utils
  elementsToMarkdown,
  elementsToJson,
  extractPlainText,
  detectFileType,
  generateId,
  formatFileSize,
} from '../src/index.js'

describe('index exports', () => {
  it('exports all PDF tools', () => {
    expect(PdfExtractTextTool).toBeDefined()
    expect(PdfParseTool).toBeDefined()
    expect(PdfToMarkdownTool).toBeDefined()
    expect(PdfOcrTool).toBeDefined()
  })

  it('exports all DOCX tools', () => {
    expect(DocxExtractTextTool).toBeDefined()
    expect(DocxToHtmlTool).toBeDefined()
    expect(DocxToMarkdownTool).toBeDefined()
    expect(DocxParseTool).toBeDefined()
  })

  it('exports all Excel tools', () => {
    expect(ExcelReadTool).toBeDefined()
    expect(ExcelToJsonTool).toBeDefined()
    expect(ExcelToMarkdownTool).toBeDefined()
    expect(ExcelParseTool).toBeDefined()
  })

  it('exports all OCR tools', () => {
    expect(ImageOcrTool).toBeDefined()
    expect(BatchImageOcrTool).toBeDefined()
    expect(ImageToMarkdownTool).toBeDefined()
  })

  it('exports all Audio tools', () => {
    expect(AudioTranscriptionTool).toBeDefined()
    expect(AudioToSrtTool).toBeDefined()
    expect(AudioToVttTool).toBeDefined()
    expect(AudioToMarkdownTool).toBeDefined()
  })

  it('exports all Universal Document tools', () => {
    expect(UniversalDocumentParserTool).toBeDefined()
    expect(BatchDocumentParserTool).toBeDefined()
    expect(DocumentConverterTool).toBeDefined()
  })

  it('exports all Official Doc Parser tools', () => {
    expect(OfficialDocParserTool).toBeDefined()
    expect(OfficialDocParserToolV2).toBeDefined()
    expect(OFFICIAL_DOC_PROMPTS).toBeDefined()
  })

  it('exports all types', () => {
    expect(OutputFormat).toBeDefined()
    expect(DocumentType).toBeDefined()
    expect(ElementType).toBeDefined()
  })

  it('exports all utility functions', () => {
    expect(elementsToMarkdown).toBeDefined()
    expect(elementsToJson).toBeDefined()
    expect(extractPlainText).toBeDefined()
    expect(detectFileType).toBeDefined()
    expect(generateId).toBeDefined()
    expect(formatFileSize).toBeDefined()
  })

  it('type interfaces are exportable', () => {
    // TypeScript compile-time check: these should not throw
    const _fields: OfficialDocFields = {}
    const _result: OfficialDocParseResult = {
      rawText: '',
      fields: {},
      markdown: '',
      metadata: { filename: '', parseTime: 0 },
    }
    const _fieldsV2: OfficialDocFieldsV2 = {}
    const _resultV2: OfficialDocParseResultV2 = {
      rawText: '',
      fields: {},
      docType: '',
      metadata: { filename: '', parseTime: 0, extractionMethod: '' },
    }
    expect(true).toBe(true)
  })
})
