/**
 * agentManifest - Agent 声明式清单
 *
 * 定义 agentId → 包名/类名/默认描述的映射。
 * AgentFactory 遍历此清单按需实例化 Agent。
 */

export interface AgentManifestEntry {
  /** 唯一标识符，对应 TaskStep.agentId */
  agentId: string
  /** npm 包名 */
  packageName: string
  /** 导出的类名 */
  className: string
  /** 默认名称 */
  defaultName: string
  /** 默认描述 */
  defaultDescription: string
  /** 能力标签，供路由匹配使用 */
  capabilities?: string[]
  /** 触发关键词，供意图分类参考 */
  triggerKeywords?: string[]
  /** 所属层级 */
  layer?: 'domain' | 'execution'
  /** 默认超时（毫秒） */
  defaultTimeout?: number
  /** 是否支持 HITL 检查点 */
  hitlCapable?: boolean
}

/**
 * 全量 Agent 清单
 *
 * 每项对应 packages/agents/ 下的一个包。
 * 添加新 Agent 只需在此追加一行。
 */
export const agentManifest: AgentManifestEntry[] = [
  // ===== 核心业务 Agent =====
  {
    agentId: 'invention',
    packageName: '@yunpat/agent-invention',
    className: 'InventionUnderstandingAgent',
    defaultName: 'invention-understanding',
    defaultDescription: '发明理解智能体',
    capabilities: ['understand', 'extract', 'disclosure'],
    triggerKeywords: ['技术交底书', '发明理解', '技术方案'],
    layer: 'domain',
    defaultTimeout: 45000,
    hitlCapable: false,
  },
  {
    agentId: 'search',
    packageName: '@yunpat/agent-search',
    className: 'PatentSearchAgent',
    defaultName: 'patent-search',
    defaultDescription: '专利检索智能体',
    capabilities: ['search', 'prior-art'],
    triggerKeywords: ['检索', '搜索', '查新', '现有技术'],
    layer: 'execution',
    defaultTimeout: 30000,
    hitlCapable: false,
  },
  {
    agentId: 'prior-art-search',
    packageName: '@yunpat/agent-prior-art-search',
    className: 'PriorArtSearchAgent',
    defaultName: 'prior-art-search',
    defaultDescription: '现有技术检索智能体',
    capabilities: ['search', 'prior-art', 'iterative'],
    triggerKeywords: ['现有技术', '先验检索', '对比文献'],
    layer: 'execution',
    defaultTimeout: 60000,
    hitlCapable: false,
  },
  {
    agentId: 'patent-responder',
    packageName: '@yunpat/agent-patent-responder',
    className: 'PatentResponderAgent',
    defaultName: 'patent-responder',
    defaultDescription: '审查答复智能体',
    capabilities: ['respond', 'oa', 'office-action'],
    triggerKeywords: ['审查意见', 'OA', '答复', '驳回'],
    layer: 'domain',
    defaultTimeout: 90000,
    hitlCapable: true,
  },
  {
    agentId: 'patent-analyzer',
    packageName: '@yunpat/agent-patent-analyzer',
    className: 'PatentAnalyzerAgent',
    defaultName: 'patent-analyzer',
    defaultDescription: '专利分析智能体',
    capabilities: ['analyze', 'portfolio', 'distribution'],
    triggerKeywords: ['专利组合', '专利分析', '技术布局'],
    layer: 'domain',
    defaultTimeout: 45000,
    hitlCapable: false,
  },

  // ===== 权利要求相关 =====
  {
    agentId: 'claim-generator',
    packageName: '@yunpat/agent-claim-generator',
    className: 'ClaimGeneratorAgent',
    defaultName: 'claim-generator',
    defaultDescription: '权利要求生成智能体（含形式检查）',
    capabilities: ['claims', 'generate', 'check', 'formality'],
    triggerKeywords: ['权利要求', '权要', 'Claims', '形式检查'],
    layer: 'execution',
    defaultTimeout: 40000,
    hitlCapable: true,
  },

  // ===== 说明书相关 =====
  {
    agentId: 'specification-drafter',
    packageName: '@yunpat/agent-specification-drafter',
    className: 'SpecificationDrafterAgent',
    defaultName: 'specification-drafter',
    defaultDescription: '说明书撰写智能体',
    capabilities: ['specification', 'draft'],
    triggerKeywords: ['说明书', '具体实施方式', '背景技术'],
    layer: 'execution',
    defaultTimeout: 50000,
    hitlCapable: false,
  },
  {
    agentId: 'spec-formality-checker',
    packageName: '@yunpat/spec-formality-checker',
    className: 'SpecFormalityChecker',
    defaultName: 'spec-formality-checker',
    defaultDescription: '说明书形式检查智能体',
    capabilities: ['specification', 'check', 'formality'],
    triggerKeywords: ['说明书检查'],
    layer: 'execution',
    defaultTimeout: 15000,
    hitlCapable: false,
  },

  // ===== 摘要/通用写作 =====
  {
    agentId: 'abstract-drafter',
    packageName: '@yunpat/agent-abstract-drafter',
    className: 'AbstractDrafterAgent',
    defaultName: 'abstract-drafter',
    defaultDescription: '摘要撰写智能体',
    capabilities: ['abstract', 'draft'],
    triggerKeywords: ['摘要'],
    layer: 'execution',
    defaultTimeout: 20000,
    hitlCapable: false,
  },
  {
    agentId: 'writer',
    packageName: '@yunpat/agent-writer',
    className: 'WriterAgent',
    defaultName: 'writer',
    defaultDescription: '通用写作智能体',
    capabilities: ['write', 'general'],
    triggerKeywords: ['写作', '撰写'],
    layer: 'execution',
    defaultTimeout: 30000,
    hitlCapable: false,
  },

  // ===== 分析/研究 =====
  {
    agentId: 'analysis',
    packageName: '@yunpat/agent-analysis',
    className: 'PatentTechnicalAnalyzerAgent',
    defaultName: 'patent-analyzer-tech',
    defaultDescription: '专利技术分析智能体',
    capabilities: ['analyze', 'technical', 'compare'],
    triggerKeywords: ['技术分析', '特征比对', '技术特征'],
    layer: 'execution',
    defaultTimeout: 35000,
    hitlCapable: false,
  },
  {
    agentId: 'comparison-report-generator',
    packageName: '@yunpat/comparison-report-generator',
    className: 'ComparisonReportGeneratorAgent',
    defaultName: 'comparison-report',
    defaultDescription: '对比报告生成智能体',
    capabilities: ['compare', 'report'],
    triggerKeywords: ['对比报告', '比对'],
    layer: 'execution',
    defaultTimeout: 30000,
    hitlCapable: false,
  },
  {
    agentId: 'researcher',
    packageName: '@yunpat/agent-researcher',
    className: 'ResearcherAgent',
    defaultName: 'researcher',
    defaultDescription: '调研分析智能体',
    capabilities: ['research', 'investigate'],
    triggerKeywords: ['调研', '研究'],
    layer: 'execution',
    defaultTimeout: 40000,
    hitlCapable: false,
  },

  // ===== 质量检查 =====
  {
    agentId: 'quality',
    packageName: '@yunpat/agent-quality',
    className: 'QualityCheckerAgent',
    defaultName: 'quality-checker',
    defaultDescription: '质量检查智能体',
    capabilities: ['quality', 'check', 'review'],
    triggerKeywords: ['质量检查', '审查'],
    layer: 'execution',
    defaultTimeout: 25000,
    hitlCapable: false,
  },
  {
    agentId: 'quality-checker',
    packageName: '@yunpat/quality-checker',
    className: 'QualityCheckerAgent',
    defaultName: 'quality-checker-alt',
    defaultDescription: '质量检查智能体（备选）',
    capabilities: ['quality', 'check'],
    triggerKeywords: ['质量检查'],
    layer: 'execution',
    defaultTimeout: 25000,
    hitlCapable: false,
  },
  {
    agentId: 'subject-matter-checker',
    packageName: '@yunpat/subject-matter-checker',
    className: 'SubjectMatterChecker',
    defaultName: 'subject-matter-checker',
    defaultDescription: '主题适格性检查智能体',
    capabilities: ['check', 'subject-matter', 'eligibility'],
    triggerKeywords: ['适格性', '主题检查'],
    layer: 'execution',
    defaultTimeout: 20000,
    hitlCapable: false,
  },
  {
    agentId: 'unity-checker',
    packageName: '@yunpat/unity-checker',
    className: 'UnityChecker',
    defaultName: 'unity-checker',
    defaultDescription: '单一性检查智能体',
    capabilities: ['check', 'unity'],
    triggerKeywords: ['单一性'],
    layer: 'execution',
    defaultTimeout: 20000,
    hitlCapable: false,
  },

  // ===== 格式/转换 =====
  {
    agentId: 'format-converter',
    packageName: '@yunpat/format-converter',
    className: 'PatentFormatConverterAgent',
    defaultName: 'format-converter',
    defaultDescription: '专利格式转换智能体',
    capabilities: ['convert', 'format'],
    triggerKeywords: ['格式转换', '导出'],
    layer: 'execution',
    defaultTimeout: 15000,
    hitlCapable: false,
  },

  // ===== 其他专业 Agent =====
  {
    agentId: 'image-understanding',
    packageName: '@yunpat/agent-image-understanding',
    className: 'DrawingUnderstandingAgent',
    defaultName: 'image-understanding',
    defaultDescription: '图纸理解智能体',
    capabilities: ['image', 'understand', 'drawing'],
    triggerKeywords: ['图纸', '附图'],
    layer: 'execution',
    defaultTimeout: 30000,
    hitlCapable: false,
  },
  {
    agentId: 'patent-manager',
    packageName: '@yunpat/agent-patent-manager',
    className: 'PatentManagerAgent',
    defaultName: 'patent-manager',
    defaultDescription: '专利档案管理智能体',
    capabilities: ['manage', 'status', 'portfolio'],
    triggerKeywords: ['专利管理', '状态查询', '年费'],
    layer: 'domain',
    defaultTimeout: 20000,
    hitlCapable: false,
  },
  {
    agentId: 'technical-drawing',
    packageName: '@yunpat/technical-drawing',
    className: 'TechnicalDrawingAgent',
    defaultName: 'technical-drawing',
    defaultDescription: '技术绘图智能体',
    capabilities: ['drawing', 'generate', 'diagram'],
    triggerKeywords: ['绘图', '附图生成'],
    layer: 'execution',
    defaultTimeout: 30000,
    hitlCapable: false,
  },

  // ===== 技术特征分析 =====
  {
    agentId: 'tech-unit',
    packageName: '@yunpat/agent-tech-unit',
    className: 'MinimumTechUnitAgent',
    defaultName: 'tech-unit',
    defaultDescription: '最小技术单元识别智能体',
    capabilities: ['tech-unit', 'extract', 'infringement'],
    triggerKeywords: ['技术特征', '技术单元', '侵权分析', '最小技术单元'],
    layer: 'execution',
    defaultTimeout: 35000,
    hitlCapable: false,
  },

  // ===== 法律问答 =====
  {
    agentId: 'legal-qa',
    packageName: '@yunpat/agent-legal-qa',
    className: 'LegalQAAgent',
    defaultName: 'legal-qa',
    defaultDescription: '法律知识问答智能体（三库联动）',
    capabilities: ['legal', 'qa', 'knowledge'],
    triggerKeywords: ['法律问答', '法条', '法律知识', '三库联动'],
    layer: 'domain',
    defaultTimeout: 30000,
    hitlCapable: false,
  },
]
