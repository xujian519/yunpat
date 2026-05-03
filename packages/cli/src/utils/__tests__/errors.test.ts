import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CLIError, handleError } from '../errors.js'

describe('Error Handling', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let processExitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  it('should create CLIError with code and suggestions', () => {
    const error = new CLIError('Test error', 'TEST_ERROR', ['Suggestion 1', 'Suggestion 2'])

    expect(error.message).toBe('Test error')
    expect(error.code).toBe('TEST_ERROR')
    expect(error.suggestions).toEqual(['Suggestion 1', 'Suggestion 2'])
  })

  it('should handle CLIError and display suggestions', () => {
    const error = new CLIError('Test error', 'TEST_ERROR', ['Suggestion 1'])

    expect(() => {
      handleError(error)
    }).toThrow('process.exit called')

    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('should handle standard Error', () => {
    const error = new Error('Standard error')

    expect(() => {
      handleError(error)
    }).toThrow('process.exit called')

    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('should handle unknown errors', () => {
    expect(() => {
      handleError('Unknown error')
    }).toThrow('process.exit called')

    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})
