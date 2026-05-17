import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AudioTranscriptionTool,
  AudioToSrtTool,
  AudioToVttTool,
  AudioToMarkdownTool,
} from '../../src/tools/AudioTools.js'
import { ToolCategory } from '@yunpat/core'

vi.mock('nodejs-whisper', () => ({
  default: vi.fn(() =>
    Promise.resolve({
      text: 'Transcribed audio text',
    })
  ),
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    statSync: vi.fn(() => ({ size: 10240 })),
    readFileSync: vi.fn(() => Buffer.from('mock audio')),
  }
})

const mockContext: any = {
  registry: {},
  llm: {
    chat: vi.fn(),
    chatStream: vi.fn(),
    embed: vi.fn(),
  } as unknown as import('@yunpat/core').LLMAdapter,
  memory: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    getAll: vi.fn(),
    setAll: vi.fn(),
    clear: vi.fn(),
    search: vi.fn(),
  },
  eventBus: { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), request: vi.fn() },
}

describe('AudioTools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AudioTranscriptionTool', () => {
    it('has correct metadata', () => {
      const tool = new AudioTranscriptionTool()
      expect(tool.metadata.name).toBe('audio_transcribe')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
      expect(tool.metadata.isConcurrencySafe).toBe(false)
      expect(tool.metadata.permissions).toContain('fs:read')
    })

    it('transcribes audio file', async () => {
      const tool = new AudioTranscriptionTool()
      const result = await tool.execute({ audioPath: '/mock/test.mp3' }, mockContext)
      expect(result.text).toBe('Transcribed audio text')
      expect(result.language).toBe('auto-detected')
      expect(result.processingTime).toBeGreaterThanOrEqual(0)
    })

    it('throws error when file does not exist', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValueOnce(false)
      const tool = new AudioTranscriptionTool()
      await expect(tool.execute({ audioPath: '/nonexistent.mp3' }, mockContext)).rejects.toThrow(
        '音频文件不存在'
      )
    })
  })

  describe('AudioToSrtTool', () => {
    it('has correct metadata', () => {
      const tool = new AudioToSrtTool()
      expect(tool.metadata.name).toBe('audio_to_srt')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('generates SRT from transcription', async () => {
      const tool = new AudioToSrtTool()
      const result = await tool.execute({ audioPath: '/mock/test.mp3' }, mockContext)
      expect(result.srt).toBeDefined()
      expect(result.metadata.filename).toBe('test.mp3')
    })
  })

  describe('AudioToVttTool', () => {
    it('has correct metadata', () => {
      const tool = new AudioToVttTool()
      expect(tool.metadata.name).toBe('audio_to_vtt')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('generates VTT from audio', async () => {
      const tool = new AudioToVttTool()
      const result = await tool.execute({ audioPath: '/mock/test.mp3' }, mockContext)
      expect(result.vtt).toContain('WEBVTT')
      expect(result.metadata.filename).toBe('test.mp3')
    })
  })

  describe('AudioToMarkdownTool', () => {
    it('has correct metadata', () => {
      const tool = new AudioToMarkdownTool()
      expect(tool.metadata.name).toBe('audio_to_markdown')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('generates markdown from transcription', async () => {
      const tool = new AudioToMarkdownTool()
      const result = await tool.execute({ audioPath: '/mock/test.mp3' }, mockContext)
      expect(result.markdown).toContain('# 音频转写结果')
      expect(result.markdown).toContain('test.mp3')
      expect(result.markdown).toContain('Transcribed audio text')
    })

    it('includes timestamps when requested', async () => {
      const tool = new AudioToMarkdownTool()
      const result = await tool.execute(
        { audioPath: '/mock/test.mp3', includeTimestamps: true },
        mockContext
      )
      expect(result.markdown).toContain('# 音频转写结果')
    })
  })
})
