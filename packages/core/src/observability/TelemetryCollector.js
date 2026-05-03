/**
 * 遥测收集器 - 可观测性核心实现
 *
 * 功能：
 * 1. 事件记录 - 记录所有智能体和系统事件
 * 2. 实时告警 - 监控慢执行、失败率、错误激增
 * 3. 指标聚合 - 计算成功率、平均延迟等
 * 4. 错误追踪 - 追踪 Top N 错误
 */
import { EventStatus, AlertType, AlertSeverity, } from './types.js';
export class TelemetryCollector {
    events = [];
    errors = new Map();
    alerts = [];
    agentMetrics = new Map();
    stageMetrics = new Map();
    config;
    alertIdCounter = 0;
    eventIdCounter = 0;
    constructor(config = {}) {
        this.config = {
            maxEvents: config.maxEvents ?? 10000,
            maxErrors: config.maxErrors ?? 100,
            retentionPeriod: config.retentionPeriod ?? 24 * 60 * 60 * 1000, // 24小时
            alertConfig: {
                slowExecutionThreshold: config.alertConfig?.slowExecutionThreshold ?? 5000, // 5秒
                highFailureRateThreshold: config.alertConfig?.highFailureRateThreshold ?? 0.5, // 50%
                errorSpikeThreshold: config.alertConfig?.errorSpikeThreshold ?? 10,
                enableAlerts: config.alertConfig?.enableAlerts ?? true,
            },
        };
    }
    /**
     * 记录遥测事件
     */
    record(event) {
        // 分配唯一ID
        if (!event.id) {
            event.id = `evt_${++this.eventIdCounter}`;
        }
        // 确保时间戳
        if (!event.timestamp) {
            event.timestamp = Date.now();
        }
        // 清理过期事件
        this.cleanup();
        // 存储事件
        this.events.push(event);
        // 限制事件数量
        if (this.events.length > this.config.maxEvents) {
            this.events.shift();
        }
        // 更新指标
        this.updateMetrics(event);
        // 追踪错误
        if (event.status === EventStatus.FAILURE && event.error) {
            this.trackError(event);
        }
        // 触发告警
        if (this.config.alertConfig.enableAlerts) {
            this.checkAlerts(event);
        }
    }
    /**
     * 获取遥测报告
     */
    getReport() {
        const now = Date.now();
        const oldestEvent = this.events[0];
        const start = oldestEvent?.timestamp ?? now;
        // 计算汇总指标
        const totalEvents = this.events.length;
        const successEvents = this.events.filter((e) => e.status === EventStatus.SUCCESS).length;
        const failedEvents = this.events.filter((e) => e.status === EventStatus.FAILURE).length;
        const durations = this.events.filter((e) => e.duration !== undefined).map((e) => e.duration);
        const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        return {
            period: {
                start,
                end: now,
            },
            summary: {
                totalEvents,
                successEvents,
                failedEvents,
                successRate: totalEvents > 0 ? successEvents / totalEvents : 0,
                avgDuration,
            },
            byAgent: this.agentMetrics,
            byStage: this.stageMetrics,
            topErrors: this.getTopErrors(10),
            alerts: [...this.alerts],
        };
    }
    /**
     * 打印可读报告
     */
    printReport() {
        const report = this.getReport();
        console.log('\n========== 遥测报告 ==========');
        console.log(`时间范围: ${new Date(report.period.start).toLocaleString()} - ${new Date(report.period.end).toLocaleString()}`);
        console.log('\n--- 汇总 ---');
        console.log(`总事件数: ${report.summary.totalEvents}`);
        console.log(`成功事件: ${report.summary.successEvents}`);
        console.log(`失败事件: ${report.summary.failedEvents}`);
        console.log(`成功率: ${(report.summary.successRate * 100).toFixed(2)}%`);
        console.log(`平均延迟: ${report.summary.avgDuration.toFixed(2)}ms`);
        console.log('\n--- 智能体指标 ---');
        report.byAgent.forEach((metrics, agentName) => {
            console.log(`\n${agentName}:`);
            console.log(`  执行次数: ${metrics.totalExecutions}`);
            console.log(`  成功率: ${(metrics.successRate * 100).toFixed(2)}%`);
            console.log(`  平均延迟: ${metrics.avgDuration.toFixed(2)}ms`);
            console.log(`  延迟范围: ${metrics.minDuration.toFixed(2)}ms - ${metrics.maxDuration.toFixed(2)}ms`);
        });
        console.log('\n--- 阶段指标 ---');
        report.byStage.forEach((metrics, stage) => {
            console.log(`\n${stage}:`);
            console.log(`  执行次数: ${metrics.totalExecutions}`);
            console.log(`  成功率: ${(metrics.successRate * 100).toFixed(2)}%`);
            console.log(`  平均延迟: ${metrics.avgDuration.toFixed(2)}ms`);
        });
        if (report.topErrors.length > 0) {
            console.log('\n--- Top 错误 ---');
            report.topErrors.forEach((error, index) => {
                console.log(`\n${index + 1}. ${error.error}`);
                console.log(`   次数: ${error.count}`);
                console.log(`   最后发生: ${new Date(error.lastOccurrence).toLocaleString()}`);
                console.log(`   影响智能体: ${error.affectedAgents.join(', ')}`);
            });
        }
        if (report.alerts.length > 0) {
            console.log('\n--- 告警 ---');
            report.alerts.forEach((alert) => {
                console.log(`\n[${alert.severity.toUpperCase()}] ${alert.message}`);
                console.log(`  类型: ${alert.type}`);
                console.log(`  时间: ${new Date(alert.timestamp).toLocaleString()}`);
                if (alert.threshold !== undefined && alert.actualValue !== undefined) {
                    console.log(`  阈值: ${alert.threshold}, 实际: ${alert.actualValue}`);
                }
            });
        }
        console.log('\n============================\n');
    }
    /**
     * 触发告警
     */
    alert(type, event) {
        const alertType = type;
        const alert = {
            id: `alert_${++this.alertIdCounter}`,
            type: alertType,
            severity: this.getAlertSeverity(alertType),
            message: this.getAlertMessage(alertType, event),
            timestamp: Date.now(),
            event,
        };
        this.alerts.push(alert);
        // 限制告警数量
        if (this.alerts.length > 100) {
            this.alerts.shift();
        }
        // 打印告警
        console.warn(`[告警] ${alert.message}`);
    }
    /**
     * 清除所有数据
     */
    clear() {
        this.events = [];
        this.errors.clear();
        this.alerts = [];
        this.agentMetrics.clear();
        this.stageMetrics.clear();
    }
    /**
     * 获取特定智能体的事件
     */
    getEventsByAgent(agentName) {
        return this.events.filter((e) => e.agentName === agentName);
    }
    /**
     * 获取特定类型的事件
     */
    getEventsByType(type) {
        return this.events.filter((e) => e.type === type);
    }
    /**
     * 获取最近的失败事件
     */
    getRecentFailures(limit = 10) {
        return this.events
            .filter((e) => e.status === EventStatus.FAILURE)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }
    // ========== 私有方法 ==========
    /**
     * 清理过期事件
     */
    cleanup() {
        const cutoff = Date.now() - this.config.retentionPeriod;
        // 清理事件
        this.events = this.events.filter((e) => e.timestamp > cutoff);
        // 清理错误指标
        for (const [key, error] of this.errors.entries()) {
            if (error.lastOccurrence < cutoff) {
                this.errors.delete(key);
            }
        }
        // 清理告警
        this.alerts = this.alerts.filter((a) => a.timestamp > cutoff);
    }
    /**
     * 更新指标
     */
    updateMetrics(event) {
        // 更新智能体指标
        if (event.agentName) {
            let metrics = this.agentMetrics.get(event.agentName);
            if (!metrics) {
                metrics = this.createAgentMetrics(event.agentName);
                this.agentMetrics.set(event.agentName, metrics);
            }
            this.updateAgentMetrics(metrics, event);
        }
        // 更新阶段指标
        if (event.stage) {
            let metrics = this.stageMetrics.get(event.stage);
            if (!metrics) {
                metrics = this.createStageMetrics(event.stage);
                this.stageMetrics.set(event.stage, metrics);
            }
            this.updateStageMetrics(metrics, event);
        }
    }
    /**
     * 创建智能体指标
     */
    createAgentMetrics(agentName) {
        return {
            agentName,
            totalExecutions: 0,
            successCount: 0,
            failureCount: 0,
            successRate: 0,
            avgDuration: 0,
            minDuration: Infinity,
            maxDuration: 0,
        };
    }
    /**
     * 更新智能体指标
     */
    updateAgentMetrics(metrics, event) {
        metrics.totalExecutions++;
        if (event.status === EventStatus.SUCCESS) {
            metrics.successCount++;
        }
        else if (event.status === EventStatus.FAILURE) {
            metrics.failureCount++;
        }
        metrics.successRate = metrics.successCount / metrics.totalExecutions;
        if (event.duration !== undefined) {
            // 更新平均延迟
            const totalDuration = metrics.avgDuration * (metrics.totalExecutions - 1) + event.duration;
            metrics.avgDuration = totalDuration / metrics.totalExecutions;
            // 更新最小/最大延迟
            metrics.minDuration = Math.min(metrics.minDuration, event.duration);
            metrics.maxDuration = Math.max(metrics.maxDuration, event.duration);
        }
        else {
            // 如果没有 duration，重置 minDuration
            if (metrics.minDuration === Infinity) {
                metrics.minDuration = 0;
            }
        }
    }
    /**
     * 创建阶段指标
     */
    createStageMetrics(stage) {
        return {
            stage,
            totalExecutions: 0,
            successCount: 0,
            failureCount: 0,
            successRate: 0,
            avgDuration: 0,
        };
    }
    /**
     * 更新阶段指标
     */
    updateStageMetrics(metrics, event) {
        metrics.totalExecutions++;
        if (event.status === EventStatus.SUCCESS) {
            metrics.successCount++;
        }
        else if (event.status === EventStatus.FAILURE) {
            metrics.failureCount++;
        }
        metrics.successRate =
            metrics.totalExecutions > 0 ? metrics.successCount / metrics.totalExecutions : 0;
        if (event.duration !== undefined) {
            const totalDuration = metrics.avgDuration * (metrics.totalExecutions - 1) + event.duration;
            metrics.avgDuration = totalDuration / metrics.totalExecutions;
        }
    }
    /**
     * 追踪错误
     */
    trackError(event) {
        if (!event.error)
            return;
        const errorKey = event.error.message || 'Unknown Error';
        let errorMetric = this.errors.get(errorKey);
        if (!errorMetric) {
            errorMetric = {
                error: errorKey,
                count: 0,
                lastOccurrence: 0,
                affectedAgents: [],
            };
            this.errors.set(errorKey, errorMetric);
        }
        errorMetric.count++;
        errorMetric.lastOccurrence = event.timestamp;
        if (event.agentName && !errorMetric.affectedAgents.includes(event.agentName)) {
            errorMetric.affectedAgents.push(event.agentName);
        }
        // 限制错误数量
        if (this.errors.size > this.config.maxErrors) {
            const oldestKey = [...this.errors.entries()].sort((a, b) => a[1].lastOccurrence - b[1].lastOccurrence)[0][0];
            this.errors.delete(oldestKey);
        }
    }
    /**
     * 获取 Top N 错误
     */
    getTopErrors(n) {
        return [...this.errors.values()].sort((a, b) => b.count - a.count).slice(0, n);
    }
    /**
     * 检查告警条件
     */
    checkAlerts(event) {
        // 慢执行告警
        if (event.duration !== undefined &&
            event.duration > this.config.alertConfig.slowExecutionThreshold) {
            this.alert(AlertType.SLOW_EXECUTION, event);
        }
        // 高失败率告警
        if (event.agentName) {
            const metrics = this.agentMetrics.get(event.agentName);
            if (metrics &&
                metrics.totalExecutions >= 10 &&
                metrics.successRate < this.config.alertConfig.highFailureRateThreshold) {
                this.alert(AlertType.HIGH_FAILURE_RATE, event);
            }
        }
        // 错误激增告警
        const recentErrors = this.getRecentFailures(10);
        if (recentErrors.length >= this.config.alertConfig.errorSpikeThreshold) {
            this.alert(AlertType.ERROR_SPIKE, event);
        }
    }
    /**
     * 获取告警严重级别
     */
    getAlertSeverity(type) {
        switch (type) {
            case AlertType.SLOW_EXECUTION:
                return AlertSeverity.WARNING;
            case AlertType.HIGH_FAILURE_RATE:
                return AlertSeverity.ERROR;
            case AlertType.ERROR_SPIKE:
                return AlertSeverity.CRITICAL;
            case AlertType.MEMORY_LEAK:
                return AlertSeverity.CRITICAL;
            default:
                return AlertSeverity.INFO;
        }
    }
    /**
     * 获取告警消息
     */
    getAlertMessage(type, event) {
        const agent = event.agentName || 'Unknown';
        const stage = event.stage || '';
        switch (type) {
            case AlertType.SLOW_EXECUTION:
                return `慢执行检测: ${agent}${stage ? ` (${stage})` : ''} 耗时 ${event.duration}ms`;
            case AlertType.HIGH_FAILURE_RATE:
                return `高失败率: ${agent} 失败率超过 ${this.config.alertConfig.highFailureRateThreshold * 100}%`;
            case AlertType.ERROR_SPIKE:
                return `错误激增: 最近检测到 ${this.config.alertConfig.errorSpikeThreshold}+ 个错误`;
            case AlertType.MEMORY_LEAK:
                return `内存泄漏警告: ${agent} 内存使用异常`;
            default:
                return `未知告警类型: ${type}`;
        }
    }
}
