/**
 * 逻辑一致性检查器 (LogicalConsistencyChecker)
 *
 * 检测内容中的逻辑矛盾、重复、逻辑断层等问题
 */
import { LogicalInconsistencyType, } from './hallucination-types.js';
/**
 * 逻辑一致性检查器
 */
export class LogicalConsistencyChecker {
    llm;
    config;
    constructor(llm, config) {
        this.llm = llm;
        this.config = {
            detectContradictions: true,
            detectDuplication: true,
            detectLogicalGaps: true,
            similarityThreshold: 0.9,
            ...config,
        };
    }
    /**
     * 检查内容的逻辑一致性
     *
     * @param content 要检查的内容
     * @returns 逻辑不一致问题列表
     */
    async checkConsistency(content) {
        const inconsistencies = [];
        // 1. 检测矛盾
        if (this.config.detectContradictions) {
            const contradictions = await this.detectContradictions(content);
            inconsistencies.push(...contradictions);
        }
        // 2. 检测重复
        if (this.config.detectDuplication) {
            const duplications = await this.detectDuplication(content);
            inconsistencies.push(...duplications);
        }
        // 3. 检测逻辑断层
        if (this.config.detectLogicalGaps) {
            const gaps = await this.detectLogicalGaps(content);
            inconsistencies.push(...gaps);
        }
        return inconsistencies;
    }
    /**
     * 检测矛盾陈述
     *
     * @param content 内容文本
     * @returns 矛盾列表
     */
    async detectContradictions(content) {
        const contradictions = [];
        // 方法1: 使用规则检测显式矛盾
        const ruleBasedContradictions = this.detectContradictionsByRules(content);
        contradictions.push(...ruleBasedContradictions);
        // 方法2: 使用LLM检测隐式矛盾
        const llmContradictions = await this.detectContradictionsByLLM(content);
        contradictions.push(...llmContradictions);
        return contradictions;
    }
    /**
     * 使用规则检测矛盾
     *
     * @param content 内容文本
     * @returns 矛盾列表
     */
    detectContradictionsByRules(content) {
        const contradictions = [];
        let contradictionId = 0;
        // 规则1: 检测相互否定的陈述（保留用于未来实现）
        const _negationPatterns = [
            {
                pattern: /(.{1,50}?)(?:不|非|无|没)(?:是|为|存在|有)(.{1,50}?)/g,
                oppositePattern: /(.{1,50}?)(?:是|为|存在|有)(.{1,50}?)/g,
            },
        ];
        const sentences = content.split(/[。！？.!?]/).filter((s) => s.trim().length > 0);
        // 检查相互矛盾的句子
        for (let i = 0; i < sentences.length; i++) {
            for (let j = i + 1; j < sentences.length; j++) {
                if (this.areSentencesContradictory(sentences[i], sentences[j])) {
                    contradictions.push({
                        id: `contradiction-${contradictionId++}`,
                        type: LogicalInconsistencyType.CONTRADICTION,
                        severity: 'major',
                        description: `句子间存在矛盾`,
                        locations: [
                            this.findLocationInText(content, sentences[i]),
                            this.findLocationInText(content, sentences[j]),
                        ].filter((loc) => loc !== undefined),
                        conflictingStatements: [sentences[i], sentences[j]],
                    });
                }
            }
        }
        return contradictions;
    }
    /**
     * 判断两个句子是否矛盾
     *
     * @param sentence1 句子1
     * @param sentence2 句子2
     * @returns 是否矛盾
     */
    areSentencesContradictory(sentence1, sentence2) {
        const s1 = sentence1.trim().toLowerCase();
        const s2 = sentence2.trim().toLowerCase();
        // 检查是否包含相互否定的关键词
        const negations1 = ['不', '非', '无', '没', '不是', '不存在'];
        const affirmations1 = ['是', '为', '存在', '有'];
        const hasNegation1 = negations1.some((neg) => s1.includes(neg));
        const hasAffirmation1 = affirmations1.some((aff) => s1.includes(aff));
        const hasNegation2 = negations1.some((neg) => s2.includes(neg));
        const hasAffirmation2 = affirmations1.some((aff) => s2.includes(aff));
        // 如果一个句子包含否定，另一个包含肯定，且关键词相似
        if (hasNegation1 && hasAffirmation2) {
            const keyTerms1 = this.extractKeyTerms(s1);
            const keyTerms2 = this.extractKeyTerms(s2);
            const commonTerms = keyTerms1.filter((term) => keyTerms2.includes(term));
            if (commonTerms.length >= 2) {
                return true;
            }
        }
        if (hasNegation2 && hasAffirmation1) {
            const keyTerms1 = this.extractKeyTerms(s1);
            const keyTerms2 = this.extractKeyTerms(s2);
            const commonTerms = keyTerms1.filter((term) => keyTerms2.includes(term));
            if (commonTerms.length >= 2) {
                return true;
            }
        }
        return false;
    }
    /**
     * 提取关键术语
     *
     * @param sentence 句子
     * @returns 关键术语列表
     */
    extractKeyTerms(sentence) {
        // 移除停用词和标点
        const stopWords = ['的', '了', '和', '或', '但', '而', '在', '中', '是', '为', '有', '不'];
        const words = sentence
            .replace(/[，。！？、,.!?]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 1 && !stopWords.includes(w));
        return words;
    }
    /**
     * 使用LLM检测矛盾
     *
     * @param content 内容文本
     * @returns 矛盾列表
     */
    async detectContradictionsByLLM(content) {
        const prompt = `请分析以下文本中是否存在逻辑矛盾或不一致的陈述。

文本内容：
${content}

请以JSON格式返回检测结果，格式如下：
[
  {
    "description": "矛盾描述",
    "statements": ["陈述1", "陈述2"],
    "severity": "critical|major|minor"
  }
]

如果没有发现矛盾，返回空数组。只返回JSON，不要有其他内容。`;
        try {
            const response = await this.llm.chat({
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的逻辑分析专家，擅长识别文本中的逻辑矛盾和不一致。',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.3,
            });
            const parsed = JSON.parse(response.message.content);
            return parsed.map((item, index) => ({
                id: `contradiction-llm-${index}`,
                type: LogicalInconsistencyType.CONTRADICTION,
                severity: item.severity || 'major',
                description: item.description,
                locations: item.statements
                    .map((stmt) => this.findLocationInText(content, stmt))
                    .filter((loc) => loc !== undefined),
                conflictingStatements: item.statements,
            }));
        }
        catch (error) {
            console.error('LLM矛盾检测失败:', error);
            return [];
        }
    }
    /**
     * 检测重复内容
     *
     * @param content 内容文本
     * @returns 重复问题列表
     */
    async detectDuplication(content) {
        const duplications = [];
        let duplicationId = 0;
        // 按段落分割
        const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
        // 比较每两个段落
        for (let i = 0; i < paragraphs.length; i++) {
            for (let j = i + 1; j < paragraphs.length; j++) {
                const similarity = this.calculateSimilarity(paragraphs[i], paragraphs[j]);
                if (similarity >= (this.config.similarityThreshold || 0.9)) {
                    duplications.push({
                        id: `duplication-${duplicationId++}`,
                        type: LogicalInconsistencyType.DUPLICATION,
                        severity: 'minor',
                        description: `发现高度相似的内容（相似度: ${(similarity * 100).toFixed(1)}%）`,
                        locations: [
                            this.findLocationInText(content, paragraphs[i]),
                            this.findLocationInText(content, paragraphs[j]),
                        ].filter((loc) => loc !== undefined),
                        conflictingStatements: [paragraphs[i], paragraphs[j]],
                        suggestedFix: '建议删除重复内容或合并为一个段落',
                    });
                }
            }
        }
        return duplications;
    }
    /**
     * 计算两个文本的相似度
     *
     * @param text1 文本1
     * @param text2 文本2
     * @returns 相似度（0-1）
     */
    calculateSimilarity(text1, text2) {
        // 使用Jaccard相似度
        const words1 = new Set(this.extractKeyTerms(text1.toLowerCase()));
        const words2 = new Set(this.extractKeyTerms(text2.toLowerCase()));
        const intersection = new Set([...words1].filter((x) => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        return union.size > 0 ? intersection.size / union.size : 0;
    }
    /**
     * 检测逻辑断层
     *
     * @param content 内容文本
     * @returns 逻辑断层列表
     */
    async detectLogicalGaps(content) {
        // const gaps: LogicalInconsistency[] = []; // 未使用，已移除
        // 使用LLM检测逻辑断层
        const prompt = `请分析以下文本的逻辑流畅性，识别是否存在逻辑断层或推理不连贯的地方。

文本内容：
${content}

请以JSON格式返回检测结果，格式如下：
[
  {
    "description": "逻辑断层描述",
    "location": "断层位置引用",
    "suggestedFix": "修复建议"
  }
]

如果没有发现逻辑断层，返回空数组。只返回JSON，不要有其他内容。`;
        try {
            const response = await this.llm.chat({
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的逻辑分析专家，擅长识别文本中的逻辑断层和推理不连贯。',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.3,
            });
            const parsed = JSON.parse(response.message.content);
            return parsed.map((item, index) => ({
                id: `logical-gap-${index}`,
                type: LogicalInconsistencyType.LOGICAL_GAP,
                severity: 'minor',
                description: item.description,
                locations: [this.findLocationInText(content, item.location || '')].filter((loc) => loc !== undefined),
                conflictingStatements: [],
                suggestedFix: item.suggestedFix,
            }));
        }
        catch (error) {
            console.error('LLM逻辑断层检测失败:', error);
            return [];
        }
    }
    /**
     * 在文本中查找位置
     *
     * @param content 完整文本
     * @param substring 要查找的子字符串
     * @returns 文本位置
     */
    findLocationInText(content, substring) {
        const index = content.indexOf(substring);
        if (index === -1) {
            return undefined;
        }
        // 计算行号
        const textBefore = content.substring(0, index);
        const line = textBefore.split('\n').length;
        const column = textBefore.split('\n').pop()?.length || 0;
        return {
            start: index,
            end: index + substring.length,
            line,
            column,
            text: substring.substring(0, 50) + (substring.length > 50 ? '...' : ''),
        };
    }
    /**
     * 生成逻辑一致性报告
     *
     * @param inconsistencies 不一致问题列表
     * @returns 报告文本
     */
    generateConsistencyReport(inconsistencies) {
        if (inconsistencies.length === 0) {
            return '✅ 未发现逻辑一致性问题';
        }
        let report = `⚠️  发现 ${inconsistencies.length} 个逻辑一致性问题\n\n`;
        // 按严重程度分组
        const bySeverity = inconsistencies.reduce((acc, inc) => {
            if (!acc[inc.severity]) {
                acc[inc.severity] = [];
            }
            acc[inc.severity].push(inc);
            return acc;
        }, {});
        // 输出严重问题
        if (bySeverity.critical) {
            report += '🔴 严重问题:\n';
            for (const inc of bySeverity.critical) {
                report += `  - ${inc.description}\n`;
            }
            report += '\n';
        }
        // 输出主要问题
        if (bySeverity.major) {
            report += '🟠 主要问题:\n';
            for (const inc of bySeverity.major) {
                report += `  - ${inc.description}\n`;
            }
            report += '\n';
        }
        // 输出次要问题
        if (bySeverity.minor) {
            report += '🟡 次要问题:\n';
            for (const inc of bySeverity.minor) {
                report += `  - ${inc.description}\n`;
            }
        }
        return report;
    }
    /**
     * 获取逻辑一致性统计
     *
     * @param inconsistencies 不一致问题列表
     * @returns 统计信息
     */
    getConsistencyStats(inconsistencies) {
        const stats = {
            total: inconsistencies.length,
            critical: 0,
            major: 0,
            minor: 0,
            byType: {},
        };
        for (const inc of inconsistencies) {
            if (inc.severity === 'critical')
                stats.critical++;
            else if (inc.severity === 'major')
                stats.major++;
            else if (inc.severity === 'minor')
                stats.minor++;
            if (!stats.byType[inc.type]) {
                stats.byType[inc.type] = 0;
            }
            stats.byType[inc.type]++;
        }
        return stats;
    }
}
