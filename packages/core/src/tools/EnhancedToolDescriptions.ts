/**
 * 工具增强描述库
 *
 * 为现有工具添加详细的增强描述，提升工具选择准确性
 */

import { ToolDescriptionEnhancer } from '@yunpat/core';

/**
 * 增强工具描述库
 */
export const EnhancedToolDescriptions: Record<
  string,
  {
    detailedDescription: string;
    commonUseCases: string[];
    capabilities: string[];
    dataTypes?: string[];
    limitations?: string[];
    prerequisites?: string[];
    relatedTools?: string[];
  }
> = {
  // ========== PDF工具 ==========
  PdfParseTool: {
    detailedDescription: `
解析PDF文件并提取结构化内容，包括文本、标题、段落、表格等元素。

此工具使用pdf-parse库，能够：
- 提取PDF中的纯文本内容
- 识别文档结构（标题、段落、列表等）
- 提取文档元数据（作者、创建日期、标题等）
- 处理受密码保护的PDF（需要密码）
    `.trim(),
    commonUseCases: ['PDF文档内容分析', 'PDF文本提取', 'PDF元数据提取', 'PDF文档预处理'],
    capabilities: ['文本提取', '结构解析', '元数据提取', '密码支持'],
    dataTypes: ['application/pdf'],
    limitations: ['扫描版PDF需要使用OCR工具', '复杂格式可能无法完全保留', '大文件处理时间较长'],
    prerequisites: ['文件可访问', '有效的PDF格式'],
    relatedTools: ['PdfOcrTool', 'PdfToMarkdownTool', 'PdfExtractTextTool'],
  },

  PdfToMarkdownTool: {
    detailedDescription: `
将PDF文件转换为Markdown格式，保留基本的文档结构。

此工具专门用于PDF到Markdown的格式转换，能够：
- 保留标题层级结构
- 转换段落和列表
- 处理简单的表格
- 移除页眉页脚
- 提供纯Markdown输出

适合用于：文档编辑、内容发布、格式转换
    `.trim(),
    commonUseCases: ['PDF转Markdown格式', '文档编辑准备', '内容管理系统导入', '文档格式转换'],
    capabilities: ['格式转换', '结构保留', '文本提取', '表格处理'],
    dataTypes: ['application/pdf'],
    limitations: ['复杂表格可能无法完全转换', '图片和嵌入内容需要单独处理', '特殊格式可能丢失'],
    prerequisites: ['有效的PDF文件'],
    relatedTools: ['PdfParseTool', 'PdfExtractTextTool'],
  },

  // ========== DOCX工具 ==========
  DocxToMarkdownTool: {
    detailedDescription: `
将Word文档（DOCX）转换为Markdown格式，保留文档结构。

此工具使用mammoth库，能够：
- 转换标题、段落、列表等基本结构
- 保留粗体、斜体等基本格式
- 处理嵌套列表
- 转换表格为Markdown表格
- 移除样式和复杂格式

适合用于：Word文档编辑、内容发布、格式转换
    `.trim(),
    commonUseCases: ['Word文档转Markdown', '文档格式转换', '内容发布准备', '文档编辑'],
    capabilities: ['格式转换', '结构保留', '样式处理'],
    dataTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    limitations: ['复杂样式可能丢失', '嵌入对象可能无法转换', '自定义格式可能不兼容'],
    prerequisites: ['有效的DOCX文件'],
    relatedTools: ['DocxExtractTextTool', 'DocxToHtmlTool'],
  },

  ExcelToJsonTool: {
    detailedDescription: `
将Excel文件转换为JSON格式，便于数据处理和分析。

此工具使用SheetJS库，能够：
- 读取Excel所有工作表
- 转换为JSON数组格式
- 保留数据类型
- 处理公式和格式
- 支持大文件处理

适合用于：数据导出、API准备、数据处理流水线
    `.trim(),
    commonUseCases: ['Excel数据导出', '数据格式转换', 'API数据准备', 'Excel数据处理'],
    capabilities: ['数据读取', '格式转换', '批量处理'],
    dataTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
    limitations: ['公式计算结果可能不包含', '复杂格式可能简化', '大文件需要分批处理'],
    prerequisites: ['有效的Excel文件'],
    relatedTools: ['ExcelReadTool', 'ExcelToMarkdownTool'],
  },

  // ========== 浏览器工具 ==========
  WebNavigateTool: {
    detailedDescription: `
在浏览器中导航到指定URL，支持新标签页或现有标签页。

此工具是浏览器自动化的基础工具，能够：
- 打开指定URL
- 在新标签页中打开（默认）
- 等待页面加载完成
- 返回页面信息

适合用于：网页访问、自动化测试、数据抓取
    `.trim(),
    commonUseCases: ['打开网页', '访问网站', '浏览器自动化', '网页测试'],
    capabilities: ['页面导航', '标签页管理', '页面加载'],
    limitations: ['需要WebBridge服务运行', '网络延迟影响性能', '某些网站可能有反爬限制'],
    prerequisites: ['WebBridge服务已启动', '浏览器扩展已安装'],
    relatedTools: ['WebSnapshotTool', 'WebClickTool', 'WebScreenshotTool'],
  },

  WebSnapshotTool: {
    detailedDescription: `
获取页面的可访问性树，用于定位页面元素和提取结构信息。

此工具返回页面的语义化结构，包括：
- 交互元素（按钮、链接、输入框等）
- 元素角色（按钮、文本、标题等）
- 元素标签和属性
- @e引用（用于点击和填充）

适合用于：元素定位、页面分析、UI自动化
    `.trim(),
    commonUseCases: ['页面元素定位', 'UI结构分析', '网页内容提取', '元素选择器获取'],
    capabilities: ['元素定位', '结构提取', '语义分析'],
    limitations: ['需要页面已加载', '动态内容可能需要等待', '隐藏元素无法获取'],
    prerequisites: ['页面已打开', 'WebBridge服务运行'],
    relatedTools: ['WebNavigateTool', 'WebClickTool', 'WebFillTool'],
  },

  WebClickTool: {
    detailedDescription: `
点击页面上的元素，支持CSS选择器或@e引用。

此工具可以：
- 点击按钮、链接等交互元素
- 支持CSS选择器定位
- 支持快照中的@e引用
- 处理点击后页面变化
- 返回点击结果

适合用于：UI交互、表单提交、页面导航
    `.trim(),
    commonUseCases: ['按钮点击', '链接访问', '表单提交', 'UI交互'],
    capabilities: ['元素点击', 'CSS选择器', '@e引用'],
    limitations: ['元素必须可见和可点击', '某些动态元素可能需要等待', '覆盖层可能阻止点击'],
    prerequisites: ['页面已打开', '元素已定位'],
    relatedTools: ['WebSnapshotTool', 'WebWaitTool', 'WebScrollTool'],
  },

  // ========== OCR工具 ==========
  ImageOcrTool: {
    detailedDescription: `
从图片中识别文字内容，支持多语言OCR识别。

此工具使用Tesseract.js，能够：
- 识别图片中的中英文文字
- 提供文字坐标信息
- 支持批量图片处理
- 返回识别置信度
- 处理多种图片格式

适合用于：扫描文档处理、验证码识别、图片文字提取
    `.trim(),
    commonUseCases: ['图片文字识别', '扫描文档处理', '验证码识别', '截图文字提取'],
    capabilities: ['文字识别', '多语言支持', '坐标定位', '批量处理'],
    dataTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp'],
    limitations: ['识别准确度取决于图片质量', '复杂背景可能影响识别', '首次使用需要下载语言包'],
    prerequisites: ['Tesseract.js已安装', '语言包已下载'],
    relatedTools: ['PdfOcrTool', 'ImageToMarkdownTool'],
  },

  // ========== 音频工具 ==========
  AudioTranscriptionTool: {
    detailedDescription: `
将音频文件转写为文字，使用Whisper模型进行语音识别。

此工具支持：
- 多语言语音转写
- 自动语言检测
- 高准确率识别
- 时间戳保留
- 多种输出格式

适合用于：会议记录、语音转文字、字幕生成、音频内容分析
    `.trim(),
    commonUseCases: ['语音转文字', '会议记录生成', '视频字幕制作', '音频内容分析'],
    capabilities: ['语音识别', '多语言支持', '时间戳生成'],
    dataTypes: ['audio/mpeg', 'audio/wav', 'audio/m4a'],
    limitations: ['需要Whisper模型', '处理时间取决于音频长度', '需要足够的内存和CPU'],
    prerequisites: ['Whisper模型已下载', '足够的系统资源'],
    relatedTools: ['AudioToSrtTool', 'AudioToVttTool', 'AudioToMarkdownTool'],
  },

  // ========== 通用工具 ==========
  UniversalDocumentParserTool: {
    detailedDescription: `
通用文档解析器，自动检测文件类型并调用相应的解析工具。

支持的文件类型包括：
- PDF（.pdf）
- Word（.docx, .doc）
- Excel（.xlsx, .xls）
- 图片（.png, .jpg, .jpeg, .gif, .bmp）
- 音频（.mp3, .wav, .m4a）
- 文本（.txt, .md）

输出格式支持：JSON、Markdown、Text

适合用于：批量文档处理、自动化文档转换、多格式文件解析
    `.trim(),
    commonUseCases: ['批量文档解析', '自动格式检测', '多格式转换', '文档内容提取'],
    capabilities: ['自动检测', '多格式支持', '批量处理'],
    dataTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/*',
      'audio/*',
    ],
    limitations: ['依赖相应的解析工具', '某些格式可能需要额外工具', '转换质量取决于源文件'],
    prerequisites: ['相应解析工具已安装'],
    relatedTools: [
      'PdfParseTool',
      'DocxParseTool',
      'ExcelParseTool',
      'ImageOcrTool',
      'AudioTranscriptionTool',
    ],
  },
};

/**
 * 为工具添加增强描述
 */
export function addEnhancedDescriptions() {
  const descriptions = EnhancedToolDescriptions;

  // 返回增强的描述库
  return descriptions;
}

/**
 * 获取工具的增强描述
 */
export function getEnhancedDescription(toolName: string): any {
  const descriptions = EnhancedToolDescriptions;
  return descriptions[toolName] || null;
}
