/**
 * 徐健的个性化写作风格配置
 *
 * 基于以下文档分析：
 * - /Users/xujian/Athena工作平台（技术设计文档）
 * - /Users/xujian/Documents/自媒体运营（系统报告）
 * - 专利相关笔记（法律文档）
 *
 * 分析时间：2026-04-30
 */

export const xuJianWritingStyle = {
  name: '徐健的技术写作风格',

  // ========== 风格示例 ==========
  examples: [
    '专利制度的一个重要特点是公开换保护，A26.3是专利制度的核心条款之一',
    '说明书对发明作出的清楚、完整的说明，应当达到所属技术领域的技术人员能够实现的程度',
    '基于父女三人（徐健、Athena、小诺）协作分析的设计方案',
    'V2设计在原有基础上进行了以下重大架构升级',
    '本方案专注于WebChat核心功能',
    '工作流步骤：步骤1 → 步骤2 → 步骤3 → 步骤4 → 步骤5',
    '质量提升：Kimi + ComfyUI 比原方案质量更高'
  ],

  // ========== 词汇特征 ==========
  vocabulary: {
    preferredWords: [
      // 专业术语（保留英文）
      'Gateway', '架构', '协议', '部署', '集成',
      '专利', '知识产权', '审查', '申请', '权利要求',
      'AI', '模型', '算法', '数据', '系统',

      // 口语化表达
      '说白了', '咱们', '来看看', '实际上', '事实上',
      '值得注意的是', '需要注意的是', '具体来说',

      // 强调性词汇
      '核心', '关键', '主要', '重点', '本质', '根本',
      '完全', '充分', '彻底', '深入', '详细',

      // 连接词
      '基于此', '因此', '所以', '从而', '进而'
    ],

    avoidWords: [
      '笔者', '综上所述', '显而易见', '较为',
      '可以说', '某种程度', '一定程度'
    ],

    formalityLevel: 'mixed' // 专业但不刻板
  },

  // ========== 句式特征 ==========
  sentenceStructure: {
    averageLength: 'medium', // 中等长度，20-40字
    variety: 'varied',    // 长短句结合

    patterns: [
      // 开头句式：直接陈述核心观点
      '{主题}是{核心观点}',
      '{主题}具有{特点}的特点',
      '基于{原因}，{结论}',

      // 解释句式：先总后分
      '具体而言，{解释}',
      '具体来说，{解释}',
      '包括但不限于：{列举}',

      // 举例句式：用案例说明
      '例如，{例子}',
      '举个例子，{例子}',
      '以{案例}为例',

      // 对比句式：对比说明
      '相较于{方案A}，{方案B}',
      '与{方案A}不同，{方案B}',
      '相比之下，{差异}',

      // 总结句式：总结要点
      '总的来说，',
      '综上所述，',
      '简而言之，',
      '换言之'
    ]
  },

  // ========== 表达习惯 ==========
  expressions: {
    useMetaphors: true,        // 使用类比和比喻
    useExamples: true,         // 大量使用实际案例
    useHumor: false,           // 技术文档不使用幽默
    useData: true,             // 引用数据和统计
    useQuotes: true,           // 引用权威来源
    useCode: true,             // 使用代码块示例
    useTables: true,           // 使用表格对比
    useLists: true,            // 使用列表分点
    useEmojis: true,           // 使用emoji增强可读性
    useNumbers: true,          // 使用编号增强逻辑性
  },

  // ========== 逻辑结构 ==========
  logicFlow: 'pyramid', // 金字塔原理：结论先行，再展开论述

  // ========== 组织模式 ==========
  organization: {
    opening: 'direct',           // 开头：直接切入主题
    structure: 'hierarchical',   // 结构：层级递进
    closing: 'summary',          // 结尾：总结要点
    sections: [
      '概述/简介',               // 必须有概述部分
      '核心内容/主体',           // 主要论述部分
      '案例分析/实例说明',       // 具体例子
      '对比分析',                // 对比说明
      '总结/结论'                 // 必须有总结
    ]
  },

  // ========== 格式特征 ==========
  formatting: {
    useMarkdown: true,           // 使用 Markdown
    useHeaders: true,            // # ## ### 层级标题
    useBold: true,               // **加粗**强调重点
    useCodeBlocks: true,        // 代码块
    useBlockquotes: true,       // 引用块
    useHorizontalRules: true,   // --- 分隔线
    useTables: true,             // 表格
    useLists: true,              // 列表
    useEmojis: true,            // emoji 标记
    useNumbering: true          // ①②③ 或 123 编号
  },

  // ========== 特殊习惯 ==========
  habits: {
    // 开头习惯
    openings: [
      '基于{背景}，{主题}',
      '本文将介绍/分析/讨论{主题}',
      '{主题}是{领域}的重要组成部分',
      '在{领域}中，{主题}扮演着重要角色'
    ],

    // 过渡习惯
    transitions: [
      '接下来，让我们来看看',
      '基于此，我们可以得出',
      '值得注意的是',
      '需要强调的是',
      '具体而言',
      '换句话说'
    ],

    // 引用习惯
    citations: [
      '根据{来源}，',
      '参考{来源}中的定义',
      '如{案例}所示，',
      '基于{原理}，',
      '按照{标准}，'
    ],

    // 总结习惯
    summaries: [
      '总的来说，',
      '综上所述，',
      '简而言之，',
      '一言以蔽之',
      '核心要点如下'
    ]
  },

  // ========== 标点符号使用 ==========
  punctuation: {
    commas: 'moderate',         // 逗号使用适中
    periods: 'frequent',         // 句号使用频繁
    semicolons: 'rare',          // 分号很少使用
    colons: 'frequent',          // 冒号经常使用（列表、解释）
    dashes: 'moderate',         // 破折号适中使用
    parentheses: 'frequent',     // 括号经常使用（补充说明）
    brackets: 'rare'            // 方括号很少使用
  },

  // ========== 段落特征 ==========
  paragraphs: {
    averageLength: 150,          // 平均段落长度（字符数）
    structure: 'topic-first',    // 主题句开头
    cohesion: 'high',            // 段内连贯性强
    unity: 'single-idea'         // 一段一意
  }
};

// ========== 风格提示词生成器 ==========

/**
 * 生成徐健风格的写作提示词
 */
export function generateXuJianStylePrompt(topic: string): string {
  let prompt = `请按照徐健的写作风格完成以下写作任务：${topic}\n\n`;

  prompt += `## 📋 写作风格要求\n\n`;

  // 开头要求
  prompt += `### 开头风格\n`;
  prompt += `- 直接切入主题，不要绕弯子\n`;
  prompt += `- 可以使用"基于..."、"本文将..."等开头\n`;
  prompt += `- 明确文章的写作目的和读者对象\n\n`;

  // 词汇要求
  prompt += `### 用词要求\n`;
  prompt += `- 专业术语保留英文（如 Gateway、AI、API 等）\n`;
  prompt += `- 适度使用口语化表达（如"说白了"、"咱们"、"实际上"）\n`;
  prompt += `- 避免使用"笔者"、"显而易见"等词汇\n`;
  prompt += `- 多用强调性词汇（核心、关键、主要、重点）\n\n`;

  // 句式要求
  prompt += `### 句式要求\n`;
  prompt += `- 长短句结合，短句用于强调重点\n`;
  prompt += `- 经常使用举例说明（"例如..."、"举个例子..."）\n`;
  prompt += `- 使用对比说明（"相较于..."、"与...不同..."）\n`;
  prompt += `- 总结时使用"总的来说"、"综上所述"等\n\n`;

  // 逻辑结构
  prompt += `### 逻辑结构\n`;
  prompt += `- 采用金字塔原理：先说结论，再展开论述\n`;
  prompt += `- 层级递进：概述 → 核心内容 → 案例分析 → 总结\n`;
  prompt += `- 每个部分都要有明确的小标题\n\n`;

  // 格式要求
  prompt += `### 格式要求\n`;
  prompt += `- 使用 Markdown 格式\n`;
  prompt += `- 层级标题：# ## ###\n`;
  prompt += `- 使用 **加粗**强调重点\n`;
  prompt += `- 使用代码块展示技术内容\n`;
  prompt += `- 使用表格进行对比分析\n`;
  prompt += `- 使用列表（1. 2. 3. 或 ① ② ③）进行分点论述\n`;
  prompt += `- 适度使用 emoji 增强可读性\n\n`;

  // 引用要求
  prompt += `### 引用要求\n`;
  prompt += `- 引用权威来源时要明确标注\n`;
  prompt += `- 使用案例说明时要具体\n`;
  prompt += `- 引用法律条文或决定书时要注明来源\n\n`;

  // 风格示例
  prompt += `## 📝 风格示例\n\n`;
  prompt += `以下是我的写作风格示例：\n\n`;

  xuJianWritingStyle.examples.forEach((example, i) => {
    prompt += `${i + 1}. ${example}\n`;
  });

  prompt += `\n## 🎯 写作目标\n\n`;
  prompt += `请严格按照以上风格要求生成内容，确保：\n`;
  prompt += `1. 结构清晰，层级分明\n`;
  prompt += `2. 逻辑严密，论证充分\n`;
  prompt += `3. 举例恰当，案例具体\n`;
  prompt += `4. 用词准确，专业但不刻板\n`;
  prompt += `5. 格式规范，易于阅读\n`;

  return prompt;
}

/**
 * 创建风格增强的写作任务
 */
export function createStyledWritingTask(
  topic: string,
  type: 'generate' | 'optimize' | 'convert' | 'format' = 'generate',
  additionalRequirements: string[] = []
): any {
  return {
    type,
    topic,
    format: 'markdown',
    requirements: [
      generateXuJianStylePrompt(topic),
      ...additionalRequirements
    ]
  };
}

/**
 * 风格配置摘要（用于快速查看）
 */
export const xuJianStyleSummary = {
  style: '徐健技术写作风格',

  characteristics: {
    opening: '直接切入主题',
    tone: '专业但不刻板',
    structure: '金字塔原理（结论先行）',
    examples: '大量使用实际案例',
    citations: '引用权威来源',
    formatting: 'Markdown + 表格 + 列表',
    emojis: '适度使用增强可读性'
  },

  strengths: [
    '结构化程度高',
    '逻辑清晰',
    '举例说明充分',
    '技术专业性强',
    '格式规范统一'
  ],

  bestFor: [
    '技术文档',
    '系统设计文档',
    '专利分析报告',
    '技术方案说明',
    '部署总结报告'
  ]
};
