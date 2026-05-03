/**
 * 关系抽取器
 *
 * 从专利文本中抽取实体间的关系
 * 基于规则和模式匹配识别专利关系
 */

import type { Entity } from './EntityExtractor.js'

/**
 * 关系类型定义
 */
export type RelationType =
  | 'applicant-inventor' // 申请人-发明人
  | 'cites' // 引用
  | 'cited-by' // 被引用
  | 'priority' // 优先权
  | 'family' // 同族
  | 'continuation' // 连续申请
  | 'related-to' // 相关

/**
 * 关系接口
 */
export interface Relation {
  fromEntity: string // 源实体名称
  toEntity: string // 目标实体名称
  relationType: RelationType
  weight: number
  confidence: number
  evidence?: string // 证据文本
  properties?: Record<string, any>
}

/**
 * 关系抽取配置
 */
export interface RelationExtractorConfig {
  /** 最小置信度阈值 */
  minConfidence?: number
  /** 最小关系权重 */
  minWeight?: number
  /** 是否启用证据提取 */
  enableEvidence?: boolean
}

/**
 * 关系模式定义
 */
interface RelationPattern {
  type: RelationType
  patterns: RegExp[]
  weight: number
  description: string
}

/**
 * 专利关系抽取器
 *
 * 核心功能：
 * 1. 基于规则的关系识别
 * 2. 关系权重计算
 * 3. 证据提取
 * 4. 批量抽取
 */
export class RelationExtractor {
  private config: Required<RelationExtractorConfig>

  // 关系模式定义
  private readonly relationPatterns: RelationPattern[] = [
    {
      type: 'applicant-inventor',
      patterns: [
        /(?:申请人|申请方|权利人)[：:]\s*([^\n，。]+)[，。\n]*(?:发明人|设计人)[：:]\s*([^\n，。]+)/g,
        /(?:发明人|设计人)[：:]\s*([^\n，。]+)[，。\n]*(?:申请人|申请方|权利人)[：:]\s*([^\n，。]+)/g,
      ],
      weight: 0.9,
      description: '申请人与发明人关系',
    },
    {
      type: 'cites',
      patterns: [
        /(?:引用|参考|基于|依据)[：:]?\s*([A-Z]{2}\d{12,13}(?:\.\d|[A-Z])?)/g,
        /(?:本申请|本案|本专利).{0,50}(?:引用|参考|基于|依据).{0,50}([A-Z]{2}\d{12,13}(?:\.\d|[A-Z])?)/g,
      ],
      weight: 0.85,
      description: '引用关系',
    },
    {
      type: 'cited-by',
      patterns: [/(?:被引用|被参考|作为基础)/g],
      weight: 0.85,
      description: '被引用关系',
    },
    {
      type: 'priority',
      patterns: [
        /(?:优先权|在先申请)[：:]?\s*([A-Z]{2}\d{12,13}(?:\.\d|[A-Z])?)/g,
        /(?:要求|享有).{0,20}(?:优先权)/g,
      ],
      weight: 0.9,
      description: '优先权关系',
    },
    {
      type: 'family',
      patterns: [/(?:同族|family|相关申请|关联申请)/g],
      weight: 0.8,
      description: '同族专利关系',
    },
    {
      type: 'continuation',
      patterns: [/(?:连续申请|分案申请|继续申请)/g],
      weight: 0.85,
      description: '连续申请关系',
    },
    {
      type: 'related-to',
      patterns: [/(?:相关|关联|类似)/g],
      weight: 0.7,
      description: '相关关系',
    },
  ]

  constructor(config: RelationExtractorConfig = {}) {
    this.config = {
      minConfidence: config.minConfidence ?? 0.6,
      minWeight: config.minWeight ?? 0.5,
      enableEvidence: config.enableEvidence ?? true,
    }
  }

  /**
   * 从文本中抽取关系
   */
  async extractRelations(text: string, entities: Entity[]): Promise<Relation[]> {
    const relations: Relation[] = []
    const entityMap = new Map<string, Entity>()

    // 建立实体名称映射
    entities.forEach((e) => {
      entityMap.set(e.name, e)
    })

    // 遍历所有关系模式
    for (const pattern of this.relationPatterns) {
      for (const regex of pattern.patterns) {
        const matches = [...text.matchAll(new RegExp(regex.source, regex.flags))]

        for (const match of matches) {
          const relation = this.parseMatch(match, pattern, text, entityMap)
          if (relation && this.isValidRelation(relation)) {
            relations.push(relation)
          }
        }
      }
    }

    // 去重（相同 from + to + type）
    const uniqueRelations = this.deduplicateRelations(relations)

    return uniqueRelations
  }

  /**
   * 解析匹配结果为关系
   */
  private parseMatch(
    match: RegExpExecArray,
    pattern: RelationPattern,
    text: string,
    entityMap: Map<string, Entity>
  ): Relation | null {
    const relation: Relation = {
      fromEntity: '',
      toEntity: '',
      relationType: pattern.type,
      weight: pattern.weight,
      confidence: 0.8,
      evidence: this.config.enableEvidence ? match[0] : undefined,
    }

    // 根据关系类型解析
    switch (pattern.type) {
      case 'applicant-inventor':
        // match[1] 和 match[2] 分别是申请人和发明人
        if (match[1] && match[2]) {
          relation.fromEntity = match[1].trim()
          relation.toEntity = match[2].trim()
        } else {
          return null
        }
        break

      case 'cites':
      case 'priority':
        // match[1] 是专利号
        if (match[1]) {
          relation.fromEntity = '本专利'
          relation.toEntity = match[1].trim()
        } else {
          return null
        }
        break

      default:
        // 其他关系类型需要从上下文推断
        return null
    }

    // 计算置信度
    relation.confidence = this.calculateConfidence(relation, entityMap)

    return relation
  }

  /**
   * 计算关系置信度
   */
  private calculateConfidence(relation: Relation, entityMap: Map<string, Entity>): number {
    let confidence = 0.75 // 基础置信度

    // 如果至少一端实体在实体列表中，适当提高置信度
    if (entityMap.has(relation.fromEntity) || entityMap.has(relation.toEntity)) {
      confidence += 0.1
    }

    // 如果两端实体都在实体列表中，进一步提高置信度
    if (entityMap.has(relation.fromEntity) && entityMap.has(relation.toEntity)) {
      confidence += 0.1
    }

    // 如果有证据文本，提高置信度
    if (relation.evidence) {
      confidence += 0.05
    }

    // 特殊处理：对于"本专利"这样的虚拟实体，降低置信度要求
    if (relation.fromEntity === '本专利' || relation.toEntity === '本专利') {
      confidence = Math.max(confidence - 0.1, 0.6)
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * 验证关系是否有效
   */
  private isValidRelation(relation: Relation): boolean {
    // 检查置信度
    if (relation.confidence < this.config.minConfidence) {
      return false
    }

    // 检查权重
    if (relation.weight < this.config.minWeight) {
      return false
    }

    // 检查实体名称非空
    if (!relation.fromEntity || !relation.toEntity) {
      return false
    }

    // 检查不自环
    if (relation.fromEntity === relation.toEntity) {
      return false
    }

    return true
  }

  /**
   * 关系去重
   */
  private deduplicateRelations(relations: Relation[]): Relation[] {
    const uniqueMap = new Map<string, Relation>()

    relations.forEach((r) => {
      const key = `${r.fromEntity}|${r.toEntity}|${r.relationType}`
      const existing = uniqueMap.get(key)

      if (!existing || r.confidence > existing.confidence) {
        uniqueMap.set(key, r)
      }
    })

    return Array.from(uniqueMap.values())
  }

  /**
   * 计算关系权重
   */
  calculateWeight(relation: Relation, context: string): number {
    let weight = relation.weight

    // 根据证据文本长度调整权重
    if (relation.evidence) {
      const evidenceLength = relation.evidence.length
      if (evidenceLength > 50) {
        weight += 0.05
      } else if (evidenceLength > 100) {
        weight += 0.1
      }
    }

    // 根据关系类型调整权重
    switch (relation.relationType) {
      case 'applicant-inventor':
      case 'priority':
        weight = Math.min(weight + 0.1, 1.0)
        break
      case 'cites':
      case 'cited-by':
        weight = Math.min(weight + 0.05, 1.0)
        break
    }

    return Math.min(weight, 1.0)
  }

  /**
   * 批量抽取关系
   */
  async extractRelationsBatch(texts: string[], entitiesList: Entity[][]): Promise<Relation[][]> {
    return Promise.all(texts.map((text, i) => this.extractRelations(text, entitiesList[i])))
  }

  /**
   * 从实体对推断关系
   */
  inferRelationFromEntities(fromEntity: Entity, toEntity: Entity): Relation | null {
    // 根据实体类型推断可能的关系
    if (fromEntity.type === 'Organization' && toEntity.type === 'Person') {
      return {
        fromEntity: fromEntity.name,
        toEntity: toEntity.name,
        relationType: 'applicant-inventor',
        weight: 0.7,
        confidence: 0.6,
      }
    }

    if (fromEntity.type === 'ApplicationNumber' && toEntity.type === 'ApplicationNumber') {
      return {
        fromEntity: fromEntity.name,
        toEntity: toEntity.name,
        relationType: 'family',
        weight: 0.6,
        confidence: 0.5,
      }
    }

    return null
  }

  /**
   * 获取统计信息
   */
  getStats(relations: Relation[]): {
    totalRelations: number
    relationTypes: Record<string, number>
    averageConfidence: number
    averageWeight: number
  } {
    const relationTypes: Record<string, number> = {}
    let totalConfidence = 0
    let totalWeight = 0

    relations.forEach((r) => {
      relationTypes[r.relationType] = (relationTypes[r.relationType] || 0) + 1
      totalConfidence += r.confidence
      totalWeight += r.weight
    })

    return {
      totalRelations: relations.length,
      relationTypes,
      averageConfidence: relations.length > 0 ? totalConfidence / relations.length : 0,
      averageWeight: relations.length > 0 ? totalWeight / relations.length : 0,
    }
  }
}

/**
 * 创建关系抽取器实例
 */
export function createRelationExtractor(config?: RelationExtractorConfig): RelationExtractor {
  return new RelationExtractor(config)
}
