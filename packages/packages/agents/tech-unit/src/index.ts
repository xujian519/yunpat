/**
 * @yunpat/agent-tech-unit - 最小技术单元提取智能体
 *
 * 专利技术特征划分与最小技术单元识别
 * 基于《专利侵权判定指南》第8条及最高人民法院判例
 */

export { MinimumTechUnitAgent } from './MinimumTechUnitAgent.js'

export type {
  TechnicalSchemeType,
  TechUnitScenario,
  TechUnitCriteria,
  MinimumTechUnit,
  IndivisibilityTestResult,
  SynergyTestResult,
  GranularityBias,
  TechUnitExtractInput,
  TechUnitExtractOutput,
  TechUnitPlan,
} from './types.js'
