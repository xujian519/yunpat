/**
 * 文档格式转换工具
 */

import {
  DocumentElement,
  ElementType,
  MarkdownOptions,
  JsonOptions,
} from '../types/document.js';

/**
 * 将文档元素转换为Markdown
 */
export function elementsToMarkdown(
  elements: DocumentElement[],
  options: MarkdownOptions = {}
): string {
  const {
    includeHeaderFooter = false,
    imageHandling = 'reference',
    tableFormat = 'markdown',
    codeBlockLanguage = '',
  } = options;

  const lines: string[] = [];

  for (const element of elements) {
    // 跳过页眉页脚（如果不需要）
    if (!includeHeaderFooter) {
      if (element.type === ElementType.HEADER || element.type === ElementType.FOOTER) {
        continue;
      }
    }

    switch (element.type) {
      case ElementType.TITLE:
        const level = element.metadata?.level || 1;
        const prefix = '#'.repeat(level);
        lines.push(`${prefix} ${element.content}\n`);
        break;

      case ElementType.PARAGRAPH:
        lines.push(`${element.content}\n`);
        break;

      case ElementType.LIST:
        const items = element.content.split('\n');
        items.forEach((item, index) => {
          if (item.trim()) {
            lines.push(`${index + 1}. ${item}\n`);
          }
        });
        break;

      case ElementType.TABLE:
        if (tableFormat === 'html') {
          lines.push(element.content); // 假设已经是HTML格式
        } else {
          lines.push(element.content); // 假设已经是Markdown格式
        }
        lines.push('\n');
        break;

      case ElementType.IMAGE:
        if (imageHandling === 'ignore') {
          continue;
        }
        const altText = element.metadata?.alt || 'Image';
        const imageUrl = element.metadata?.url || element.content;
        if (imageHandling === 'embed') {
          lines.push(`![${altText}](${imageUrl})\n`);
        } else {
          lines.push(`[${altText}](${imageUrl})\n`);
        }
        break;

      case ElementType.CODE:
        const lang = codeBlockLanguage || element.metadata?.language || '';
        lines.push(`\`\`\`${lang}\n${element.content}\n\`\`\`\n`);
        break;

      case ElementType.PAGE_BREAK:
        lines.push('\n---\n\n');
        break;

      default:
        lines.push(`${element.content}\n`);
    }
  }

  return lines.join('\n');
}

/**
 * 将文档元素转换为JSON
 */
export function elementsToJson(
  elements: DocumentElement[],
  options: JsonOptions = {}
): string {
  const { includeCoordinates = true, includeStyles = false, compress = false } = options;

  const data = elements.map((element) => {
    const result: any = {
      type: element.type,
      content: element.content,
    };

    if (includeCoordinates && element.metadata?.bbox) {
      result.bbox = element.metadata.bbox;
    }

    if (includeStyles && element.metadata?.style) {
      result.style = element.metadata.style;
    }

    if (element.metadata?.page) {
      result.page = element.metadata.page;
    }

    if (element.metadata?.level) {
      result.level = element.metadata.level;
    }

    return result;
  });

  return JSON.stringify(data, null, compress ? 0 : 2);
}

/**
 * 提取纯文本
 */
export function extractPlainText(elements: DocumentElement[]): string {
  return elements
    .filter((e) => e.type !== ElementType.HEADER && e.type !== ElementType.FOOTER)
    .map((e) => e.content)
    .join('\n');
}

/**
 * 检测文件类型
 */
export function detectFileType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();

  const typeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    txt: 'text/plain',
    md: 'text/markdown',
    html: 'text/html',
    epub: 'application/epub+zip',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };

  return typeMap[ext || ''] || 'application/octet-stream';
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
