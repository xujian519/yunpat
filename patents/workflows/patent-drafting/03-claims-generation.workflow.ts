import type { WorkflowDefinition } from '@yunpat/core'
import { ClaimGeneratorAgent, ClaimsRenderer } from '@yunpat/agent-claim-generator'
import type { InventionUnderstandingOutput } from '@yunpat/agent-invention'
import type { PriorArtSearchOutput } from '@yunpat/agent-prior-art-search'

export function createClaimsGenerationWorkflow(): WorkflowDefinition {
  return {
    id: 'claims-generation',
    name: '权利要求生成工作流',
    description: '基于发明理解和检索分析撰写权利要求书',
    steps: [
      {
        id: 'validate-input',
        name: '验证输入',
        agentName: 'input-validator',
        description: '验证发明理解和检索分析结果',
        inputMapping: {
          inventionUnderstanding: 'input.inventionUnderstanding',
          priorArtSearch: 'input.priorArtSearch',
        },
        requiresApproval: false,
      },
      {
        id: 'generate-independent-claims',
        name: '生成独立权利要求',
        agentName: 'claim-generator',
        description: '撰写独立权利要求（最关键）',
        inputMapping: {
          inventionUnderstanding: 'input.inventionUnderstanding',
          priorArtSearch: 'input.priorArtSearch',
        },
        requiresApproval: true,
        approvalPrompt: '请审核独立权利要求的保护范围是否准确',
      },
      {
        id: 'generate-dependent-claims',
        name: '生成从属权利要求',
        agentName: 'claim-generator',
        description: '撰写从属权利要求（进一步限定）',
        inputMapping: {
          claimsDraft: 'steps.generate-independent-claims.output',
        },
        requiresApproval: true,
        approvalPrompt: '请审核从属权利要求是否合理',
      },
      {
        id: 'quality-check',
        name: '质量检查',
        agentName: 'claim-generator',
        description: '检查清楚性、支持性、必要技术特征',
        inputMapping: {
          claimsSet: 'steps.generate-dependent-claims.output.claimsSet',
        },
        requiresApproval: false,
      },
      {
        id: 'render-report',
        name: '生成权利要求书',
        agentName: 'claims-renderer',
        description: '将权利要求集合渲染为标准格式',
        inputMapping: {
          claimsOutput: 'steps.quality-check.output',
        },
      },
    ],
    enableCheckpoints: true,
  }
}

/**
 * 创建端到端工作流：发明理解 + 检索 + 权利要求
 */
export function createDraftingWorkflowPhase3(): WorkflowDefinition {
  return {
    id: 'patent-drafting-phase-3',
    name: '专利撰写Phase 3: 发明理解+检索+权利要求',
    description: '完整的专利撰写前期流程',
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
      {
        id: 'claims-generation',
        name: '权利要求生成',
        agentName: 'claim-generator',
        description: '撰写权利要求书',
        inputMapping: {
          inventionUnderstanding: 'steps.invention-understanding.output',
          priorArtSearch: 'steps.prior-art-search.output',
        },
        requiresApproval: true,
        approvalPrompt: '请审核权利要求是否准确完整',
      },
    ],
    dependencies: [
      { from: 'invention-understanding', to: 'prior-art-search' },
      { from: 'prior-art-search', to: 'claims-generation' }
    ],
    enableCheckpoints: true,
  }
}
