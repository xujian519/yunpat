/**
 * 内容审核服务
 *
 * 提供多种内容审核实现：
 * - OpenAI Moderation API
 * - 本地规则引擎
 * - 自定义 ML 服务
 */
/**
 * 内容审核结果
 */
export interface ModerationResult {
  /** 是否不安全 */
  isUnsafe: boolean
  /** 分数（0-1） */
  score: number
  /** 类别 */
  categories: {
    harassment?: boolean
    harassmentThreatening?: boolean
    hate?: boolean
    hateThreatening?: boolean
    selfHarm?: boolean
    sexual?: boolean
    sexualMinors?: boolean
    violence?: boolean
    violenceGraphic?: boolean
  }
  /** 原因 */
  reason?: string
}
/**
 * 内容审核服务接口
 */
export interface ContentModerationService {
  /**
   * 审核内容
   */
  moderate(content: string): Promise<ModerationResult>
}
/**
 * OpenAI Moderation API 实现
 */
export declare class OpenAIModerationService implements ContentModerationService {
  private apiKey
  private apiUrl
  constructor(apiKey: string, apiUrl?: string)
  moderate(content: string): Promise<ModerationResult>
}
/**
 * 基于规则的内容审核实现
 *
 * 使用预定义的规则进行内容审核
 */
export declare class RuleBasedModerationService implements ContentModerationService {
  private rules
  constructor()
  /**
   * 添加自定义规则
   */
  addRule(name: string, patterns: RegExp[], severity: 'low' | 'medium' | 'high'): void
  moderate(content: string): Promise<ModerationResult>
}
/**
 * 组合审核服务
 *
 * 组合多个审核服务，任一服务标记为不安全即认为不安全
 */
export declare class CombinedModerationService implements ContentModerationService {
  private services
  constructor(services: ContentModerationService[])
  moderate(content: string): Promise<ModerationResult>
}
//# sourceMappingURL=ContentModerationService.d.ts.map
