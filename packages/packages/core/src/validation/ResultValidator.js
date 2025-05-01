/**
 * 结果验证器 - P0 准确率优化方案 #2
 *
 * 核心功能：
 * 1. 结构验证（Zod schema 检查）
 * 2. 内容质量检查（长度、格式、完整性）
 * 3. 逻辑一致性验证（无矛盾、无重复）
 * 4. 幻觉检测（事实验证、逻辑一致性、源归属）
 * 5. 自动纠正策略（重试、降级、人工介入）
 */
import { z } from 'zod'
import { HallucinationDetector } from './HallucinationDetector.js'
/**
 * 错误类型
 */
export var ValidationErrorType
;(function (ValidationErrorType) {
  /** 结构错误（schema 不匹配） */
  ValidationErrorType['STRUCTURAL'] = 'structural'
  /** 质量错误（长度、格式、完整性） */
  ValidationErrorType['QUALITY'] = 'quality'
  /** 逻辑错误（矛盾、重复） */
  ValidationErrorType['LOGICAL'] = 'logical'
  /** 事实错误（幻觉检测发现的错误） */
  ValidationErrorType['FACTUAL'] = 'factual'
  /** 合规错误（违反规范或原则） */
  ValidationErrorType['COMPLIANCE'] = 'compliance'
})(ValidationErrorType || (ValidationErrorType = {}))
/**
 * 纠正策略
 */
export var CorrectionStrategy
;(function (CorrectionStrategy) {
  /** 重试（简单重试机制） */
  CorrectionStrategy['RETRY'] = 'retry'
  /** 降级（返回部分结果） */
  CorrectionStrategy['DEGRADE'] = 'degrade'
  /** 人工介入（返回错误） */
  CorrectionStrategy['MANUAL'] = 'manual'
  /** 强制接受（标记警告） */
  CorrectionStrategy['FORCE_ACCEPT'] = 'force_accept'
})(CorrectionStrategy || (CorrectionStrategy = {}))
/**
 * 结果验证器
 */
export class ResultValidator {
  config
  hallucinationDetector
  constructor(config = {}) {
    this.config = {
      verbose: true,
      defaultCorrectionStrategy: CorrectionStrategy.RETRY,
      maxRetries: 3,
      llm: config.llm,
      knowledgeBase: config.knowledgeBase,
      enableHallucinationCheck: false,
    }
    // 应用用户配置
    if (config.verbose !== undefined) {
      this.config.verbose = config.verbose
    }
    if (config.defaultCorrectionStrategy !== undefined) {
      this.config.defaultCorrectionStrategy = config.defaultCorrectionStrategy
    }
    if (config.maxRetries !== undefined) {
      this.config.maxRetries = config.maxRetries
    }
    if (config.enableHallucinationCheck !== undefined) {
      this.config.enableHallucinationCheck = config.enableHallucinationCheck
    }
    // 初始化幻觉检测器（如果提供了 LLM 和 KnowledgeBase）
    if (config.llm && config.knowledgeBase && this.config.enableHallucinationCheck) {
      this.hallucinationDetector = new HallucinationDetector(
        config.llm,
        config.knowledgeBase, // 这里仍然是可能undefined，但在if条件中已经检查
        {
          enableFactCheck: true,
          enableLogicalConsistencyCheck: true,
          enableSourceAttribution: true,
          factCheckThreshold: 0.7,
        }
      )
    }
  }
  /**
   * 更新幻觉检测器配置（运行时）
   */
  setHallucinationDetector(detector) {
    this.hallucinationDetector = detector
  }
  /**
   * 获取幻觉检测器（如果已配置）
   */
  getHallucinationDetector() {
    return this.hallucinationDetector
  }
  /**
   * 验证结果（结构 + 质量 + 逻辑）
   */
  async validate(result, schema) {
    const errors = []
    const warnings = []
    // 1. 结构验证（Zod schema）
    const structuralResult = this.validateStructure(result, schema)
    if (!structuralResult.valid) {
      errors.push(...structuralResult.errors)
      return {
        valid: false,
        errors,
        warnings,
        errorType: ValidationErrorType.STRUCTURAL,
      }
    }
    // 2. 内容质量检查（仅对字符串类型）
    if (typeof result === 'string' || (typeof result === 'object' && result !== null)) {
      const content = this.extractContent(result)
      if (content) {
        const qualityResult = this.checkQuality(content, {})
        if (!qualityResult.passed) {
          if (!qualityResult.lengthCheck.passed) {
            errors.push(
              `长度检查失败: 实际 ${qualityResult.lengthCheck.actualLength} 字符` +
                (qualityResult.lengthCheck.minLength
                  ? `, 要求最小 ${qualityResult.lengthCheck.minLength}`
                  : '') +
                (qualityResult.lengthCheck.maxLength
                  ? `, 要求最大 ${qualityResult.lengthCheck.maxLength}`
                  : '')
            )
          }
          if (!qualityResult.keywordCheck.passed) {
            if (qualityResult.keywordCheck.missingRequired.length > 0) {
              errors.push(
                `缺少必需关键词: ${qualityResult.keywordCheck.missingRequired.join(', ')}`
              )
            }
            if (qualityResult.keywordCheck.foundForbidden.length > 0) {
              errors.push(`包含禁止关键词: ${qualityResult.keywordCheck.foundForbidden.join(', ')}`)
            }
          }
          if (!qualityResult.completenessCheck.passed) {
            errors.push(
              `内容被截断，检测到标记: ${qualityResult.completenessCheck.truncationMarker}`
            )
          }
          return {
            valid: false,
            errors,
            warnings,
            errorType: ValidationErrorType.QUALITY,
          }
        }
      }
    }
    // 3. 逻辑一致性验证
    const content = this.extractContent(result)
    if (content && typeof content === 'string') {
      const inconsistencies = await this.detectInconsistencies(content)
      if (inconsistencies.length > 0) {
        warnings.push(`检测到 ${inconsistencies.length} 个潜在逻辑问题:`)
        inconsistencies.forEach((inc) => {
          warnings.push(`  - ${inc.type}: ${inc.description}`)
        })
        // 逻辑问题不阻止验证，只发出警告
      }
    }
    return {
      valid: true,
      data: structuralResult.data,
      errors,
      warnings,
    }
  }
  /**
   * 带幻觉检测的验证（结构 + 质量 + 逻辑 + 幻觉检测）
   */
  async validateWithHallucinationCheck(result, schema, options) {
    // 1. 执行基础验证
    const baseResult = await this.validate(result, schema)
    // 2. 如果没有配置幻觉检测器，直接返回基础验证结果
    if (!this.hallucinationDetector) {
      return baseResult
    }
    // 3. 提取内容并进行幻觉检测
    const content = this.extractContent(result)
    if (!content || typeof content !== 'string') {
      return baseResult
    }
    try {
      // 执行幻觉检测
      const hallucinationReport = await this.hallucinationDetector.detect(content)
      // 根据幻觉检测报告更新验证结果
      const errors = [...baseResult.errors]
      const warnings = [...baseResult.warnings]
      // 如果幻觉分数过高，添加错误
      if (hallucinationReport.overallScore >= (options?.factCheckThreshold ?? 0.7)) {
        errors.push(
          `幻觉检测分数过高: ${(hallucinationReport.overallScore * 100).toFixed(1)}% ` +
            `(阈值: ${((options?.factCheckThreshold ?? 0.7) * 100).toFixed(1)}%)`
        )
      }
      // 添加事实验证结果到警告
      if (hallucinationReport.factCheckResults.length > 0) {
        const unverifiedFacts = hallucinationReport.factCheckResults.filter(
          (r) => r.isVerifiable && !r.isVerified
        )
        if (unverifiedFacts.length > 0) {
          warnings.push(`发现 ${unverifiedFacts.length} 个未验证的事实声明`)
        }
      }
      // 添加逻辑不一致问题到警告
      if (hallucinationReport.logicalInconsistencies.length > 0) {
        warnings.push(`发现 ${hallucinationReport.logicalInconsistencies.length} 个逻辑不一致问题`)
      }
      // 添加源归属问题到警告
      if (hallucinationReport.sourceAttributionIssues.length > 0) {
        const criticalIssues = hallucinationReport.sourceAttributionIssues.filter(
          (i) => i.severity === 'critical'
        )
        if (criticalIssues.length > 0) {
          warnings.push(`发现 ${criticalIssues.length} 个关键源归属问题`)
        }
      }
      return {
        ...baseResult,
        errors,
        warnings,
        hallucinationReport,
        errorType: errors.length > 0 ? ValidationErrorType.FACTUAL : baseResult.errorType,
      }
    } catch (error) {
      // 幻觉检测失败，记录警告但不阻止验证
      if (this.config.verbose) {
        console.warn('幻觉检测失败:', error)
      }
      return {
        ...baseResult,
        warnings: [
          ...baseResult.warnings,
          `幻觉检测失败: ${error instanceof Error ? error.message : '未知错误'}`,
        ],
      }
    }
  }
  /**
   * 结构验证（Zod schema）
   */
  validateStructure(result, schema) {
    try {
      const data = schema.parse(result)
      return {
        valid: true,
        data,
        errors: [],
        warnings: [],
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorsList = error.errors.map((e) => `${e.path.join('.') || 'root'}: ${e.message}`)
        return {
          valid: false,
          errors: errorsList,
          warnings: [],
        }
      }
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      }
    }
  }
  /**
   * 内容质量检查
   */
  checkQuality(content, requirements) {
    const lengthCheck = this.checkLength(content, requirements)
    const keywordCheck = this.checkKeywords(content, requirements)
    const completenessCheck = this.checkCompleteness(content, requirements)
    const passed = lengthCheck.passed && keywordCheck.passed && completenessCheck.passed
    return {
      passed,
      lengthCheck,
      keywordCheck,
      completenessCheck,
    }
  }
  /**
   * 长度检查
   */
  checkLength(content, requirements) {
    const actualLength = content.length
    const minLength = requirements.minLength
    const maxLength = requirements.maxLength
    const passed =
      (!minLength || actualLength >= minLength) && (!maxLength || actualLength <= maxLength)
    return {
      passed,
      actualLength,
      minLength,
      maxLength,
    }
  }
  /**
   * 关键词检查
   */
  checkKeywords(content, requirements) {
    const missingRequired = []
    const foundForbidden = []
    // 检查必需关键词
    if (requirements.requiredKeywords) {
      for (const keyword of requirements.requiredKeywords) {
        if (!content.includes(keyword)) {
          missingRequired.push(keyword)
        }
      }
    }
    // 检查禁止关键词
    if (requirements.forbiddenKeywords) {
      for (const keyword of requirements.forbiddenKeywords) {
        if (content.includes(keyword)) {
          foundForbidden.push(keyword)
        }
      }
    }
    const passed = missingRequired.length === 0 && foundForbidden.length === 0
    return {
      passed,
      missingRequired,
      foundForbidden,
    }
  }
  /**
   * 完整性检查
   */
  checkCompleteness(content, requirements) {
    if (!requirements.mustBeComplete) {
      return {
        passed: true,
        isTruncated: false,
      }
    }
    const truncationMarkers = requirements.truncationMarkers || [
      '...',
      '（未完）',
      '(未完)',
      '待续',
      'To be continued',
      '[TRUNCATED]',
      '[INCOMPLETE]',
    ]
    const trimmedContent = content.trim()
    for (const marker of truncationMarkers) {
      if (trimmedContent.endsWith(marker)) {
        return {
          passed: false,
          isTruncated: true,
          truncationMarker: marker,
        }
      }
    }
    return {
      passed: true,
      isTruncated: false,
    }
  }
  /**
   * 逻辑一致性验证
   */
  async detectInconsistencies(content) {
    const inconsistencies = []
    // 1. 检测矛盾陈述
    const contradictions = this.detectContradictions(content)
    inconsistencies.push(...contradictions)
    // 2. 检测重复内容
    const repetitions = this.detectRepetitions(content)
    inconsistencies.push(...repetitions)
    // 3. 检测逻辑断层
    const gaps = this.detectGaps(content)
    inconsistencies.push(...gaps)
    return inconsistencies
  }
  /**
   * 检测矛盾陈述
   */
  detectContradictions(content) {
    const contradictions = []
    // 简单矛盾模式：A是对的... A是错的
    const patterns = [
      { pattern: /(.{5,30})是正确的[。，,]?\s*.{0,100}\1是错误的/gs, desc: '相互矛盾的陈述' },
      { pattern: /(.{5,30})是[对真][。，,]?\s*.{0,100}\1是[错假]/gs, desc: '真值矛盾' },
      { pattern: /应该做(.{5,20})[。，,]?\s*.{0,100}不应该做\1/gs, desc: '行动矛盾' },
    ]
    for (const { pattern, desc } of patterns) {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        contradictions.push({
          type: 'contradiction',
          description: desc,
          location: {
            start: match.index || 0,
            end: (match.index || 0) + match[0].length,
          },
        })
      }
    }
    return contradictions
  }
  /**
   * 检测重复内容
   */
  detectRepetitions(content) {
    const repetitions = []
    // 按句子分割
    const sentences = content.split(/[。！？.!?]/).filter((s) => s.trim().length > 10)
    // 检查相似句子（简单编辑距离）
    for (let i = 0; i < sentences.length; i++) {
      for (let j = i + 1; j < sentences.length; j++) {
        const similarity = this.calculateSimilarity(sentences[i], sentences[j])
        if (similarity > 0.85) {
          repetitions.push({
            type: 'repetition',
            description: `重复内容: "${sentences[i].trim().substring(0, 30)}..."`,
          })
        }
      }
    }
    return repetitions
  }
  /**
   * 检测逻辑断层
   */
  detectGaps(content) {
    const gaps = []
    // 检测缺少过渡词的句子序列
    const transitionWords = [
      '因此',
      '所以',
      '然而',
      '但是',
      '此外',
      '另外',
      '首先',
      '其次',
      '最后',
      'then',
      'however',
      'therefore',
    ]
    const sentences = content.split(/[。！？.!?]/).filter((s) => s.trim().length > 5)
    for (let i = 1; i < sentences.length; i++) {
      const prevSentence = sentences[i - 1].trim()
      const currSentence = sentences[i].trim()
      // 如果前一句以结论词结尾，当前句没有过渡词，可能存在断层
      const prevEndsWithConclusion = /因此|所以|综上|可见|得出结论|therefore|thus/.test(
        prevSentence
      )
      const currStartsWithTransition = transitionWords.some((word) => currSentence.startsWith(word))
      if (prevEndsWithConclusion && !currStartsWithTransition && currSentence.length > 20) {
        gaps.push({
          type: 'gap',
          description: '可能缺少过渡词或逻辑连接',
        })
      }
    }
    return gaps
  }
  /**
   * 计算两个字符串的相似度（简化版）
   */
  calculateSimilarity(str1, str2) {
    const s1 = str1.trim().toLowerCase()
    const s2 = str2.trim().toLowerCase()
    if (s1 === s2) return 1
    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1
    if (longer.length === 0) return 1
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }
  /**
   * Levenshtein 距离
   */
  levenshteinDistance(str1, str2) {
    const matrix = []
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    return matrix[str2.length][str1.length]
  }
  /**
   * 提取内容（从对象或字符串）
   */
  extractContent(result) {
    if (typeof result === 'string') {
      return result
    }
    if (typeof result === 'object' && result !== null) {
      const obj = result
      // 尝试提取常见的 content/message/text 字段
      if (typeof obj.content === 'string') return obj.content
      if (typeof obj.message === 'string') return obj.message
      if (typeof obj.text === 'string') return obj.text
      if (typeof obj.output === 'string') return obj.output
      // 如果没有单个content字段，尝试合并所有字符串字段
      const stringFields = Object.entries(obj)
        .filter(([key, value]) => typeof value === 'string' && !key.startsWith('_'))
        .map(([_key, value]) => value)
      if (stringFields.length > 0) {
        // 返回合并的内容，用换行符分隔
        return stringFields.join('\n')
      }
      // 尝试提取 LLM 响应格式
      if (
        Array.isArray(obj.choices) &&
        obj.choices.length > 0 &&
        typeof obj.choices[0] === 'object' &&
        obj.choices[0] !== null
      ) {
        const choice = obj.choices[0]
        if (typeof choice.message === 'object' && choice.message !== null) {
          const message = choice.message
          if (typeof message.content === 'string') {
            return message.content
          }
        }
      }
    }
    return null
  }
  /**
   * 纠正结果
   */
  async correct(result, validationResult, retryFn) {
    const strategy = this.determineCorrectionStrategy(validationResult)
    this.log(`执行纠正策略: ${strategy}`)
    switch (strategy) {
      case CorrectionStrategy.RETRY:
        if (!retryFn) {
          throw new Error('重试策略需要提供 retryFn')
        }
        return await this.retryWithBackoff(retryFn)
      case CorrectionStrategy.DEGRADE:
        return this.degradeResult(result, validationResult)
      case CorrectionStrategy.MANUAL:
        throw new Error(`验证失败，需要人工介入: ${validationResult.errors.join('; ')}`)
      case CorrectionStrategy.FORCE_ACCEPT:
        this.log('强制接受结果（带有警告）')
        if (validationResult.warnings.length > 0) {
          console.warn('[ResultValidator] 警告:', validationResult.warnings)
        }
        return result
      default:
        throw new Error(`未知的纠正策略: ${strategy}`)
    }
  }
  /**
   * 确定纠正策略
   */
  determineCorrectionStrategy(result) {
    // 结构错误：重试
    if (result.errorType === ValidationErrorType.STRUCTURAL) {
      return CorrectionStrategy.RETRY
    }
    // 质量错误：根据默认策略
    if (result.errorType === ValidationErrorType.QUALITY) {
      return this.config.defaultCorrectionStrategy ?? CorrectionStrategy.RETRY
    }
    // 逻辑错误：强制接受（只警告）
    if (result.errorType === ValidationErrorType.LOGICAL) {
      return CorrectionStrategy.FORCE_ACCEPT
    }
    // 未知错误：使用默认策略
    return this.config.defaultCorrectionStrategy ?? CorrectionStrategy.RETRY
  }
  /**
   * 重试（带指数退避）
   */
  async retryWithBackoff(retryFn) {
    let lastError
    const maxRetries = this.config.maxRetries ?? 3
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log(`重试 ${attempt}/${maxRetries}`)
        return await retryFn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        this.log(`重试 ${attempt} 失败: ${lastError.message}`)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
          await this.sleep(delay)
        }
      }
    }
    throw lastError || new Error('所有重试均失败')
  }
  /**
   * 降级结果
   */
  degradeResult(result, validationResult) {
    this.log('降级处理: 返回部分结果')
    // 如果是字符串，添加警告前缀
    if (typeof result === 'string') {
      return `[警告: 验证未通过] ${result}`
    }
    // 如果是对象，尝试添加警告字段
    if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
      const degradedResult = {
        ...result,
        _validationWarnings: validationResult.errors,
      }
      return degradedResult
    }
    // 其他情况，直接返回
    return result
  }
  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
  /**
   * 日志输出
   */
  log(message) {
    if (!this.config.verbose) return
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [ResultValidator] ${message}`)
  }
}
//# sourceMappingURL=ResultValidator.js.map
