import type { WorkflowDefinition } from '@yunpat/core'

/**
 * 完整的专利撰写工作流
 *
 * 从技术交底书到完整专利申请文件的端到端流程
 *
 * 正确的专业流程（参考专利代理人实际工作流程）：
 * 1. 验证输入 → 发明理解 → [人类确认]
 * 2. 检索策略 → 执行检索 → 对比分析 → [人类确认]
 * 3. 说明书撰写 → [人类确认] ← 充分公开，为权利要求提供支持
 * 4. 权利要求布局规划 → [人类确认]
 * 5. 独立权利要求 → [人类确认] ← 以说明书为依据（A26.4）
 * 6. 从属权利要求 → [人类确认]
 * 7. 摘要撰写 → [人类确认] ← 最后撰写，总结全文
 * 8. 质量检查 → 输出完整文件
 *
 * 关键原则：
 * - 说明书在权利要求之前（支持性原则 A26.4）
 * - 摘要在最后撰写（总结性内容）
 */
export function createFullPatentDraftingWorkflow(): WorkflowDefinition {
  return {
    id: 'full-patent-drafting',
    name: '完整专利撰写工作流',
    description: '从技术交底书到完整专利申请文件的端到端流程',
    steps: [
      // ===== Phase 1: 发明理解 =====
      {
        id: 'validate-disclosure',
        name: '验证技术交底书',
        agentName: 'input-validator',
        description: '验证输入文件的完整性和格式',
        inputMapping: {
          technicalDisclosure: 'input.technicalDisclosure',
          title: 'input.title',
          field: 'input.field',
        },
        requiresApproval: false,
      },
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
        approvalPrompt: '请审核发明理解结果是否准确完整。关键要点：技术领域、技术问题、技术方案、关键特征',
      },

      // ===== Phase 2: 先导技术检索 =====
      {
        id: 'prior-art-search',
        name: '先导技术检索',
        agentName: 'prior-art-search',
        description: '构建检索策略并分析现有技术',
        inputMapping: {
          inventionUnderstanding: 'steps.invention-understanding.output',
        },
        requiresApproval: true,
        approvalPrompt: '请审核检索策略和对比分析。关键要点：检索关键词、最接近现有技术、区别特征、创造性评估',
      },

      // ===== Phase 3: 说明书撰写 =====
      // 注意：说明书必须在权利要求之前撰写（A26.4支持性原则）
      {
        id: 'specification-drafting',
        name: '说明书撰写',
        agentName: 'specification-drafter',
        description: '分章节撰写说明书（技术领域、背景技术、发明内容、具体实施方式、附图说明）',
        inputMapping: {
          inventionUnderstanding: 'steps.invention-understanding.output',
          priorArtSearch: 'steps.prior-art-search.output',
          drawings: 'input.drawings',
        },
        requiresApproval: true,
        approvalPrompt: '请审核说明书内容。关键要点：充分公开原则（清楚、完整、能够实现）、术语统一性、各章节完整性',
      },

      // ===== Phase 4: 权利要求撰写 =====
      // 注意：权利要求以说明书为依据（A26.4），因此在说明书之后撰写
      {
        id: 'claims-layout-planning',
        name: '权利要求布局规划',
        agentName: 'claim-generator',
        description: '规划权利要求布局（独立+从属）',
        inputMapping: {
          inventionUnderstanding: 'steps.invention-understanding.output',
          priorArtSearch: 'steps.prior-art-search.output',
          specification: 'steps.specification-drafting.output',
        },
        requiresApproval: true,
        approvalPrompt: '请审核权利要求布局策略。关键要点：独立权利要求数量、从属权利要求层级、保护范围',
      },
      {
        id: 'generate-independent-claims',
        name: '生成独立权利要求',
        agentName: 'claim-generator',
        description: '撰写独立权利要求（最关键）',
        inputMapping: {
          inventionUnderstanding: 'steps.invention-understanding.output',
          priorArtSearch: 'steps.prior-art-search.output',
          specification: 'steps.specification-drafting.output',
        },
        requiresApproval: true,
        approvalPrompt: '请重点审核独立权利要求。关键要点：前序部分、特征部分、必要技术特征是否完整、保护范围是否合理、是否得到说明书支持',
      },
      {
        id: 'generate-dependent-claims',
        name: '生成从属权利要求',
        agentName: 'claim-generator',
        description: '撰写从属权利要求（进一步限定）',
        inputMapping: {
          independentClaims: 'steps.generate-independent-claims.output.independentClaims',
          specification: 'steps.specification-drafting.output',
        },
        requiresApproval: true,
        approvalPrompt: '请审核从属权利要求。关键要点：引用关系、附加特征、限定类型、是否得到说明书支持',
      },

      // ===== Phase 5: 摘要撰写 =====
      // 注意：摘要在最后撰写，用于总结整个发明
      {
        id: 'abstract-drafting',
        name: '摘要撰写',
        agentName: 'abstract-drafter',
        description: '撰写专利摘要（总结技术方案、有益效果、应用领域）',
        inputMapping: {
          inventionUnderstanding: 'steps.invention-understanding.output',
          specification: 'steps.specification-drafting.output',
          claims: 'steps.generate-dependent-claims.output',
        },
        requiresApproval: true,
        approvalPrompt: '请审核摘要。关键要点：简洁明了（通常不超过300字）、准确反映技术方案和有益效果',
      },

      // ===== Phase 4: 质量检查 =====
      {
        id: 'quality-check',
        name: '质量检查',
        agentName: 'quality-checker',
        description: '全面检查专利申请文件质量',
        inputMapping: {
          inventionUnderstanding: 'steps.invention-understanding.output',
          priorArtSearch: 'steps.prior-art-search.output',
          claimsSet: 'steps.generate-dependent-claims.output',
        },
        requiresApproval: false,
      },
      {
        id: 'render-final-document',
        name: '生成最终文档',
        agentName: 'document-renderer',
        description: '生成完整的专利申请文件',
        inputMapping: {
          allSteps: 'steps.*.output',
        },
        requiresApproval: false,
      },
    ],
    dependencies: [
      { from: 'validate-disclosure', to: 'invention-understanding' },
      { from: 'invention-understanding', to: 'prior-art-search' },
      { from: 'prior-art-search', to: 'specification-drafting' },
      { from: 'specification-drafting', to: 'claims-layout-planning' },
      { from: 'claims-layout-planning', to: 'generate-independent-claims' },
      { from: 'generate-independent-claims', to: 'generate-dependent-claims' },
      { from: 'generate-dependent-claims', to: 'abstract-drafting' },
      { from: 'abstract-drafting', to: 'quality-check' },
      { from: 'quality-check', to: 'render-final-document' },
    ],
    enableCheckpoints: true,
  }
}

/**
 * 快速专利撰写工作流（非交互式）
 *
 * 适用于批量处理或自动化场景
 *
 * 正确的专业流程：
 * 1. 发明理解
 * 2. 现有技术检索
 * 3. 说明书撰写
 * 4. 权利要求撰写
 * 5. 摘要撰写
 */
export function createQuickPatentDraftingWorkflow(): WorkflowDefinition {
  return {
    id: 'quick-patent-drafting',
    name: '快速专利撰写工作流',
    description: '自动化专利撰写流程，无需人工确认',
    steps: [
      {
        id: 'invention-understanding',
        name: '发明理解',
        agentName: 'invention-understanding',
        description: '分析技术交底书',
        inputMapping: {
          title: 'input.title',
          field: 'input.field',
          technicalDisclosure: 'input.technicalDisclosure',
          drawings: 'input.drawings',
        },
        requiresApproval: false,
      },
      {
        id: 'prior-art-search',
        name: '先导技术检索',
        agentName: 'prior-art-search',
        description: '构建检索策略',
        inputMapping: {
          inventionUnderstanding: 'steps.invention-understanding.output',
        },
        requiresApproval: false,
      },
      {
        id: 'specification-drafting',
        name: '说明书撰写',
        agentName: 'specification-drafter',
        description: '撰写说明书',
        inputMapping: {
          inventionUnderstanding: 'steps.invention-understanding.output',
          priorArtSearch: 'steps.prior-art-search.output',
          drawings: 'input.drawings',
        },
        requiresApproval: false,
      },
      {
        id: 'claims-generation',
        name: '权利要求生成',
        agentName: 'claim-generator',
        description: '撰写权利要求书',
        inputMapping: {
          inventionUnderstanding: 'steps.invention-understanding.output',
          priorArtSearch: 'steps.prior-art-search.output',
          specification: 'steps.specification-drafting.output',
        },
        requiresApproval: false,
      },
      {
        id: 'abstract-drafting',
        name: '摘要撰写',
        agentName: 'abstract-drafter',
        description: '撰写摘要',
        inputMapping: {
          inventionUnderstanding: 'steps.invention-understanding.output',
          specification: 'steps.specification-drafting.output',
          claims: 'steps.claims-generation.output',
        },
        requiresApproval: false,
      },
      {
        id: 'render-document',
        name: '生成文档',
        agentName: 'document-renderer',
        description: '生成专利申请文件',
        inputMapping: {
          allSteps: 'steps.*.output',
        },
        requiresApproval: false,
      },
    ],
    dependencies: [
      { from: 'invention-understanding', to: 'prior-art-search' },
      { from: 'prior-art-search', to: 'specification-drafting' },
      { from: 'specification-drafting', to: 'claims-generation' },
      { from: 'claims-generation', to: 'abstract-drafting' },
      { from: 'abstract-drafting', to: 'render-document' },
    ],
    enableCheckpoints: false, // 快速模式不使用检查点
  }
}
