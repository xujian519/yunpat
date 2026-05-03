import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger } from '../logger.js'

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('should create logger with context', () => {
    const logger = createLogger('TestContext')
    expect(logger).toBeDefined()
  })

  it('should log info messages', () => {
    const logger = createLogger('TestContext')
    logger.info('Test info message')
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('should log success messages', () => {
    const logger = createLogger('TestContext')
    logger.success('Test success message')
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('should log warning messages', () => {
    const logger = createLogger('TestContext')
    logger.warning('Test warning message')
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('should log data messages', () => {
    const logger = createLogger('TestContext')
    logger.data('Key', 'Value')
    expect(consoleSpy).toHaveBeenCalled()
  })
})
