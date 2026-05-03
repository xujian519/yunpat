/**
 * 偏离检测器
 *
 * 监控计划执行过程，检测与预期的偏离
 */
/**
 * 偏离检测器
 */
export class DeviationDetector {
    baselineMetrics;
    detectionHistory;
    constructor() {
        this.baselineMetrics = new Map();
        this.detectionHistory = [];
    }
    /**
     * 检测偏离
     */
    async detectDeviations(plannedState, actualState, thresholds = {}) {
        const deviations = [];
        // 1. 检测进度偏离
        const scheduleDeviation = this.detectScheduleDeviation(plannedState, actualState, thresholds.scheduleDeviation ?? 0.2);
        if (scheduleDeviation) {
            deviations.push(scheduleDeviation);
        }
        // 2. 检测质量偏离
        const qualityDeviations = this.detectQualityDeviations(plannedState.qualityMetrics, actualState.qualityMetrics, thresholds.qualityDeviation ?? 0.15);
        deviations.push(...qualityDeviations);
        // 3. 检测资源偏离
        const resourceDeviations = this.detectResourceDeviations(plannedState.resourceUsage, actualState.resourceUsage, thresholds.resourceDeviation ?? 0.25);
        deviations.push(...resourceDeviations);
        // 4. 检测依赖偏离
        const dependencyDeviation = this.detectDependencyDeviation(plannedState, actualState);
        if (dependencyDeviation) {
            deviations.push(dependencyDeviation);
        }
        // 计算总体偏离分数
        const overallDeviationScore = this.calculateOverallDeviationScore(deviations);
        const report = {
            hasDeviation: deviations.length > 0,
            deviations,
            overallDeviationScore,
            timestamp: new Date(),
        };
        // 记录历史
        this.detectionHistory.push(report);
        return report;
    }
    /**
     * 检测进度偏离
     */
    detectScheduleDeviation(plannedState, actualState, threshold) {
        const plannedProgress = this.calculateProgress(plannedState);
        const actualProgress = this.calculateProgress(actualState);
        const deviationDegree = Math.abs(actualProgress - plannedProgress);
        if (deviationDegree < threshold) {
            return null;
        }
        const isBehind = actualProgress < plannedProgress;
        return {
            type: 'schedule_deviation',
            severity: deviationDegree > 0.5 ? 'severe' : deviationDegree > 0.3 ? 'moderate' : 'minor',
            description: isBehind
                ? `进度落后: 预期 ${(plannedProgress * 100).toFixed(1)}%, 实际 ${(actualProgress * 100).toFixed(1)}%`
                : `进度超前: 预期 ${(plannedProgress * 100).toFixed(1)}%, 实际 ${(actualProgress * 100).toFixed(1)}%`,
            plannedValue: plannedProgress,
            actualValue: actualProgress,
            deviationDegree,
            affectedGoals: this.getAffectedGoals(plannedState, actualState),
            suggestions: isBehind
                ? ['增加资源投入', '调整任务优先级', '并行化执行', '分解剩余任务']
                : ['提高质量标准', '增加验证步骤'],
        };
    }
    /**
     * 检测质量偏离
     */
    detectQualityDeviations(plannedQuality, actualQuality, threshold) {
        const deviations = [];
        // 检测总体质量偏离
        const qualityDeviation = Math.abs(plannedQuality.overallQuality - actualQuality.overallQuality);
        if (qualityDeviation >= threshold) {
            deviations.push({
                type: 'quality_deviation',
                severity: qualityDeviation > 0.4 ? 'severe' : qualityDeviation > 0.25 ? 'moderate' : 'minor',
                description: `总体质量偏离: 预期 ${(plannedQuality.overallQuality * 100).toFixed(1)}%, 实际 ${(actualQuality.overallQuality * 100).toFixed(1)}%`,
                plannedValue: plannedQuality.overallQuality,
                actualValue: actualQuality.overallQuality,
                deviationDegree: qualityDeviation,
                affectedGoals: [],
                suggestions: this.generateQualityImprovementSuggestions(actualQuality),
            });
        }
        // 检测成功率偏离
        const successRateDeviation = Math.abs(plannedQuality.taskSuccessRate - actualQuality.taskSuccessRate);
        if (successRateDeviation >= threshold) {
            deviations.push({
                type: 'quality_deviation',
                severity: successRateDeviation > 0.3 ? 'severe' : 'moderate',
                description: `任务成功率偏离: 预期 ${(plannedQuality.taskSuccessRate * 100).toFixed(1)}%, 实际 ${(actualQuality.taskSuccessRate * 100).toFixed(1)}%`,
                plannedValue: plannedQuality.taskSuccessRate,
                actualValue: actualQuality.taskSuccessRate,
                deviationDegree: successRateDeviation,
                affectedGoals: [],
                suggestions: ['分析失败原因', '调整任务难度', '增加资源支持', '改进任务描述'],
            });
        }
        // 检测质量趋势
        if (actualQuality.qualityTrend === 'declining' && qualityDeviation >= threshold * 0.8) {
            deviations.push({
                type: 'quality_deviation',
                severity: 'moderate',
                description: '质量呈下降趋势',
                plannedValue: plannedQuality.overallQuality,
                actualValue: actualQuality.overallQuality,
                deviationDegree: 0.3,
                affectedGoals: [],
                suggestions: ['暂停执行，分析原因', '调整执行策略', '增加质量控制'],
            });
        }
        return deviations;
    }
    /**
     * 检测资源偏离
     */
    detectResourceDeviations(plannedResources, actualResources, threshold) {
        const deviations = [];
        // 检测Token使用偏离
        const tokenDeviation = this.calculateResourceDeviation(plannedResources.tokensUsed, plannedResources.estimatedTokens, actualResources.tokensUsed, actualResources.estimatedTokens);
        if (Math.abs(tokenDeviation) >= threshold) {
            const isOverBudget = tokenDeviation > 0;
            deviations.push({
                type: 'resource_deviation',
                severity: Math.abs(tokenDeviation) > 0.5 ? 'severe' : 'moderate',
                description: `Token使用${isOverBudget ? '超预算' : '低于预期'}: ${(Math.abs(tokenDeviation) * 100).toFixed(1)}%`,
                plannedValue: plannedResources.tokensUsed,
                actualValue: actualResources.tokensUsed,
                deviationDegree: Math.abs(tokenDeviation),
                affectedGoals: [],
                suggestions: isOverBudget
                    ? ['优化提示词', '减少冗余步骤', '使用语义缓存']
                    : ['增加任务深度', '提高输出质量'],
            });
        }
        // 检测时间偏离
        const timeDeviation = this.calculateResourceDeviation(plannedResources.timeElapsed, plannedResources.estimatedTime, actualResources.timeElapsed, actualResources.estimatedTime);
        if (Math.abs(timeDeviation) >= threshold) {
            const isOverTime = timeDeviation > 0;
            deviations.push({
                type: 'resource_deviation',
                severity: Math.abs(timeDeviation) > 0.6 ? 'severe' : 'moderate',
                description: `时间${isOverTime ? '超时' : '提前'}: ${(Math.abs(timeDeviation) * 100).toFixed(1)}%`,
                plannedValue: plannedResources.timeElapsed,
                actualValue: actualResources.timeElapsed,
                deviationDegree: Math.abs(timeDeviation),
                affectedGoals: [],
                suggestions: isOverTime
                    ? ['跳过非关键任务', '降低输出质量', '并行化执行']
                    : ['增加验证步骤', '提高输出质量'],
            });
        }
        return deviations;
    }
    /**
     * 检测依赖偏离
     */
    detectDependencyDeviation(plannedState, actualState) {
        // 检查是否有任务在不满足依赖的情况下执行
        const plannedDeps = plannedState.plan.dependencies;
        const completedGoals = actualState.completedGoals;
        let violatedDeps = 0;
        const affectedGoals = [];
        for (const edge of plannedDeps.edges) {
            const fromCompleted = completedGoals.has(edge.from);
            const toCompleted = completedGoals.has(edge.to);
            // 如果依赖的目标已完成，但被依赖的目标未完成，可能存在依赖违反
            if (toCompleted && !fromCompleted) {
                violatedDeps++;
                affectedGoals.push(edge.to);
            }
        }
        if (violatedDeps === 0) {
            return null;
        }
        return {
            type: 'dependency_deviation',
            severity: violatedDeps > 2 ? 'severe' : 'moderate',
            description: `依赖关系违反: ${violatedDeps}个任务在依赖未满足时执行`,
            plannedValue: 0,
            actualValue: violatedDeps,
            deviationDegree: Math.min(violatedDeps * 0.2, 1.0),
            affectedGoals,
            suggestions: ['重新排序任务', '调整依赖关系', '增加中间检查点'],
        };
    }
    /**
     * 计算总体偏离分数
     */
    calculateOverallDeviationScore(deviations) {
        if (deviations.length === 0) {
            return 0;
        }
        // 加权平均，严重程度高的偏离权重更大
        const weights = {
            minor: 0.3,
            moderate: 0.6,
            severe: 1.0,
        };
        const totalWeight = deviations.reduce((sum, d) => sum + weights[d.severity], 0);
        const weightedSum = deviations.reduce((sum, d) => sum + d.deviationDegree * weights[d.severity], 0);
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
    /**
     * 计算进度
     */
    calculateProgress(state) {
        const totalGoals = state.plan.subGoals.length;
        if (totalGoals === 0) {
            return 1;
        }
        return state.completedGoals.size / totalGoals;
    }
    /**
     * 计算资源偏离
     */
    calculateResourceDeviation(plannedUsed, plannedEstimated, actualUsed, actualEstimated) {
        const plannedRatio = plannedEstimated > 0 ? plannedUsed / plannedEstimated : 0;
        const actualRatio = actualEstimated > 0 ? actualUsed / actualEstimated : 0;
        return actualRatio - plannedRatio;
    }
    /**
     * 获取受影响的子目标
     */
    getAffectedGoals(plannedState, actualState) {
        const behindGoals = [];
        for (const goal of plannedState.plan.subGoals) {
            if (!actualState.completedGoals.has(goal.id)) {
                behindGoals.push(goal.id);
            }
        }
        return behindGoals;
    }
    /**
     * 生成质量改进建议
     */
    generateQualityImprovementSuggestions(quality) {
        const suggestions = [];
        if (quality.taskSuccessRate < 0.8) {
            suggestions.push('分析失败任务模式');
            suggestions.push('增加任务前验证');
        }
        if (quality.averageQuality < 0.7) {
            suggestions.push('提高输出标准');
            suggestions.push('增加质量检查点');
        }
        if (quality.qualityTrend === 'declining') {
            suggestions.push('暂停并分析趋势原因');
            suggestions.push('调整执行策略');
        }
        return suggestions;
    }
    /**
     * 获取历史记录
     */
    getHistory() {
        return [...this.detectionHistory];
    }
    /**
     * 清除历史记录
     */
    clearHistory() {
        this.detectionHistory = [];
    }
    /**
     * 设置基线指标
     */
    setBaselineMetrics(metrics) {
        this.baselineMetrics = new Map(metrics);
    }
    /**
     * 获取基线指标
     */
    getBaselineMetrics() {
        return new Map(this.baselineMetrics);
    }
}
