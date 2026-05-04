/**
 * 技术图纸识别智能体
 *
 * 专门用于技术图纸的识别和提取，包括：
 * 1. 说明书附图识别（OCR）
 * 2. 化学结构识别（SMILES格式）
 * 3. 数学公式识别（LaTeX格式）
 * 4. 电学符号识别
 *
 * 特性：
 * - 复用ChemicalStructureTool（Phase 1新增）
 * - 复用MathFormulaTool（Phase 1新增）
 * - 复用OcrTools
 * - 自动识别图纸类型
 * - TDD方式（测试驱动开发）
 */

import {
  Agent,
  type EventBus,
  type MemoryStore,
  type ToolRegistry,
  type LLMAdapter,
  type ExecutionContext,
} from '@yunpat/core'
import { ChemicalStructureTool } from '@yunpat/image-tools'
import { MathFormulaTool } from '@yunpat/image-tools'

/**
 * 图纸识别输入
 */
export interface DrawingRecognitionInput {
  /** 图片路径或Base64数据 */
  imageData: string

  /** 图片格式 */
  imageFormat?: 'png' | 'jpg' | 'jpeg'

  /** 图纸类型（自动检测如果未指定） */
  drawingType?: 'general' | 'chemical' | 'math' | 'electrical'

  /** 是否自动检测类型 */
  autoDetect?: boolean
}

/**
 * 图纸识别输出
 */
export interface DrawingRecognitionOutput {
  /** 识别是否成功 */
  success: boolean

  /** 检测到的图纸类型 */
  detectedType: 'general' | 'chemical' | 'math' | 'electrical'

  /** OCR文本（通用图纸） */
  ocrText?: string

  /** 化学结构（化学图纸） */
  chemicalStructure?: {
    smiles: string
    confidence: number
    format: string
  }

  /** 数学公式（数学图纸） */
  mathFormula?: {
    latex: string
    confidence: number
  }

  /** 图纸元素列表 */
  elements: Array<{
    type: string
    position: { x: number; y: number }
    content: string
    confidence?: number
  }>

  /** 识别耗时（毫秒） */
  recognitionTimeMs: number
}

/**
 * 图纸识别计划
 */
interface DrawingRecognitionPlan {
  input: DrawingRecognitionInput
  detectedType: 'general' | 'chemical' | 'math' | 'electrical'
}

/**
 * 技术图纸识别智能体
 */
export class TechnicalDrawingAgent extends Agent<
  DrawingRecognitionInput,
  DrawingRecognitionOutput
> {
  private chemicalTool: ChemicalStructureTool
  private mathTool: MathFormulaTool

  constructor(config: {
    name: string
    description: string
    eventBus: EventBus
    memory: MemoryStore
    tools: ToolRegistry
    llm: LLMAdapter
  }) {
    super(config)
    this.chemicalTool = new ChemicalStructureTool()
    this.mathTool = new MathFormulaTool()
  }

  /**
   * 规划阶段：检测图纸类型
   */
  protected async plan(
    input: DrawingRecognitionInput,
    _context: ExecutionContext
  ): Promise<DrawingRecognitionPlan> {
    console.log('\n🔍 [图纸识别] 步骤1: 规划阶段')
    console.log(`   图片格式: ${input.imageFormat || 'png'}`)

    // 检测图纸类型
    const detectedType =
      input.drawingType || (input.autoDetect ? await this.detectDrawingType(input) : 'general')

    console.log(`   检测到图纸类型: ${detectedType}`)

    return {
      input,
      detectedType,
    }
  }

  /**
   * 执行阶段：识别图纸内容
   */
  protected async act(
    plan: DrawingRecognitionPlan,
    context: ExecutionContext
  ): Promise<DrawingRecognitionOutput> {
    console.log('\n🔎 [图纸识别] 步骤2: 执行阶段')

    const startTime = Date.now()
    const input = plan.input
    const detectedType = plan.detectedType

    try {
      const result: DrawingRecognitionOutput = {
        success: false,
        detectedType,
        elements: [],
        recognitionTimeMs: 0,
      }

      // 根据图纸类型选择识别策略
      switch (detectedType) {
        case 'chemical':
          await this.recognizeChemicalStructure(input, result, context)
          break
        case 'math':
          await this.recognizeMathFormula(input, result, context)
          break
        case 'electrical':
          await this.recognizeElectricalSymbols(input, result, context)
          break
        case 'general':
        default:
          await this.recognizeGeneralDrawing(input, result, context)
          break
      }

      result.recognitionTimeMs = Date.now() - startTime
      result.success = true

      console.log(`\n✅ [图纸识别] 完成 (耗时: ${result.recognitionTimeMs}ms)`)
      console.log(`   识别到 ${result.elements.length} 个元素`)

      return result
    } catch (error) {
      console.error(
        `\n❌ [图纸识别] 失败: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }

  /**
   * 检测图纸类型
   */
  private async detectDrawingType(
    input: DrawingRecognitionInput
  ): Promise<'general' | 'chemical' | 'math' | 'electrical'> {
    // 简单的启发式检测
    // 实际项目中可能需要更复杂的算法或ML模型

    const imageData = input.imageData.toLowerCase()

    // 检测化学结构特征
    if (
      imageData.includes('benzene') ||
      imageData.includes('molecule') ||
      imageData.includes('chemical') ||
      imageData.includes('structure')
    ) {
      return 'chemical'
    }

    // 检测数学公式特征
    if (
      imageData.includes('formula') ||
      imageData.includes('equation') ||
      imageData.includes('math') ||
      imageData.includes('integral') ||
      imageData.includes('fraction') ||
      imageData.includes('sqrt')
    ) {
      return 'math'
    }

    // 检测电学符号特征
    if (
      imageData.includes('circuit') ||
      imageData.includes('electrical') ||
      imageData.includes('schematic') ||
      imageData.includes('resistor') ||
      imageData.includes('capacitor')
    ) {
      return 'electrical'
    }

    // 默认为通用图纸
    return 'general'
  }

  /**
   * 识别化学结构
   */
  private async recognizeChemicalStructure(
    input: DrawingRecognitionInput,
    result: DrawingRecognitionOutput,
    context: ExecutionContext
  ): Promise<void> {
    console.log('\n🧪 [化学结构识别] 正在识别化学结构...')

    try {
      const chemicalResult = await this.chemicalTool.execute(
        {
          imageData: input.imageData,
          imageFormat: input.imageFormat || 'png',
          outputFormat: 'smiles',
        },
        context
      )

      if (chemicalResult.success && chemicalResult.structure) {
        result.chemicalStructure = {
          smiles: chemicalResult.structure,
          confidence: chemicalResult.confidence || 0,
          format: chemicalResult.format,
        }

        result.elements.push({
          type: 'chemical_structure',
          position: { x: 0, y: 0 },
          content: chemicalResult.structure,
          confidence: chemicalResult.confidence,
        })

        console.log(`   识别成功: ${chemicalResult.structure}`)
        console.log(`   置信度: ${chemicalResult.confidence}`)
      }
    } catch (error) {
      console.warn(`   化学结构识别失败: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * 识别数学公式
   */
  private async recognizeMathFormula(
    input: DrawingRecognitionInput,
    result: DrawingRecognitionOutput,
    context: ExecutionContext
  ): Promise<void> {
    console.log('\n📐 [数学公式识别] 正在识别数学公式...')

    try {
      const mathResult = await this.mathTool.execute(
        {
          imageData: input.imageData,
          imageFormat: input.imageFormat || 'png',
        },
        context
      )

      if (mathResult.success && mathResult.latex) {
        result.mathFormula = {
          latex: mathResult.latex,
          confidence: mathResult.confidence || 0,
        }

        result.elements.push({
          type: 'math_formula',
          position: { x: 0, y: 0 },
          content: mathResult.latex,
          confidence: mathResult.confidence,
        })

        console.log(`   识别成功: ${mathResult.latex}`)
        console.log(`   置信度: ${mathResult.confidence}`)
      }
    } catch (error) {
      console.warn(`   数学公式识别失败: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * 识别电学符号
   */
  private async recognizeElectricalSymbols(
    _input: DrawingRecognitionInput,
    result: DrawingRecognitionOutput,
    _context: ExecutionContext
  ): Promise<void> {
    console.log('\n⚡ [电学符号识别] 正在识别电学符号...')

    // TODO: 实现电学符号识别
    // 当前为占位实现
    console.log('   电学符号识别功能待实现')

    result.elements.push({
      type: 'electrical_symbol',
      position: { x: 0, y: 0 },
      content: '电学符号识别功能待实现',
    })
  }

  /**
   * 识别通用图纸（OCR）
   */
  private async recognizeGeneralDrawing(
    _input: DrawingRecognitionInput,
    result: DrawingRecognitionOutput,
    _context: ExecutionContext
  ): Promise<void> {
    console.log('\n📄 [通用图纸识别] 正在进行OCR识别...')

    // TODO: 集成OcrTools
    // 当前为占位实现
    console.log('   OCR识别功能待实现')

    result.ocrText = 'OCR识别功能待实现'

    result.elements.push({
      type: 'text',
      position: { x: 0, y: 0 },
      content: 'OCR识别功能待实现',
    })
  }
}
