/**
 * 工作流引擎
 *
 * 对TaskScheduler的轻量封装，专门用于Agent编排
 * 支持步骤间数据传递、审批、检查点
 */

import { v4 as uuidv4 } from 'uuid';
import type { ExecutionContext, EventBus, MemoryStore } from '../lifecycle/Lifecycle.js';
import type { Agent } from '../agent/Agent.js';
import type { ApprovalFlow } from '../gateway/ApprovalFlow.js';
import type { CheckpointManager } from '../memory/CheckpointManager.js';

/**
 * 验证工作流定义
 *
 * @param workflow - 工作流定义
 * @throws {Error} 当工作流定义无效时
 */
function validateWorkflow(workflow: WorkflowDefinition): void {
  // 验证工作流ID
  if (!workflow.id || typeof workflow.id !== 'string' || workflow.id.trim().length === 0) {
    throw new Error('工作流ID不能为空');
  }

  // 验证工作流名称
  if (!workflow.name || typeof workflow.name !== 'string' || workflow.name.trim().length === 0) {
    throw new Error('工作流名称不能为空');
  }

  // 验证步骤列表
  if (!workflow.steps || !Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    throw new Error('工作流必须包含至少一个步骤');
  }

  // 验证每个步骤
  const stepIds = new Set<string>();
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];

    // 验证步骤ID
    if (!step.id || typeof step.id !== 'string' || step.id.trim().length === 0) {
      throw new Error(`步骤 ${i} 的ID不能为空`);
    }

    // 检查步骤ID唯一性
    if (stepIds.has(step.id)) {
      throw new Error(`步骤ID重复: ${step.id}`);
    }
    stepIds.add(step.id);

    // 验证步骤名称
    if (!step.name || typeof step.name !== 'string' || step.name.trim().length === 0) {
      throw new Error(`步骤 ${step.id} 的名称不能为空`);
    }

    // 验证Agent名称
    if (!step.agentName || typeof step.agentName !== 'string' || step.agentName.trim().length === 0) {
      throw new Error(`步骤 ${step.id} 的agentName不能为空`);
    }

    // 验证超时时间（如果提供）
    if (step.timeout !== undefined && (typeof step.timeout !== 'number' || step.timeout <= 0)) {
      throw new Error(`步骤 ${step.id} 的超时时间必须是正数`);
    }
  }

  // 验证依赖关系
  if (workflow.dependencies) {
    if (!Array.isArray(workflow.dependencies)) {
      throw new Error('依赖关系必须是数组');
    }

    for (let i = 0; i < workflow.dependencies.length; i++) {
      const dep = workflow.dependencies[i];

      if (!dep.from || !dep.to) {
        throw new Error(`依赖关系 ${i} 缺少from或to字段`);
      }

      // 验证from和to是否引用了存在的步骤
      if (!stepIds.has(dep.from)) {
        throw new Error(`依赖关系引用了不存在的步骤: ${dep.from}`);
      }

      if (!stepIds.has(dep.to)) {
        throw new Error(`依赖关系引用了不存在的步骤: ${dep.to}`);
      }

      // 检查循环依赖
      if (dep.from === dep.to) {
        throw new Error(`步骤不能依赖自己: ${dep.from}`);
      }
    }
  }

  // 验证全局超时（如果提供）
  if (workflow.timeout !== undefined && (typeof workflow.timeout !== 'number' || workflow.timeout <= 0)) {
    throw new Error('全局超时时间必须是正数');
  }
}

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  /** 步骤ID */
  id: string;

  /** 步骤名称 */
  name: string;

  /** 执行该步骤的Agent名称 */
  agentName: string;

  /** 从前序步骤输出映射输入 */
  inputMapping?: Record<string, string>;

  /** 超时时间（毫秒） */
  timeout?: number;

  /** 是否需要人工审批 */
  requiresApproval?: boolean;

  /** 审批提示信息 */
  approvalPrompt?: string;

  /** 步骤描述 */
  description?: string;
}

/**
 * 工作流定义
 */
export interface WorkflowDefinition {
  /** 工作流ID */
  id: string;

  /** 工作流名称 */
  name: string;

  /** 工作流描述 */
  description?: string;

  /** 步骤列表 */
  steps: WorkflowStep[];

  /** 步骤依赖关系 */
  dependencies?: Array<{ from: string; to: string }>;

  /** 初始输入 */
  initialInput?: unknown;

  /** 是否启用检查点 */
  enableCheckpoints?: boolean;

  /** 全局超时时间（毫秒） */
  timeout?: number;
}

/**
 * 工作流步骤结果
 */
export interface WorkflowStepResult {
  /** 步骤ID */
  stepId: string;

  /** 步骤名称 */
  stepName: string;

  /** 执行的Agent名称 */
  agentName: string;

  /** 步骤输出 */
  output: unknown;

  /** 是否成功 */
  success: boolean;

  /** 错误信息 */
  error?: string;

  /** 执行开始时间 */
  startTime: Date;

  /** 执行结束时间 */
  endTime: Date;

  /** 执行耗时（毫秒） */
  duration: number;

  /** 是否经过审批 */
  approved?: boolean;

  /** 审批反馈 */
  approvalFeedback?: string;
}

/**
 * 工作流执行结果
 */
export interface WorkflowResult {
  /** 工作流ID */
  workflowId: string;

  /** 执行ID */
  executionId: string;

  /** 是否成功 */
  success: boolean;

  /** 步骤结果列表 */
  stepResults: WorkflowStepResult[];

  /** 最终输出 */
  finalOutput: unknown;

  /** 执行开始时间 */
  startTime: Date;

  /** 执行结束时间 */
  endTime: Date;

  /** 总耗时（毫秒） */
  totalDuration: number;

  /** 错误信息 */
  error?: string;
}

/**
 * 工作流配置
 */
export interface WorkflowEngineConfig {
  /** 事件总线 */
  eventBus: EventBus;

  /** 记忆存储 */
  memory: MemoryStore;

  /** Agent注册表 */
  agents: Map<string, Agent>;

  /** 审批流程（可选） */
  approvalFlow?: ApprovalFlow;

  /** 检查点管理器（可选） */
  checkpointManager?: CheckpointManager;
}

/**
 * 工作流引擎
 */
export class WorkflowEngine {
  private config: WorkflowEngineConfig;
  private activeWorkflows = new Map<string, WorkflowExecution>();
  private readonly MAX_ACTIVE_WORKFLOWS = 100; // 最大活动工作流数量

  constructor(config: WorkflowEngineConfig) {
    this.config = config;
  }

  /**
   * 清理旧的工作流执行记录
   */
  private cleanupOldWorkflows(): void {
    if (this.activeWorkflows.size <= this.MAX_ACTIVE_WORKFLOWS) {
      return;
    }

    // 获取所有执行并按开始时间排序
    const executions = Array.from(this.activeWorkflows.values())
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // 删除最旧的20%
    const toDelete = Math.floor(executions.length * 0.2);
    for (let i = 0; i < toDelete; i++) {
      this.activeWorkflows.delete(executions[i].executionId);
    }

    console.log(`[WorkflowEngine] 已清理 ${toDelete} 个旧工作流执行记录`);
  }

  /**
   * 执行工作流
   *
   * @param workflow 工作流定义
   * @param initialInput 初始输入
   * @returns 工作流执行结果
   */
  async execute(
    workflow: WorkflowDefinition,
    initialInput?: unknown
  ): Promise<WorkflowResult> {
    // 验证工作流定义
    validateWorkflow(workflow);

    const executionId = uuidv4();
    const startTime = new Date();

    console.log(`[WorkflowEngine] 开始执行工作流: ${workflow.name} (执行ID: ${executionId})`);

    // 定期清理旧的工作流执行记录
    this.cleanupOldWorkflows();

    const execution: WorkflowExecution = {
      workflowId: workflow.id,
      executionId,
      workflow,
      currentStepIndex: 0,
      stepResults: [],
      stepOutputs: new Map(),
      startTime,
      initialInput,
    };

    this.activeWorkflows.set(executionId, execution);

    return this.runExecution(execution);
  }

  private async runExecution(execution: WorkflowExecution): Promise<WorkflowResult> {
    const workflow = execution.workflow;
    const startTime = execution.startTime;

    try {
      for (let i = execution.currentStepIndex; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        execution.currentStepIndex = i;

        if (execution.paused) {
          await this.saveCheckpoint(execution);
          throw new Error(`WORKFLOW_PAUSED:${execution.executionId}`);
        }

        if (workflow.dependencies) {
          const dependencies = workflow.dependencies.filter((d) => d.to === step.id);
          for (const dep of dependencies) {
            const depResult = execution.stepResults.find((r) => r.stepId === dep.from);
            if (!depResult || !depResult.success) {
              throw new Error(`步骤 ${step.id} 的依赖 ${dep.from} 执行失败或未完成`);
            }
          }
        }

        const stepResult = await this.executeStep(step, execution, execution.initialInput);
        execution.stepResults.push(stepResult);
        execution.stepOutputs.set(step.id, stepResult.output);

        if (workflow.enableCheckpoints) {
          await this.saveCheckpoint(execution);
        }

        if (!stepResult.success) {
          throw new Error(`步骤 ${step.id} 执行失败: ${stepResult.error}`);
        }
      }

      const endTime = new Date();
      const finalOutput = this.extractFinalOutput(execution);

      const result: WorkflowResult = {
        workflowId: workflow.id,
        executionId: execution.executionId,
        success: true,
        stepResults: execution.stepResults,
        finalOutput,
        startTime,
        endTime,
        totalDuration: endTime.getTime() - startTime.getTime(),
      };

      console.log(`[WorkflowEngine] 工作流执行成功: ${workflow.name} (耗时: ${result.totalDuration}ms)`);

      return result;
    } catch (error) {
      const endTime = new Date();
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.startsWith('WORKFLOW_PAUSED:')) {
        console.log(`[WorkflowEngine] 工作流已暂停: ${workflow.name} (执行ID: ${execution.executionId})`);
        return {
          workflowId: workflow.id,
          executionId: execution.executionId,
          success: false,
          stepResults: execution.stepResults,
          finalOutput: null,
          startTime,
          endTime,
          totalDuration: endTime.getTime() - startTime.getTime(),
          error: '工作流已暂停',
        };
      }

      const result: WorkflowResult = {
        workflowId: workflow.id,
        executionId: execution.executionId,
        success: false,
        stepResults: execution.stepResults,
        finalOutput: null,
        startTime,
        endTime,
        totalDuration: endTime.getTime() - startTime.getTime(),
        error: errorMessage,
      };

      console.error(`[WorkflowEngine] 工作流执行失败: ${workflow.name} - ${errorMessage}`);

      return result;
    } finally {
      if (!execution.paused) {
        this.activeWorkflows.delete(execution.executionId);
      }
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    initialInput?: unknown
  ): Promise<WorkflowStepResult> {
    const startTime = new Date();
    console.log(`[WorkflowEngine] 执行步骤: ${step.name} (Agent: ${step.agentName})`);

    try {
      // 获取Agent
      const agent = this.config.agents.get(step.agentName);
      if (!agent) {
        throw new Error(`Agent不存在: ${step.agentName}`);
      }

      // 准备输入（应用inputMapping）
      const stepInput = this.prepareStepInput(step, execution, initialInput);

      // 执行Agent
      const output = await (agent as Agent).execute(stepInput);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      let stepResult: WorkflowStepResult = {
        stepId: step.id,
        stepName: step.name,
        agentName: step.agentName,
        output,
        success: true,
        startTime,
        endTime,
        duration,
      };

      // 如果需要审批，请求审批
      if (step.requiresApproval && this.config.approvalFlow) {
        console.log(`[WorkflowEngine] 步骤 ${step.name} 需要审批`);

        const context: ExecutionContext = {
          executionId: execution.executionId,
          agentName: step.agentName,
          startTime,
          currentStage: 'act' as any,
          memory: this.config.memory,
          eventBus: this.config.eventBus,
          tools: agent.getTools(),
          llm: agent.getLlm(),
          metadata: {},
          sharedState: new Map(),
        };

        const approval = await this.config.approvalFlow.requestApproval(output, context);

        stepResult.approved = approval.approved;
        stepResult.approvalFeedback = approval.feedback?.content;

        if (!approval.approved) {
          // 审批未通过，步骤失败
          stepResult.success = false;
          stepResult.error = '审批未通过';

          // 如果有修正，使用修正后的输出
          if (approval.feedback?.corrections) {
            stepResult.output = approval.feedback.corrections.output;
          }
        }
      }

      console.log(`[WorkflowEngine] 步骤 ${step.name} 执行成功 (耗时: ${duration}ms)`);

      return stepResult;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`[WorkflowEngine] 步骤 ${step.name} 执行失败: ${errorMessage}`);

      return {
        stepId: step.id,
        stepName: step.name,
        agentName: step.agentName,
        output: null,
        success: false,
        error: errorMessage,
        startTime,
        endTime,
        duration,
      };
    }
  }

  /**
   * 准备步骤输入（应用inputMapping）
   */
  private prepareStepInput(
    step: WorkflowStep,
    execution: WorkflowExecution,
    initialInput?: unknown
  ): unknown {
    if (!step.inputMapping || Object.keys(step.inputMapping).length === 0) {
      // 没有inputMapping，使用initialInput或前一个步骤的输出
      if (execution.stepResults.length === 0) {
        return initialInput;
      }
      return execution.stepResults[execution.stepResults.length - 1].output;
    }

    // 应用inputMapping
    const input: Record<string, unknown> = {};

    for (const [targetKey, sourcePath] of Object.entries(step.inputMapping)) {
      // 解析sourcePath，例如 "steps.validate-input.technicalDisclosure"
      const parts = sourcePath.split('.');

      if (parts[0] === 'input') {
        // 从initialInput获取
        input[targetKey] = initialInput;
      } else if (parts[0] === 'steps') {
        // 从前序步骤获取
        const sourceStepId = parts[1];
        const sourceResult = execution.stepResults.find((r) => r.stepId === sourceStepId);
        if (sourceResult) {
          input[targetKey] = sourceResult.output;
        }
      }
    }

    return input;
  }

  /**
   * 提取最终输出
   */
  private extractFinalOutput(execution: WorkflowExecution): unknown {
    if (execution.stepResults.length === 0) {
      return null;
    }

    // 返回最后一个步骤的输出
    return execution.stepResults[execution.stepResults.length - 1].output;
  }

  private async saveCheckpoint(execution: WorkflowExecution): Promise<void> {
    if (!this.config.checkpointManager) {
      return;
    }

    try {
      await this.config.checkpointManager.saveCheckpoint(
        'workflow-engine',
        execution.executionId,
        execution.currentStepIndex,
        Object.fromEntries(execution.stepOutputs),
        {
          workflowId: execution.workflowId,
          currentStepIndex: execution.currentStepIndex,
          stepResults: execution.stepResults,
          initialInput: execution.initialInput,
        },
        { paused: execution.paused, workflow: execution.workflow },
        ['workflow'],
        `工作流 ${execution.workflowId} 步骤 ${execution.currentStepIndex}`
      );
    } catch (error) {
      console.error(`[WorkflowEngine] 保存检查点失败: ${error}`);
    }
  }

  async pause(executionId: string): Promise<void> {
    const execution = this.activeWorkflows.get(executionId);
    if (!execution) {
      throw new Error(`执行不存在: ${executionId}`);
    }

    execution.paused = true;
    await this.saveCheckpoint(execution);
    console.log(`[WorkflowEngine] 工作流已暂停: ${executionId}`);
  }

  async resume(executionId: string): Promise<WorkflowResult> {
    let execution = this.activeWorkflows.get(executionId);

    if (!execution && this.config.checkpointManager) {
      try {
        const checkpoints = await this.config.checkpointManager.listCheckpoints({
          executionId,
        });

        if (checkpoints.length > 0) {
          const latest = checkpoints[checkpoints.length - 1];

          if (!latest.contextSnapshot || typeof latest.contextSnapshot !== 'object') {
            throw new Error(`检查点上下文无效: ${executionId}`);
          }

          const context = latest.contextSnapshot as Record<string, unknown>;
          const workflowDef = latest.stateSnapshot?.workflow;

          if (!workflowDef || typeof workflowDef !== 'object') {
            throw new Error(`检查点中未找到工作流定义: ${executionId}`);
          }

          const workflowId = typeof context.workflowId === 'string' ? context.workflowId : executionId;
          const currentStepIndex = typeof context.currentStepIndex === 'number' ? context.currentStepIndex : 0;
          const stepResults = Array.isArray(context.stepResults) ? (context.stepResults as WorkflowStepResult[]) : [];
          const startTime = this.parseStartTime(context.startTime);

          execution = {
            workflowId,
            executionId,
            workflow: workflowDef as WorkflowDefinition,
            currentStepIndex,
            stepResults,
            stepOutputs: new Map(Object.entries(latest.memorySnapshot ?? {})),
            startTime,
            initialInput: context.initialInput,
          };
        }
      } catch (error) {
        console.error(`[WorkflowEngine] 从检查点恢复失败: ${error}`);
        throw error;
      }
    }

    if (!execution) {
      throw new Error(`无法恢复执行: ${executionId}，未找到执行记录或检查点`);
    }

    execution.paused = false;
    this.activeWorkflows.set(executionId, execution);

    console.log(`[WorkflowEngine] 恢复工作流执行: ${executionId} (从步骤 ${execution.currentStepIndex})`);

    return this.runExecution(execution);
  }

  private parseStartTime(value: unknown): Date {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    if (typeof value === 'number') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  }
}

/**
 * 工作流执行上下文
 */
interface WorkflowExecution {
  /** 工作流ID */
  workflowId: string;

  /** 执行ID */
  executionId: string;

  /** 工作流定义 */
  workflow: WorkflowDefinition;

  /** 当前步骤索引 */
  currentStepIndex: number;

  /** 步骤结果列表 */
  stepResults: WorkflowStepResult[];

  /** 步骤输出映射 */
  stepOutputs: Map<string, unknown>;

  /** 开始时间 */
  startTime: Date;

  paused?: boolean;
  initialInput?: unknown;
}
