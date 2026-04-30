/**
 * 工具使用追踪器
 *
 * 追踪工具调用历史，分析性能，提供优化建议
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 工具使用记录
 */
export interface ToolUsageRecord {
  id: string;
  timestamp: Date;
  toolName: string;
  sessionId: string;
  userId?: string;

  // 输入信息
  userInput: string;
  toolParameters: Record<string, unknown>;
  context?: {
    conversationHistory?: Array<{ role: string; content: string }>;
    taskDescription?: string;
  };

  // 执行结果
  result: {
    success: boolean;
    executionTime: number; // 毫秒
    output?: unknown;
    error?: string;
    errorMessage?: string;
  };

  // 元数据
  metadata?: {
    modelUsed?: string;
    promptTokens?: number;
    completionTokens?: number;
    retries?: number;
  };
}

/**
 * 工具性能统计
 */
export interface ToolPerformanceStats {
  toolName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRate: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  lastUsed: Date;
  mostCommonErrors: Array<{ error: string; count: number }>;
  bestUseCases: Array<{ useCase: string; successRate: number }>;
}

/**
 * 工具推荐
 */
export interface ToolRecommendation {
  toolName: string;
  confidence: number;
  reason: string;
  expectedPerformance: {
    successRate?: number;
    avgExecutionTime?: number;
  };
}

/**
 * 工具使用追踪器
 */
export class ToolUsageTracker extends EventEmitter {
  private records: ToolUsageRecord[] = [];
  private statsCache: Map<string, ToolPerformanceStats> = new Map();
  private storagePath: string;
  private config: {
    maxRecords?: number;
    retentionDays?: number;
    autoSave?: boolean;
  } = {};

  constructor(
    storagePathOrConfig?:
      | string
      | { dataDirectory?: string; maxRecords?: number; retentionDays?: number; autoSave?: boolean }
  ) {
    super();

    // 支持两种调用方式：
    // 1. new ToolUsageTracker('/path/to/file.json')
    // 2. new ToolUsageTracker({ dataDirectory: '/path', maxRecords: 100 })
    if (typeof storagePathOrConfig === 'string') {
      this.storagePath = storagePathOrConfig;
    } else if (storagePathOrConfig && typeof storagePathOrConfig === 'object') {
      const config = storagePathOrConfig;
      if (config.dataDirectory) {
        this.storagePath = path.join(config.dataDirectory, 'tool-usage.json');
      } else {
        this.storagePath = path.join(process.cwd(), 'data', 'tool-usage.json');
      }
      this.config = {
        maxRecords: config.maxRecords,
        retentionDays: config.retentionDays,
        autoSave: config.autoSave,
      };
    } else {
      this.storagePath = path.join(process.cwd(), 'data', 'tool-usage.json');
    }

    this.loadRecords();
  }

  /**
   * 记录工具调用
   */
  recordUsage(record: ToolUsageRecord) {
    // 生成ID
    if (!record.id) {
      record.id = this.generateId();
    }

    // 设置时间戳
    if (!record.timestamp) {
      record.timestamp = new Date();
    }

    // 添加记录
    this.records.push(record);

    // 更新缓存
    this.updateStatsCache(record.toolName);

    // 持久化（如果启用）
    if (this.config.autoSave !== false) {
      this.saveRecords();
    }

    // 触发事件
    this.emit('tool:called', record);

    return record.id;
  }

  /**
   * 获取工具性能统计
   */
  getPerformanceStats(toolName: string): ToolPerformanceStats {
    // 从缓存获取
    if (this.statsCache.has(toolName)) {
      return this.statsCache.get(toolName)!;
    }

    // 计算统计
    const toolRecords = this.records.filter((r) => r.toolName === toolName);

    if (toolRecords.length === 0) {
      return {
        toolName,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        successRate: 0,
        avgExecutionTime: 0,
        minExecutionTime: 0,
        maxExecutionTime: 0,
        lastUsed: new Date(),
        mostCommonErrors: [],
        bestUseCases: [],
      };
    }

    const successfulRecords = toolRecords.filter((r) => r.result.success);
    const failedRecords = toolRecords.filter((r) => !r.result.success);

    const executionTimes = toolRecords.map((r) => r.result.executionTime);

    // 统计错误
    const errorCounts = new Map<string, number>();
    for (const record of failedRecords) {
      const error = record.result.error || record.result.errorMessage || 'Unknown error';
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    }

    const mostCommonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 分析最佳用例
    const useCaseStats = new Map<string, { success: number; total: number }>();
    for (const record of toolRecords) {
      const useCase = this.extractUseCase(record.userInput);
      if (!useCaseStats.has(useCase)) {
        useCaseStats.set(useCase, { success: 0, total: 0 });
      }
      const stats = useCaseStats.get(useCase)!;
      stats.total++;
      if (record.result.success) {
        stats.success++;
      }
    }

    const bestUseCases = Array.from(useCaseStats.entries())
      .map(([useCase, stats]) => ({
        useCase,
        successRate: stats.total > 0 ? stats.success / stats.total : 0,
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    const stats: ToolPerformanceStats = {
      toolName,
      totalCalls: toolRecords.length,
      successfulCalls: successfulRecords.length,
      failedCalls: failedRecords.length,
      successRate: successfulRecords.length / toolRecords.length,
      avgExecutionTime: executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length,
      minExecutionTime: Math.min(...executionTimes),
      maxExecutionTime: Math.max(...executionTimes),
      lastUsed: toolRecords[toolRecords.length - 1].timestamp,
      mostCommonErrors,
      bestUseCases,
    };

    // 缓存结果
    this.statsCache.set(toolName, stats);

    return stats;
  }

  /**
   * 获取所有工具的性能统计
   */
  getAllPerformanceStats(): Map<string, ToolPerformanceStats> {
    const toolNames = new Set(this.records.map((r) => r.toolName));

    for (const toolName of toolNames) {
      if (!this.statsCache.has(toolName)) {
        this.getPerformanceStats(toolName);
      }
    }

    return this.statsCache;
  }

  /**
   * 获取工具推荐
   */
  getRecommendations(userInput: string, availableTools: string[]): ToolRecommendation[] {
    const recommendations: ToolRecommendation[] = [];
    const inputLower = userInput.toLowerCase();

    for (const toolName of availableTools) {
      const stats = this.getPerformanceStats(toolName);

      // 过滤掉没有使用记录的工具
      if (stats.totalCalls === 0) {
        continue;
      }

      // 计算匹配度
      let relevance = 0;

      // 基于历史用例匹配
      for (const useCase of stats.bestUseCases) {
        if (this.isUseCaseMatch(useCase.useCase, inputLower)) {
          relevance = Math.max(relevance, useCase.successRate);
        }
      }

      // 基于工具名称匹配
      if (
        inputLower.includes(toolName.toLowerCase()) ||
        toolName.toLowerCase().includes(inputLower)
      ) {
        relevance = Math.max(relevance, 0.5);
      }

      // 只推荐高相关度的工具
      if (relevance > 0.3) {
        recommendations.push({
          toolName,
          confidence: relevance,
          reason: this.generateRecommendationReason(toolName, stats),
          expectedPerformance: {
            successRate: stats.successRate,
            avgExecutionTime: stats.avgExecutionTime,
          },
        });
      }
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 获取使用趋势
   */
  getUsageTrends(toolName: string, days: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentRecords = this.records.filter(
      (r) => r.toolName === toolName && r.timestamp >= cutoffDate
    );

    const dailyUsage = new Map<number, number>();

    for (const record of recentRecords) {
      const day = Math.floor(record.timestamp.getTime() / (1000 * 60 * 60 * 24));
      dailyUsage.set(day, (dailyUsage.get(day) || 0) + 1);
    }

    return {
      toolName,
      period: `${days}天`,
      totalCalls: recentRecords.length,
      dailyAverage: recentRecords.length / days,
      dailyUsage: Array.from(dailyUsage.entries()).map(([day, count]) => ({
        date: new Date(day * 1000 * 60 * 60 * 24),
        count,
      })),
    };
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): string {
    const allStats = this.getAllPerformanceStats();
    const lines: string[] = [];

    lines.push('# 工具性能报告\n');
    lines.push(`生成时间：${new Date().toLocaleString()}\n`);
    lines.push(`总记录数：${this.records.length}\n`);

    // 按工具分组
    const byCategory = this.groupToolsByCategory(allStats);

    for (const [category, tools] of byCategory) {
      lines.push(`## ${category}\n`);

      for (const stats of tools) {
        lines.push(`### ${stats.toolName}\n`);
        lines.push(`- 总调用次数：${stats.totalCalls}`);
        lines.push(`- 成功次数：${stats.successfulCalls}`);
        lines.push(`- 失败次数：${stats.failedCalls}`);
        lines.push(`- 成功率：${(stats.successRate * 100).toFixed(1)}%`);
        lines.push(`- 平均执行时间：${stats.avgExecutionTime.toFixed(0)}ms`);
        lines.push(`- 最后使用：${stats.lastUsed.toLocaleString()}`);

        if (stats.mostCommonErrors.length > 0) {
          lines.push(`\n**常见错误**：`);
          stats.mostCommonErrors.forEach((err) => {
            lines.push(`  - ${err.error} (${err.count}次)`);
          });
        }

        if (stats.bestUseCases.length > 0) {
          lines.push(`\n**最佳用例**：`);
          stats.bestUseCases.forEach((uc) => {
            lines.push(`  - ${uc.useCase} (成功率：${(uc.successRate * 100).toFixed(0)}%)`);
          });
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * 分析工具选择准确性
   */
  analyzeSelectionAccuracy(): {
    accuracy: number;
    improvements: string[];
  } {
    const _correctSelections = 0; // 保留用于未来实现准确选择统计
    const totalSelections = this.records.length;
    const improvements: string[] = [];

    // 分析重试记录
    const retries = this.records.filter((r) => r.metadata?.retries && r.metadata.retries > 0);

    if (retries.length > 0) {
      const retryRate = retries.length / totalSelections;
      improvements.push(`${(retryRate * 100).toFixed(1)}%的操作需要重试，建议优化工具选择策略`);
    }

    // 分析失败率
    const failed = this.records.filter((r) => !r.result.success);
    if (failed.length > 0) {
      const failureRate = failed.length / totalSelections;
      if (failureRate > 0.2) {
        improvements.push(
          `失败率较高(${(failureRate * 100).toFixed(1)}%)，建议加强参数验证和错误处理`
        );
      }
    }

    // 分析执行时间
    const slowOperations = this.records.filter((r) => r.result.executionTime > 5000);
    if (slowOperations.length > 0) {
      improvements.push(
        `${slowOperations.length}个操作执行时间超过5秒，建议优化性能或使用异步处理`
      );
    }

    // 计算准确性（成功率）
    const accuracy = totalSelections > 0 ? (totalSelections - failed.length) / totalSelections : 0;

    if (accuracy < 0.9) {
      improvements.push(`选择准确率较低(${(accuracy * 100).toFixed(1)}%)，建议优化工具匹配策略`);
    }

    return {
      accuracy,
      improvements,
    };
  }

  // ==================== 私有方法 ====================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractUseCase(userInput: string): string {
    const input = userInput.toLowerCase();

    if (input.includes('pdf') && input.includes('markdown')) return 'PDF转Markdown';
    if (input.includes('pdf') && input.includes('文本')) return 'PDF文本提取';
    if (input.includes('excel') && input.includes('json')) return 'Excel转JSON';
    if (input.includes('网页') && input.includes('截图')) return '网页截图';
    if (input.includes('图片') && input.includes('文字')) return '图片OCR';
    if (input.includes('音频') && input.includes('文字')) return '音频转写';

    return '通用处理';
  }

  private isUseCaseMatch(useCase: string, userInput: string): boolean {
    const useCaseLower = useCase.toLowerCase();
    if (userInput.includes(useCaseLower) || useCaseLower.includes(userInput)) {
      return true;
    }
    // 关键词匹配
    const extractTokens = (s: string): string[] => {
      const chinese = s.match(/[\u4e00-\u9fa5]{2,}/g) || [];
      const english = s.match(/[a-z]+/g) || [];
      return [...chinese, ...english];
    };
    const useCaseTokens = extractTokens(useCaseLower);
    const inputTokens = extractTokens(userInput);
    return useCaseTokens.some((t) => inputTokens.includes(t));
  }

  private generateRecommendationReason(toolName: string, stats: ToolPerformanceStats): string {
    const reasons = [];

    if (stats.successRate > 0.9) {
      reasons.push(`历史成功率${(stats.successRate * 100).toFixed(0)}%`);
    }

    if (stats.avgExecutionTime < 1000) {
      reasons.push(`平均执行时间${stats.avgExecutionTime.toFixed(0)}ms`);
    }

    if (stats.totalCalls > 10) {
      reasons.push(`已被使用${stats.totalCalls}次`);
    }

    return reasons.join('，') || '基于历史使用数据推荐';
  }

  private groupToolsByCategory(
    stats: Map<string, ToolPerformanceStats>
  ): Map<string, ToolPerformanceStats[]> {
    const grouped = new Map<string, ToolPerformanceStats[]>();

    for (const stat of stats.values()) {
      const category = this.inferCategory(stat.toolName);

      if (!grouped.has(category)) {
        grouped.set(category, []);
      }

      grouped.get(category)!.push(stat);
    }

    return grouped;
  }

  private inferCategory(toolName: string): string {
    const name = toolName.toLowerCase();

    if (name.includes('pdf') || name.includes('docx') || name.includes('excel')) {
      return '文档工具';
    }

    if (name.includes('web')) {
      return '浏览器工具';
    }

    if (name.includes('ocr') || name.includes('image')) {
      return 'OCR工具';
    }

    if (name.includes('audio') || name.includes('transcribe')) {
      return '音频工具';
    }

    return '其他工具';
  }

  private updateStatsCache(toolName: string) {
    // 清除缓存以便重新计算
    this.statsCache.delete(toolName);
  }

  /**
   * 保存记录到文件
   */
  private saveRecords() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.storagePath,
        JSON.stringify(this.records.slice(-1000), null, 2), // 只保存最近1000条
        'utf-8'
      );
    } catch (error) {
      console.error('保存工具使用记录失败:', error);
    }
  }

  /**
   * 从文件加载记录
   */
  private loadRecords() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        this.records = JSON.parse(data);

        // 恢复日期对象
        for (const record of this.records) {
          record.timestamp = new Date(record.timestamp);
        }
      }
    } catch (error) {
      console.error('加载工具使用记录失败:', error);
      this.records = [];
    }
  }

  /**
   * 清理旧记录
   */
  cleanup(daysToKeep: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const beforeCount = this.records.length;
    this.records = this.records.filter((r) => r.timestamp >= cutoffDate);

    const cleanedCount = beforeCount - this.records.length;

    if (cleanedCount > 0) {
      this.saveRecords();
      this.emit('records:cleaned', { cleanedCount, remainingCount: this.records.length });
    }

    return cleanedCount;
  }

  /**
   * 清理旧数据（别名方法）
   */
  cleanupOldData(daysToKeep?: number) {
    return this.cleanup(daysToKeep);
  }

  /**
   * 设置自动保存开关
   */
  setAutoSave(enabled: boolean) {
    this.config.autoSave = enabled;
  }

  /**
   * 清空所有记录（用于测试）
   */
  clear() {
    this.records = [];
    this.statsCache.clear();
    try {
      if (fs.existsSync(this.storagePath)) {
        fs.unlinkSync(this.storagePath);
      }
    } catch (error) {
      // 忽略文件删除错误
    }
  }

  /**
   * 保存数据到文件
   */
  async saveData() {
    this.saveRecords();
  }

  /**
   * 从文件加载数据
   */
  async loadData() {
    this.loadRecords();
  }
}

// 导出单例
export const toolUsageTracker = new ToolUsageTracker();
