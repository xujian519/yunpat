/**
 * 音频转写工具
 *
 * 支持使用Whisper进行语音转文字
 */

import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core'
import { TranscriptionResult, TranscriptionOptions, DocumentType } from '../types/document.js'

// 动态导入
let whisper: any

async function loadWhisper() {
  if (!whisper) {
    try {
      const module = await import('nodejs-whisper')
      whisper = module.default || module
    } catch (error) {
      throw new Error('nodejs-whisper未安装。请运行: npm install nodejs-whisper')
    }
  }
}

/**
 * 音频转写工具
 */
export class AudioTranscriptionTool extends EnhancedBaseTool<
  {
    audioPath: string
    language?: string
    translateToEnglish?: boolean
    outputFormat?: 'text' | 'srt' | 'vtt' | 'json'
  },
  TranscriptionResult
> {
  readonly metadata = {
    name: 'audio_transcribe',
    description: '将音频文件转写为文字（使用Whisper模型）',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: false, // Whisper需要GPU资源，不建议并发
    inputSchema: z.object({
      audioPath: z.string().describe('音频文件路径（MP3、WAV、M4A等）'),
      language: z.string().optional().describe('语言代码（如zh、en等），默认自动检测'),
      translateToEnglish: z.boolean().optional().default(false).describe('是否翻译成英文'),
      outputFormat: z
        .enum(['text', 'srt', 'vtt', 'json'])
        .optional()
        .default('text')
        .describe('输出格式'),
    }),
    outputSchema: z.object({
      text: z.string().describe('转写文本'),
      segments: z
        .array(
          z.object({
            id: z.number(),
            start: z.number(),
            end: z.number(),
            text: z.string(),
          })
        )
        .optional(),
      language: z.string().describe('检测到的语言'),
      processingTime: z.number().describe('处理时长（秒）'),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: {
      audioPath: string
      language?: string
      translateToEnglish?: boolean
      outputFormat?: 'text' | 'srt' | 'vtt' | 'json'
    },
    _context: ToolContext
  ): Promise<TranscriptionResult> {
    await loadWhisper()

    // 检查文件是否存在
    if (!fs.existsSync(input.audioPath)) {
      throw new Error(`音频文件不存在: ${input.audioPath}`)
    }

    const startTime = Date.now()

    // 使用Whisper进行转写
    try {
      const transcript = await whisper(input.audioPath, {
        language: input.language,
        model: 'base', // 使用基础模型，可配置为tiny、small、medium、large
        task: input.translateToEnglish ? 'translate' : 'transcribe',
      })

      const processingTime = (Date.now() - startTime) / 1000

      return {
        text: transcript.text || transcript,
        language: input.language || 'auto-detected',
        processingTime,
      }
    } catch (error) {
      throw new Error(`音频转写失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

/**
 * 音频转SRT字幕工具
 */
export class AudioToSrtTool extends EnhancedBaseTool<
  {
    audioPath: string
    language?: string
  },
  {
    srt: string
    metadata: {
      filename: string
      duration: number
      language: string
    }
  }
> {
  readonly metadata = {
    name: 'audio_to_srt',
    description: '将音频文件转写为SRT字幕格式',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: false,
    inputSchema: z.object({
      audioPath: z.string().describe('音频文件路径'),
      language: z.string().optional().describe('语言代码'),
    }),
    outputSchema: z.object({
      srt: z.string().describe('SRT字幕内容'),
      metadata: z.object({
        filename: z.string(),
        duration: z.number(),
        language: z.string(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: { audioPath: string; language?: string },
    context: ToolContext
  ): Promise<{ srt: string; metadata: any }> {
    const transcribeTool = new AudioTranscriptionTool()
    const result = await transcribeTool.execute(
      {
        audioPath: input.audioPath,
        language: input.language,
        outputFormat: 'json',
      },
      context
    )

    // 如果有分段信息，生成SRT格式
    if (result.segments && result.segments.length > 0) {
      const srt = this.generateSrt(result.segments)
      return {
        srt,
        metadata: {
          filename: path.basename(input.audioPath),
          duration: result.processingTime,
          language: result.language,
        },
      }
    }

    // 如果没有分段信息，生成简单的SRT
    const lines = result.text.split('\n').filter((line) => line.trim())
    const srt = lines
      .map((line, index) => {
        const startTime = index * 3 // 假设每行3秒
        const endTime = (index + 1) * 3
        return `${index + 1}\n${this.formatTime(startTime)} --> ${this.formatTime(endTime)}\n${line}\n`
      })
      .join('\n')

    return {
      srt,
      metadata: {
        filename: path.basename(input.audioPath),
        duration: result.processingTime,
        language: result.language,
      },
    }
  }

  /**
   * 生成SRT格式
   */
  private generateSrt(
    segments: Array<{ id: number; start: number; end: number; text: string }>
  ): string {
    return segments
      .map((seg) => {
        return `${seg.id}\n${this.formatTime(seg.start)} --> ${this.formatTime(seg.end)}\n${seg.text}\n`
      })
      .join('\n')
  }

  /**
   * 格式化时间为SRT格式
   */
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')},${ms.toString().padStart(3, '0')}`
  }
}

/**
 * 音频转VTT字幕工具
 */
export class AudioToVttTool extends EnhancedBaseTool<
  {
    audioPath: string
    language?: string
  },
  {
    vtt: string
    metadata: {
      filename: string
      duration: number
      language: string
    }
  }
> {
  readonly metadata = {
    name: 'audio_to_vtt',
    description: '将音频文件转写为VTT字幕格式（WebVTT）',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: false,
    inputSchema: z.object({
      audioPath: z.string().describe('音频文件路径'),
      language: z.string().optional().describe('语言代码'),
    }),
    outputSchema: z.object({
      vtt: z.string().describe('VTT字幕内容'),
      metadata: z.object({
        filename: z.string(),
        duration: z.number(),
        language: z.string(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: { audioPath: string; language?: string },
    context: ToolContext
  ): Promise<{ vtt: string; metadata: any }> {
    const srtTool = new AudioToSrtTool()
    const { srt } = await srtTool.execute(input, context)

    // 将SRT转换为VTT格式
    let vtt = 'WEBVTT\n\n'

    // 简单的SRT到VTT转换（将逗号改为点）
    vtt += srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')

    return {
      vtt,
      metadata: {
        filename: path.basename(input.audioPath),
        duration: 0, // VTT工具没有duration信息
        language: input.language || 'unknown',
      },
    }
  }
}

/**
 * 音频转Markdown工具
 */
export class AudioToMarkdownTool extends EnhancedBaseTool<
  {
    audioPath: string
    language?: string
    includeTimestamps?: boolean
  },
  {
    markdown: string
    metadata: {
      filename: string
      duration: number
      language: string
    }
  }
> {
  readonly metadata = {
    name: 'audio_to_markdown',
    description: '将音频文件转写为Markdown格式',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: false,
    inputSchema: z.object({
      audioPath: z.string().describe('音频文件路径'),
      language: z.string().optional().describe('语言代码'),
      includeTimestamps: z.boolean().optional().default(false).describe('是否包含时间戳'),
    }),
    outputSchema: z.object({
      markdown: z.string().describe('Markdown内容'),
      metadata: z.object({
        filename: z.string(),
        duration: z.number(),
        language: z.string(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: { audioPath: string; language?: string; includeTimestamps?: boolean },
    context: ToolContext
  ): Promise<{ markdown: string; metadata: any }> {
    const transcribeTool = new AudioTranscriptionTool()
    const result = await transcribeTool.execute(
      {
        audioPath: input.audioPath,
        language: input.language,
        outputFormat: 'json',
      },
      context
    )

    let markdown = `# 音频转写结果\n\n`
    markdown += `**文件名**: ${path.basename(input.audioPath)}\n`
    markdown += `**语言**: ${result.language}\n`
    markdown += `**处理时长**: ${result.processingTime.toFixed(2)}秒\n\n`
    markdown += `---\n\n`

    if (input.includeTimestamps && result.segments && result.segments.length > 0) {
      for (const segment of result.segments) {
        const timestamp = this.formatTimestamp(segment.start)
        markdown += `**[${timestamp}]** ${segment.text}\n\n`
      }
    } else {
      markdown += result.text
    }

    return {
      markdown,
      metadata: {
        filename: path.basename(input.audioPath),
        duration: result.processingTime,
        language: result.language,
      },
    }
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
}
