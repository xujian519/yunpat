/**
 * DualQualityEvaluator - 双重质量评估器
 *
 * 两个不同模型从不同角度评估内容质量：
 * - 绝对质量评估：基于标准评分细则给出 0-100 分
 * - 相对排名评估：与同类内容比较给出百分位排名
 *
 * 参考：PatExpert 的 Gold-LLM-as-Judge + Reward-LLM-as-Judge 双重评估
 */

interface DualEvaluationResult {
  absoluteScore: number // 绝对质量分 (0-100)
  relativeRank: number // 相对排名 (0-100 percentile)
  combinedScore: number // 加权综合分 (0-100)
  absoluteFeedback: string // 绝对评估反馈
  relativeFeedback: string // 相对评估反馈
  rubric?: string // 使用的评分标准
}

interface DualEvaluatorConfig {
  absoluteWeight?: number
  relativeWeight?: number
}

interface EvaluationResponse {
  score: number
  feedback: string
}

interface LLMInterface {
  generate(prompt: string): Promise<string>
}

class DualQualityEvaluator {
  private evaluatorA: LLMInterface
  private evaluatorB: LLMInterface
  private config: Required<DualEvaluatorConfig>

  constructor(
    evaluatorA: LLMInterface,
    evaluatorB: LLMInterface,
    config?: DualEvaluatorConfig
  ) {
    this.evaluatorA = evaluatorA
    this.evaluatorB = evaluatorB
    this.config = {
      absoluteWeight: config?.absoluteWeight ?? 0.6,
      relativeWeight: config?.relativeWeight ?? 0.4,
    }

    const totalWeight = this.config.absoluteWeight + this.config.relativeWeight
    if (Math.abs(totalWeight - 1) > 0.01) {
      console.warn(
        `权重之和不为 1 (当前: ${totalWeight})，将自动归一化`
      )
      this.config.absoluteWeight = this.config.absoluteWeight / totalWeight
      this.config.relativeWeight = this.config.relativeWeight / totalWeight
    }
  }

  /**
   * 评估内容质量
   * @param content 待评估内容
   * @param rubric 可选的评分细则
   * @returns 双重评估结果
   */
  async evaluate(
    content: string,
    rubric?: string
  ): Promise<DualEvaluationResult> {
    const [absoluteResult, relativeResult] = await Promise.all([
      this.evaluateAbsolute(content, rubric),
      this.evaluateRelative(content),
    ])

    const combinedScore =
      absoluteResult.score * this.config.absoluteWeight +
      relativeResult.score * this.config.relativeWeight

    return {
      absoluteScore: absoluteResult.score,
      relativeRank: relativeResult.score,
      combinedScore,
      absoluteFeedback: absoluteResult.feedback,
      relativeFeedback: relativeResult.feedback,
      rubric,
    }
  }

  private async evaluateAbsolute(
    content: string,
    rubric?: string
  ): Promise<EvaluationResponse> {
    const prompt = this.buildAbsolutePrompt(content, rubric)
    const response = await this.evaluatorA.generate(prompt)
    return this.parseEvaluationResponse(response)
  }

  private async evaluateRelative(
    content: string
  ): Promise<EvaluationResponse> {
    const prompt = this.buildRelativePrompt(content)
    const response = await this.evaluatorB.generate(prompt)
    return this.parseEvaluationResponse(response)
  }

  private buildAbsolutePrompt(
    content: string,
    rubric?: string
  ): string {
    const rubricText =
      rubric ||
      `- 完整性（completeness）：内容是否完整覆盖所有必要要素
- 准确性（accuracy）：事实、数据和逻辑是否准确无误
- 清晰性（clarity）：表达是否清晰易懂，结构是否合理
- 专业性（professionalism）：术语使用是否规范，格式是否符合行业标准`

    return `你是一个专业的质量评估专家。请基于以下评分细则，对给定的内容进行评估。

评分细则：
${rubricText}

评估标准：
- 0-20 分：质量极差，无法使用
- 20-40 分：质量较差，需要大幅改进
- 40-60 分：质量一般，有明显缺陷
- 60-80 分：质量良好，有少量不足
- 80-100 分：质量优秀，无需改进

待评估内容：
${content}

请以 JSON 格式返回评估结果，格式如下：
{
  "score": <0-100 的分数>,
  "feedback": "<详细的反馈意见，指出优点和改进点>"
}

请只返回 JSON，不要包含其他说明。`
  }

  private buildRelativePrompt(content: string): string {
    return `你是一个专业的质量排名专家。请将以下内容与该领域的典型专业级输出进行比较。

待评估内容：
${content}

评估要求：
1. 与同类专业级内容比较，评估其质量水平
2. 给出百分位排名（0-100）：
   - 0-10：远低于专业水准
   - 10-30：低于专业水准
   - 30-50：略低于专业水准
   - 50-70：达到专业水准
   - 70-90：超过专业水准
   - 90-100：顶级专业水准
3. 提供相对性的反馈，说明其在同类内容中的位置

请以 JSON 格式返回评估结果，格式如下：
{
  "score": <0-100 的百分位排名>,
  "feedback": "<相对性反馈，说明在同类内容中的质量位置>"
}

请只返回 JSON，不要包含其他说明。`
  }

  private parseEvaluationResponse(
    response: string
  ): EvaluationResponse {
    try {
      const parsed = JSON.parse(response.trim())
      if (
        typeof parsed.score === 'number' &&
        typeof parsed.feedback === 'string'
      ) {
        return {
          score: Math.max(0, Math.min(100, parsed.score)),
          feedback: parsed.feedback,
        }
      }

      throw new Error('无效的响应格式')
    } catch (error) {
      console.warn('JSON 解析失败，尝试正则提取:', error)
      return this.extractWithRegex(response)
    }
  }

  private extractWithRegex(response: string): EvaluationResponse {
    const scoreMatch = response.match(/score['"\s]*[:=]['"\s]*(\d+)/i)
    const feedbackMatch = response.match(
      /feedback['"\s]*[:=]['"\s]*"([^"]*)"/i
    )
    const score = scoreMatch
      ? Math.max(0, Math.min(100, parseInt(scoreMatch[1], 10)))
      : 50
    const feedback =
      feedbackMatch?.[1] ||
      '无法提取详细反馈，请人工复核' ||
      response.substring(0, 200)

    return { score, feedback }
  }
}

export { DualQualityEvaluator }
export type { DualEvaluationResult, DualEvaluatorConfig }