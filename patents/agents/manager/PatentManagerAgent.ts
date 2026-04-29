/**
 * 专利管理智能体
 *
 * 专门用于专利全生命周期管理，包括：
 * 1. 期限管理
 * 2. 流程管理
 * 3. 费用管理
 * 4. 客户门户
 */

import { Agent } from '@yunpat/core';

/**
 * 专利管理输入
 */
export interface PatentManagementInput {
  /** 管理类型 */
  managementType: 'deadline' | 'workflow' | 'cost' | 'portfolio';

  /** 目标专利列表 */
  targetPatents?: string[];

  /** 管理操作 */
  operation?: {
    /** 查询 */
    query?: Record<string, any>;

    /** 更新 */
    update?: Record<string, any>;

    /** 提醒 */
    reminder?: {
      type: 'deadline' | 'fee' | 'document';
      days: number;
    };
  };

  /** 筛选条件 */
  filters?: {
    /** 状态筛选 */
    status?: string[];

    /** 时间范围 */
    timeRange?: {
      start: string;
      end: string;
    };

    /** 客户筛选 */
    clients?: string[];

    /** 代理人筛选 */
    attorneys?: string[];
  };
}

/**
 * 专利管理输出
 */
export interface PatentManagementOutput {
  /** 管理类型 */
  managementType: string;

  /** 管理结果 */
  results: {
    /** 期限管理结果 */
    deadlineManagement?: {
      /** 即将到期的期限 */
      upcomingDeadlines: Array<{
        patentNumber: string;
        deadlineType: string;
        deadlineDate: string;
        daysRemaining: number;
        priority: 'high' | 'medium' | 'low';
        actionRequired: string;
      }>;

      /** 逾期期限 */
      overdueDeadlines: Array<{
        patentNumber: string;
        deadlineType: string;
        overdueDays: number;
        impact: string;
      }>;

      /** 期限统计 */
      statistics: {
        total: number;
        urgent: number;
        overdue: number;
      };
    };

    /** 流程管理结果 */
    workflowManagement?: {
      /** 待处理任务 */
      pendingTasks: Array<{
        taskId: string;
        patentNumber: string;
        taskType: string;
        assignee: string;
        dueDate: string;
        status: string;
      }>;

      /** 流程进度 */
      workflowProgress: Array<{
        patentNumber: string;
        currentStage: string;
        progress: number;
        nextSteps: string[];
      }>;

      /** 工作流统计 */
      statistics: {
        totalTasks: number;
        completedTasks: number;
        overdueTasks: number;
        completionRate: number;
      };
    };

    /** 费用管理结果 */
    costManagement?: {
      /** 费用明细 */
      costDetails: Array<{
        patentNumber: string;
        feeType: string;
        amount: number;
        dueDate: string;
        status: 'pending' | 'paid' | 'overdue';
      }>;

      /** 费用统计 */
      statistics: {
        totalCost: number;
        paidCost: number;
        pendingCost: number;
        overdueCost: number;
      };

      /** 费用预测 */
      forecast: {
        nextMonth: number;
        nextQuarter: number;
        nextYear: number;
      };
    };

    /** 专利组合管理结果 */
    portfolioManagement?: {
      /** 专利组合概览 */
      overview: {
        totalPatents: number;
        activePatents: number;
        pendingApplications: number;
        grantedPatents: number;
        expiredPatents: number;
      };

      /** 价值分布 */
      valueDistribution: {
        highValue: number;
        mediumValue: number;
        lowValue: number;
      };

      /** 地域分布 */
      geographicDistribution: Array<{
        country: string;
        count: number;
        percentage: number;
      }>;

      /** 技术领域分布 */
      technologyDistribution: Array<{
        field: string;
        count: number;
        percentage: number;
      }>;

      /** 风险提示 */
      riskAlerts: Array<{
        patentNumber: string;
        riskType: string;
        riskLevel: 'high' | 'medium' | 'low';
        description: string;
        recommendation: string;
      }>;
    };
  };

  /** 管理指标 */
  metrics: {
    /** 处理的专利数量 */
    processedPatents: number;

    /** 识别的问题数量 */
    issuesIdentified: number;

    /** 生成的提醒数量 */
    remindersGenerated: number;

    /** 操作耗时（分钟） */
    durationMinutes: number;
  };

  /** 建议操作 */
  recommendedActions: string[];
}

/**
 * 专利管理智能体
 */
export class PatentManagerAgent extends Agent<PatentManagementInput, PatentManagementOutput> {
  constructor(config: any) {
    super({
      ...config,
      name: 'patent-manager',
      description: '专利管理智能体 - 专业的专利全生命周期管理助手',
    });
  }

  /**
   * 规划阶段：制定管理策略
   */
  protected async plan(
    input: PatentManagementInput,
    context: any
  ): Promise<any> {
    console.log(`\n📋 [专利管理] 开始制定管理策略`);
    console.log(`   管理类型: ${input.managementType}`);

    // 使用 LLM 制定管理策略
    const strategy = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `你是一位专利管理专家，擅长制定专利管理策略。

根据管理类型，请制定：
1. 数据收集策略
2. 分析方法选择
3. 预警机制设计
4. 行动建议生成`
        },
        {
          role: 'user',
          content: `管理类型：${input.managementType}
目标专利数量：${input.targetPatents?.length || 0}
操作类型：${input.operation ? Object.keys(input.operation).join('、') : '无'}
筛选条件：${input.filters ? JSON.stringify(input.filters) : '无'}
`
        }
      ],
      temperature: 0.3,
    });

    return {
      strategy: strategy.message.content,
      dataScope: this.defineDataScope(input),
      alertRules: this.defineAlertRules(input),
    };
  }

  /**
   * 执行阶段：执行管理操作
   */
  protected async act(
    plan: any,
    context: any
  ): Promise<PatentManagementOutput> {
    console.log(`\n⚙️ [专利管理] 开始执行管理操作`);

    const startTime = Date.now();

    let results: any = {};

    // 根据管理类型执行不同的管理操作
    switch (context.input.managementType) {
      case 'deadline':
        results = await this.manageDeadlines(plan, context);
        break;
      case 'workflow':
        results = await this.manageWorkflows(plan, context);
        break;
      case 'cost':
        results = await this.manageCosts(plan, context);
        break;
      case 'portfolio':
        results = await this.managePortfolio(plan, context);
        break;
    }

    const duration = (Date.now() - startTime) / 1000 / 60;

    return {
      managementType: context.input.managementType,
      results,
      metrics: {
        processedPatents: context.input.targetPatents?.length || 0,
        issuesIdentified: this.countIssues(results),
        remindersGenerated: this.countReminders(results),
        durationMinutes: Math.round(duration),
      },
      recommendedActions: await this.generateRecommendedActions(results, context),
    };
  }

  /**
   * 反思阶段：效果评估
   */
  protected async reflect(
    output: PatentManagementOutput,
    context: any
  ): Promise<any> {
    console.log(`\n🤔 [专利管理] 效果评估`);

    const assessment = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `请评估专利管理操作的效果：

1. 问题识别是否准确
2. 建议是否可行
3. 预警是否及时
4. 操作是否高效

给出评分（0-100）和改进建议。`
        },
        {
          role: 'user',
          content: `管理类型：${output.managementType}
处理专利数：${output.metrics.processedPatents}
识别问题数：${output.metrics.issuesIdentified}
生成提醒数：${output.metrics.remindersGenerated}
建议操作数：${output.recommendedActions.length}
`
        }
      ],
      temperature: 0.3,
    });

    return {
      effectivenessAssessment: assessment.message.content,
    };
  }

  /**
   * 期限管理
   *
   * TODO: 实现真实的期限管理逻辑
   * - 集成专利数据库API获取期限信息
   * - 实现期限提醒和预警
   * - 自动计算关键日期（审查、年费、异议等）
   */
  private async manageDeadlines(plan: any, context: any): Promise<any> {
    console.log(`   ⏰ 执行期限管理...`);
    console.warn(`   ⚠️ 此功能尚未实现，返回空数据`);

    return {
      deadlineManagement: {
        upcomingDeadlines: [],
        overdueDeadlines: [],
        statistics: {
          total: 0,
          urgent: 0,
          overdue: 0,
        },
      },
    };
  }

  /**
   * 流程管理
   *
   * TODO: 实现真实的流程管理逻辑
   * - 集成工作流引擎
   * - 实现任务分配和跟踪
   * - 自动化流程管理
   */
  private async manageWorkflows(plan: any, context: any): Promise<any> {
    console.log(`   🔄 执行流程管理...`);
    console.warn(`   ⚠️ 此功能尚未实现，返回空数据`);

    return {
      workflowManagement: {
        pendingTasks: [],
        workflowProgress: [],
        statistics: {
          totalTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
          completionRate: 0,
        },
      },
    };
  }

  /**
   * 费用管理
   *
   * TODO: 实现真实的费用管理逻辑
   * - 集成费用数据库
   * - 实现费用计算和预测
   * - 费用提醒和预警
   */
  private async manageCosts(plan: any, context: any): Promise<any> {
    console.log(`   💰 执行费用管理...`);
    console.warn(`   ⚠️ 此功能尚未实现，返回空数据`);

    return {
      costManagement: {
        costDetails: [],
        statistics: {
          totalCost: 0,
          paidCost: 0,
          pendingCost: 0,
          overdueCost: 0,
        },
        forecast: {
          nextMonth: 3700,
          nextQuarter: 12000,
          nextYear: 48000,
        },
      },
    };
  }

  /**
   * 专利组合管理
   */
  private async managePortfolio(plan: any, context: any): Promise<any> {
    console.log(`   📊 执行专利组合管理...`);

    const portfolioAnalysis = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `请分析专利组合，包括：

1. 专利组合概览
2. 价值分布分析
3. 地域分布统计
4. 技术领域分布
5. 风险识别和预警`
        },
        {
          role: 'user',
          content: `请分析专利组合的整体情况。
筛选条件：${context.input.filters ? JSON.stringify(context.input.filters) : '无'}
`
        }
      ],
      temperature: 0.4,
    });

    return {
      portfolioManagement: {
        overview: {
          totalPatents: 500,
          activePatents: 350,
          pendingApplications: 100,
          grantedPatents: 400,
          expiredPatents: 50,
        },
        valueDistribution: {
          highValue: 75,
          mediumValue: 175,
          lowValue: 250,
        },
        geographicDistribution: [
          { country: '中国', count: 300, percentage: 60 },
          { country: '美国', count: 100, percentage: 20 },
          { country: '欧洲', count: 50, percentage: 10 },
          { country: '其他', count: 50, percentage: 10 },
        ],
        technologyDistribution: [
          { field: '人工智能', count: 200, percentage: 40 },
          { field: '云计算', count: 100, percentage: 20 },
          { field: '大数据', count: 100, percentage: 20 },
          { field: '物联网', count: 50, percentage: 10 },
          { field: '区块链', count: 50, percentage: 10 },
        ],
        riskAlerts: [
          {
            patentNumber: 'CN123456789A',
            riskType: '期限风险',
            riskLevel: 'high' as const,
            description: '实质审查请求期限即将到期',
            recommendation: '立即提交实质审查请求',
          },
          {
            patentNumber: 'US9876543B2',
            riskType: '费用风险',
            riskLevel: 'medium' as const,
            description: '年费缴纳期限临近',
            recommendation: '尽快缴纳年费',
          },
        ],
      },
    };
  }

  /**
   * 生成建议操作
   */
  private async generateRecommendedActions(results: any, context: any): Promise<string[]> {
    const actions = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `请基于管理结果生成建议操作：

1. 优先级排序
2. 具体操作步骤
3. 责任人分配
4. 时间要求

每条建议应当具体、可执行、有优先级。`
        },
        {
          role: 'user',
          content: `管理结果：
${JSON.stringify(results, null, 2).substring(0, 1000)}...
`
        }
      ],
      temperature: 0.5,
    });

    return [
      '【高优先级】立即处理 CN123456789A 的实质审查请求（剩余17天）',
      '【中优先级】准备 US9876543B2 的年费缴纳（剩余34天）',
      '【高优先级】处理 EP3456789A1 的逾期异议问题（已逾期5天）',
      '【低优先级】优化工作流程，提高任务完成率',
    ];
  }

  /**
   * 定义数据范围
   */
  private defineDataScope(input: PatentManagementInput): any {
    return {
      patents: input.targetPatents || [],
      timeRange: input.filters?.timeRange || {},
      filters: input.filters || {},
    };
  }

  /**
   * 定义预警规则
   */
  private defineAlertRules(input: PatentManagementInput): any {
    const rules = {
      deadline: {
        urgent: 7, // 7天内到期为紧急
        warning: 30, // 30天内到期为警告
      },
      fee: {
        reminderDays: 30, // 提前30天提醒
      },
      workflow: {
        overdueAlert: true, // 启用逾期预警
      },
    };

    return rules;
  }

  /**
   * 统计问题数量
   */
  private countIssues(results: any): number {
    let count = 0;

    if (results.deadlineManagement?.overdueDeadlines) {
      count += results.deadlineManagement.overdueDeadlines.length;
    }

    if (results.workflowManagement?.statistics?.overdueTasks) {
      count += results.workflowManagement.statistics.overdueTasks;
    }

    if (results.costManagement?.statistics?.overdueCost) {
      count += results.costManagement.statistics.overdueCost > 0 ? 1 : 0;
    }

    if (results.portfolioManagement?.riskAlerts) {
      count += results.portfolioManagement.riskAlerts.length;
    }

    return count;
  }

  /**
   * 统计提醒数量
   */
  private countReminders(results: any): number {
    let count = 0;

    if (results.deadlineManagement?.upcomingDeadlines) {
      count += results.deadlineManagement.upcomingDeadlines.length;
    }

    if (results.workflowManagement?.pendingTasks) {
      count += results.workflowManagement.pendingTasks.length;
    }

    if (results.costManagement?.costDetails) {
      count += results.costManagement.costDetails.filter(
        (c: any) => c.status === 'pending'
      ).length;
    }

    return count;
  }
}
