/**
 * 文档解析结果类型定义
 */

/**
 * 解析输出格式
 */
export enum OutputFormat {
  JSON = 'json',
  MARKDOWN = 'markdown',
  TEXT = 'text',
  HTML = 'html',
}

/**
 * 文档类型
 */
export enum DocumentType {
  PDF = 'pdf',
  DOCX = 'docx',
  DOC = 'doc',
  XLSX = 'xlsx',
  XLS = 'xls',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  TXT = 'txt',
  MD = 'md',
  HTML = 'html',
  EPUB = 'epub',
  PPTX = 'pptx',
}

/**
 * 文档元素类型
 */
export enum ElementType {
  TITLE = 'title',
  PARAGRAPH = 'paragraph',
  LIST = 'list',
  TABLE = 'table',
  IMAGE = 'image',
  CODE = 'code',
  HEADER = 'header',
  FOOTER = 'footer',
  PAGE_BREAK = 'page_break',
}

/**
 * 文档元素
 */
export interface DocumentElement {
  type: ElementType;
  content: string;
  metadata?: {
    level?: number; // 标题级别
    page?: number; // 页码
    bbox?: [number, number, number, number]; // 边界框 [x1, y1, x2, y2]
    [key: string]: any;
  };
}

/**
 * 文档解析结果
 */
export interface DocumentParseResult {
  /** 文档类型 */
  documentType: DocumentType;
  /** 原始文件名 */
  filename: string;
  /** 文本内容 */
  text: string;
  /** 结构化元素 */
  elements: DocumentElement[];
  /** 元数据 */
  metadata: {
    totalPages?: number;
    author?: string;
    creationDate?: Date;
    modificationDate?: Date;
    title?: string;
    subject?: string;
    keywords?: string[];
    language?: string;
    [key: string]: any;
  };
  /** 解析时间（毫秒） */
  parseTime: number;
}

/**
 * Markdown输出选项
 */
export interface MarkdownOptions {
  /** 包含页眉页脚 */
  includeHeaderFooter?: boolean;
  /** 图片处理方式 */
  imageHandling?: 'embed' | 'reference' | 'ignore';
  /** 表格格式 */
  tableFormat?: 'markdown' | 'html';
  /** 代码块语言 */
  codeBlockLanguage?: string;
}

/**
 * JSON输出选项
 */
export interface JsonOptions {
  /** 包含坐标信息 */
  includeCoordinates?: boolean;
  /** 包含样式信息 */
  includeStyles?: boolean;
  /** 压缩输出 */
  compress?: boolean;
}

/**
 * 文档解析选项
 */
export interface ParseOptions {
  /** 输出格式 */
  outputFormat?: OutputFormat;
  /** OCR语言（用于图片/扫描版PDF） */
  ocrLanguages?: string[];
  /** 是否提取图片 */
  extractImages?: boolean;
  /** 是否提取表格 */
  extractTables?: boolean;
  /** Markdown选项 */
  markdownOptions?: MarkdownOptions;
  /** JSON选项 */
  jsonOptions?: JsonOptions;
}

/**
 * 音频转写选项
 */
export interface TranscriptionOptions {
  /** 语言代码 */
  language?: string;
  /** 是否翻译成英文 */
  translateToEnglish?: boolean;
  /** 输出格式 */
  outputFormat?: 'text' | 'srt' | 'vtt' | 'json';
}

/**
 * 音频转写结果
 */
export interface TranscriptionResult {
  /** 转写文本 */
  text: string;
  /** 时间戳分段 */
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  /** 检测到的语言 */
  language: string;
  /** 处理时长（秒） */
  processingTime: number;
}
