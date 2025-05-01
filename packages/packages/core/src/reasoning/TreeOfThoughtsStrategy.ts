/**
 * Tree-of-Thoughts (ToT) 推理策略
 *
 * 多路径探索+投票策略
 *
 * 核心功能：
 * 1. 生成多个思路 - 同时探索多条推理路径
 * 2. 评估思路 - 多维度评估（可行性、创新性、完整性、清晰度）
 * 3. 最佳优先搜索 - 寻找最佳解决方案
 * 4. 路径追踪 - 记录思考路径
 *
 * @module reasoning/TreeOfThoughtsStrategy
 */

import { LLMAdapter } from '../lifecycle/Lifecycle.js'

// ========== 类型定义 ==========

/**
 * 思维节点
 */
export interface ThoughtNode {
  /** 思路内容 */
  thought: string

  /** 评分 (0-10) */
  score: number

  /** 深度 */
  depth: number

  /** 父节点 */
  parent?: ThoughtNode

  /** 子节点 */
  children?: ThoughtNode[]

  /** 评估详情 */
  evaluation?: {
    /** 可行性 */
    feasibility: number
    /** 创新性 */
    innovation: number
    /** 完整性 */
    completeness: number
    /** 清晰度 */
    clarity: number
  }
}

/**
 * 思路选项
 */
export interface ThoughtOption {
  /** 思路内容 */
  thought: string

  /** 初始评分 */
  score: number

  /** 评估详情（可选） */
  evaluation?: {
    feasibility: number
    innovation: number
    completeness: number
    clarity: number
  }
}

/**
 * ToT 配置
 */
export interface ToTConfig {
  /** 最大深度 */
  maxDepth: number

  /** 分支因子（每个节点的子节点数） */
  branchFactor: number

  /** 温度参数（高温度鼓励多样性） */
  temperature: number

  /** 是否启用详细日志 */
  verbose: boolean
}

// ========== 主类实现 ==========

/**
 * Tree-of-Thoughts 策略
 *
 * 思维树，探索多个可能的思考路径
 */
export class TreeOfThoughtsStrategy {
  private llm: LLMAdapter
  private config: ToTConfig

  constructor(llm: LLMAdapter, config?: Partial<ToTConfig>) {
    this.llm = llm
    this.config = {
      maxDepth: 3,
      branchFactor: 3,
      temperature: 0.8,
      verbose: false,
      ...config,
    }
  }

  /**
   * 生成思维树
   */
  async generateThoughts(
    problem: string,
    branchFactor: number = this.config.branchFactor
  ): Promise<Array<{ thought: string; score: number }>> {
    const prompt = `针对以下问题，请生成 ${branchFactor} 个不同的解决思路。

**要求**：
1. 每个思路要有明确的策略
2. 思路之间要有差异化
3. 格式：1. [思路描述]

问题：${problem}

请生成 ${branchFactor} 个思路：`

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个创意思考专家，擅长从不同角度思考问题。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: this.config.temperature,
    })

    // 解析多个思路
    const thoughts = this.parseThoughts(response.message.content)

    if (this.config.verbose) {
      console.log(`\n🌳 [ToT] 生成了 ${thoughts.length} 个思路`)
      thoughts.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.thought.substring(0, 60)}...`)
      })
    }

    return thoughts.slice(0, branchFactor)
  }

  /**
   * 评估思路（多维度评估）
   */
  async evaluateThoughts(
    problem: string,
    thoughts: Array<{ thought: string; score: number }>
  ): Promise<Array<{ thought: string; score: number; evaluation?: unknown }>> {
    const prompt = `请对以下解决思路进行多维度评估（每个维度 1-10 分）：

**评估维度**：
- 可行性：是否容易实施
- 创新性：是否有新意
- 完整性：是否考虑全面
- 清晰度：表述是否清楚

**问题**：${problem}

**待评估思路**：
${thoughts.map((t, i) => `${i + 1}. ${t.thought}`).join('\n')}

**请按以下格式返回**：
1. 可行性: X分, 创新性: X分, 完整性: X分, 清晰度: X分, 总分: XX分
2. 可行性: X分, 创新性: X分, 完整性: X分, 清晰度: X分, 总分: XX分
...`

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个评估专家，擅长从多个维度分析方案质量。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    })

    // 解析评估结果
    const evaluated = this.parseEvaluations(response.message.content, thoughts)

    if (this.config.verbose) {
      console.log(`\n📊 [ToT] 评估了 ${evaluated.length} 个思路`)
      evaluated.forEach((t, i) => {
        const eval_ = t.evaluation as { total: number }
        console.log(`  ${i + 1}. 评分: ${eval_?.total || t.score}/10`)
      })
    }

    return evaluated
  }

  /**
   * 最佳优先搜索 - 寻找最佳解决方案
   */
  async bestFirstSearch(
    problem: string,
    maxDepth: number = this.config.maxDepth,
    branchFactor: number = this.config.branchFactor
  ): Promise<ThoughtNode> {
    if (this.config.verbose) {
      console.log(`\n🌳 [ToT] 开始最佳优先搜索`)
      console.log(`  问题: ${problem}`)
      console.log(`  最大深度: ${maxDepth}, 分支因子: ${branchFactor}`)
    }

    // 根节点
    const root: ThoughtNode = {
      thought: problem,
      score: 0,
      depth: 0,
    }

    // 优先队列（按分数排序）
    const queue: ThoughtNode[] = [root]
    let bestNode = root

    while (queue.length > 0) {
      // 取出最佳节点
      const current = queue.shift()!
      if (current.depth >= maxDepth) {
        continue
      }

      // 生成子节点
      const thoughts = await this.generateThoughts(current.thought, branchFactor)
      const evaluated = await this.evaluateThoughts(current.thought, thoughts)

      // 创建子节点
      const children: ThoughtNode[] = []
      for (const t of evaluated) {
        const node: ThoughtNode = {
          thought: t.thought,
          score: t.score,
          depth: current.depth + 1,
          parent: current,
          evaluation: t.evaluation as
            | { feasibility: number; innovation: number; completeness: number; clarity: number }
            | undefined,
        }
        children.push(node)

        // 更新最佳节点
        if (node.score > bestNode.score) {
          bestNode = node
        }
      }

      current.children = children

      // 添加到队列（按分数排序）
      queue.push(...children)
      queue.sort((a, b) => b.score - a.score)
    }

    if (this.config.verbose) {
      console.log(`\n✅ [ToT] 搜索完成，最佳节点评分: ${bestNode.score}/10`)
      console.log(`  最佳思路: ${bestNode.thought.substring(0, 80)}...`)
    }

    return bestNode
  }

  /**
   * 获取最佳思路的完整路径
   */
  getBestPath(node: ThoughtNode): string[] {
    const path: string[] = []
    let current: ThoughtNode | undefined = node

    while (current) {
      path.unshift(current.thought)
      current = current.parent
    }

    return path
  }

  /**
   * 解析思路列表
   */
  private parseThoughts(content: string): Array<{ thought: string; score: number }> {
    const thoughts: Array<{ thought: string; score: number }> = []

    // 尝试多种格式
    const patterns = [
      /^\d+[\.\)]\s*(.+)$/gm, // "1. 思路" 或 "1) 思路"
      /^[-•]\s*(.+)$/gm, // "- 思路" 或 "• 思路"
    ]

    for (const pattern of patterns) {
      const matches = Array.from(content.matchAll(pattern))
      if (matches && matches.length > 0) {
        for (const match of matches) {
          const cleaned = match[1]?.trim()
          if (cleaned && !thoughts.find((t) => t.thought === cleaned)) {
            thoughts.push({ thought: cleaned, score: 5.0 }) // 默认中等分数
          }
        }
        if (thoughts.length > 0) break
      }
    }

    // 如果没有匹配到，按段落分割
    if (thoughts.length === 0) {
      const paragraphs = content.split(/\n\n+/).filter((p) => p.trim())
      for (const para of paragraphs) {
        const cleaned = para.trim()
        if (cleaned && !thoughts.find((t) => t.thought === cleaned)) {
          thoughts.push({ thought: cleaned, score: 5.0 })
        }
      }
    }

    return thoughts
  }

  /**
   * 解析评估结果
   */
  private parseEvaluations(
    content: string,
    originalThoughts: Array<{ thought: string; score: number }>
  ): Array<{ thought: string; score: number; evaluation?: unknown }> {
    const results: Array<{ thought: string; score: number; evaluation?: unknown }> = []

    // 按行解析
    const lines = content.split('\n').filter((line) => line.trim())

    for (let i = 0; i < Math.min(lines.length, originalThoughts.length); i++) {
      const line = lines[i]
      const thought = originalThoughts[i].thought

      // 解析分数
      const scores = this.parseScores(line)

      results.push({
        thought,
        score: scores.total || 5.0,
        evaluation: {
          feasibility: scores.feasibility || 5.0,
          innovation: scores.innovation || 5.0,
          completeness: scores.completeness || 5.0,
          clarity: scores.clarity || 5.0,
        },
      })
    }

    return results
  }

  /**
   * 解析单个评估分数
   */
  private parseScores(line: string): {
    feasibility: number
    innovation: number
    completeness: number
    clarity: number
    total: number
  } {
    const scores = {
      feasibility: 5.0,
      innovation: 5.0,
      completeness: 5.0,
      clarity: 5.0,
      total: 5.0,
    }

    // 尝试匹配 "可行性: X分, 创新性: X分, 完整性: X分, 清晰度: X分" 格式
    const pattern = /可行性[:：]\s*(\d+(?:\.\d+)?)\s*分/
    const match = line.match(pattern)

    if (match) {
      // 使用更精确的匹配
      const patterns = {
        feasibility: /可行性[:：]\s*(\d+(?:\.\d+)?)/,
        innovation: /创新性[:：]\s*(\d+(?:\.\d+)?)/,
        completeness: /完整性[:：]\s*(\d+(?:\.\d+)?)/,
        clarity: /清晰度[:：]\s*(\d+(?:\.\d+)?)/,
        total: /总分[:：]\s*(\d+(?:\.\d+)?)/,
      }

      for (const [key, regex] of Object.entries(patterns)) {
        const m = line.match(regex)
        if (m) {
          ;(scores as any)[key] = parseFloat(m[1])
        }
      }

      // 计算总分（如果没有明确给出）
      if (scores.total === 5.0) {
        const sum = scores.feasibility + scores.innovation + scores.completeness + scores.clarity
        if (sum > 20) {
          // 如果不是默认值
          scores.total = sum / 4
        }
      }
    } else {
      // 降级方案：提取所有数字
      const numberPattern = /(\d+(?:\.\d+)?)/g
      const numbers = line.match(numberPattern)

      if (numbers && numbers.length >= 4) {
        const nums = numbers.map((n) => parseFloat(n))
        scores.feasibility = nums[0]
        scores.innovation = nums[1]
        scores.completeness = nums[2]
        scores.clarity = nums[3]
        scores.total = nums[4] || (nums[0] + nums[1] + nums[2] + nums[3]) / 4
      }
    }

    return scores
  }
}
