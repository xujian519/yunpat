/**
 * 人机协同审批流程 (Human-in-the-Loop Approval Flow)
 *
 * 实现用户反馈循环机制，核心功能：
 * 1. 审批请求生成（清晰展示结果、标注疑点）
 * 2. 多模式审批（CLI交互、HTTP API、WebSocket）
 * 3. 反馈收集（修正、补充、拒绝）
 * 4. 反馈学习（更新模板、调整策略）
 */

import { v4 as uuidv4 } from 'uuid';
import readline from 'readline';
import type { ExecutionContext } from '../lifecycle/Lifecycle.js';
import type { EventBus } from '../eventbus/EventBus.js';
import { HttpApprovalServer } from './http/HttpApprovalServer.js';
import type { ApprovalRequest } from './Gateway.js';

/**
 * 审批响应
 */
export interface ApprovalResponse {
  /** 审批ID */
  approvalId: string;

  /** 是否批准 */
  approved: boolean;

  /** 用户反馈 */
  feedback?: UserFeedback;

  /** 审批时间 */
  timestamp: Date;
}

/**
 * 用户反馈
 */
export interface UserFeedback {
  /** 反馈类型 */
  type: 'approve' | 'correct' | 'reject' | 'supplement';

  /** 反馈内容 */
  content: string;

  /** 修正数据（当type=correct时） */
  corrections?: Record<string, unknown>;

  /** 补充信息（当type=supplement时） */
  supplements?: Record<string, unknown>;

  /** 拒绝原因（当type=reject时） */
  rejectionReason?: string;

  /** 反馈时间 */
  timestamp: Date;

  /** 用户ID */
  userId?: string;
}

/**
 * 展示选项
 */
export interface PresentationOptions {
  /** 展示格式 */
  format: 'json' | 'table' | 'summary';

  /** 是否标注疑点 */
  highlightConcerns: boolean;

  /** 疑点列表 */
  concerns?: string[];

  /** 自定义消息 */
  message?: string;
}

/**
 * 审批模式
 */
export enum ApprovalMode {
  /** CLI交互模式 */
  CLI = 'cli',

  /** HTTP API模式 */
  HTTP = 'http',

  /** WebSocket模式 */
  WEBSOCKET = 'websocket',
}

/**
 * 审批配置
 */
export interface ApprovalFlowConfig {
  /** 审批模式 */
  mode: ApprovalMode;

  /** 默认超时时间（毫秒） */
  defaultTimeout: number;

  /** 是否启用反馈学习 */
  enableLearning: boolean;

  /** 反馈存储路径（可选） */
  feedbackStorePath?: string;

  /** HTTP 服务器配置（HTTP 模式时需要） */
  httpServerConfig?: {
    port: number;
    host?: string;
    apiPrefix?: string;
    corsOrigin?: string | string[];
    apiKey?: string;
  };
}

/**
 * 反馈统计
 */
export interface FeedbackStats {
  /** 总审批次数 */
  totalApprovals: number;

  /** 批准次数 */
  approvedCount: number;

  /** 拒绝次数 */
  rejectedCount: number;

  /** 修正次数 */
  correctedCount: number;

  /** 补充次数 */
  supplementedCount: number;

  /** 准确率 */
  accuracy: number;
}

/**
 * 审批流程实现
 */
export class ApprovalFlow {
  private config: ApprovalFlowConfig;
  private eventBus?: EventBus;
  private feedbackHistory: Map<string, UserFeedback[]> = new Map();
  private stats: FeedbackStats = {
    totalApprovals: 0,
    approvedCount: 0,
    rejectedCount: 0,
    correctedCount: 0,
    supplementedCount: 0,
    accuracy: 0,
  };
  private httpServer?: HttpApprovalServer;

  constructor(config: ApprovalFlowConfig, eventBus?: EventBus) {
    this.config = config;
    this.eventBus = eventBus;

    // 初始化 HTTP 服务器（如果配置了）
    if (config.mode === ApprovalMode.HTTP && config.httpServerConfig) {
      this.httpServer = new HttpApprovalServer(config.httpServerConfig);
    }
  }

  /**
   * 启动审批流程（启动必要的服务）
   */
  async start(): Promise<void> {
    if (this.httpServer) {
      await this.httpServer.start();
    }
  }

  /**
   * 停止审批流程（清理资源）
   */
  async stop(): Promise<void> {
    if (this.httpServer) {
      await this.httpServer.stop();
    }
  }

  /**
   * 请求审批
   *
   * @param result 结果数据
   * @param context 执行上下文
   * @param timeout 超时时间
   * @returns 审批响应
   */
  async requestApproval(
    result: unknown,
    context: ExecutionContext,
    timeout?: number
  ): Promise<ApprovalResponse> {
    const approvalId = uuidv4();
    const effectiveTimeout = timeout ?? this.config.defaultTimeout;

    // 发送审批请求事件
    if (this.eventBus) {
      this.eventBus.publish({
        type: 'approval:request',
        source: context.agentName,
        data: {
          approvalId,
          result,
          context: {
            agentName: context.agentName,
            executionId: context.executionId,
          },
        },
        timestamp: new Date(),
      });
    }

    // 根据模式选择审批方式
    let response: ApprovalResponse;

    switch (this.config.mode) {
      case ApprovalMode.CLI:
        response = await this.cliApproval(approvalId, result, context, effectiveTimeout);
        break;

      case ApprovalMode.HTTP:
        response = await this.httpApproval(approvalId, result, context, effectiveTimeout);
        break;

      case ApprovalMode.WEBSOCKET:
        response = await this.websocketApproval(approvalId, result, context, effectiveTimeout);
        break;

      default:
        throw new Error(`不支持的审批模式: ${this.config.mode}`);
    }

    // 更新统计
    this.updateStats(response);

    // 发送审批完成事件
    if (this.eventBus) {
      this.eventBus.publish({
        type: 'approval:completed',
        source: context.agentName,
        data: {
          approvalId,
          response,
        },
        timestamp: new Date(),
      });
    }

    return response;
  }

  /**
   * 展示结果供审批
   *
   * @param result 结果数据
   * @param options 展示选项
   */
  async presentForApproval(result: unknown, options: PresentationOptions): Promise<void> {
    const { format, highlightConcerns, concerns, message } = options;

    // 打印自定义消息
    if (message) {
      console.log(`\n${message}\n`);
    }

    // 根据格式展示结果
    switch (format) {
      case 'json':
        console.log(JSON.stringify(result, null, 2));
        break;

      case 'table':
        this.presentAsTable(result);
        break;

      case 'summary':
        this.presentAsSummary(result);
        break;
    }

    // 标注疑点
    if (highlightConcerns && concerns && concerns.length > 0) {
      console.log('\n⚠️  疑点标注:');
      concerns.forEach((concern, index) => {
        console.log(`  ${index + 1}. ${concern}`);
      });
      console.log('');
    }
  }

  /**
   * 收集反馈
   *
   * @param approvalId 审批ID
   * @returns 用户反馈
   */
  async collectFeedback(approvalId: string): Promise<UserFeedback> {
    // 根据模式收集反馈
    switch (this.config.mode) {
      case ApprovalMode.CLI:
        return await this.collectCliFeedback(approvalId);

      case ApprovalMode.HTTP:
        return await this.collectHttpFeedback(approvalId);

      case ApprovalMode.WEBSOCKET:
        return await this.collectWebSocketFeedback(approvalId);

      default:
        throw new Error(`不支持的审批模式: ${this.config.mode}`);
    }
  }

  /**
   * 从反馈中学习
   *
   * @param feedback 用户反馈
   */
  async learnFromFeedback(feedback: UserFeedback): Promise<void> {
    if (!this.config.enableLearning) {
      return;
    }

    // 存储反馈历史
    const key = `${feedback.type}_${feedback.timestamp.getTime()}`;
    if (!this.feedbackHistory.has(key)) {
      this.feedbackHistory.set(key, []);
    }
    this.feedbackHistory.get(key)!.push(feedback);

    // TODO: 集成PromptTemplate更新
    // 这里可以：
    // 1. 分析反馈模式
    // 2. 更新prompt模板
    // 3. 调整推理策略

    console.log(`[反馈学习] 收到${feedback.type}类型反馈`);
    console.log(`[反馈学习] 当前反馈总数: ${this.feedbackHistory.size}`);
  }

  /**
   * 获取统计信息
   *
   * @returns 反馈统计
   */
  getStats(): FeedbackStats {
    return { ...this.stats };
  }

  /**
   * CLI审批模式
   */
  private async cliApproval(
    approvalId: string,
    result: unknown,
    context: ExecutionContext,
    timeout: number
  ): Promise<ApprovalResponse> {
    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const timer = setTimeout(() => {
        rl.close();
        reject(new Error(`审批超时: ${approvalId}`));
      }, timeout);

      // 展示结果
      this.presentForApproval(result, {
        format: 'summary',
        highlightConcerns: true,
        concerns: this.analyzeConcerns(result),
        message: `📋 审批请求 [${context.agentName}]`,
      });

      // 询问审批
      rl.question('\n是否批准? (y/n/c=修正/s=补充): ', (answer) => {
        clearTimeout(timer);

        const approved = answer.toLowerCase() === 'y';
        const feedback: UserFeedback = {
          type: approved
            ? 'approve'
            : answer === 'c'
              ? 'correct'
              : answer === 's'
                ? 'supplement'
                : 'reject',
          content: answer,
          timestamp: new Date(),
        };

        // 收集详细反馈
        if (!approved) {
          rl.question('请说明原因/修正内容: ', (detail) => {
            feedback.content = detail;

            if (answer.toLowerCase() === 'c') {
              feedback.corrections = { detail };
            } else if (answer.toLowerCase() === 'r') {
              feedback.rejectionReason = detail;
            } else if (answer.toLowerCase() === 's') {
              feedback.supplements = { detail };
            }

            rl.close();

            // 学习反馈
            this.learnFromFeedback(feedback);

            resolve({
              approvalId,
              approved,
              feedback,
              timestamp: new Date(),
            });
          });
        } else {
          rl.close();
          this.learnFromFeedback(feedback);

          resolve({
            approvalId,
            approved: true,
            feedback,
            timestamp: new Date(),
          });
        }
      });
    });
  }

  /**
   * HTTP审批模式
   */
  private async httpApproval(
    approvalId: string,
    result: unknown,
    context: ExecutionContext,
    timeout: number
  ): Promise<ApprovalResponse> {
    if (!this.httpServer) {
      throw new Error('HTTP server not configured');
    }

    // 构建审批请求
    const request: ApprovalRequest = {
      requestId: approvalId,
      agentName: context.agentName,
      content: {
        type: 'output',
        data: result,
      },
      context: {
        goal: context.executionId,
        reasoning: 'Pending approval via HTTP API',
        alternatives: [],
      },
      timeout,
      level: 'info',
    };

    // 通过 HTTP 服务器请求审批
    return await this.httpServer.requestApproval(request, context, timeout);
  }

  /**
   * WebSocket审批模式（预留接口）
   */
  private async websocketApproval(
    _approvalId: string,
    _result: unknown,
    _context: ExecutionContext,
    _timeout: number
  ): Promise<ApprovalResponse> {
    // TODO: 实现WebSocket连接
    // 返回默认批准（实际应该等待WebSocket消息）
    return {
      approvalId: _approvalId,
      approved: true,
      timestamp: new Date(),
    };
  }

  /**
   * 收集CLI反馈
   */
  private async collectCliFeedback(_approvalId: string): Promise<UserFeedback> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('\n请提供反馈: ', (feedback) => {
        rl.close();

        resolve({
          type: 'approve',
          content: feedback,
          timestamp: new Date(),
        });
      });
    });
  }

  /**
   * 收集HTTP反馈
   */
  private async collectHttpFeedback(approvalId: string): Promise<UserFeedback> {
    if (!this.httpServer) {
      throw new Error('HTTP server not configured');
    }

    // 从 HTTP 服务器获取已完成的审批
    const completedApproval = this.httpServer.getCompletedApproval(approvalId);

    if (!completedApproval || !completedApproval.response) {
      // 审批尚未完成或不存在，返回默认批准
      return {
        type: 'approve',
        content: 'Auto-approved (no feedback received)',
        timestamp: new Date(),
      };
    }

    const response = completedApproval.response;

    // 将 ApprovalResponse 转换为 UserFeedback
    if (response.feedback) {
      return {
        type: response.feedback.type,
        content: response.feedback.content,
        corrections: response.feedback.corrections,
        supplements: response.feedback.supplements,
        rejectionReason: response.feedback.rejectionReason,
        timestamp: response.feedback.timestamp,
      };
    }

    // 如果没有反馈信息，根据批准状态返回默认反馈
    return {
      type: response.approved ? 'approve' : 'reject',
      content: response.approved ? 'Approved' : 'Rejected',
      timestamp: response.timestamp,
    };
  }

  /**
   * 收集WebSocket反馈（预留）
   */
  private async collectWebSocketFeedback(_approvalId: string): Promise<UserFeedback> {
    // TODO: 实现WebSocket反馈收集
    return {
      type: 'approve',
      content: '',
      timestamp: new Date(),
    };
  }

  /**
   * 以表格形式展示结果
   */
  private presentAsTable(result: unknown): void {
    if (typeof result === 'object' && result !== null) {
      console.log('\n┌─────────────────────────────────────────────────────────┐');
      console.log('│ 结果摘要                                                │');
      console.log('├─────────────────────────────────────────────────────────┤');

      Object.entries(result).forEach(([key, value]) => {
        const valueStr = JSON.stringify(value).slice(0, 50);
        console.log(`│ ${key.padEnd(20)} │ ${valueStr.padEnd(45)} │`);
      });

      console.log('└─────────────────────────────────────────────────────────┘\n');
    } else {
      console.log(`\n结果: ${JSON.stringify(result)}\n`);
    }
  }

  /**
   * 以摘要形式展示结果
   */
  private presentAsSummary(result: unknown): void {
    console.log('\n📊 结果摘要:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (typeof result === 'object' && result !== null) {
      Object.entries(result).forEach(([key, value]) => {
        const valueStr = JSON.stringify(value);
        if (valueStr.length > 100) {
          console.log(`• ${key}: ${valueStr.slice(0, 100)}...`);
        } else {
          console.log(`• ${key}: ${valueStr}`);
        }
      });
    } else {
      console.log(`• ${JSON.stringify(result)}`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  /**
   * 分析疑点
   */
  private analyzeConcerns(result: unknown): string[] {
    const concerns: string[] = [];

    if (typeof result === 'object' && result !== null) {
      // 检查空值
      Object.entries(result).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          concerns.push(`字段 "${key}" 为空`);
        }
      });

      // 检查异常值
      Object.entries(result).forEach(([key, value]) => {
        if (typeof value === 'number' && (value < 0 || value > 1e10)) {
          concerns.push(`字段 "${key}" 的值异常: ${value}`);
        }
      });
    }

    return concerns;
  }

  /**
   * 更新统计信息
   */
  private updateStats(response: ApprovalResponse): void {
    this.stats.totalApprovals++;

    if (response.approved) {
      this.stats.approvedCount++;
    } else if (response.feedback) {
      switch (response.feedback.type) {
        case 'reject':
          this.stats.rejectedCount++;
          break;
        case 'correct':
          this.stats.correctedCount++;
          break;
        case 'supplement':
          this.stats.supplementedCount++;
          break;
      }
    }

    // 计算准确率
    this.stats.accuracy =
      this.stats.totalApprovals > 0 ? this.stats.approvedCount / this.stats.totalApprovals : 0;
  }
}
