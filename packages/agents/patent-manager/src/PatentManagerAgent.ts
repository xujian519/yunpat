/**
 * 专利管理智能体
 *
 * 专利全生命周期管理智能体，提供：
 * 1. 专利申请管理
 * 2. 期限管理与提醒
 * 3. 费用管理与监控
 * 4. 状态跟踪与报告
 * 5. 工作流程协调
 */

import { Agent, type ExecutionContext } from '@yunpat/core';

export interface PatentApplication {
  /** 申请号 */
  applicationNumber: string;
  /** 专利标题 */
  title: string;
  /** 申请人 */
  applicant: string;
  /** 发明人 */
  inventors: string[];
  /** 专利类型 */
  patentType: 'invention' | 'utility' | 'design';
  /** 申请日 */
  filingDate: Date;
  /** 当前状态 */
  status: PatentStatus;
  /** 优先权信息 */
  priorityClaims?: Array<{
    country: string;
    applicationNumber: string;
    filingDate: Date;
  }>;
  /** 代理机构 */
  attorney?: string;
  /** 分类号 */
  classification?: string;
}

export type PatentStatus =
  | 'draft'
  | 'filed'
  | 'under_exam'
  | 'oa_issued'
  | 'amended'
  | 'allowed'
  | 'granted'
  | 'rejected'
  | 'abandoned'
  | 'expired'
  | 'withdrawn';

export interface Deadline {
  /** 申请号 */
  applicationNumber: string;
  /** 截止日期类型 */
  type: DeadlineType;
  /** 截止日期 */
  deadlineDate: Date;
  /** 描述 */
  description: string;
  /** 优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 是否已完成 */
  completed: boolean;
  /** 提醒日期 */
  reminderDate?: Date;
}

export type DeadlineType =
  | 'oa_response'
  | 'renewal_fee'
  | 'publication_fee'
  | 'examination_fee'
  | 'appeal_deadline'
  | 'priority_claim'
  | 'other';

export interface PatentFee {
  /** 申请号 */
  applicationNumber: string;
  /** 费用类型 */
  feeType: string;
  /** 金额 */
  amount: number;
  /** 货币 */
  currency: string;
  /** 到期日 */
  dueDate: Date;
  /** 支付状态 */
  status: 'pending' | 'paid' | 'overdue';
  /** 支付日期 */
  paymentDate?: Date;
  /** 备注 */
  notes?: string;
}

export interface PatentPortfolio {
  /** 专利列表 */
  patents: PatentApplication[];
  /** 统计信息 */
  statistics: {
    total: number;
    byStatus: Record<PatentStatus, number>;
    byType: Record<'invention' | 'utility' | 'design', number>;
    upcomingDeadlines: number;
    pendingFees: number;
  };
  /** 风险提示 */
  riskAlerts: string[];
}

export interface PatentManagerInput {
  /** 操作类型 */
  operation: ManagerOperation;
  /** 专利信息（添加/更新时使用） */
  patent?: PatentApplication;
  /** 申请号（查询/删除时使用） */
  applicationNumber?: string;
  /** 截止日期信息（添加截止日期时使用） */
  deadline?: Omit<Deadline, 'applicationNumber'>;
  /** 费用信息（添加费用时使用） */
  fee?: Omit<PatentFee, 'applicationNumber'>;
  /** 查询条件 */
  query?: {
    status?: PatentStatus;
    patentType?: PatentApplication['patentType'];
    dateRange?: { start: Date; end: Date };
  };
}

export type ManagerOperation =
  | 'add_patent'
  | 'update_patent'
  | 'remove_patent'
  | 'get_patent'
  | 'list_patents'
  | 'add_deadline'
  | 'update_deadline'
  | 'get_upcoming_deadlines'
  | 'add_fee'
  | 'update_fee'
  | 'get_pending_fees'
  | 'get_portfolio'
  | 'generate_report';

export interface PatentManagerOutput {
  /** 操作结果 */
  success: boolean;
  /** 返回数据 */
  data?: any;
  /** 错误信息 */
  error?: string;
  /** 元数据 */
  metadata?: {
    operation: ManagerOperation;
    timestamp: Date;
    processingTime: number;
  };
}

interface ManagementPlan {
  input: PatentManagerInput;
  operation: ManagerOperation;
}

// 内存存储（实际应用中应使用数据库）
class PatentStore {
  private patents: Map<string, PatentApplication> = new Map();
  private deadlines: Map<string, Deadline[]> = new Map();
  private fees: Map<string, PatentFee[]> = new Map();

  addPatent(patent: PatentApplication): void {
    this.patents.set(patent.applicationNumber, patent);
  }

  getPatent(applicationNumber: string): PatentApplication | undefined {
    return this.patents.get(applicationNumber);
  }

  updatePatent(applicationNumber: string, updates: Partial<PatentApplication>): boolean {
    const patent = this.patents.get(applicationNumber);
    if (!patent) return false;

    this.patents.set(applicationNumber, { ...patent, ...updates });
    return true;
  }

  removePatent(applicationNumber: string): boolean {
    return this.patents.delete(applicationNumber);
  }

  listPatents(query?: PatentManagerInput['query']): PatentApplication[] {
    let patents = Array.from(this.patents.values());

    if (query?.status) {
      patents = patents.filter((p) => p.status === query.status);
    }

    if (query?.patentType) {
      patents = patents.filter((p) => p.patentType === query.patentType);
    }

    if (query?.dateRange) {
      patents = patents.filter((p) => {
        const filingDate = new Date(p.filingDate);
        return (
          filingDate >= query.dateRange!.start && filingDate <= query.dateRange!.end
        );
      });
    }

    return patents;
  }

  addDeadline(applicationNumber: string, deadline: Omit<Deadline, 'applicationNumber'>): void {
    const deadlines = this.deadlines.get(applicationNumber) || [];
    deadlines.push({ ...deadline, applicationNumber });
    this.deadlines.set(applicationNumber, deadlines);
  }

  getUpcomingDeadlines(days: number = 30): Deadline[] {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const allDeadlines: Deadline[] = [];
    for (const deadlines of this.deadlines.values()) {
      allDeadlines.push(...deadlines);
    }

    return allDeadlines.filter(
      (d) => !d.completed && d.deadlineDate >= now && d.deadlineDate <= futureDate
    );
  }

  addFee(applicationNumber: string, fee: Omit<PatentFee, 'applicationNumber'>): void {
    const fees = this.fees.get(applicationNumber) || [];
    fees.push({ ...fee, applicationNumber });
    this.fees.set(applicationNumber, fees);
  }

  getPendingFees(): PatentFee[] {
    const now = new Date();
    const allFees: PatentFee[] = [];
    for (const fees of this.fees.values()) {
      allFees.push(...fees);
    }

    return allFees.filter((f) => f.status === 'pending' && f.dueDate <= now);
  }

  getPortfolio(): PatentPortfolio {
    const patents = Array.from(this.patents.values());

    const statistics = {
      total: patents.length,
      byStatus: {
        draft: 0,
        filed: 0,
        under_exam: 0,
        oa_issued: 0,
        amended: 0,
        allowed: 0,
        granted: 0,
        rejected: 0,
        abandoned: 0,
        expired: 0,
        withdrawn: 0,
      },
      byType: {
        invention: 0,
        utility: 0,
        design: 0,
      },
      upcomingDeadlines: this.getUpcomingDeadlines(30).length,
      pendingFees: this.getPendingFees().length,
    };

    patents.forEach((p) => {
      statistics.byStatus[p.status]++;
      statistics.byType[p.patentType]++;
    });

    const riskAlerts: string[] = [];

    // 检查即将到期的重要截止日期
    const urgentDeadlines = this.getUpcomingDeadlines(7);
    if (urgentDeadlines.length > 0) {
      riskAlerts.push(`${urgentDeadlines.length} 个截止日期将在 7 天内到期`);
    }

    // 检查逾期费用
    const overdueFees = this.getPendingFees().filter((f) => f.dueDate < new Date());
    if (overdueFees.length > 0) {
      riskAlerts.push(`${overdueFees.length} 个费用已逾期`);
    }

    return {
      patents,
      statistics,
      riskAlerts,
    };
  }
}

export class PatentManagerAgent extends Agent {
  private store = new PatentStore();

  protected async plan(
    input: PatentManagerInput,
    _context: ExecutionContext
  ): Promise<ManagementPlan> {
    console.log('[PatentManager] 步骤1: 规划阶段');
    console.log(`   操作类型: ${input.operation}`);

    if (input.operation === 'add_patent' || input.operation === 'update_patent') {
      if (!input.patent?.applicationNumber?.trim()) {
        throw new Error('申请号不能为空');
      }
      if (!input.patent?.title?.trim()) {
        throw new Error('专利标题不能为空');
      }
      console.log(`   申请号: ${input.patent.applicationNumber}`);
    } else if (input.operation === 'get_patent' || input.operation === 'remove_patent') {
      if (!input.applicationNumber?.trim()) {
        throw new Error('申请号不能为空');
      }
      console.log(`   申请号: ${input.applicationNumber}`);
    }

    return { input, operation: input.operation };
  }

  protected async act(
    plan: ManagementPlan,
    context: ExecutionContext
  ): Promise<PatentManagerOutput> {
    console.log('[PatentManager] 步骤2: 执行阶段');

    const { input, operation } = plan;
    const startTime = Date.now();

    let data: any;
    let success = true;
    let error: string | undefined;

    try {
      switch (operation) {
        case 'add_patent':
          data = this.addPatent(input, context);
          break;
        case 'update_patent':
          data = this.updatePatent(input, context);
          break;
        case 'remove_patent':
          data = this.removePatent(input, context);
          break;
        case 'get_patent':
          data = this.getPatent(input, context);
          break;
        case 'list_patents':
          data = this.listPatents(input, context);
          break;
        case 'add_deadline':
          data = this.addDeadline(input, context);
          break;
        case 'update_deadline':
          data = this.updateDeadline(input, context);
          break;
        case 'get_upcoming_deadlines':
          data = this.getUpcomingDeadlines(input, context);
          break;
        case 'add_fee':
          data = this.addFee(input, context);
          break;
        case 'update_fee':
          data = this.updateFee(input, context);
          break;
        case 'get_pending_fees':
          data = this.getPendingFees(input, context);
          break;
        case 'get_portfolio':
          data = this.getPortfolio(input, context);
          break;
        case 'generate_report':
          data = await this.generateReport(input, context);
          break;
        default:
          throw new Error(`未知的操作类型: ${operation}`);
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
    }

    const duration = Date.now() - startTime;
    console.log(`[PatentManager] 完成 (耗时 ${duration}ms)`);

    return {
      success,
      data,
      error,
      metadata: {
        operation,
        timestamp: new Date(),
        processingTime: duration,
      },
    };
  }

  private addPatent(_input: PatentManagerInput, _context: ExecutionContext): PatentApplication {
    if (!_input.patent) {
      throw new Error('专利信息不能为空');
    }

    console.log(`   添加专利: ${_input.patent.applicationNumber}`);
    this.store.addPatent(_input.patent);
    return _input.patent;
  }

  private updatePatent(input: PatentManagerInput, _context: ExecutionContext): PatentApplication | null {
    if (!input.patent?.applicationNumber) {
      throw new Error('申请号不能为空');
    }

    console.log(`   更新专利: ${input.patent.applicationNumber}`);
    const success = this.store.updatePatent(input.patent.applicationNumber, input.patent);

    if (!success) {
      throw new Error('专利不存在');
    }

    return this.store.getPatent(input.patent.applicationNumber)!;
  }

  private removePatent(input: PatentManagerInput, _context: ExecutionContext): boolean {
    if (!input.applicationNumber) {
      throw new Error('申请号不能为空');
    }

    console.log(`   删除专利: ${input.applicationNumber}`);
    const success = this.store.removePatent(input.applicationNumber);

    if (!success) {
      throw new Error('专利不存在');
    }

    return true;
  }

  private getPatent(input: PatentManagerInput, _context: ExecutionContext): PatentApplication {
    if (!input.applicationNumber) {
      throw new Error('申请号不能为空');
    }

    const patent = this.store.getPatent(input.applicationNumber);
    if (!patent) {
      throw new Error('专利不存在');
    }

    return patent;
  }

  private listPatents(input: PatentManagerInput, _context: ExecutionContext): PatentApplication[] {
    console.log(`   列出专利（条件: ${JSON.stringify(input.query)}）`);
    return this.store.listPatents(input.query);
  }

  private addDeadline(input: PatentManagerInput, _context: ExecutionContext): Deadline {
    if (!input.applicationNumber) {
      throw new Error('申请号不能为空');
    }
    if (!input.deadline) {
      throw new Error('截止日期信息不能为空');
    }

    console.log(`   添加截止日期: ${input.applicationNumber}`);
    this.store.addDeadline(input.applicationNumber, input.deadline);

    return { ...input.deadline, applicationNumber: input.applicationNumber };
  }

  private updateDeadline(input: PatentManagerInput, _context: ExecutionContext): Deadline {
    // 简化实现：添加新的截止日期
    return this.addDeadline(input, _context);
  }

  private getUpcomingDeadlines(
    _input: PatentManagerInput,
    _context: ExecutionContext
  ): Deadline[] {
    console.log('   获取即将到来的截止日期');
    return this.store.getUpcomingDeadlines(30);
  }

  private addFee(input: PatentManagerInput, _context: ExecutionContext): PatentFee {
    if (!input.applicationNumber) {
      throw new Error('申请号不能为空');
    }
    if (!input.fee) {
      throw new Error('费用信息不能为空');
    }

    console.log(`   添加费用: ${input.applicationNumber}`);
    this.store.addFee(input.applicationNumber, input.fee);

    return { ...input.fee, applicationNumber: input.applicationNumber };
  }

  private updateFee(input: PatentManagerInput, _context: ExecutionContext): PatentFee {
    // 简化实现：添加新的费用记录
    return this.addFee(input, _context);
  }

  private getPendingFees(_input: PatentManagerInput, _context: ExecutionContext): PatentFee[] {
    console.log('   获取待支付费用');
    return this.store.getPendingFees();
  }

  private getPortfolio(_input: PatentManagerInput, _context: ExecutionContext): PatentPortfolio {
    console.log('   获取专利组合概览');
    return this.store.getPortfolio();
  }

  private async generateReport(
    input: PatentManagerInput,
    context: ExecutionContext
  ): Promise<string> {
    console.log('   生成管理报告');

    if (!context.llm) {
      throw new Error('LLM 未配置，无法生成报告');
    }

    const portfolio = this.store.getPortfolio();

    const systemPrompt = `你是一位专利管理顾问。

请根据专利组合数据，生成一份管理报告，包括：
1. 总体概况
2. 状态分析
3. 风险提示
4. 建议

报告应简洁明了，突出重点。`;

    const userPrompt = `## 专利组合数据

总专利数: ${portfolio.statistics.total}

### 状态分布
${Object.entries(portfolio.statistics.byStatus)
  .filter(([_, count]) => count > 0)
  .map(([status, count]) => `- ${status}: ${count}`)
  .join('\n')}

### 类型分布
${Object.entries(portfolio.statistics.byType)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

### 即将到期的截止日期
${portfolio.statistics.upcomingDeadlines} 个

### 待支付费用
${portfolio.statistics.pendingFees} 个

### 风险提示
${portfolio.riskAlerts.map((alert) => `- ${alert}`).join('\n')}

请生成管理报告。`;

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
    });

    return response.message.content;
  }
}
