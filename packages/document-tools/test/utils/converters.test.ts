import { describe, it, expect } from 'vitest';
import {
  elementsToMarkdown,
  elementsToJson,
  extractPlainText,
  detectFileType,
  generateId,
  formatFileSize,
} from '../../src/utils/converters.js';
import { ElementType, DocumentElement } from '../../src/types/document.js';

describe('converters', () => {
  const sampleElements: DocumentElement[] = [
    { type: ElementType.TITLE, content: 'Hello World', metadata: { level: 1 } },
    { type: ElementType.PARAGRAPH, content: 'This is a paragraph.' },
    { type: ElementType.LIST, content: 'Item 1\nItem 2' },
    { type: ElementType.CODE, content: 'const x = 1;', metadata: { language: 'ts' } },
    { type: ElementType.PAGE_BREAK, content: '' },
    { type: ElementType.HEADER, content: 'Header text' },
    { type: ElementType.FOOTER, content: 'Footer text' },
  ];

  describe('elementsToMarkdown', () => {
    it('converts elements to markdown with default options', () => {
      const md = elementsToMarkdown(sampleElements);
      expect(md).toContain('# Hello World');
      expect(md).toContain('This is a paragraph.');
      expect(md).toContain('1. Item 1');
      expect(md).toContain('2. Item 2');
      expect(md).toContain('```ts');
      expect(md).toContain('const x = 1;');
      expect(md).toContain('---');
      expect(md).not.toContain('Header text');
      expect(md).not.toContain('Footer text');
    });

    it('includes header and footer when option is enabled', () => {
      const md = elementsToMarkdown(sampleElements, { includeHeaderFooter: true });
      expect(md).toContain('Header text');
      expect(md).toContain('Footer text');
    });

    it('ignores images when imageHandling is ignore', () => {
      const elements: DocumentElement[] = [
        { type: ElementType.IMAGE, content: 'image.png', metadata: { alt: 'Test', url: 'http://example.com/image.png' } },
      ];
      const md = elementsToMarkdown(elements, { imageHandling: 'ignore' });
      expect(md).not.toContain('image.png');
    });

    it('embeds images when imageHandling is embed', () => {
      const elements: DocumentElement[] = [
        { type: ElementType.IMAGE, content: 'image.png', metadata: { alt: 'Test', url: 'http://example.com/image.png' } },
      ];
      const md = elementsToMarkdown(elements, { imageHandling: 'embed' });
      expect(md).toContain('![Test](http://example.com/image.png)');
    });
  });

  describe('elementsToJson', () => {
    it('converts elements to JSON string', () => {
      const elements: DocumentElement[] = [
        { type: ElementType.TITLE, content: 'Title', metadata: { level: 1, bbox: [0, 0, 100, 50] } },
      ];
      const json = elementsToJson(elements);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe(ElementType.TITLE);
      expect(parsed[0].content).toBe('Title');
      expect(parsed[0].bbox).toEqual([0, 0, 100, 50]);
      expect(parsed[0].level).toBe(1);
    });

    it('respects compress option', () => {
      const elements: DocumentElement[] = [
        { type: ElementType.PARAGRAPH, content: 'Hi' },
      ];
      const json = elementsToJson(elements, { compress: true });
      expect(json).not.toContain('\n');
    });

    it('excludes coordinates when includeCoordinates is false', () => {
      const elements: DocumentElement[] = [
        { type: ElementType.PARAGRAPH, content: 'Hi', metadata: { bbox: [0, 0, 10, 10] } },
      ];
      const json = elementsToJson(elements, { includeCoordinates: false });
      const parsed = JSON.parse(json);
      expect(parsed[0].bbox).toBeUndefined();
    });
  });

  describe('extractPlainText', () => {
    it('extracts plain text excluding headers and footers', () => {
      const text = extractPlainText(sampleElements);
      expect(text).toContain('Hello World');
      expect(text).toContain('This is a paragraph.');
      expect(text).not.toContain('Header text');
      expect(text).not.toContain('Footer text');
    });
  });

  describe('detectFileType', () => {
    it('detects common file types', () => {
      expect(detectFileType('doc.pdf')).toBe('application/pdf');
      expect(detectFileType('doc.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(detectFileType('sheet.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(detectFileType('image.png')).toBe('image/png');
      expect(detectFileType('image.jpg')).toBe('image/jpeg');
      expect(detectFileType('audio.mp3')).toBe('audio/mpeg');
      expect(detectFileType('video.mp4')).toBe('video/mp4');
      expect(detectFileType('text.txt')).toBe('text/plain');
      expect(detectFileType('readme.md')).toBe('text/markdown');
    });

    it('returns octet-stream for unknown extensions', () => {
      expect(detectFileType('unknown.abc')).toBe('application/octet-stream');
      expect(detectFileType('noextension')).toBe('application/octet-stream');
    });
  });

  describe('generateId', () => {
    it('generates a unique string id', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(typeof id1).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toContain('-');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
      expect(formatFileSize(1536)).toBe('1.50 KB');
    });
  });
});
