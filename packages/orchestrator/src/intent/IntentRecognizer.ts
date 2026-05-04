/**
 * IntentRecognizer - 意图识别器（Call 1）完整实现
 *
 * 职责：
 * 1. 识别用户意图（9种类型）
 * 2. 评估置信度
 * 3. 提取关键信息
 * 4. 生成追问问题（如需要）
 */

import { IntentRecognitionResult, OrchestratorInput, IntentType } from '../types/index.js'
import { LLMClient, LLMMessage } from '../llm/LLMClient.js'

export class IntentRecognizer {
  private llmClient: LLMClient
  private confidenceThreshold: number

  constructor(llmClient: LLMClient, confidenceThreshold: number = 0.7) {
    this.llmClient = llmClient
    this.confidenceThreshold = confidenceThreshold
  }

  /**
   * 识别意图
   */
  async recognize(input: OrchestratorInput): Promise<IntentRecognitionResult> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt()
      },
      {
        role: 'user',
        content: this.buildUserPrompt(input)
      }
    ]

    // 添加Few-shot示例
    const fewShotExamples = this.getFewShotExamples()
    for (const example of fewShotExamples) {
      messages.push({
        role: 'user',
        content: example.input
      })
      messages.push({
        role: 'assistant',
        content: JSON.stringify(example.output)
      })
    }

    // 添加当前输入
    messages.push({
      role: 'user',
      content: input.message
    })

    try {
      const response = await this.llmClient.chatWithSchema<IntentRecognitionResponse>(
        messages,
        this.getResponseSchema()
      )

      return this.parseResponse(response, input)
    } catch (error) {
      // LLM调用失败，返回CLARIFY
      return {
        intent: 'CLARIFY',
        confidence: 0.5,
        complexity: 'simple',
        extracted: {
          hasAttachment: input.attachments ? input.attachments.length > 0 : false,
          urgency: 'normal',
          keywords: []
        },
        clarifyQuestion: '抱歉，我没有理解您的需求，能否详细说明一下？'
      }
    }
  }

  /**
   * 生成System Prompt
   */
  private getSystemPrompt(): string {
    return `你是一个专利代理AI助手的中枢意图识别专家。

## 你的角色
你是用户输入的第一道关口，负责准确理解用户意图，为后续任务规划提供基础。

## 9种意图类型

### 核心业务意图（6个）
1. **DRAFT_FULL** - 完整专利撰写
   - 特征：用户要求撰写完整的专利申请文件
   - 关键词："撰写专利"、"写专利"、"申请专利"、"完整"、"全套"
   - 提取：发明名称、技术领域、申请人信息
   - 复杂度：complex

2. **DRAFT_CLAIMS** - 仅撰写/修改权利要求
   - 特征：明确提到"权利要求"、"权要"、" Claims"
   - 关键词："权利要求"、"权要"、" Claims"、"保护范围"
   - 提取：权利要求数量、类型（独立/从属）
   - 复杂度：simple

3. **DRAFT_SPEC** - 仅撰写说明书
   - 特征：明确提到"说明书"、"具体实施方式"
   - 关键词："说明书"、"具体实施方式"、"背景技术"、"技术方案"
   - 提取：说明书章节要求
   - 复杂度：simple

4. **RESPOND_OA** - 审查意见答复
   - 特征：提到"审查意见"、"OA"、"答复"、"反驳"
   - 关键词："审查意见"、"OA"、"答复"、"审查员"、"驳回"
   - 提取：OA文件、审查意见类型
   - 复杂度：complex

5. **SEARCH** - 现有技术检索
   - 特征：明确要求检索、查找相关技术
   - 关键词："检索"、"搜索"、"查新"、"现有技术"、"相关技术"
   - 提取：检索关键词、技术领域、时间范围
   - 复杂度：simple

6. **ANALYZE_PORTFOLIO** - 专利组合分析
   - 特征：分析多个专利的组合情况
   - 关键词："专利组合"、"专利分析"、"技术布局"、"专利地图"
   - 提取：专利列表、分析维度
   - 复杂度：complex

### 系统意图（3个）
7. **MULTI_INTENT** - 一条消息包含多个任务
   - 特征：包含多个不同的任务需求
   - 判断：包含2个及以上核心意图的特征
   - 复杂度：complex

8. **CLARIFY** - 意图不明确，需要追问
   - 特征：信息不足，无法确定具体意图
   - 处理：生成追问语句
   - 复杂度：simple

9. **CHITCHAT** - 闲聊、感谢、询问功能
   - 特征：非业务相关的对话
   - 示例："你好"、"谢谢"、"你能做什么"、"介绍下自己"
   - 复杂度：simple

## 置信度评估标准
- **≥0.9**：非常确定，直接执行
- **0.7-0.9**：较确定，正常执行
- **<0.7**：不确定，进入CLARIFY流程

## 复杂度评估标准
- **simple**：可直接路由到单一Agent（DRAFT_CLAIMS, DRAFT_SPEC, SEARCH）
- **complex**：需要编排多步计划（DRAFT_FULL, RESPOND_OA, ANALYZE_PORTFOLIO, MULTI_INTENT）

## 关键信息提取
对于每个意图，提取以下信息：
- title: 发明名称或主题
- field: 技术领域
- hasAttachment: 是否有附件
- urgency: 紧急程度（normal/urgent）
- keywords: 关键词列表（3-10个）

## 输出格式
严格按照JSON Schema输出，不要添加任何额外的文字说明。`
  }

  /**
   * 构建用户提示
   */
  private buildUserPrompt(input: OrchestratorInput): string {
    let prompt = `用户消息：${input.message}`

    if (input.attachments && input.attachments.length > 0) {
      prompt += `\n\n附件：${input.attachments.length}个文件`
      input.attachments.forEach((att, index) => {
        prompt += `\n${index + 1}. ${att.filename} (${att.mimeType})`
      })
    }

    if (input.context) {
      prompt += `\n\n额外上下文：${JSON.stringify(input.context)}`
    }

    return prompt
  }

  /**
   * 获取Few-shot示例
   */
  private getFewShotExamples(): Array<{
    input: string
    output: IntentRecognitionResponse
  }> {
    return [
      {
        input: '帮我撰写一个关于智能控制器的专利申请',
        output: {
          intent: 'DRAFT_FULL',
          confidence: 0.95,
          complexity: 'complex',
          extracted: {
            title: '智能控制器',
            field: '控制技术',
            hasAttachment: false,
            urgency: 'normal',
            keywords: ['智能控制器', '撰写', '专利申请']
          }
        }
      },
      {
        input: '帮我修改权利要求，增加从属权利要求',
        output: {
          intent: 'DRAFT_CLAIMS',
          confidence: 0.92,
          complexity: 'simple',
          extracted: {
            title: '',
            field: '',
            hasAttachment: false,
            urgency: 'normal',
            keywords: ['权利要求', '从属权利要求', '修改']
          }
        }
      },
      {
        input: '只写说明书部分，不要权利要求',
        output: {
          intent: 'DRAFT_SPEC',
          confidence: 0.90,
          complexity: 'simple',
          extracted: {
            title: '',
            field: '',
            hasAttachment: false,
            urgency: 'normal',
            keywords: ['说明书', '不要权利要求']
          }
        }
      },
      {
        input: '我收到了审查意见，需要帮忙答复',
        output: {
          intent: 'CLARIFY',
          confidence: 0.6,
          complexity: 'complex',
          extracted: {
            hasAttachment: false,
            urgency: 'normal',
            keywords: ['审查意见', '答复']
          },
          clarifyQuestion: '请问您是否已经上传了审查意见文件？如果已上传，我将自动分析审查意见并生成答复策略。'
        }
      },
      {
        input: '帮我检索一下智能控制器的现有技术',
        output: {
          intent: 'SEARCH',
          confidence: 0.93,
          complexity: 'simple',
          extracted: {
            title: '智能控制器',
            field: '控制技术',
            hasAttachment: false,
            urgency: 'normal',
            keywords: ['检索', '智能控制器', '现有技术']
          }
        }
      },
      {
        input: '分析我们公司的专利组合情况',
        output: {
          intent: 'ANALYZE_PORTFOLIO',
          confidence: 0.88,
          complexity: 'complex',
          extracted: {
            title: '',
            field: '',
            hasAttachment: false,
            urgency: 'normal',
            keywords: ['专利组合', '分析', '公司']
          }
        }
      },
      {
        input: '你好',
        output: {
          intent: 'CHITCHAT',
          confidence: 0.98,
          complexity: 'simple',
          extracted: {
            hasAttachment: false,
            urgency: 'normal',
            keywords: ['你好']
          }
        }
      },
      {
        input: '谢谢你的帮助',
        output: {
          intent: 'CHITCHAT',
          confidence: 0.99,
          complexity: 'simple',
          extracted: {
            hasAttachment: false,
            urgency: 'normal',
            keywords: ['谢谢', '帮助']
          }
        }
      },
      {
        input: '你能做什么？',
        output: {
          intent: 'CHITCHAT',
          confidence: 0.96,
          complexity: 'simple',
          extracted: {
            hasAttachment: false,
            urgency: 'normal',
            keywords: ['能做什么', '功能']
          }
        }
      },
      {
        input: '先帮我检索现有技术，然后撰写完整的专利申请',
        output: {
          intent: 'MULTI_INTENT',
          confidence: 0.91,
          complexity: 'complex',
          extracted: {
            title: '',
            field: '',
            hasAttachment: false,
            urgency: 'normal',
            keywords: ['检索', '撰写', '专利申请']
          }
        }
      },
      {
        input: '这是一个关于新能源汽车的技术方案，帮我写专利',
        output: {
          intent: 'DRAFT_FULL',
          confidence: 0.94,
          complexity: 'complex',
          extracted: {
            title: '新能源汽车',
            field: '汽车技术',
            hasAttachment: true,
            urgency: 'normal',
            keywords: ['新能源汽车', '技术方案', '写专利']
          }
        }
      },
      {
        input: '紧急！需要今天完成专利撰写',
        output: {
          intent: 'DRAFT_FULL',
          confidence: 0.89,
          complexity: 'complex',
          extracted: {
            title: '',
            field: '',
            hasAttachment: false,
            urgency: 'urgent',
            keywords: ['紧急', '今天完成', '专利撰写']
          }
        }
      }
    ]
  }

  /**
   * 获取响应Schema
   */
  private getResponseSchema(): object {
    return {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: [
            'DRAFT_FULL',
            'DRAFT_CLAIMS',
            'DRAFT_SPEC',
            'RESPOND_OA',
            'SEARCH',
            'ANALYZE_PORTFOLIO',
            'MULTI_INTENT',
            'CLARIFY',
            'CHITCHAT'
          ]
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1
        },
        complexity: {
          type: 'string',
          enum: ['simple', 'complex']
        },
        extracted: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            field: { type: 'string' },
            hasAttachment: { type: 'boolean' },
            urgency: { type: 'string', enum: ['normal', 'urgent'] },
            keywords: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['hasAttachment', 'urgency', 'keywords']
        },
        clarifyQuestion: {
          type: 'string'
        }
      },
      required: ['intent', 'confidence', 'complexity', 'extracted']
    }
  }

  /**
   * 解析响应
   */
  private parseResponse(
    response: IntentRecognitionResponse,
    input: OrchestratorInput
  ): IntentRecognitionResult {
    // 如果置信度低于阈值，转换为CLARIFY
    if (response.confidence < this.confidenceThreshold && response.intent !== 'CLARIFY') {
      return {
        intent: 'CLARIFY',
        confidence: response.confidence,
        complexity: 'simple',
        extracted: response.extracted,
        clarifyQuestion: this.generateClarifyQuestion(response)
      }
    }

    // 确保有附件时正确标记
    if (input.attachments && input.attachments.length > 0) {
      response.extracted.hasAttachment = true
    }

    return response as IntentRecognitionResult
  }

  /**
   * 生成追问问题
   */
  private generateClarifyQuestion(response: IntentRecognitionResponse): string {
    const intent = response.intent
    const keywords = response.extracted.keywords

    switch (intent) {
      case 'DRAFT_FULL':
        return `我注意到您想要撰写专利申请（关键词：${keywords.join('、')}）。请问您是否已经准备好了技术交底书或相关材料？`
      case 'DRAFT_CLAIMS':
        return `我注意到您想要修改权利要求。请问您是要增加新的权利要求，还是修改现有的权利要求？`
      case 'DRAFT_SPEC':
        return `我注意到您想要撰写说明书。请问您需要撰写哪些章节？背景技术、发明内容、具体实施方式等。`
      case 'RESPOND_OA':
        return `请问您是否已经上传了审查意见文件？如果已上传，我将自动分析并生成答复策略。`
      case 'SEARCH':
        return `我注意到您想要检索现有技术（关键词：${keywords.join('、')}）。请问您需要检索哪个技术领域？有时间范围要求吗？`
      case 'ANALYZE_PORTFOLIO':
        return `我注意到您想要分析专利组合。请问您需要分析哪些专利？可以提供专利列表或专利号吗？`
      default:
        return '抱歉，我没有完全理解您的需求，能否详细说明一下您想要做什么？'
    }
  }
}

/**
 * 意图识别响应（内部使用）
 */
interface IntentRecognitionResponse {
  intent: IntentType
  confidence: number
  complexity: 'simple' | 'complex'
  extracted: {
    title?: string
    field?: string
    hasAttachment: boolean
    urgency: 'normal' | 'urgent'
    keywords: string[]
  }
  clarifyQuestion?: string
}
