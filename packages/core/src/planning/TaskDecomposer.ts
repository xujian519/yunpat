/**
 * 任务分解器
 *
 * 将高层目标递归分解为可执行的子目标和任务层次结构
 */

import type {
  HierarchicalPlan,
  SubGoal,
  PlanningTask,
  DecompositionOptions,
  TaskDecomposerConfig,
  DecompositionRule,
  PlanningExecutionContext,
  DecompositionStats,
  Dependency,
} from './types.js';
import { Priority, TaskStatus, TaskType, PlanStatus } from './types.js';
import { DependencyAnalyzer } from './DependencyAnalyzer.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 任务分解器
 */
export class TaskDecomposer {
  private config: TaskDecomposerConfig;
  private dependencyAnalyzer: DependencyAnalyzer;
  private domainRules: Map<string, DecompositionRule[]>;

  /**
   * 创建任务对象的辅助方法
   */
  private createTask(
    title: string,
    description: string,
    type: TaskType,
    capabilities: string[],
    tokens: number,
    duration: number
  ): PlanningTask {
    return {
      id: uuidv4(),
      title,
      description,
      type,
      status: TaskStatus.PENDING,
      requiredCapabilities: capabilities,
      estimatedTokens: tokens,
      estimatedDuration: duration,
      createdAt: new Date(),
    };
  }

  constructor(config: TaskDecomposerConfig = {}) {
    this.config = {
      llm: config.llm,
      maxDepth: config.maxDepth ?? 3,
      maxTasksPerGoal: config.maxTasksPerGoal ?? 10,
      enableIntelligentDecomposition: config.enableIntelligentDecomposition ?? false,
      domain: config.domain ?? 'general',
      customRules: config.customRules ?? [],
    } as TaskDecomposerConfig;

    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.domainRules = new Map();

    this.initializeDomainRules();
  }

  /**
   * 分解目标为层次化计划
   */
  async decompose(
    goal: string,
    context?: Partial<PlanningExecutionContext>,
    options?: DecompositionOptions
  ): Promise<HierarchicalPlan> {
    const opts = this.mergeOptions(options);

    console.log(`🎯 开始分解目标: ${goal}`);
    console.log(`   最大深度: ${opts.maxDepth}, 智能分解: ${opts.enableIntelligentDecomposition}`);

    // 生成唯一ID
    const planId = uuidv4();

    // 递归分解
    const subGoals = await this.decomposeRecursive(goal, 0, opts.maxDepth, context, opts);

    console.log(`   分解完成: ${subGoals.length} 个子目标`);

    // 分析依赖关系
    const dependencies = this.dependencyAnalyzer.analyzeDependencies(subGoals);

    if (dependencies.hasCycles) {
      console.warn('   ⚠️ 检测到循环依赖，尝试修复...');
    }

    // 计算统计信息
    const stats = this.calculateStats(subGoals, dependencies);

    const plan: HierarchicalPlan = {
      id: planId,
      goal,
      subGoals,
      dependencies,
      estimatedDuration: stats.totalEstimatedDuration,
      estimatedTokens: stats.totalEstimatedTokens,
      status: PlanStatus.READY,
      createdAt: new Date(),
      metadata: {
        decompositionOptions: opts,
        stats,
      },
    };

    console.log(
      `   总任务数: ${stats.totalTasks}, 预估时长: ${(stats.totalEstimatedDuration / 60).toFixed(1)} 分钟`
    );

    return plan;
  }

  /**
   * 递归分解
   */
  private async decomposeRecursive(
    goal: string,
    currentDepth: number,
    maxDepth: number,
    context?: Partial<PlanningExecutionContext>,
    options?: DecompositionOptions
  ): Promise<SubGoal[]> {
    // 达到最大深度，创建叶子任务
    // maxDepth=1 表示不分解，直接创建叶子任务
    // maxDepth=2 表示分解1层
    if (currentDepth >= maxDepth - 1) {
      return [this.createLeafSubGoal(goal, currentDepth)];
    }

    // 检查是否有匹配的分解规则
    const rule = this.findMatchingRule(goal, options);
    if (rule) {
      return this.applyRule(goal, rule, currentDepth, context, options);
    }

    // 使用智能分解（LLM）或规则分解
    if (options?.enableIntelligentDecomposition && this.config.llm) {
      return await this.intelligentDecompose(goal, currentDepth, context, options);
    } else {
      return this.ruleBasedDecompose(goal, currentDepth, options);
    }
  }

  /**
   * 查找匹配的分解规则
   */
  private findMatchingRule(goal: string, options?: DecompositionOptions): DecompositionRule | null {
    const domain = options?.domain || this.config.domain || 'general';
    const allRules = [...(this.domainRules.get(domain) || []), ...(this.config.customRules || [])];

    for (const rule of allRules) {
      if (this.matchesRule(goal, rule)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * 检查目标是否匹配规则
   */
  private matchesRule(goal: string, rule: DecompositionRule): boolean {
    const lowerGoal = goal.toLowerCase();

    if (rule.matchPattern instanceof RegExp) {
      return rule.matchPattern.test(lowerGoal);
    } else if (Array.isArray(rule.matchPattern)) {
      return rule.matchPattern.some((pattern) => lowerGoal.includes(pattern.toLowerCase()));
    }

    return false;
  }

  /**
   * 应用分解规则
   */
  private async applyRule(
    goal: string,
    rule: DecompositionRule,
    _currentDepth: number,
    _context?: Partial<PlanningExecutionContext>,
    _options?: DecompositionOptions
  ): Promise<SubGoal[]> {
    const subGoals: SubGoal[] = [];

    for (const template of rule.subGoalTemplates) {
      const tasks: PlanningTask[] = template.taskTemplates.map((taskTemplate) => ({
        id: uuidv4(),
        title: taskTemplate.title,
        description: taskTemplate.description,
        type: taskTemplate.type,
        status: TaskStatus.PENDING,
        requiredCapabilities: taskTemplate.requiredCapabilities,
        estimatedTokens: taskTemplate.estimatedTokens,
        estimatedDuration: taskTemplate.estimatedDuration,
        createdAt: new Date(),
      }));

      subGoals.push({
        id: uuidv4(),
        title: template.title,
        description: template.description,
        tasks,
        dependencies: [],
        priority: template.priority,
        status: TaskStatus.PENDING,
        estimatedDuration: tasks.reduce((sum, t) => sum + t.estimatedDuration, 0),
        estimatedTokens: tasks.reduce((sum, t) => sum + t.estimatedTokens, 0),
      });
    }

    return subGoals;
  }

  /**
   * 基于规则的分解
   */
  private ruleBasedDecompose(
    goal: string,
    _currentDepth: number,
    _options?: DecompositionOptions
  ): SubGoal[] {
    // 通用分解策略
    const subGoals: SubGoal[] = [];

    // 1. 研究阶段
    subGoals.push({
      id: uuidv4(),
      title: '信息收集与分析',
      description: `收集与"${goal}"相关的信息，进行初步分析`,
      tasks: [
        {
          id: uuidv4(),
          title: '搜索相关资料',
          description: '搜索和收集相关背景资料',
          type: TaskType.RESEARCH,
          status: TaskStatus.PENDING,
          requiredCapabilities: ['search', 'knowledge'],
          estimatedTokens: 2000,
          estimatedDuration: 300,
          createdAt: new Date(),
        } as PlanningTask,
        {
          id: uuidv4(),
          title: '分析现状',
          description: '分析当前情况和存在的问题',
          type: TaskType.ANALYSIS,
          status: TaskStatus.PENDING,
          requiredCapabilities: ['analysis', 'reasoning'],
          estimatedTokens: 1500,
          estimatedDuration: 240,
          createdAt: new Date(),
        } as PlanningTask,
      ],
      dependencies: [],
      priority: Priority.HIGH,
      status: TaskStatus.PENDING,
      estimatedDuration: 540,
      estimatedTokens: 3500,
    });

    // 2. 规划阶段
    subGoals.push({
      id: uuidv4(),
      title: '方案规划',
      description: '制定详细的实施方案',
      tasks: [
        {
          id: uuidv4(),
          title: '制定方案',
          description: '制定详细的实施方案',
          type: TaskType.WRITING,
          status: TaskStatus.PENDING,
          requiredCapabilities: ['planning', 'writing'],
          estimatedTokens: 3000,
          estimatedDuration: 600,
          createdAt: new Date(),
        },
      ],
      dependencies: [subGoals[0].id], // 依赖研究阶段
      priority: Priority.HIGH,
      status: TaskStatus.PENDING,
      estimatedDuration: 600,
      estimatedTokens: 3000,
    });

    // 3. 执行阶段
    subGoals.push({
      id: uuidv4(),
      title: '方案实施',
      description: '执行方案并生成结果',
      tasks: [
        {
          id: uuidv4(),
          title: '生成内容',
          description: '根据方案生成实际内容',
          type: TaskType.GENERATION,
          status: TaskStatus.PENDING,
          requiredCapabilities: ['generation', 'writing'],
          estimatedTokens: 5000,
          estimatedDuration: 900,
          createdAt: new Date(),
        },
      ],
      dependencies: [subGoals[1].id], // 依赖规划阶段
      priority: Priority.MEDIUM,
      status: TaskStatus.PENDING,
      estimatedDuration: 900,
      estimatedTokens: 5000,
    });

    // 4. 验证阶段
    subGoals.push({
      id: uuidv4(),
      title: '质量验证',
      description: '验证结果质量',
      tasks: [
        {
          id: uuidv4(),
          title: '质量检查',
          description: '检查生成内容的质量',
          type: TaskType.VALIDATION,
          status: TaskStatus.PENDING,
          requiredCapabilities: ['validation', 'analysis'],
          estimatedTokens: 2000,
          estimatedDuration: 300,
          createdAt: new Date(),
        },
        {
          id: uuidv4(),
          title: '内容审查',
          description: '审查内容的准确性和完整性',
          type: TaskType.REVIEW,
          status: TaskStatus.PENDING,
          requiredCapabilities: ['review', 'knowledge'],
          estimatedTokens: 1500,
          estimatedDuration: 240,
          createdAt: new Date(),
        },
      ],
      dependencies: [subGoals[2].id], // 依赖执行阶段
      priority: Priority.MEDIUM,
      status: TaskStatus.PENDING,
      estimatedDuration: 540,
      estimatedTokens: 3500,
    });

    return subGoals;
  }

  /**
   * 智能分解（使用LLM）
   */
  private async intelligentDecompose(
    goal: string,
    currentDepth: number,
    context?: Partial<PlanningExecutionContext>,
    options?: DecompositionOptions
  ): Promise<SubGoal[]> {
    if (!this.config.llm) {
      // 回退到规则分解
      return this.ruleBasedDecompose(goal, currentDepth, options);
    }

    try {
      const prompt = this.buildDecompositionPrompt(goal, currentDepth, options);
      const response = await this.config.llm.chat({
        messages: [
          {
            role: 'system',
            content: '你是一个专业的任务规划专家，擅长将复杂目标分解为可执行的子任务。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });

      const content = response.message?.content || '';
      return this.parseDecompositionResult(content, currentDepth);
    } catch (error) {
      console.error('智能分解失败，回退到规则分解:', error);
      return this.ruleBasedDecompose(goal, currentDepth, options);
    }
  }

  /**
   * 构建分解提示词
   */
  private buildDecompositionPrompt(
    goal: string,
    currentDepth: number,
    options?: DecompositionOptions
  ): string {
    return `请将以下目标分解为3-5个子目标，每个子目标包含2-4个具体任务。

目标：${goal}
当前深度：${currentDepth}
最大深度：${options?.maxDepth || this.config.maxDepth}

请按以下JSON格式返回：
{
  "subGoals": [
    {
      "title": "子目标标题",
      "description": "子目标描述",
      "tasks": [
        {
          "title": "任务标题",
          "description": "任务描述",
          "type": "research|analysis|writing|validation|generation|review",
          "estimatedDuration": 预估秒数,
          "estimatedTokens": 预估token数
        }
      ],
      "priority": "critical|high|medium|low"
    }
  ]
}

要求：
1. 子目标之间应该有逻辑顺序
2. 每个任务应该是可执行的
3. 合理估算时间和token消耗
4. 任务类型应该是 research, analysis, writing, validation, generation, review 之一`;
  }

  /**
   * 解析分解结果
   */
  private parseDecompositionResult(content: string, currentDepth: number): SubGoal[] {
    try {
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法找到JSON结果');
      }

      const result = JSON.parse(jsonMatch[0]);

      if (!result.subGoals || !Array.isArray(result.subGoals)) {
        throw new Error('无效的子目标格式');
      }

      return result.subGoals.map((sg: unknown) => ({
        id: uuidv4(),
        title: (sg as any).title || '未命名子目标',
        description: (sg as any).description || '',
        tasks: ((sg as any).tasks || []).map((t: unknown) => ({
          id: uuidv4(),
          title: (t as any).title || '未命名任务',
          description: (t as any).description || '',
          type: this.parseTaskType((t as any).type),
          status: TaskStatus.PENDING,
          requiredCapabilities: this.inferCapabilities((t as any).type),
          estimatedTokens: (t as any).estimatedTokens || 2000,
          estimatedDuration: (t as any).estimatedDuration || 300,
          createdAt: new Date(),
        })),
        dependencies: (sg as any).dependencies || [],
        priority: this.parsePriority((sg as any).priority),
        status: TaskStatus.PENDING,
        estimatedDuration: ((sg as any).tasks || []).reduce(
          (sum: number, t: unknown) => sum + ((t as any).estimatedDuration || 300),
          0
        ),
        estimatedTokens: ((sg as any).tasks || []).reduce(
          (sum: number, t: unknown) => sum + ((t as any).estimatedTokens || 2000),
          0
        ),
      }));
    } catch (error) {
      console.error('解析分解结果失败:', error);
      // 回退到规则分解
      return this.ruleBasedDecompose('未知目标', currentDepth);
    }
  }

  /**
   * 解析任务类型
   */
  private parseTaskType(type: string): TaskType {
    const validTypes = ['research', 'analysis', 'writing', 'validation', 'generation', 'review'];
    const normalized = type?.toLowerCase() || '';
    return validTypes.includes(normalized) ? (normalized as TaskType) : TaskType.WRITING;
  }

  /**
   * 推断所需能力
   */
  private inferCapabilities(taskType: TaskType): string[] {
    const capabilityMap: Record<TaskType, string[]> = {
      [TaskType.RESEARCH]: ['search', 'knowledge'],
      [TaskType.ANALYSIS]: ['analysis', 'reasoning'],
      [TaskType.WRITING]: ['writing', 'generation'],
      [TaskType.VALIDATION]: ['validation', 'analysis'],
      [TaskType.GENERATION]: ['generation', 'writing'],
      [TaskType.REVIEW]: ['review', 'knowledge'],
    };

    return capabilityMap[taskType] || ['general'];
  }

  /**
   * 解析优先级
   */
  private parsePriority(priority: string): Priority {
    const validPriorities = ['critical', 'high', 'medium', 'low'];
    const normalized = priority?.toLowerCase() || 'medium';
    return validPriorities.includes(normalized) ? (normalized as Priority) : Priority.MEDIUM;
  }

  /**
   * 创建叶子子目标（达到最大深度时）
   */
  private createLeafSubGoal(goal: string, _depth: number): SubGoal {
    const taskId = uuidv4();
    return {
      id: uuidv4(),
      title: goal,
      description: `执行任务: ${goal}`,
      tasks: [
        {
          id: taskId,
          title: goal,
          description: `直接执行: ${goal}`,
          type: TaskType.WRITING,
          status: TaskStatus.PENDING,
          requiredCapabilities: ['general'],
          estimatedTokens: 3000,
          estimatedDuration: 600,
          createdAt: new Date(),
        },
      ],
      dependencies: [],
      priority: Priority.MEDIUM,
      status: TaskStatus.PENDING,
      estimatedDuration: 600,
      estimatedTokens: 3000,
    };
  }

  /**
   * 计算统计信息
   */
  private calculateStats(
    subGoals: SubGoal[],
    dependencies: { edges: Dependency[] }
  ): DecompositionStats {
    const totalGoals = subGoals.length;
    const totalTasks = subGoals.reduce((sum, g) => sum + g.tasks.length, 0);
    const totalDependencies = dependencies.edges.length;
    const totalEstimatedDuration = subGoals.reduce((sum, g) => sum + g.estimatedDuration, 0);
    const totalEstimatedTokens = subGoals.reduce((sum, g) => sum + g.estimatedTokens, 0);
    const avgTasksPerGoal = totalGoals > 0 ? totalTasks / totalGoals : 0;

    // 计算最大深度（简单估算）
    const maxDepth = Math.ceil(Math.log2(totalGoals + 1));

    // 计算关键路径长度（粗略估计）
    const criticalPathLength = Math.max(...subGoals.map((g) => g.tasks.length));

    return {
      totalGoals,
      totalTasks,
      totalDependencies,
      totalEstimatedDuration,
      totalEstimatedTokens,
      avgTasksPerGoal,
      maxDepth,
      criticalPathLength,
    };
  }

  /**
   * 合并选项
   */
  private mergeOptions(options?: DecompositionOptions): Required<DecompositionOptions> {
    return {
      maxDepth: options?.maxDepth ?? this.config.maxDepth ?? 3,
      maxTasksPerGoal: options?.maxTasksPerGoal ?? this.config.maxTasksPerGoal ?? 10,
      enableIntelligentDecomposition:
        options?.enableIntelligentDecomposition ??
        this.config.enableIntelligentDecomposition ??
        false,
      domain: options?.domain ?? this.config.domain ?? 'general',
      customRules: options?.customRules ?? this.config.customRules ?? [],
    };
  }

  /**
   * 初始化领域规则
   */
  private initializeDomainRules(): void {
    // 专利撰写规则
    this.domainRules.set('patent', [
      {
        name: 'patent-writing',
        description: '专利撰写分解规则',
        matchPattern: /专利|撰写|申请/,
        strategy: 'sequential',
        subGoalTemplates: [
          {
            title: '技术方案理解',
            description: '理解技术交底书中的技术方案',
            taskTemplates: [
              {
                title: '分析技术领域',
                description: '分析发明所属的技术领域',
                type: TaskType.ANALYSIS,
                requiredCapabilities: ['analysis', 'knowledge'],
                estimatedTokens: 1500,
                estimatedDuration: 300,
              },
              {
                title: '理解技术问题',
                description: '理解要解决的技术问题',
                type: TaskType.ANALYSIS,
                requiredCapabilities: ['analysis', 'reasoning'],
                estimatedTokens: 2000,
                estimatedDuration: 400,
              },
            ],
            priority: Priority.HIGH,
          },
          {
            title: '权利要求撰写',
            description: '撰写权利要求书',
            taskTemplates: [
              {
                title: '撰写独立权利要求',
                description: '撰写独立权利要求',
                type: TaskType.WRITING,
                requiredCapabilities: ['writing', 'knowledge'],
                estimatedTokens: 3000,
                estimatedDuration: 600,
              },
              {
                title: '撰写从属权利要求',
                description: '撰写从属权利要求',
                type: TaskType.WRITING,
                requiredCapabilities: ['writing', 'generation'],
                estimatedTokens: 4000,
                estimatedDuration: 800,
              },
            ],
            priority: Priority.CRITICAL,
          },
          {
            title: '说明书撰写',
            description: '撰写说明书',
            taskTemplates: [
              {
                title: '撰写技术领域和背景技术',
                description: '撰写技术领域和背景技术部分',
                type: TaskType.WRITING,
                requiredCapabilities: ['writing', 'research'],
                estimatedTokens: 2500,
                estimatedDuration: 500,
              },
              {
                title: '撰写发明内容',
                description: '撰写发明内容部分',
                type: TaskType.WRITING,
                requiredCapabilities: ['writing', 'generation'],
                estimatedTokens: 3500,
                estimatedDuration: 700,
              },
              {
                title: '撰写具体实施方式',
                description: '撰写具体实施方式部分',
                type: TaskType.WRITING,
                requiredCapabilities: ['writing', 'generation'],
                estimatedTokens: 5000,
                estimatedDuration: 900,
              },
            ],
            priority: Priority.HIGH,
          },
        ],
      },
    ]);

    // 研究规则
    this.domainRules.set('research', [
      {
        name: 'research-task',
        description: '研究任务分解规则',
        matchPattern: /研究|调研|分析/,
        strategy: 'hierarchical',
        subGoalTemplates: [
          {
            title: '文献调研',
            description: '收集和阅读相关文献',
            taskTemplates: [
              {
                title: '搜索文献',
                description: '搜索相关文献资料',
                type: TaskType.RESEARCH,
                requiredCapabilities: ['search', 'knowledge'],
                estimatedTokens: 2000,
                estimatedDuration: 600,
              },
              {
                title: '阅读文献',
                description: '阅读和分析文献',
                type: TaskType.ANALYSIS,
                requiredCapabilities: ['analysis', 'reading'],
                estimatedTokens: 3000,
                estimatedDuration: 900,
              },
            ],
            priority: Priority.HIGH,
          },
          {
            title: '数据分析',
            description: '分析收集的数据',
            taskTemplates: [
              {
                title: '处理数据',
                description: '处理和分析数据',
                type: TaskType.ANALYSIS,
                requiredCapabilities: ['analysis', 'computation'],
                estimatedTokens: 2500,
                estimatedDuration: 600,
              },
            ],
            priority: Priority.MEDIUM,
          },
        ],
      },
    ]);
  }

  /**
   * 添加自定义规则
   */
  addCustomRule(rule: DecompositionRule): void {
    if (!this.config.customRules) {
      this.config.customRules = [];
    }
    this.config.customRules.push(rule);
  }

  /**
   * 获取分解器统计信息
   */
  getStats(): {
    totalRules: number;
    domainRulesCount: number;
    customRulesCount: number;
  } {
    let domainRulesCount = 0;
    this.domainRules.forEach((rules) => {
      domainRulesCount += rules.length;
    });

    return {
      totalRules: domainRulesCount + (this.config.customRules?.length || 0),
      domainRulesCount,
      customRulesCount: this.config.customRules?.length || 0,
    };
  }
}
