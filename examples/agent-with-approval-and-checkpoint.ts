/**
 * Agent 集成 ApprovalFlow 和 CheckpointManager 示例
 *
 * 展示如何配置Agent使其支持人机审批和检查点保存
 */

import { Agent, AgentConfig } from '@yunpat/core';
import { ApprovalFlow, ApprovalMode } from '@yunpat/core';
import { CheckpointManager } from '@yunpat/core';
import { FileSystemCheckpointStore } from '@yunpat/core';
import { EventBus } from '@yunpat/core';
import { MemoryStore } from '@yunpat/core';
import { ToolRegistry } from '@yunpat/core';
import { createDeepSeekModel } from '@yunpat/core';

/**
 * 示例Agent：专利撰写智能体
 */
class PatentWriterAgent extends Agent<string, string> {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected async plan(input: string, context: any): Promise<any> {
    console.log('[Plan] 分析技术交底书，生成撰写计划');
    return {
      steps: ['理解发明', '撰写权利要求', '撰写说明书'],
      currentStep: 0,
    };
  }

  protected async act(plan: any, context: any): Promise<string> {
    console.log(`[Act] 执行步骤: ${plan.steps[plan.currentStep]}`);
    plan.currentStep++;

    if (plan.currentStep >= plan.steps.length) {
      return '专利撰写完成';
    }

    return `正在执行: ${plan.steps[plan.currentStep - 1]}`;
  }

  protected async reflect(result: any, context: any): Promise<any> {
    console.log('[Reflect] 评估执行结果');
    return {
      shouldContinue: result.includes('正在执行'),
      quality: 0.85,
    };
  }
}

async function main() {
  // 1. 创建基础组件
  const eventBus = new EventBus();
  const memory = new MemoryStore();
  const tools = new ToolRegistry();
  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || '');

  // 2. 创建检查点存储
  const checkpointStore = new FileSystemCheckpointStore({
    rootDir: 'data/checkpoints',
  });

  const checkpointManager = new CheckpointManager({
    autoSave: true,
    autoSaveInterval: 1,
    maxCheckpoints: 100,
    store: checkpointStore, // 使用文件系统存储
  });

  // 3. 创建审批流程（CLI模式）
  const approvalFlow = new ApprovalFlow(
    {
      mode: ApprovalMode.CLI,
      defaultTimeout: 60000, // 60秒
      enableLearning: true,
    },
    eventBus
  );

  await approvalFlow.start();

  // 4. 创建Agent并集成审批和检查点
  const agent = new PatentWriterAgent({
    name: 'PatentWriterAgent',
    description: '专利撰写智能体',
    eventBus,
    memory,
    tools,
    llm,
    maxIterations: 10,

    // ========== 人机协作配置 ==========
    approvalFlow, // 审批流程
    approvalStages: ['plan', 'act'], // 在plan和act阶段请求审批

    checkpointManager, // 检查点管理器
    enableCheckpoints: true, // 启用自动检查点
  });

  // 5. 执行Agent
  try {
    const result = await agent.execute('技术交底书内容...');
    console.log('✅ 执行完成:', result);
  } catch (error) {
    console.error('❌ 执行失败:', error);
  } finally {
    await approvalFlow.stop();
  }

  // 6. 列出可恢复的执行
  const executions = await checkpointManager.listResumableExecutions();
  console.log('📋 可恢复的执行:', executions);
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
