/**
 * YunPat 文档解析工具集
 *
 * 支持多种文件格式的解析和转换
 */

// 类型定义
export * from './types/document.js';

// PDF工具
export {
  PdfExtractTextTool,
  PdfParseTool,
  PdfToMarkdownTool,
  PdfOcrTool,
} from './tools/PdfTools.js';

// DOCX工具
export {
  DocxExtractTextTool,
  DocxToHtmlTool,
  DocxToMarkdownTool,
  DocxParseTool,
} from './tools/DocxTools.js';

// Excel工具
export {
  ExcelReadTool,
  ExcelToJsonTool,
  ExcelToMarkdownTool,
  ExcelParseTool,
} from './tools/ExcelTools.js';

// OCR工具
export {
  ImageOcrTool,
  BatchImageOcrTool,
  ImageToMarkdownTool,
} from './tools/OcrTools.js';

// 音频工具
export {
  AudioTranscriptionTool,
  AudioToSrtTool,
  AudioToVttTool,
  AudioToMarkdownTool,
} from './tools/AudioTools.js';

// 通用文档工具
export {
  UniversalDocumentParserTool,
  BatchDocumentParserTool,
  DocumentConverterTool,
} from './tools/UniversalDocumentTool.js';

// 官文解析工具
export {
  OfficialDocParserTool,
  OfficialDocFields,
  OfficialDocParseResult,
  OfficialDocType,
  OFFICIAL_DOC_PROMPTS,
} from './tools/OfficialDocParser.js';

// 官文解析工具 V2（不依赖外部OCR服务）
export {
  OfficialDocParserToolV2,
  OfficialDocFields as OfficialDocFieldsV2,
  OfficialDocParseResult as OfficialDocParseResultV2,
} from './tools/OfficialDocParserV2.js';

// 专利文档生成工具
export {
  PatentApplicationGeneratorTool,
  PatentClaimsGeneratorTool,
  ResponseStatementGeneratorTool,
  PatentApplicationData,
  ResponseStatementData,
} from './tools/PatentDocxGenerator.js';

// PPTX 演示文稿工具
export {
  PptxExtractTextTool,
  PatentPresentationTool,
  TechnicalDisclosureTool,
  PatentTrainingTool,
  SlideData,
  PresentationData,
} from './tools/PptxTools.js';

// 文档协作工具
export {
  DocumentCollaborationTool,
  PatentTemplateLibraryTool,
  DocumentChange,
  DocumentVersion,
  DocumentCollaborationSession,
} from './tools/DocumentCollaborationTools.js';

// 工具函数
export * from './utils/converters.js';
