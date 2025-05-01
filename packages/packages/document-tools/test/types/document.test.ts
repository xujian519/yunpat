import { describe, it, expect } from 'vitest'
import { OutputFormat, DocumentType, ElementType } from '../../src/types/document.js'

describe('document types', () => {
  describe('OutputFormat enum', () => {
    it('has correct values', () => {
      expect(OutputFormat.JSON).toBe('json')
      expect(OutputFormat.MARKDOWN).toBe('markdown')
      expect(OutputFormat.TEXT).toBe('text')
      expect(OutputFormat.HTML).toBe('html')
    })
  })

  describe('DocumentType enum', () => {
    it('has correct values', () => {
      expect(DocumentType.PDF).toBe('pdf')
      expect(DocumentType.DOCX).toBe('docx')
      expect(DocumentType.XLSX).toBe('xlsx')
      expect(DocumentType.IMAGE).toBe('image')
      expect(DocumentType.AUDIO).toBe('audio')
      expect(DocumentType.VIDEO).toBe('video')
      expect(DocumentType.TXT).toBe('txt')
      expect(DocumentType.MD).toBe('md')
      expect(DocumentType.HTML).toBe('html')
      expect(DocumentType.EPUB).toBe('epub')
      expect(DocumentType.PPTX).toBe('pptx')
    })
  })

  describe('ElementType enum', () => {
    it('has correct values', () => {
      expect(ElementType.TITLE).toBe('title')
      expect(ElementType.PARAGRAPH).toBe('paragraph')
      expect(ElementType.LIST).toBe('list')
      expect(ElementType.TABLE).toBe('table')
      expect(ElementType.IMAGE).toBe('image')
      expect(ElementType.CODE).toBe('code')
      expect(ElementType.HEADER).toBe('header')
      expect(ElementType.FOOTER).toBe('footer')
      expect(ElementType.PAGE_BREAK).toBe('page_break')
    })
  })
})
