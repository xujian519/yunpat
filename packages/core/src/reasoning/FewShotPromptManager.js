/**
 * Few-shot提示管理器
 *
 * 管理工具选择的Few-shot示例，提升智能体工具选择准确性
 */
import { similarityCalculator } from '../tools/SimilarityCalculator.js';
/**
 * Few-shot示例库
 */
export class FewShotPromptManager {
    examples = new Map();
    toolExamples = new Map();
    /**
     * 添加示例
     */
    addExample(example) {
        // 按场景分类
        const category = this.categorizeExample(example);
        if (!this.examples.has(category)) {
            this.examples.set(category, []);
        }
        this.examples.get(category).push(example);
        // 按工具分类
        if (!this.toolExamples.has(example.selectedTool)) {
            this.toolExamples.set(example.selectedTool, []);
        }
        this.toolExamples.get(example.selectedTool).push(example);
    }
    /**
     * 获取相关示例
     */
    getRelevantExamples(userInput, availableTools, maxExamples = 5) {
        const relevant = [];
        // 如果用户输入为空，返回所有示例
        const isEmptyInput = !userInput || userInput.trim() === '';
        // 从场景匹配中获取
        for (const [category, examples] of this.examples) {
            if (isEmptyInput || this.isCategoryRelevant(category, userInput)) {
                for (const example of examples) {
                    const score = isEmptyInput ? 1 : this.calculateSimilarity(userInput, example.userInput);
                    relevant.push({ example, score });
                }
            }
        }
        // 从工具匹配中获取
        const toolNames = availableTools.map((t) => t.metadata.name);
        for (const toolName of toolNames) {
            const examples = this.toolExamples.get(toolName) || [];
            for (const example of examples) {
                const score = this.calculateSimilarity(userInput, example.userInput);
                relevant.push({ example, score });
            }
        }
        // 去重并排序
        const unique = new Map();
        for (const { example, score } of relevant) {
            if (!unique.has(example.id) || score > 0.5) {
                unique.set(example.id, example);
            }
        }
        return Array.from(unique.values())
            .sort((a, b) => this.calculateSimilarity(userInput, b.userInput) -
            this.calculateSimilarity(userInput, a.userInput))
            .slice(0, maxExamples);
    }
    /**
     * 生成Few-shot提示
     */
    generateFewShotPrompt(userInput, availableTools, context) {
        const examples = this.getRelevantExamples(userInput, availableTools, 3);
        let prompt = `
# 工具选择指南

你是一个智能助手，可以使用以下工具来完成任务：

## 可用工具

${this.formatToolsList(availableTools)}

## 工具选择示例

`;
        for (const example of examples) {
            prompt += this.formatExample(example);
            prompt += '\n';
        }
        prompt += `
## 当前任务

用户输入：${userInput}

${context?.conversationHistory ? `对话历史：\n${this.formatConversationHistory(context.conversationHistory)}\n` : ''}

请参考上述示例，选择最合适的工具并说明理由：

1. **分析用户需求**：用户想要完成什么？
2. **匹配工具特征**：哪些工具可以满足需求？
3. **评估适配度**：哪个工具最合适？
4. **准备工具参数**：需要哪些参数？
5. **规划执行步骤**：如何使用工具完成任务？

请按照以下格式回答：

**思考过程**：[你的推理]
**选择工具**：[工具名称]
**工具参数**：[参数JSON]
**执行计划**：[具体步骤]
`;
        return prompt;
    }
    /**
     * 格式化工具列表
     */
    formatToolsList(tools) {
        return tools
            .map((tool) => {
            const metadata = tool.metadata;
            return `
**${metadata.name}**
- 描述：${metadata.description}
- 分类：${metadata.category || 'N/A'}
`;
        })
            .join('\n');
    }
    /**
     * 格式化示例
     */
    formatExample(example) {
        return `
### 示例：${example.scenario}

**用户输入**: "${example.userInput}"

**思考过程**:
${example.reasoning}

**选择工具**: ${example.selectedTool}

**工具参数**:
\`\`\`json
${JSON.stringify(example.toolParameters, null, 2)}
\`\`\`

**执行结果**: ${example.outcome}

${example.lessons ? `**经验**: ${example.lessons}` : ''}
${example.alternatives ? `**替代方案**: ${example.alternatives.join(', ')}` : ''}
`;
    }
    /**
     * 格式化对话历史
     */
    formatConversationHistory(history) {
        return history.map((msg) => `${msg.role}: ${msg.content}`).join('\n');
    }
    /**
     * 分类示例
     */
    categorizeExample(example) {
        const input = example.userInput.toLowerCase();
        if (input.includes('pdf') || input.includes('文档'))
            return 'document';
        if (input.includes('网页') || input.includes('网站'))
            return 'web';
        if (input.includes('图片') || input.includes('ocr'))
            return 'image';
        if (input.includes('音频') || input.includes('语音'))
            return 'audio';
        if (input.includes('数据') || input.includes('分析'))
            return 'analysis';
        if (input.includes('转换') || input.includes('转'))
            return 'conversion';
        return 'general';
    }
    /**
     * 判断类别是否相关
     */
    isCategoryRelevant(category, userInput) {
        const input = userInput.toLowerCase();
        // general 类别总是相关的（兜底）
        if (category === 'general') {
            return true;
        }
        const categoryKeywords = {
            document: ['pdf', 'docx', 'word', 'excel', '文档', '文件'],
            web: ['网页', '网站', 'url', 'http', '浏览'],
            image: ['图片', '图像', 'ocr', '识别'],
            audio: ['音频', '语音', '声音', '转录'],
            analysis: ['分析', '统计', '计算'],
            conversion: ['转换', '转', '格式'],
        };
        const keywords = categoryKeywords[category] || [];
        return keywords.some((kw) => input.includes(kw));
    }
    /**
     * 计算相似度（使用优化的计算器）
     */
    calculateSimilarity(input1, input2) {
        return similarityCalculator.calculateSimilarity(input1, input2, 'jaccard');
    }
    /**
     * 初始化默认示例
     */
    initializeDefaultExamples() {
        // 文档处理示例
        this.addExample({
            id: 'doc-001',
            scenario: 'PDF转Markdown',
            userInput: '帮我把这个PDF文件转换成Markdown格式',
            reasoning: `
用户需求：将PDF文件转换为Markdown格式
需求分析：
1. 文件类型：PDF
2. 目标格式：Markdown
3. 操作类型：格式转换

工具匹配：
- PdfToMarkdownTool：专门用于PDF到Markdown的转换 ✅
- PdfParseTool：可以解析PDF但不是专门转换 ❌

决策：选择PdfToMarkdownTool
      `.trim(),
            selectedTool: 'PdfToMarkdownTool',
            toolParameters: {
                filePath: '/path/to/document.pdf',
                includeHeaderFooter: false,
            },
            outcome: '成功将PDF转换为Markdown格式，保留了标题、段落等基本结构',
            lessons: '对于明确的格式转换需求，优先选择专门的转换工具而非通用解析工具',
        });
        // 网页自动化示例
        this.addExample({
            id: 'web-001',
            scenario: '网页数据抓取',
            userInput: '打开百度首页并截图',
            reasoning: `
用户需求：访问网页并获取视觉内容
需求分析：
1. 操作类型：网页导航 + 截图
2. 需要工具：导航工具 + 截图工具
3. 执行顺序：先导航，后截图

工具匹配：
- WebNavigateTool：导航到指定URL ✅
- WebScreenshotTool：对页面进行截图 ✅

决策：组合使用WebNavigateTool和WebScreenshotTool
      `.trim(),
            selectedTool: 'WebNavigateTool, WebScreenshotTool',
            toolParameters: {
                url: 'https://www.baidu.com',
                newTab: true,
            },
            outcome: '成功打开网页并完成截图',
            alternatives: ['WebSnapshotTool（可同时获取页面结构）'],
            lessons: '多步骤任务需要规划工具使用顺序，确保前一个工具的输出是后一个工具的输入',
        });
        // 数据分析示例
        this.addExample({
            id: 'data-001',
            scenario: 'Excel数据分析',
            userInput: '分析这个Excel表格中的销售数据',
            reasoning: `
用户需求：分析Excel中的数据
需求分析：
1. 数据来源：Excel文件
2. 操作类型：数据读取 + 数据分析
3. 数据类型：结构化表格数据

工具匹配：
- ExcelReadTool：读取Excel数据 ✅
- ExcelToJsonTool：转换为JSON便于分析 ✅
- DataAnalysisTool：执行数据分析 ✅

决策：使用ExcelToJsonTool读取数据，然后使用分析工具处理
      `.trim(),
            selectedTool: 'ExcelToJsonTool',
            toolParameters: {
                filePath: '/path/to/sales_data.xlsx',
                sheetName: 'Sheet1',
            },
            outcome: '成功提取销售数据并转换为JSON格式，可进一步进行数据分析',
            lessons: '对于数据分析任务，先将数据转换为结构化格式（如JSON）可以提高后续处理效率',
        });
        // OCR识别示例
        this.addExample({
            id: 'ocr-001',
            scenario: '图片文字识别',
            userInput: '识别这张图片中的文字内容',
            reasoning: `
用户需求：从图片中提取文字
需求分析：
1. 输入类型：图片文件
2. 操作类型：OCR文字识别
3. 输出要求：文本内容

工具匹配：
- ImageOcrTool：专门用于图片OCR识别 ✅
- PdfOcrTool：用于PDF OCR，不适用 ❌

决策：选择ImageOcrTool
      `.trim(),
            selectedTool: 'ImageOcrTool',
            toolParameters: {
                imagePath: '/path/to/image.png',
                languages: ['eng', 'chi_sim'],
                outputFormat: 'text',
            },
            outcome: '成功识别图片中的中英文文字',
            lessons: '选择工具时注意工具的适用范围，OCR工具分为图片OCR和PDF OCR',
        });
        // 音频转写示例
        this.addExample({
            id: 'audio-001',
            scenario: '语音转文字',
            userInput: '把这段录音转写成文字',
            reasoning: `
用户需求：将语音内容转换为文字
需求分析：
1. 输入类型：音频文件
2. 操作类型：语音识别/转写
3. 输出要求：文本内容

工具匹配：
- AudioTranscriptionTool：使用Whisper模型进行语音转写 ✅
- AudioToSrtTool：生成SRT字幕，非直接转写 ❌

决策：选择AudioTranscriptionTool
      `.trim(),
            selectedTool: 'AudioTranscriptionTool',
            toolParameters: {
                audioPath: '/path/to/recording.mp3',
                language: 'zh',
                outputFormat: 'text',
            },
            outcome: '成功将语音转换为文字，支持中文识别',
            lessons: '注意区分转写工具和字幕生成工具，根据用户的具体需求选择',
        });
        // 批量处理示例
        this.addExample({
            id: 'batch-001',
            scenario: '批量文档转换',
            userInput: '把这个文件夹里的所有PDF都转换成Markdown',
            reasoning: `
用户需求：批量处理多个文件
需求分析：
1. 操作类型：批量处理
2. 文件数量：多个文件
3. 工具选择：批量处理工具 vs 循环调用单个工具

工具匹配：
- BatchDocumentParserTool：专门用于批量处理 ✅
- PdfToMarkdownTool：单个文件处理，需要循环 ❌

决策：选择BatchDocumentParserTool
      `.trim(),
            selectedTool: 'BatchDocumentParserTool',
            toolParameters: {
                filePaths: ['/doc1.pdf', '/doc2.pdf', '/doc3.pdf'],
                outputFormat: 'markdown',
            },
            outcome: '成功批量转换所有PDF文件',
            lessons: '对于批量处理任务，优先使用专门的批量处理工具，可以提升效率和并发性能',
        });
        // 错误恢复示例
        this.addExample({
            id: 'error-001',
            scenario: '工具调用失败重试',
            userInput: '访问网站获取数据',
            reasoning: `
用户需求：从网站获取数据
首次尝试：直接导航到网站
结果：连接超时失败

错误分析：
1. 网络问题：连接超时
2. 解决方案：增加超时时间或重试

重试策略：
- 增加timeout参数
- 添加重试逻辑
- 考虑使用代理
      `.trim(),
            selectedTool: 'WebNavigateTool',
            toolParameters: {
                url: 'https://example.com',
                newTab: true,
                timeout: 30000, // 增加超时时间到30秒
            },
            outcome: '重试后成功访问网站',
            lessons: '工具调用失败时，分析错误原因并调整参数重试，常见问题包括超时、权限、参数错误等',
        });
        // 工具组合示例
        this.addExample({
            id: 'combo-001',
            scenario: '复杂文档处理流程',
            userInput: '从PDF中提取表格数据并生成Excel报告',
            reasoning: `
用户需求：PDF表格提取 → 数据分析 → 生成报告
需求分析：
1. 数据来源：PDF文件
2. 目标格式：Excel报告
3. 操作流程：提取 → 转换 → 生成

工具组合：
步骤1：PdfParseTool - 解析PDF，提取结构
步骤2：ExtractTablesTool - 从结构中提取表格数据
步骤3：ExcelWriteTool - 生成Excel报告

决策：使用工具链完成复杂任务
      `.trim(),
            selectedTool: 'PdfParseTool → ExtractTablesTool → ExcelWriteTool',
            toolParameters: {
                filePath: '/path/to/report.pdf',
            },
            outcome: '成功从PDF提取表格数据并生成Excel报告',
            lessons: '复杂任务需要组合多个工具，关键是要规划好数据流：每个工具的输出是下一个工具的输入',
        });
    }
    /**
     * 导出示例为JSON
     */
    exportExamples() {
        const allExamples = [];
        for (const examples of this.examples.values()) {
            allExamples.push(...examples);
        }
        return JSON.stringify(allExamples, null, 2);
    }
    /**
     * 从JSON导入示例
     */
    importExamples(jsonString) {
        const examples = JSON.parse(jsonString);
        for (const example of examples) {
            this.addExample(example);
        }
    }
}
// 导出单例
export const fewShotManager = new FewShotPromptManager();
fewShotManager.initializeDefaultExamples();
