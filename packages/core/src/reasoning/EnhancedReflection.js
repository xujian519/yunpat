/**
 * 增强自我反思机制 (Enhanced Reflection)
 *
 * P1 准确率优化方案 #4
 *
 * 核心功能：
 * 1. 多维度反思（质量、完整性、一致性）
 * 2. 改进建议生成（具体、可执行）
 * 3. 自动迭代优化（最多3轮自我改进）
 * 4. 反思历史追踪（避免重复错误）
 *
 * @module reasoning/EnhancedReflection
 */
import { TelemetryEventType, EventStatus } from '../observability/types.js';
// ========== 类型定义 ==========
/**
 * 反思维度
 */
export var ReflectionDimension;
(function (ReflectionDimension) {
    /** 质量评估 - 结果是否准确、相关 */
    ReflectionDimension["QUALITY"] = "quality";
    /** 完整性评估 - 是否遗漏重要信息 */
    ReflectionDimension["COMPLETENESS"] = "completeness";
    /** 一致性评估 - 是否存在矛盾或冲突 */
    ReflectionDimension["CONSISTENCY"] = "consistency";
    /** 安全性评估 - 是否存在安全风险 */
    ReflectionDimension["SAFETY"] = "safety";
    /** 效率评估 - 资源使用是否合理 */
    ReflectionDimension["EFFICIENCY"] = "efficiency";
})(ReflectionDimension || (ReflectionDimension = {}));
/**
 * 质量评分等级
 */
export var QualityLevel;
(function (QualityLevel) {
    /** 优秀 - 无需改进 */
    QualityLevel["EXCELLENT"] = "excellent";
    /** 良好 - 可选改进 */
    QualityLevel["GOOD"] = "good";
    /** 一般 - 建议改进 */
    QualityLevel["FAIR"] = "fair";
    /** 较差 - 必须改进 */
    QualityLevel["POOR"] = "poor";
    /** 失败 - 需要重做 */
    QualityLevel["FAILED"] = "failed";
})(QualityLevel || (QualityLevel = {}));
/**
 * 改进优先级
 */
export var ImprovementPriority;
(function (ImprovementPriority) {
    /** 高优先级 - 必须修复 */
    ImprovementPriority["HIGH"] = "high";
    /** 中优先级 - 建议修复 */
    ImprovementPriority["MEDIUM"] = "medium";
    /** 低优先级 - 可选优化 */
    ImprovementPriority["LOW"] = "low";
})(ImprovementPriority || (ImprovementPriority = {}));
// ========== 默认配置 ==========
const DEFAULT_CONFIG = {
    maxIterations: 3,
    iterationThreshold: 0.7,
    enabledDimensions: [
        ReflectionDimension.QUALITY,
        ReflectionDimension.COMPLETENESS,
        ReflectionDimension.CONSISTENCY,
    ],
    useDeepAnalysis: true,
    recordHistory: true,
    maxHistorySize: 100,
    enableTelemetry: true,
};
// ========== 主类实现 ==========
/**
 * 增强自我反思机制
 *
 * 实现多维度、自动迭代的自我反思能力
 */
export class EnhancedReflection {
    llm;
    config;
    telemetryCollector;
    history = [];
    counter = 0;
    /**
     * 构造函数
     */
    constructor(llm, config = {}, telemetryCollector) {
        this.llm = llm;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.telemetryCollector = telemetryCollector;
    }
    /**
     * 核心方法：对结果进行反思
     *
     * @param result 执行结果
     * @param context 执行上下文
     * @param goal 原始目标（可选）
     * @returns 反思报告
     */
    async reflect(result, context, goal) {
        const startTime = Date.now();
        // 记录反思开始
        this.recordTelemetryEvent(TelemetryEventType.STAGE_STARTED, {
            stage: 'reflection',
            agentName: context.agentName,
        });
        const reportId = `ref_${++this.counter}`;
        // 1. 执行多维度评估
        const assessments = await this.performDimensionalAssessments(result, context, goal);
        // 2. 计算综合评分
        const { overallScore, overallLevel } = this.calculateOverallScore(assessments);
        // 3. 生成改进建议
        const improvements = this.generateImprovements(assessments);
        // 4. 判断是否需要迭代
        const { needsIteration, iterationReason } = this.determineIterationNeed(overallScore, improvements, context);
        // 5. 计算置信度
        const confidence = this.calculateConfidence(assessments, improvements);
        const report = {
            id: reportId,
            executionId: context.executionId,
            timestamp: new Date(),
            assessments,
            overallScore,
            overallLevel,
            improvements,
            needsIteration,
            iterationReason,
            confidence,
        };
        // 6. 记录反思历史
        if (this.config.recordHistory) {
            this.addToHistory({
                executionId: context.executionId,
                timestamp: new Date(),
                report,
                iterated: false,
                iterationCount: 0,
            });
        }
        // 记录反思完成
        this.recordTelemetryEvent(TelemetryEventType.STAGE_COMPLETED, {
            stage: 'reflection',
            agentName: context.agentName,
            duration: Date.now() - startTime,
            metadata: {
                reportId,
                overallScore,
                needsIteration,
            },
        });
        return report;
    }
    generateImprovements(input) {
        const assessments = Array.isArray(input) ? input : input.assessments;
        const improvements = [];
        let improvementId = 0;
        for (const assessment of assessments) {
            // 只为需要改进的维度生成建议
            if (assessment.level === QualityLevel.EXCELLENT) {
                continue;
            }
            // 为每个问题生成改进建议
            for (const issue of assessment.issues) {
                const priority = this.determinePriority(assessment.level);
                const actionSteps = this.generateActionSteps(assessment.dimension, issue);
                improvements.push({
                    id: `imp_${++improvementId}`,
                    description: `改进 ${assessment.dimension}: ${issue}`,
                    priority,
                    relatedDimensions: [assessment.dimension],
                    actionSteps,
                    expectedOutcome: this.getExpectedOutcome(assessment.dimension),
                    applied: false,
                });
            }
        }
        // 按优先级排序
        improvements.sort((a, b) => {
            const priorityOrder = {
                [ImprovementPriority.HIGH]: 0,
                [ImprovementPriority.MEDIUM]: 1,
                [ImprovementPriority.LOW]: 2,
            };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        return improvements;
    }
    /**
     * 自动迭代优化
     *
     * @param result 当前结果
     * @param improvements 改进建议
     * @param context 执行上下文
     * @param reActFunction 重新执行函数
     * @returns 迭代结果
     */
    async iterate(result, improvements, context, reActFunction) {
        const startTime = Date.now();
        const reports = [];
        const appliedImprovements = [];
        let currentResult = result;
        let iterationCount = 0;
        let success = false;
        // 最多迭代 maxIterations 次
        while (iterationCount < this.config.maxIterations) {
            iterationCount++;
            // 标记改进为已应用
            for (const imp of improvements) {
                if (!imp.applied) {
                    imp.applied = true;
                    imp.appliedAt = new Date();
                    appliedImprovements.push(imp);
                }
            }
            // 重新执行
            try {
                currentResult = await reActFunction(improvements);
            }
            catch (error) {
                // 迭代失败，停止
                break;
            }
            // 对新结果进行反思
            const newReport = await this.reflect(currentResult, context);
            reports.push(newReport);
            // 检查是否达到标准
            if (!newReport.needsIteration || newReport.overallScore >= this.config.iterationThreshold) {
                success = true;
                break;
            }
            // 更新改进建议
            improvements = this.generateImprovements(newReport);
        }
        const duration = Date.now() - startTime;
        // 更新历史记录
        if (this.config.recordHistory) {
            const historyEntry = this.history.find((h) => h.executionId === context.executionId);
            if (historyEntry) {
                historyEntry.iterated = true;
                historyEntry.iterationCount = iterationCount;
                historyEntry.finalResult = currentResult;
            }
        }
        return {
            iterationCount,
            success,
            result: currentResult,
            reports,
            appliedImprovements,
            duration,
        };
    }
    /**
     * 获取反思历史
     *
     * @param limit 限制数量
     * @returns 历史记录
     */
    getReflectionHistory(limit) {
        const sorted = [...this.history].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return limit ? sorted.slice(0, limit) : sorted;
    }
    /**
     * 获取特定执行的历史
     */
    getHistoryByExecution(executionId) {
        return this.history.find((h) => h.executionId === executionId);
    }
    /**
     * 获取重复错误模式
     *
     * 分析历史记录，找出重复出现的问题
     */
    getRepeatedErrorPatterns() {
        const patternMap = new Map();
        for (const record of this.history) {
            for (const assessment of record.report.assessments) {
                for (const issue of assessment.issues) {
                    const key = `${assessment.dimension}:${issue}`;
                    patternMap.set(key, (patternMap.get(key) || 0) + 1);
                }
            }
        }
        return [...patternMap.entries()]
            .filter(([_, count]) => count > 1)
            .map(([pattern, count]) => ({ pattern, count }))
            .sort((a, b) => b.count - a.count);
    }
    /**
     * 清除历史记录
     */
    clearHistory() {
        this.history = [];
    }
    /**
     * 更新配置
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * 获取配置
     */
    getConfig() {
        return { ...this.config };
    }
    // ========== 私有方法 ==========
    /**
     * 执行多维度评估
     */
    async performDimensionalAssessments(result, context, goal) {
        const assessments = [];
        for (const dimension of this.config.enabledDimensions) {
            let assessment;
            if (this.config.useDeepAnalysis) {
                // 使用 LLM 进行深度分析
                assessment = await this.performLLMAssessment(dimension, result, context, goal);
            }
            else {
                // 使用规则进行快速评估
                assessment = this.performRuleBasedAssessment(dimension, result, context);
            }
            assessments.push(assessment);
        }
        return assessments;
    }
    /**
     * 使用 LLM 进行深度评估
     */
    async performLLMAssessment(dimension, result, context, goal) {
        const prompt = this.buildAssessmentPrompt(dimension, result, context, goal);
        const response = await this.llm.chat({
            messages: [
                {
                    role: 'system',
                    content: this.getSystemPromptForDimension(dimension),
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3,
            maxTokens: 1000,
        });
        return this.parseAssessmentResponse(dimension, response.message.content);
    }
    /**
     * 基于规则的快速评估
     */
    performRuleBasedAssessment(dimension, result, _context) {
        const issues = [];
        let score = 1.0;
        switch (dimension) {
            case ReflectionDimension.QUALITY:
                // 检查结果是否为空
                if (!result || result === null || result === undefined) {
                    issues.push('结果为空');
                    score = 0;
                }
                else if (typeof result === 'string' && result.trim().length === 0) {
                    issues.push('结果为空字符串');
                    score = 0.2;
                }
                // 检查是否包含错误标记
                if (typeof result === 'string' && result.toLowerCase().includes('error')) {
                    issues.push('结果包含错误信息');
                    score = Math.min(score, 0.4);
                }
                break;
            case ReflectionDimension.COMPLETENESS:
                // 检查是否有 TODO 标记
                if (typeof result === 'string' && result.toLowerCase().includes('todo')) {
                    issues.push('包含未完成的 TODO 项');
                    score = 0.6;
                }
                // 检查是否有截断标记
                if (typeof result === 'string' && result.endsWith('...')) {
                    issues.push('结果可能被截断');
                    score = 0.7;
                }
                break;
            case ReflectionDimension.CONSISTENCY:
                // 检查是否有矛盾陈述（简单启发式）
                if (typeof result === 'string') {
                    const hasBut = result.toLowerCase().split('但是').length > 2;
                    if (hasBut) {
                        issues.push('可能包含矛盾的陈述');
                        score = 0.8;
                    }
                }
                break;
            case ReflectionDimension.SAFETY:
                // 检查敏感词
                const sensitivePatterns = ['密码', 'token', 'secret', 'key'];
                const resultStr = JSON.stringify(result).toLowerCase();
                for (const pattern of sensitivePatterns) {
                    if (resultStr.includes(pattern)) {
                        issues.push(`可能包含敏感信息: ${pattern}`);
                        score = Math.min(score, 0.5);
                    }
                }
                break;
            case ReflectionDimension.EFFICIENCY:
                // 检查结果大小
                const resultSize = JSON.stringify(result).length;
                if (resultSize > 100000) {
                    issues.push('结果过大，可能影响效率');
                    score = 0.7;
                }
                break;
        }
        return {
            dimension,
            level: this.scoreToLevel(score),
            score,
            reasoning: issues.length > 0 ? `发现 ${issues.length} 个问题` : '无明显问题',
            issues,
        };
    }
    /**
     * 构建评估提示词
     */
    buildAssessmentPrompt(dimension, result, context, goal) {
        let prompt = `请对以下执行结果进行【${this.getDimensionLabel(dimension)}】维度评估：\n\n`;
        if (goal) {
            prompt += `原始目标：${goal}\n\n`;
        }
        prompt += `执行结果：\n${JSON.stringify(result, null, 2)}\n\n`;
        prompt += `请返回 JSON 格式：\n{
  "score": 0-1之间的评分,
  "reasoning": "评估理由",
  "issues": ["问题1", "问题2"],
  "evidence": ["证据片段1", "证据片段2"]
}`;
        return prompt;
    }
    /**
     * 获取维度的系统提示词
     */
    getSystemPromptForDimension(dimension) {
        const prompts = {
            [ReflectionDimension.QUALITY]: `你是质量评估专家。
评估标准：
- 准确性：结果是否正确、准确
- 相关性：结果是否与目标相关
- 有用性：结果是否有实际价值
评分：0-1，1表示完美。`,
            [ReflectionDimension.COMPLETENESS]: `你是完整性评估专家。
评估标准：
- 覆盖度：是否覆盖了目标的所有方面
- 深度：是否有足够的细节
- 遗漏：是否有明显遗漏的信息
评分：0-1，1表示完整。`,
            [ReflectionDimension.CONSISTENCY]: `你是一致性评估专家。
评估标准：
- 内部一致性：结果内部是否存在矛盾
- 逻辑一致性：推理是否合乎逻辑
- 格式一致性：格式是否统一
评分：0-1，1表示完全一致。`,
            [ReflectionDimension.SAFETY]: `你是安全评估专家。
评估标准：
- 敏感信息：是否泄露敏感信息
- 有害内容：是否包含有害内容
- 隐私风险：是否存在隐私风险
评分：0-1，1表示安全。`,
            [ReflectionDimension.EFFICIENCY]: `你是效率评估专家。
评估标准：
- 资源使用：计算资源使用是否合理
- 结果大小：结果是否冗余
- 时间复杂度：执行时间是否可接受
评分：0-1，1表示高效。`,
        };
        return prompts[dimension];
    }
    /**
     * 解析评估响应
     */
    parseAssessmentResponse(dimension, content) {
        try {
            // 尝试提取 JSON
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    dimension,
                    score: this.clampScore(parsed.score || 0.5),
                    level: this.scoreToLevel(parsed.score || 0.5),
                    reasoning: parsed.reasoning || '未提供理由',
                    issues: parsed.issues || [],
                    evidence: parsed.evidence,
                };
            }
        }
        catch (e) {
            // 解析失败，返回默认评估
        }
        // 解析失败时的默认评估
        return {
            dimension,
            score: 0.5,
            level: QualityLevel.FAIR,
            reasoning: 'LLM 响应解析失败，使用默认评估',
            issues: ['无法进行详细评估'],
        };
    }
    /**
     * 计算综合评分
     */
    calculateOverallScore(assessments) {
        if (assessments.length === 0) {
            return { overallScore: 0.5, overallLevel: QualityLevel.FAIR };
        }
        // 加权平均（质量维度权重更高）
        const weights = {
            [ReflectionDimension.QUALITY]: 0.4,
            [ReflectionDimension.COMPLETENESS]: 0.25,
            [ReflectionDimension.CONSISTENCY]: 0.2,
            [ReflectionDimension.SAFETY]: 0.1,
            [ReflectionDimension.EFFICIENCY]: 0.05,
        };
        let weightedSum = 0;
        let totalWeight = 0;
        for (const assessment of assessments) {
            const weight = weights[assessment.dimension] || 0.2;
            weightedSum += assessment.score * weight;
            totalWeight += weight;
        }
        const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
        const overallLevel = this.scoreToLevel(overallScore);
        return { overallScore, overallLevel };
    }
    /**
     * 判断是否需要迭代
     */
    determineIterationNeed(overallScore, improvements, _context) {
        // 检查评分阈值
        if (overallScore < this.config.iterationThreshold) {
            return {
                needsIteration: true,
                iterationReason: `综合评分 ${overallScore.toFixed(2)} 低于阈值 ${this.config.iterationThreshold}`,
            };
        }
        // 检查高优先级改进
        const highPriorityImprovements = improvements.filter((imp) => imp.priority === ImprovementPriority.HIGH);
        if (highPriorityImprovements.length > 0) {
            return {
                needsIteration: true,
                iterationReason: `存在 ${highPriorityImprovements.length} 个高优先级问题需要修复`,
            };
        }
        return { needsIteration: false };
    }
    /**
     * 计算置信度
     */
    calculateConfidence(assessments, improvements) {
        // 基于以下因素计算置信度：
        // 1. 各维度评分的一致性
        // 2. 改进建议的数量
        const scores = assessments.map((a) => a.score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
        // 低方差 = 高置信度
        const consistencyConfidence = 1 - Math.min(variance, 1);
        // 少量改进 = 高置信度
        const improvementConfidence = 1 / (1 + improvements.length * 0.1);
        return (consistencyConfidence + improvementConfidence) / 2;
    }
    /**
     * 确定改进优先级
     */
    determinePriority(level) {
        switch (level) {
            case QualityLevel.FAILED:
            case QualityLevel.POOR:
                return ImprovementPriority.HIGH;
            case QualityLevel.FAIR:
                return ImprovementPriority.MEDIUM;
            case QualityLevel.GOOD:
                return ImprovementPriority.LOW;
            case QualityLevel.EXCELLENT:
                return ImprovementPriority.LOW;
        }
    }
    /**
     * 生成行动步骤
     */
    generateActionSteps(dimension, _issue) {
        const stepsMap = {
            [ReflectionDimension.QUALITY]: ['重新验证结果准确性', '检查与目标的相关性', '补充缺失的信息'],
            [ReflectionDimension.COMPLETENESS]: ['检查遗漏的方面', '补充必要的细节', '确保覆盖所有要求'],
            [ReflectionDimension.CONSISTENCY]: ['检查内部矛盾', '统一格式和风格', '验证逻辑连贯性'],
            [ReflectionDimension.SAFETY]: ['移除敏感信息', '检查隐私风险', '确保内容安全合规'],
            [ReflectionDimension.EFFICIENCY]: ['优化结果大小', '减少冗余内容', '改进执行效率'],
        };
        return stepsMap[dimension] || ['重新评估并改进'];
    }
    /**
     * 获取预期效果
     */
    getExpectedOutcome(dimension) {
        const outcomes = {
            [ReflectionDimension.QUALITY]: '提高结果准确性和相关性',
            [ReflectionDimension.COMPLETENESS]: '确保结果完整覆盖目标',
            [ReflectionDimension.CONSISTENCY]: '消除矛盾，保持逻辑一致',
            [ReflectionDimension.SAFETY]: '消除安全风险，保护隐私',
            [ReflectionDimension.EFFICIENCY]: '优化资源使用，提高效率',
        };
        return outcomes[dimension];
    }
    /**
     * 分数转质量等级
     */
    scoreToLevel(score) {
        if (score >= 0.9)
            return QualityLevel.EXCELLENT;
        if (score >= 0.75)
            return QualityLevel.GOOD;
        if (score >= 0.5)
            return QualityLevel.FAIR;
        if (score >= 0.25)
            return QualityLevel.POOR;
        return QualityLevel.FAILED;
    }
    /**
     * 限制分数在 0-1 范围
     */
    clampScore(score) {
        return Math.max(0, Math.min(1, score));
    }
    /**
     * 获取维度标签
     */
    getDimensionLabel(dimension) {
        const labels = {
            [ReflectionDimension.QUALITY]: '质量',
            [ReflectionDimension.COMPLETENESS]: '完整性',
            [ReflectionDimension.CONSISTENCY]: '一致性',
            [ReflectionDimension.SAFETY]: '安全性',
            [ReflectionDimension.EFFICIENCY]: '效率',
        };
        return labels[dimension];
    }
    /**
     * 添加到历史记录
     */
    addToHistory(record) {
        this.history.push(record);
        // 限制历史大小
        if (this.history.length > this.config.maxHistorySize) {
            // 移除最旧的记录
            this.history.shift();
        }
    }
    /**
     * 记录遥测事件
     */
    recordTelemetryEvent(type, data) {
        if (this.config.enableTelemetry && this.telemetryCollector) {
            this.telemetryCollector.record({
                id: '',
                type,
                timestamp: Date.now(),
                status: EventStatus.SUCCESS,
                ...data,
            });
        }
    }
}
// ========== 工厂函数 ==========
/**
 * 创建增强反思实例
 */
export function createEnhancedReflection(llm, config, telemetryCollector) {
    return new EnhancedReflection(llm, config, telemetryCollector);
}
