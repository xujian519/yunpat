import { v4 as uuidv4 } from 'uuid'
import type { WorkflowDefinition } from '@yunpat/core'
import { PriorArtSearchAgent, SearchStrategyRenderer } from '@yunpat/agent-prior-art-search'
import type { InventionUnderstandingOutput } from '@yunpat/agent-invention'

export function createPriorArtSearchWorkflow(): WorkflowDefinition {
  return {
    id: 'prior-art-search',
    name: '先导技术检索工作流',
    description: '基于发明理解构建检索策略并分析现有技术',
    steps: [
      {
        id: 'validate-input',
        name: '验证输入',
        agentName: 'input-validator',
        description: '验证发明理解结果是否完整',
        inputMapping: {
          inventionUnderstanding: 'input.inventionUnderstanding',
        },
        requiresApproval: false,
      },
      {
        id: 'build-search-strategy',
        name: '构建检索策略',
        agentName: 'prior-art-search',
        description: 'AI生成检索关键词、IPC分类和检索式',
        inputMapping: {
          inventionUnderstanding: 'input.inventionUnderstanding',
        },
        requiresApproval: false,
      },
      {
        id: 'execute-search',
        name: '执行检索',
        agentName: 'prior-art-search',
        description: '执行检索（当前使用模拟数据）',
        inputMapping: {
          searchResults: 'steps.build-search-strategy.output.results',
        },
        requiresApproval: false,
      },
      {
        id: 'analyze-prior-art',
        name: '分析现有技术',
        agentName: 'prior-art-search',
        description: '对比分析最接近的现有技术和区别特征',
        inputMapping: {
          comparisonAnalysis: 'steps.build-search-strategy.output.comparisonAnalysis',
        },
        requiresApproval: true,
        approvalPrompt: '请审核检索策略和对比分析是否准确完整',
      },
      {
        id: 'render-report',
        name: '生成检索报告',
        agentName: 'search-strategy-renderer',
        description: '将检索结果渲染为人类可读格式',
        inputMapping: {
          searchOutput: 'steps.build-search-strategy.output',
        },
      },
    ],
    enableCheckpoints: true,
  }
}

/**
 * 创建端到端工作流：发明理解 + 先导技术检索
 */
export function createDraftingWorkflowPhase2(): WorkflowDefinition {
  return {
    id: 'patent-drafting-phase-2',
    name: '专利撰写Phase 2: 发明理解+检索',
    description: '完整的发明理解和先导技术检索流程',
    steps: [
      {
        id: 'invention-understanding',
        name: '发明理解',
        agentName: 'invention-understanding',
        description: '分析技术交底书，提取发明要点',
        inputMapping: {
          title: 'input.title',
          field: 'input.field',
          technicalDisclosure: 'input.technicalDisclosure',
          drawings: 'input.drawings',
        },
        requiresApproval: true,
        approvalPrompt: '请审核发明理解结果是否准确完整',
      },
      {
        id: 'prior-art-search',
        name: '先导技术检索',
        agentName: 'prior-art-search',
        description: '构建检索策略并分析现有技术',
        inputMapping: {
          inventionUnderstanding: 'steps.invention-understanding.output',
        },
        requiresApproval: true,
        approvalPrompt: '请审核检索策略和对比分析是否准确',
      },
    ],
    dependencies: [
      { from: 'invention-understanding', to: 'prior-art-search' }
    ],
    enableCheckpoints: true,
  }
}
